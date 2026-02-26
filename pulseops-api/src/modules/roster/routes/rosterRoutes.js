// ============================================================================
// Roster Routes — PulseOps API
//
// PURPOSE: Full CRUD endpoints for the ShiftRoaster module. Manages
// shifts, employees, leaves, schedules, and roster configuration.
// Includes a current-shift endpoint for the dashboard header.
//
// ARCHITECTURE: All endpoints require authentication. Write operations
// require admin or manager role. Data is persisted in shiftroaster_*
// tables in PostgreSQL, surviving Kubernetes pod restarts.
//
// ENDPOINTS:
//   --- Shifts ---
//   GET    /api/roster/shifts            — List all shifts
//   POST   /api/roster/shifts            — Create a shift
//   PUT    /api/roster/shifts/:id        — Update a shift
//   DELETE /api/roster/shifts/:id        — Delete a shift
//   --- Employees ---
//   GET    /api/roster/employees         — List all employees
//   POST   /api/roster/employees         — Create an employee
//   PUT    /api/roster/employees/:id     — Update an employee
//   DELETE /api/roster/employees/:id     — Delete an employee
//   --- Leaves ---
//   GET    /api/roster/leaves            — List leaves (filterable)
//   POST   /api/roster/leaves            — Create a leave
//   PUT    /api/roster/leaves/:id        — Update a leave
//   DELETE /api/roster/leaves/:id        — Delete a leave
//   --- Schedules ---
//   GET    /api/roster/schedule/:y/:m    — Get schedule for a month
//   PUT    /api/roster/schedule/:y/:m    — Save schedule for a month
//   DELETE /api/roster/schedule/:y/:m    — Delete schedule for a month
//   GET    /api/roster/schedules         — List all saved schedules
//   --- Config ---
//   GET    /api/roster/config            — Get active roster config
//   PUT    /api/roster/config            — Save roster config
//   --- Dashboard ---
//   GET    /api/roster/current-shift     — Get current active shift details
//   GET    /api/roster/stats             — Get module dashboard stats
//
// USED BY:
//   - Frontend ShiftRosterApp            — All roster UI views
//   - Frontend RosterDashboard           — Current shift header
//   - Frontend RosterConfig              — Shift/employee/leave CRUD
//   - Frontend RosterReports             — Compliance data
//
// INTEGRATION FLOW:
//   UI calls API → data from shiftroaster_* tables → rendered in views
// ============================================================================
import { Router } from 'express';
import { Op } from 'sequelize';
import {
  RosterSchedule, RosterConfig,
  ShiftRoasterShift, ShiftRoasterEmployee, ShiftRoasterLeave,
} from '../../../core/database/models/index.js';
import { authenticate, authorize } from '../../../core/middleware/auth.js';
import logger, { msg, logMessages } from '../../../core/logger.js';

const router = Router();

// ─── SHIFTS ─────────────────────────────────────────────────────────────────

router.get('/shifts', authenticate, async (req, res, next) => {
  try {
    const shifts = await ShiftRoasterShift.findAll({ where: { isActive: true }, order: [['order', 'ASC']] });
    res.json({ success: true, data: shifts });
  } catch (err) { next(err); }
});

router.post('/shifts', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { label, shortCode, startTime, endTime, color, reqWeekday, reqWeekend, order } = req.body;
    if (!label || !startTime || !endTime) {
      return res.status(400).json({ success: false, error: { message: 'Label, startTime, and endTime are required', code: 'VALIDATION_ERROR' } });
    }
    const shift = await ShiftRoasterShift.create({ label, shortCode, startTime, endTime, color, reqWeekday, reqWeekend, order });
    res.status(201).json({ success: true, data: shift });
  } catch (err) { next(err); }
});

router.put('/shifts/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const shift = await ShiftRoasterShift.findByPk(req.params.id);
    if (!shift) return res.status(404).json({ success: false, error: { message: 'Shift not found', code: 'NOT_FOUND' } });
    const fields = ['label', 'shortCode', 'startTime', 'endTime', 'color', 'reqWeekday', 'reqWeekend', 'order', 'isActive'];
    fields.forEach(f => { if (req.body[f] !== undefined) shift[f] = req.body[f]; });
    await shift.save();
    res.json({ success: true, data: shift });
  } catch (err) { next(err); }
});

