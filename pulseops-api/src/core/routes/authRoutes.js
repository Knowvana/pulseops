// ============================================================================
// Auth Routes — PulseOps API
//
// PURPOSE: Authentication endpoints. Database auth (email/password) with
// a placeholder for future OpenID Connect integration. Single login
// endpoint for all roles — the backend determines role from DB.
//
// ENDPOINTS:
//   POST /api/auth/login     — Authenticate with email + password
//   GET  /api/auth/me        — Get current authenticated user profile
// ============================================================================
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createRequire } from 'module';
import { User } from '../database/models/index.js';
import { authenticate } from '../middleware/auth.js';
import logger, { msg, logMessages } from '../logger.js';

const require = createRequire(import.meta.url);
const appConfig = require('../../config/app.json');
const defaultUsers = require('../../config/defaultUsers.json');

const router = Router();

/**
 * Authenticate against database or fallback to JSON file if DB unavailable
 */
async function authenticateUser(email, password) {
  try {
    // Try database first
    const user = await User.findOne({ where: { email, status: 'active' } });
    if (user) {
      const isValid = await user.validatePassword(password);
      if (isValid) {
        return { success: true, user: user.toSafeJSON(), source: 'database' };
      }
    }
  } catch (err) {
    logger.warn('Database auth failed, falling back to JSON', { error: err.message });
  }

  // Fallback to JSON file if DB unavailable
  const jsonUser = defaultUsers.users.find(u => u.email === email);
  if (jsonUser && jsonUser.password === password) {
    return { success: true, user: jsonUser, source: 'json' };
  }

  return { success: false, user: null, source: null };
}

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email and password
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200: { description: Login successful }
 *       401: { description: Invalid credentials }
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    logger.info(msg(logMessages.auth.loginAttempt, { email }));

    if (!email || !password) {
      return res.status(400).json({ success: false, error: { message: 'Email and password are required', code: 'VALIDATION_ERROR' } });
    }

    const authResult = await authenticateUser(email, password);
    if (!authResult.success) {
      logger.warn(msg(logMessages.auth.loginFailed, { email }));
      return res.status(401).json({ success: false, error: { message: 'Invalid email or password', code: 'AUTH_FAILED' } });
    }

    const user = authResult.user;
    const tokenPayload = { id: user.id, email: user.email, name: user.name, role: user.role };
    const token = jwt.sign(tokenPayload, appConfig.jwt.secret, { expiresIn: appConfig.jwt.expiresIn });
    const refreshToken = jwt.sign({ id: user.id }, appConfig.jwt.secret, { expiresIn: appConfig.jwt.refreshExpiresIn });

    logger.info(msg(logMessages.auth.loginSuccess, { email }));
    logger.info(msg(logMessages.auth.tokenGenerated, { userId: user.id, source: authResult.source }));

    res.json({
      success: true,
      data: {
        user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status },
        token,
        refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// OPENID CONNECT PLACEHOLDER
//
// When implementing OIDC:
//   POST /api/auth/oidc/callback — Exchange authorization code for tokens
//   GET  /api/auth/oidc/authorize — Redirect to IdP authorization URL
//
// The frontend will redirect to the IdP, which redirects back with a code.
// The backend validates the code, fetches user info from the IdP, creates
// or updates the user in the database, and returns a JWT as usual.
// ============================================================================

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current authenticated user profile
 *     responses:
 *       200: { description: Current user profile }
 *       401: { description: Not authenticated }
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: { message: 'User not found', code: 'NOT_FOUND' } });
    }
    res.json({ success: true, data: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

export default router;
