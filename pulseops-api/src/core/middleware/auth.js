// ============================================================================
// Auth Middleware — PulseOps API
//
// PURPOSE: JWT token verification and role-based access control (RBAC).
// Extracts the Bearer token from Authorization header, verifies it,
// and attaches the decoded user to req.user.
//
// ARCHITECTURE: Stateless middleware. Tokens are verified against the
// secret from app.json config. No session state — Kubernetes-safe.
// ============================================================================
import jwt from 'jsonwebtoken';
import { createRequire } from 'module';
import logger, { msg, logMessages } from '../logger.js';

const require = createRequire(import.meta.url);
const appConfig = require('../../config/app.json');

/**
 * Middleware: Verify JWT token and attach user to request.
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn(logMessages.auth.tokenMissing, { ip: req.ip, url: req.originalUrl });
    return res.status(401).json({ success: false, error: { message: 'Authentication required', code: 'AUTH_REQUIRED' } });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, appConfig.jwt.secret);
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn(logMessages.auth.tokenInvalid, { error: err.message, ip: req.ip });
    return res.status(401).json({ success: false, error: { message: 'Invalid or expired token', code: 'TOKEN_INVALID' } });
  }
}

/**
 * Middleware factory: Restrict access to specific roles.
 * @param  {...string} allowedRoles - Roles that can access the route
 */
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      logger.warn(msg(logMessages.auth.forbidden, {}), { userId: req.user?.id, role: req.user?.role, required: allowedRoles });
      return res.status(403).json({ success: false, error: { message: 'Insufficient permissions', code: 'FORBIDDEN' } });
    }
    next();
  };
}