router.delete('/shifts/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const shift = await ShiftRoasterShift.findByPk(req.params.id);
    if (!shift) return res.status(404).json({ success: false, error: { message: 'Shift not found', code: 'NOT_FOUND' } });
    await shift.destroy();
    res.json({ success: true, data: { message: 'Shift deleted' } });
  } catch (err) { next(err); }
});

// ─── EMPLOYEES ──────────────────────────────────────────────────────────────

router.get('/employees', authenticate, async (req, res, next) => {
  try {
    const where = {};
    if (req.query.active === 'true') where.isActive = true;
    const employees = await ShiftRoasterEmployee.findAll({ where, order: [['name', 'ASC']], include: [{ model: ShiftRoasterLeave, as: 'leaves' }] });
    res.json({ success: true, data: employees });
  } catch (err) { next(err); }
});

router.post('/employees', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { name, email, phone, role, skills, maxShiftsPerWeek, isShiftLead } = req.body;
    if (!name) return res.status(400).json({ success: false, error: { message: 'Name is required', code: 'VALIDATION_ERROR' } });
    const emp = await ShiftRoasterEmployee.create({ name, email, phone, role, skills, maxShiftsPerWeek, isShiftLead });
    res.status(201).json({ success: true, data: emp });
  } catch (err) { next(err); }
});

router.put('/employees/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const emp = await ShiftRoasterEmployee.findByPk(req.params.id);
    if (!emp) return res.status(404).json({ success: false, error: { message: 'Employee not found', code: 'NOT_FOUND' } });
    const fields = ['name', 'email', 'phone', 'role', 'skills', 'maxShiftsPerWeek', 'isShiftLead', 'isActive'];
    fields.forEach(f => { if (req.body[f] !== undefined) emp[f] = req.body[f]; });
    await emp.save();
    res.json({ success: true, data: emp });
  } catch (err) { next(err); }
});

router.delete('/employees/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const emp = await ShiftRoasterEmployee.findByPk(req.params.id);
    if (!emp) return res.status(404).json({ success: false, error: { message: 'Employee not found', code: 'NOT_FOUND' } });
    await ShiftRoasterLeave.destroy({ where: { employeeId: emp.id } });
    await emp.destroy();
    res.json({ success: true, data: { message: 'Employee deleted' } });
  } catch (err) { next(err); }
});

// ─── LEAVES ─────────────────────────────────────────────────────────────────

router.get('/leaves', authenticate, async (req, res, next) => {
  try {
    const where = {};
    if (req.query.employeeId) where.employeeId = req.query.employeeId;
    if (req.query.status) where.status = req.query.status;
    const leaves = await ShiftRoasterLeave.findAll({
      where,
      order: [['startDate', 'DESC']],
      include: [{ model: ShiftRoasterEmployee, as: 'employee', attributes: ['id', 'name', 'email'] }],
    });
    res.json({ success: true, data: leaves });
  } catch (err) { next(err); }
});

router.post('/leaves', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { employeeId, startDate, endDate, leaveType, reason } = req.body;
    if (!employeeId || !startDate || !endDate) {
      return res.status(400).json({ success: false, error: { message: 'employeeId, startDate, and endDate are required', code: 'VALIDATION_ERROR' } });
    }
    const leave = await ShiftRoasterLeave.create({ employeeId, startDate, endDate, leaveType, reason, approvedBy: req.user.id });
    res.status(201).json({ success: true, data: leave });
  } catch (err) { next(err); }
});

router.put('/leaves/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const leave = await ShiftRoasterLeave.findByPk(req.params.id);
    if (!leave) return res.status(404).json({ success: false, error: { message: 'Leave not found', code: 'NOT_FOUND' } });
    const fields = ['startDate', 'endDate', 'leaveType', 'reason', 'status'];
    fields.forEach(f => { if (req.body[f] !== undefined) leave[f] = req.body[f]; });
    if (req.body.status === 'approved') leave.approvedBy = req.user.id;
    await leave.save();
    res.json({ success: true, data: leave });
  } catch (err) { next(err); }
});

router.delete('/leaves/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const leave = await ShiftRoasterLeave.findByPk(req.params.id);
    if (!leave) return res.status(404).json({ success: false, error: { message: 'Leave not found', code: 'NOT_FOUND' } });
    await leave.destroy();
    res.json({ success: true, data: { message: 'Leave deleted' } });
  } catch (err) { next(err); }
});

