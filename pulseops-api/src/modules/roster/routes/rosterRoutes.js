// ============================================================================
// Roster Routes — PulseOps API
//
// PURPOSE: CRUD endpoints for the Shift Roster Planner module.
// Manages roster configurations (shifts, employees, leaves) and
// generated schedules (stored as JSONB per month).
//
// ENDPOINTS:
//   GET    /api/roster/config              — Get active roster config
//   PUT    /api/roster/config              — Save roster config
//   GET    /api/roster/schedule/:year/:month — Get schedule for a month
//   PUT    /api/roster/schedule/:year/:month — Save schedule for a month
//   DELETE /api/roster/schedule/:year/:month — Delete schedule for a month
//   GET    /api/roster/schedules            — List all saved schedules
// ============================================================================
import { Router } from 'express';
import { RosterSchedule, RosterConfig } from '../../../core/database/models/index.js';
import { authenticate } from '../../../core/middleware/auth.js';
import logger, { msg, logMessages } from '../../../core/logger.js';

const router = Router();

/**
 * @swagger
 * /roster/config:
 *   get:
 *     tags: [Roster]
 *     summary: Get the active roster configuration (shifts, employees, leaves)
 *     responses:
 *       200: { description: Active roster config }
 */
router.get('/config', authenticate, async (req, res, next) => {
  try {
    const config = await RosterConfig.findOne({ where: { isActive: true }, order: [['updatedAt', 'DESC']] });
    logger.info(logMessages.roster.configLoaded);
    res.json({ success: true, data: config || { shifts: [], employees: [], leaves: [] } });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /roster/config:
 *   put:
 *     tags: [Roster]
 *     summary: Save or update roster configuration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               shifts: { type: array }
 *               employees: { type: array }
 *               leaves: { type: array }
 *     responses:
 *       200: { description: Config saved }
 */
router.put('/config', authenticate, async (req, res, next) => {
  try {
    const { shifts, employees, leaves } = req.body;
    let config = await RosterConfig.findOne({ where: { isActive: true } });

    if (config) {
      config.shifts = shifts || config.shifts;
      config.employees = employees || config.employees;
      config.leaves = leaves || config.leaves;
      config.updatedBy = req.user.id;
      await config.save();
    } else {
      config = await RosterConfig.create({
        shifts: shifts || [],
        employees: employees || [],
        leaves: leaves || [],
        isActive: true,
        updatedBy: req.user.id,
      });
    }

    logger.info(logMessages.roster.configSaved);
    res.json({ success: true, data: config });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /roster/schedule/{year}/{month}:
 *   get:
 *     tags: [Roster]
 *     summary: Get a saved schedule for a specific month
 *     parameters:
 *       - in: path
 *         name: year
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: month
 *         required: true
 *         schema: { type: integer, minimum: 1, maximum: 12 }
 *     responses:
 *       200: { description: Schedule data }
 *       404: { description: No schedule found }
 */
router.get('/schedule/:year/:month', authenticate, async (req, res, next) => {
  try {
    const { year, month } = req.params;
    const schedule = await RosterSchedule.findOne({ where: { year: parseInt(year), month: parseInt(month) } });
    if (!schedule) {
      return res.status(404).json({ success: false, error: { message: 'No schedule found for this period', code: 'NOT_FOUND' } });
    }
    logger.info(msg(logMessages.roster.scheduleLoaded, { year, month }));
    res.json({ success: true, data: schedule });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /roster/schedule/{year}/{month}:
 *   put:
 *     tags: [Roster]
 *     summary: Save or update a schedule for a specific month
 *     parameters:
 *       - in: path
 *         name: year
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: month
 *         required: true
 *         schema: { type: integer, minimum: 1, maximum: 12 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               schedule: { type: object }
 *               metadata: { type: object }
 *     responses:
 *       200: { description: Schedule saved }
 */
router.put('/schedule/:year/:month', authenticate, async (req, res, next) => {
  try {
    const { year, month } = req.params;
    const { schedule, metadata } = req.body;

    const [record, created] = await RosterSchedule.findOrCreate({
      where: { year: parseInt(year), month: parseInt(month) },
      defaults: { schedule: schedule || {}, metadata: metadata || {}, createdBy: req.user.id },
    });

    if (!created) {
      record.schedule = schedule || record.schedule;
      record.metadata = metadata || record.metadata;
      await record.save();
    }

    logger.info(msg(logMessages.roster.scheduleSaved, { year, month }));
    res.json({ success: true, data: record });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /roster/schedule/{year}/{month}:
 *   delete:
 *     tags: [Roster]
 *     summary: Delete a saved schedule
 *     parameters:
 *       - in: path
 *         name: year
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: month
 *         required: true
 *         schema: { type: integer, minimum: 1, maximum: 12 }
 *     responses:
 *       200: { description: Schedule deleted }
 */
router.delete('/schedule/:year/:month', authenticate, async (req, res, next) => {
  try {
    const { year, month } = req.params;
    const deleted = await RosterSchedule.destroy({ where: { year: parseInt(year), month: parseInt(month) } });
    if (!deleted) {
      return res.status(404).json({ success: false, error: { message: 'No schedule found', code: 'NOT_FOUND' } });
    }
    logger.info(msg(logMessages.roster.scheduleDeleted, { year, month }));
    res.json({ success: true, data: { message: 'Schedule deleted' } });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /roster/schedules:
 *   get:
 *     tags: [Roster]
 *     summary: List all saved schedules (metadata only)
 *     responses:
 *       200: { description: List of schedules }
 */
router.get('/schedules', authenticate, async (req, res, next) => {
  try {
    const schedules = await RosterSchedule.findAll({
      attributes: ['id', 'year', 'month', 'metadata', 'createdAt', 'updatedAt'],
      order: [['year', 'DESC'], ['month', 'DESC']],
    });
    res.json({ success: true, data: schedules });
  } catch (err) { next(err); }
});

export default router;
