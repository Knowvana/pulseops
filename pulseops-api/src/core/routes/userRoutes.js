// ============================================================================
// User Routes — PulseOps API
//
// PURPOSE: CRUD endpoints for platform user management. Admin-only access
// for create/update/delete. Authenticated users can read their own profile.
//
// ENDPOINTS:
//   GET    /api/users         — List all users (admin)
//   GET    /api/users/stats   — User statistics (admin)
//   GET    /api/users/:id     — Get user by ID (admin)
//   POST   /api/users         — Create user (admin)
//   PUT    /api/users/:id     — Update user (admin)
//   DELETE /api/users/:id     — Delete user (admin)
// ============================================================================
import { Router } from 'express';
import { User } from '#core/database/models/index.js';
import { authenticate, authorize } from '#core/middleware/auth.js';
import logger, { msg, logMessages } from '#core/logger.js';

const router = Router();

/**
 * @swagger
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: List all platform users
 *     responses:
 *       200: { description: List of users }
 */
router.get('/', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const users = await User.findAll({ attributes: { exclude: ['password'] }, order: [['createdAt', 'DESC']] });
    logger.info(msg(logMessages.user.listFetched, { count: users.length }));
    res.json({ success: true, data: users });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /users/stats:
 *   get:
 *     tags: [Users]
 *     summary: Get user statistics
 *     responses:
 *       200: { description: User stats }
 */
router.get('/stats', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const total = await User.count();
    const active = await User.count({ where: { status: 'active' } });
    const inactive = await User.count({ where: { status: 'inactive' } });
    const admins = await User.count({ where: { role: 'admin' } });
    const managers = await User.count({ where: { role: 'manager' } });
    const users = await User.count({ where: { role: 'user' } });
    res.json({ success: true, data: { total, active, inactive, byRole: { admins, managers, users } } });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get user by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: User details }
 *       404: { description: User not found }
 */
router.get('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id, { attributes: { exclude: ['password'] } });
    if (!user) {
      logger.warn(msg(logMessages.user.notFound, { identifier: req.params.id }));
      return res.status(404).json({ success: false, error: { message: 'User not found', code: 'NOT_FOUND' } });
    }
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /users:
 *   post:
 *     tags: [Users]
 *     summary: Create a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string }
 *               role: { type: string, enum: [admin, manager, user] }
 *     responses:
 *       201: { description: User created }
 */
router.post('/', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, error: { message: 'All fields are required', code: 'VALIDATION_ERROR' } });
    }
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ success: false, error: { message: 'Email already exists', code: 'DUPLICATE' } });
    }
    const user = await User.create({ name, email, password, role, status: 'active' });
    logger.info(msg(logMessages.user.created, { email }));
    res.status(201).json({ success: true, data: user.toSafeJSON() });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     tags: [Users]
 *     summary: Update an existing user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: User updated }
 */
router.put('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: { message: 'User not found', code: 'NOT_FOUND' } });
    }
    const { name, email, role, status, password } = req.body;
    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (status) user.status = status;
    if (password) user.password = password;
    await user.save();
    logger.info(msg(logMessages.user.updated, { userId: user.id }));
    res.json({ success: true, data: user.toSafeJSON() });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Delete a user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: User deleted }
 */
router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: { message: 'User not found', code: 'NOT_FOUND' } });
    }
    await user.destroy();
    logger.info(msg(logMessages.user.deleted, { userId: req.params.id }));
    res.json({ success: true, data: { message: 'User deleted successfully' } });
  } catch (err) { next(err); }
});

export default router;