// ─── SCHEDULES ──────────────────────────────────────────────────────────────

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

router.put('/schedule/:year/:month', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
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

router.delete('/schedule/:year/:month', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { year, month } = req.params;
    const deleted = await RosterSchedule.destroy({ where: { year: parseInt(year), month: parseInt(month) } });
    if (!deleted) return res.status(404).json({ success: false, error: { message: 'No schedule found', code: 'NOT_FOUND' } });
    logger.info(msg(logMessages.roster.scheduleDeleted, { year, month }));
    res.json({ success: true, data: { message: 'Schedule deleted' } });
  } catch (err) { next(err); }
});

router.get('/schedules', authenticate, async (req, res, next) => {
  try {
    const schedules = await RosterSchedule.findAll({
      attributes: ['id', 'year', 'month', 'metadata', 'createdAt', 'updatedAt'],
      order: [['year', 'DESC'], ['month', 'DESC']],
    });
    res.json({ success: true, data: schedules });
  } catch (err) { next(err); }
});

// ─── CONFIG (legacy JSONB blob) ─────────────────────────────────────────────

router.get('/config', authenticate, async (req, res, next) => {
  try {
    const config = await RosterConfig.findOne({ where: { isActive: true }, order: [['updatedAt', 'DESC']] });
    logger.info(logMessages.roster.configLoaded);
    res.json({ success: true, data: config || { shifts: [], employees: [], leaves: [] } });
  } catch (err) { next(err); }
});

router.put('/config', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
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
      config = await RosterConfig.create({ shifts: shifts || [], employees: employees || [], leaves: leaves || [], isActive: true, updatedBy: req.user.id });
    }
    logger.info(logMessages.roster.configSaved);
    res.json({ success: true, data: config });
  } catch (err) { next(err); }
});

// ─── DASHBOARD: Current Shift ───────────────────────────────────────────────

router.get('/current-shift', authenticate, async (req, res, next) => {
  try {
    const now = new Date();
    const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const shifts = await ShiftRoasterShift.findAll({ where: { isActive: true }, order: [['order', 'ASC']] });

    let currentShift = null;
    for (const s of shifts) {
      if (s.startTime <= s.endTime) {
        if (currentHHMM >= s.startTime && currentHHMM < s.endTime) { currentShift = s; break; }
      } else {
        if (currentHHMM >= s.startTime || currentHHMM < s.endTime) { currentShift = s; break; }
      }
    }

    const activeEmployees = await ShiftRoasterEmployee.count({ where: { isActive: true } });
    const todayLeaves = await ShiftRoasterLeave.count({
      where: {
        startDate: { [Op.lte]: now },
        endDate: { [Op.gte]: now },
        status: 'approved',
      },
    });
    const availableResources = activeEmployees - todayLeaves;

    // Find shift lead for current shift (first lead employee)
    let shiftLead = null;
    const leads = await ShiftRoasterEmployee.findAll({ where: { isShiftLead: true, isActive: true }, limit: 1 });
    if (leads.length > 0) shiftLead = leads[0].name;

    res.json({
      success: true,
      data: {
        currentShift: currentShift ? {
          id: currentShift.id,
          label: currentShift.label,
          startTime: currentShift.startTime,
          endTime: currentShift.endTime,
          color: currentShift.color,
        } : null,
        totalEmployees: activeEmployees,
        availableResources,
        onLeaveToday: todayLeaves,
        shiftLead,
        serverTime: now.toISOString(),
      },
    });
  } catch (err) { next(err); }
});

// ─── STATS (Module Dashboard) ───────────────────────────────────────────────

router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const totalShifts = await ShiftRoasterShift.count({ where: { isActive: true } });
    const totalEmployees = await ShiftRoasterEmployee.count({ where: { isActive: true } });
    const totalLeaves = await ShiftRoasterLeave.count();
    const pendingLeaves = await ShiftRoasterLeave.count({ where: { status: 'pending' } });
    const totalSchedules = await RosterSchedule.count();

    res.json({
      success: true,
      data: { totalShifts, totalEmployees, totalLeaves, pendingLeaves, totalSchedules },
    });
  } catch (err) { next(err); }
});

export default router;
