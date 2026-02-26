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
} from '#core/database/models/index.js';
import { authenticate, authorize } from '#core/middleware/auth.js';
import logger, { msg, logMessages } from '#core/logger.js';

const router = Router();

// ─── SHIFTS ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /roster/shifts:
 *   get:
 *     tags: [Roster - Shifts]
 *     summary: Get all active shifts
 *     description: Retrieve a list of all active shifts ordered by their display order, with optional name filtering
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter shifts by name (exact match)
 *         example: "Morning Shift"
 *     responses:
 *       200:
 *         description: List of active shifts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         description: Shift unique identifier
 *                       label:
 *                         type: string
 *                         description: Shift display name
 *                         example: "Morning Shift"
 *                       shortCode:
 *                         type: string
 *                         description: Short code for the shift
 *                         example: "AM"
 *                       startTime:
 *                         type: string
 *                         format: time
 *                         description: Shift start time (HH:MM)
 *                         example: "09:00"
 *                       endTime:
 *                         type: string
 *                         format: time
 *                         description: Shift end time (HH:MM)
 *                         example: "17:00"
 *                       color:
 *                         type: string
 *                         description: Hex color code for UI display
 *                         example: "#3B82F6"
 *                       reqWeekday:
 *                         type: integer
 *                         description: Required staff count for weekdays
 *                         minimum: 0
 *                         example: 5
 *                       reqWeekend:
 *                         type: integer
 *                         description: Required staff count for weekends
 *                         minimum: 0
 *                         example: 3
 *                       order:
 *                         type: integer
 *                         description: Display order for shifts
 *                         example: 1
 *                       isActive:
 *                         type: boolean
 *                         description: Whether the shift is active
 *                         example: true
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Internal server error
 */
router.get('/shifts', authenticate, async (req, res, next) => {
  try {
    const where = { isActive: true };

    // Support name filtering for duplicate checking
    if (req.query.name) {
      where.label = req.query.name; // Exact match for duplicate validation
    }

    const shifts = await ShiftRoasterShift.findAll({ where, order: [['order', 'ASC']] });
    res.json({ success: true, data: shifts });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /roster/shifts:
 *   post:
 *     tags: [Roster - Shifts]
 *     summary: Create a new shift
 *     description: Create a new shift with the provided details. Requires admin or manager role.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - label
 *               - startTime
 *               - endTime
 *             properties:
 *               label:
 *                 type: string
 *                 description: Shift display name
 *                 minLength: 1
 *                 maxLength: 100
 *                 example: "Morning Shift"
 *               shortCode:
 *                 type: string
 *                 description: Short code for the shift
 *                 maxLength: 10
 *                 example: "AM"
 *               startTime:
 *                 type: string
 *                 format: time
 *                 description: Shift start time (HH:MM)
 *                 pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                 example: "09:00"
 *               endTime:
 *                 type: string
 *                 format: time
 *                 description: Shift end time (HH:MM)
 *                 pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                 example: "17:00"
 *               color:
 *                 type: string
 *                 description: Hex color code for UI display
 *                 pattern: '^#[0-9A-Fa-f]{6}$'
 *                 example: "#3B82F6"
 *               reqWeekday:
 *                 type: integer
 *                 description: Required staff count for weekdays
 *                 minimum: 0
 *                 maximum: 999
 *                 example: 5
 *               reqWeekend:
 *                 type: integer
 *                 description: Required staff count for weekends
 *                 minimum: 0
 *                 maximum: 999
 *                 example: 3
 *               order:
 *                 type: integer
 *                 description: Display order for shifts
 *                 minimum: 0
 *                 example: 1
 *     responses:
 *       201:
 *         description: Shift created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       description: New shift ID
 *                       example: 1
 *                     label:
 *                       type: string
 *                       example: "Morning Shift"
 *                     shortCode:
 *                       type: string
 *                       example: "AM"
 *                     startTime:
 *                       type: string
 *                       example: "09:00"
 *                     endTime:
 *                       type: string
 *                       example: "17:00"
 *                     color:
 *                       type: string
 *                       example: "#3B82F6"
 *                     reqWeekday:
 *                       type: integer
 *                       example: 5
 *                     reqWeekend:
 *                       type: integer
 *                       example: 3
 *                     order:
 *                       type: integer
 *                       example: 1
 *                     isActive:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: Validation error - Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Label, startTime, and endTime are required"
 *                     code:
 *                       type: string
 *                       example: "VALIDATION_ERROR"
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Admin or manager role required
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /roster/shifts/{id}:
 *   put:
 *     tags: [Roster - Shifts]
 *     summary: Update an existing shift
 *     description: Update shift details by ID. Requires admin or manager role.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Shift ID to update
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label:
 *                 type: string
 *                 description: Shift display name
 *                 minLength: 1
 *                 maxLength: 100
 *                 example: "Morning Shift"
 *               shortCode:
 *                 type: string
 *                 description: Short code for the shift
 *                 maxLength: 10
 *                 example: "AM"
 *               startTime:
 *                 type: string
 *                 format: time
 *                 description: Shift start time (HH:MM)
 *                 pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                 example: "09:00"
 *               endTime:
 *                 type: string
 *                 format: time
 *                 description: Shift end time (HH:MM)
 *                 pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                 example: "17:00"
 *               color:
 *                 type: string
 *                 description: Hex color code for UI display
 *                 pattern: '^#[0-9A-Fa-f]{6}$'
 *                 example: "#3B82F6"
 *               reqWeekday:
 *                 type: integer
 *                 description: Required staff count for weekdays
 *                 minimum: 0
 *                 maximum: 999
 *                 example: 5
 *               reqWeekend:
 *                 type: integer
 *                 description: Required staff count for weekends
 *                 minimum: 0
 *                 maximum: 999
 *                 example: 3
 *               order:
 *                 type: integer
 *                 description: Display order for shifts
 *                 minimum: 0
 *                 example: 1
 *               isActive:
 *                 type: boolean
 *                 description: Whether the shift is active
 *                 example: true
 *     responses:
 *       200:
 *         description: Shift updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   description: Updated shift object
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Admin or manager role required
 *       404:
 *         description: Shift not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Shift not found"
 *                     code:
 *                       type: string
 *                       example: "NOT_FOUND"
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /roster/shifts/{id}:
 *   delete:
 *     tags: [Roster - Shifts]
 *     summary: Delete a shift
 *     description: Soft delete a shift by setting isActive to false. Requires admin or manager role.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Shift ID to delete
 *         example: 1
 *     responses:
 *       200:
 *         description: Shift deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Shift deleted"
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Admin or manager role required
 *       404:
 *         description: Shift not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Shift not found"
 *                     code:
 *                       type: string
 *                       example: "NOT_FOUND"
 *       500:
 *         description: Internal server error
 */
router.delete('/shifts/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const shift = await ShiftRoasterShift.findByPk(req.params.id);
    if (!shift) return res.status(404).json({ success: false, error: { message: 'Shift not found', code: 'NOT_FOUND' } });
    await shift.destroy();
    res.json({ success: true, data: { message: 'Shift deleted' } });
  } catch (err) { next(err); }
});

// ─── EMPLOYEES ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /roster/employees:
 *   get:
 *     tags: [Roster - Employees]
 *     summary: Get all employees
 *     description: Retrieve a list of employees with optional filtering. Includes leave information.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: active
 *         schema:
 *           type: string
 *           enum: [true]
 *         description: Filter to only active employees
 *         example: true
 *     responses:
 *       200:
 *         description: List of employees retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         description: Employee unique identifier
 *                       name:
 *                         type: string
 *                         description: Employee full name
 *                         example: "John Doe"
 *                       email:
 *                         type: string
 *                         format: email
 *                         description: Employee email address
 *                         example: "john.doe@company.com"
 *                       phone:
 *                         type: string
 *                         description: Employee phone number
 *                         example: "+1-555-0123"
 *                       role:
 *                         type: string
 *                         description: Employee role/responsibility
 *                         example: "Nurse"
 *                       skills:
 *                         type: array
 *                         items:
 *                           type: string
 *                         description: Employee skills/certifications
 *                         example: ["CPR", "IV Therapy"]
 *                       maxShiftsPerWeek:
 *                         type: integer
 *                         description: Maximum shifts per week
 *                         minimum: 1
 *                         maximum: 7
 *                         example: 5
 *                       isShiftLead:
 *                         type: boolean
 *                         description: Whether employee is a shift lead
 *                         example: false
 *                       isActive:
 *                         type: boolean
 *                         description: Whether employee is active
 *                         example: true
 *                       leaves:
 *                         type: array
 *                         items:
 *                           type: object
 *                         description: Associated leave records
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Internal server error
 */
router.get('/employees', authenticate, async (req, res, next) => {
  try {
    const where = {};
    if (req.query.active === 'true') where.isActive = true;
    const employees = await ShiftRoasterEmployee.findAll({ where, order: [['name', 'ASC']], include: [{ model: ShiftRoasterLeave, as: 'leaves' }] });
    res.json({ success: true, data: employees });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /roster/employees:
 *   post:
 *     tags: [Roster - Employees]
 *     summary: Create a new employee
 *     description: Create a new employee record. Requires admin or manager role.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Employee full name
 *                 minLength: 1
 *                 maxLength: 100
 *                 example: "Jane Smith"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Employee email address
 *                 example: "jane.smith@company.com"
 *               phone:
 *                 type: string
 *                 description: Employee phone number
 *                 example: "+1-555-0124"
 *               role:
 *                 type: string
 *                 description: Employee role/responsibility
 *                 minLength: 1
 *                 maxLength: 50
 *                 example: "Registered Nurse"
 *               skills:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Employee skills/certifications
 *                 example: ["ACLS", "PALS"]
 *               maxShiftsPerWeek:
 *                 type: integer
 *                 description: Maximum shifts per week
 *                 minimum: 1
 *                 maximum: 7
 *                 example: 6
 *               isShiftLead:
 *                 type: boolean
 *                 description: Whether employee is a shift lead
 *                 example: true
 *     responses:
 *       201:
 *         description: Employee created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       description: New employee ID
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: "Jane Smith"
 *                     email:
 *                       type: string
 *                       example: "jane.smith@company.com"
 *                     phone:
 *                       type: string
 *                       example: "+1-555-0124"
 *                     role:
 *                       type: string
 *                       example: "Registered Nurse"
 *                     skills:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["ACLS", "PALS"]
 *                     maxShiftsPerWeek:
 *                       type: integer
 *                       example: 6
 *                     isShiftLead:
 *                       type: boolean
 *                       example: true
 *                     isActive:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: Validation error - Name is required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Name is required"
 *                     code:
 *                       type: string
 *                       example: "VALIDATION_ERROR"
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Admin or manager role required
 *       500:
 *         description: Internal server error
 */
router.post('/employees', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { name, email, phone, role, skills, maxShiftsPerWeek, isShiftLead } = req.body;
    if (!name) return res.status(400).json({ success: false, error: { message: 'Name is required', code: 'VALIDATION_ERROR' } });
    const emp = await ShiftRoasterEmployee.create({ name, email, phone, role, skills, maxShiftsPerWeek, isShiftLead });
    res.status(201).json({ success: true, data: emp });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /roster/employees/{id}:
 *   put:
 *     tags: [Roster - Employees]
 *     summary: Update an employee
 *     description: Update employee details by ID. Requires admin or manager role.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Employee ID to update
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Employee full name
 *                 minLength: 1
 *                 maxLength: 100
 *                 example: "Jane Smith"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Employee email address
 *                 example: "jane.smith@company.com"
 *               phone:
 *                 type: string
 *                 description: Employee phone number
 *                 example: "+1-555-0124"
 *               role:
 *                 type: string
 *                 description: Employee role/responsibility
 *                 minLength: 1
 *                 maxLength: 50
 *                 example: "Registered Nurse"
 *               skills:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Employee skills/certifications
 *                 example: ["ACLS", "PALS"]
 *               maxShiftsPerWeek:
 *                 type: integer
 *                 description: Maximum shifts per week
 *                 minimum: 1
 *                 maximum: 7
 *                 example: 6
 *               isShiftLead:
 *                 type: boolean
 *                 description: Whether employee is a shift lead
 *                 example: true
 *               isActive:
 *                 type: boolean
 *                 description: Whether employee is active
 *                 example: true
 *     responses:
 *       200:
 *         description: Employee updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   description: Updated employee object
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Admin or manager role required
 *       404:
 *         description: Employee not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Employee not found"
 *                     code:
 *                       type: string
 *                       example: "NOT_FOUND"
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /roster/employees/{id}:
 *   delete:
 *     tags: [Roster - Employees]
 *     summary: Delete an employee
 *     description: Delete an employee and all associated leave records. Requires admin or manager role.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Employee ID to delete
 *         example: 1
 *     responses:
 *       200:
 *         description: Employee deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Employee deleted"
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Admin or manager role required
 *       404:
 *         description: Employee not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Employee not found"
 *                     code:
 *                       type: string
 *                       example: "NOT_FOUND"
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /roster/leaves:
 *   get:
 *     tags: [Roster - Leaves]
 *     summary: Get all leaves
 *     description: Retrieve a list of leave records with optional filtering by employee ID or status. Includes employee information.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: employeeId
 *         schema:
 *           type: integer
 *         description: Filter leaves by employee ID
 *         example: 1
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *         description: Filter leaves by approval status
 *         example: approved
 *     responses:
 *       200:
 *         description: List of leaves retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         description: Leave unique identifier
 *                       employeeId:
 *                         type: integer
 *                         description: Employee who requested the leave
 *                         example: 1
 *                       startDate:
 *                         type: string
 *                         format: date
 *                         description: Leave start date
 *                         example: "2024-01-15"
 *                       endDate:
 *                         type: string
 *                         format: date
 *                         description: Leave end date
 *                         example: "2024-01-20"
 *                       leaveType:
 *                         type: string
 *                         description: Type of leave (vacation, sick, personal, etc.)
 *                         example: "vacation"
 *                       reason:
 *                         type: string
 *                         description: Reason for the leave request
 *                         example: "Family vacation"
 *                       status:
 *                         type: string
 *                         enum: [pending, approved, rejected]
 *                         description: Approval status of the leave request
 *                         example: "approved"
 *                       approvedBy:
 *                         type: integer
 *                         description: User ID who approved/rejected the leave
 *                         nullable: true
 *                         example: 2
 *                       employee:
 *                         type: object
 *                         description: Associated employee information
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 1
 *                           name:
 *                             type: string
 *                             example: "John Doe"
 *                           email:
 *                             type: string
 *                             example: "john.doe@company.com"
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /roster/leaves:
 *   post:
 *     tags: [Roster - Leaves]
 *     summary: Create a leave request
 *     description: Submit a new leave request. Requires admin or manager role.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - employeeId
 *               - startDate
 *               - endDate
 *             properties:
 *               employeeId:
 *                 type: integer
 *                 description: Employee requesting the leave
 *                 example: 1
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: Leave start date
 *                 example: "2024-01-15"
 *               endDate:
 *                 type: string
 *                 format: date
 *                 description: Leave end date
 *                 example: "2024-01-20"
 *               leaveType:
 *                 type: string
 *                 description: Type of leave
 *                 enum: [vacation, sick, personal, maternity, bereavement]
 *                 example: "vacation"
 *               reason:
 *                 type: string
 *                 description: Reason for the leave request
 *                 maxLength: 500
 *                 example: "Family vacation to Hawaii"
 *     responses:
 *       201:
 *         description: Leave request created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       description: New leave request ID
 *                       example: 1
 *                     employeeId:
 *                       type: integer
 *                       example: 1
 *                     startDate:
 *                       type: string
 *                       format: date
 *                       example: "2024-01-15"
 *                     endDate:
 *                       type: string
 *                       format: date
 *                       example: "2024-01-20"
 *                     leaveType:
 *                       type: string
 *                       example: "vacation"
 *                     reason:
 *                       type: string
 *                       example: "Family vacation to Hawaii"
 *                     status:
 *                       type: string
 *                       example: "pending"
 *                     approvedBy:
 *                       type: integer
 *                       nullable: true
 *                       example: null
 *       400:
 *         description: Validation error - Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "employeeId, startDate, and endDate are required"
 *                     code:
 *                       type: string
 *                       example: "VALIDATION_ERROR"
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Admin or manager role required
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /roster/leaves/{id}:
 *   put:
 *     tags: [Roster - Leaves]
 *     summary: Update a leave request
 *     description: Update leave request details or approval status. Requires admin or manager role.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Leave request ID to update
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: Updated leave start date
 *                 example: "2024-01-16"
 *               endDate:
 *                 type: string
 *                 format: date
 *                 description: Updated leave end date
 *                 example: "2024-01-21"
 *               leaveType:
 *                 type: string
 *                 description: Updated leave type
 *                 enum: [vacation, sick, personal, maternity, bereavement]
 *                 example: "vacation"
 *               reason:
 *                 type: string
 *                 description: Updated reason for leave
 *                 maxLength: 500
 *                 example: "Extended family vacation"
 *               status:
 *                 type: string
 *                 description: Approval status (only for admin/manager)
 *                 enum: [pending, approved, rejected]
 *                 example: "approved"
 *     responses:
 *       200:
 *         description: Leave request updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   description: Updated leave object
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Admin or manager role required
 *       404:
 *         description: Leave request not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Leave not found"
 *                     code:
 *                       type: string
 *                       example: "NOT_FOUND"
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /roster/leaves/{id}:
 *   delete:
 *     tags: [Roster - Leaves]
 *     summary: Delete a leave request
 *     description: Delete a leave request. Requires admin or manager role.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Leave request ID to delete
 *         example: 1
 *     responses:
 *       200:
 *         description: Leave request deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Leave deleted"
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Admin or manager role required
 *       404:
 *         description: Leave request not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Leave not found"
 *                     code:
 *                       type: string
 *                       example: "NOT_FOUND"
 *       500:
 *         description: Internal server error
 */
router.delete('/leaves/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const leave = await ShiftRoasterLeave.findByPk(req.params.id);
    if (!leave) return res.status(404).json({ success: false, error: { message: 'Leave not found', code: 'NOT_FOUND' } });
    await leave.destroy();
    res.json({ success: true, data: { message: 'Leave deleted' } });
  } catch (err) { next(err); }
});

// ─── SCHEDULES ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /roster/schedule/{year}/{month}:
 *   get:
 *     tags: [Roster - Schedules]
 *     summary: Get schedule for a specific month
 *     description: Retrieve the shift schedule for a specific year and month.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 2020
 *           maximum: 2050
 *         description: Year for the schedule
 *         example: 2024
 *       - in: path
 *         name: month
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *         description: Month for the schedule (1-12)
 *         example: 1
 *     responses:
 *       200:
 *         description: Schedule retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       description: Schedule record ID
 *                       example: 1
 *                     year:
 *                       type: integer
 *                       example: 2024
 *                     month:
 *                       type: integer
 *                       example: 1
 *                     schedule:
 *                       type: object
 *                       description: Schedule data object with shift assignments
 *                       example: {"2024-01-01": {"shiftId": 1, "employeeIds": [1, 2]}}
 *                     metadata:
 *                       type: object
 *                       description: Additional schedule metadata
 *                       example: {"totalShifts": 31, "createdBy": "John Doe"}
 *       401:
 *         description: Unauthorized - Authentication required
 *       404:
 *         description: No schedule found for this period
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "No schedule found for this period"
 *                     code:
 *                       type: string
 *                       example: "NOT_FOUND"
 *       500:
 *         description: Internal server error
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
 *     tags: [Roster - Schedules]
 *     summary: Save or update schedule for a month
 *     description: Create or update the shift schedule for a specific year and month. Requires admin or manager role.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 2020
 *           maximum: 2050
 *         description: Year for the schedule
 *         example: 2024
 *       - in: path
 *         name: month
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *         description: Month for the schedule (1-12)
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               schedule:
 *                 type: object
 *                 description: Schedule data with date keys and shift assignments
 *                 example: {"2024-01-01": {"shiftId": 1, "employeeIds": [1, 2, 3]}}
 *               metadata:
 *                 type: object
 *                 description: Additional schedule metadata
 *                 example: {"notes": "January schedule with holiday coverage", "version": "1.0"}
 *     responses:
 *       200:
 *         description: Schedule saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     year:
 *                       type: integer
 *                       example: 2024
 *                     month:
 *                       type: integer
 *                       example: 1
 *                     schedule:
 *                       type: object
 *                       description: Saved schedule data
 *                     metadata:
 *                       type: object
 *                       description: Schedule metadata
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Admin or manager role required
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /roster/schedule/{year}/{month}:
 *   delete:
 *     tags: [Roster - Schedules]
 *     summary: Delete schedule for a month
 *     description: Delete the shift schedule for a specific year and month. Requires admin or manager role.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 2020
 *           maximum: 2050
 *         description: Year for the schedule
 *         example: 2024
 *       - in: path
 *         name: month
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *         description: Month for the schedule (1-12)
 *         example: 1
 *     responses:
 *       200:
 *         description: Schedule deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Schedule deleted"
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Admin or manager role required
 *       404:
 *         description: No schedule found for this period
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "No schedule found"
 *                     code:
 *                       type: string
 *                       example: "NOT_FOUND"
 *       500:
 *         description: Internal server error
 */
router.delete('/schedule/:year/:month', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { year, month } = req.params;
    const deleted = await RosterSchedule.destroy({ where: { year: parseInt(year), month: parseInt(month) } });
    if (!deleted) return res.status(404).json({ success: false, error: { message: 'No schedule found', code: 'NOT_FOUND' } });
    logger.info(msg(logMessages.roster.scheduleDeleted, { year, month }));
    res.json({ success: true, data: { message: 'Schedule deleted' } });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /roster/schedules:
 *   get:
 *     tags: [Roster - Schedules]
 *     summary: Get list of all saved schedules
 *     description: Retrieve a list of all saved schedules with metadata, ordered by year and month descending.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of schedules retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         description: Schedule record ID
 *                         example: 1
 *                       year:
 *                         type: integer
 *                         description: Schedule year
 *                         example: 2024
 *                       month:
 *                         type: integer
 *                         description: Schedule month (1-12)
 *                         example: 1
 *                       metadata:
 *                         type: object
 *                         description: Schedule metadata
 *                         example: {"notes": "January schedule", "totalShifts": 31}
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         description: When the schedule was created
 *                         example: "2024-01-01T10:00:00.000Z"
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         description: When the schedule was last updated
 *                         example: "2024-01-15T14:30:00.000Z"
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Internal server error
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

// ─── CONFIG (legacy JSONB blob) ─────────────────────────────────────────────

/**
 * @swagger
 * /roster/config:
 *   get:
 *     tags: [Roster - Config]
 *     summary: Get active roster configuration
 *     description: Retrieve the active roster configuration containing shifts, employees, and leave data. Returns default empty config if none exists.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Roster configuration retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   description: Roster configuration object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       description: Configuration record ID
 *                       nullable: true
 *                       example: 1
 *                     shifts:
 *                       type: array
 *                       description: Array of shift configurations
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             description: Shift identifier
 *                             example: "morning"
 *                           name:
 *                             type: string
 *                             description: Shift display name
 *                             example: "Morning Shift"
 *                           time:
 *                             type: string
 *                             description: Shift time range
 *                             example: "09:00 - 17:00"
 *                           color:
 *                             type: string
 *                             description: Shift color
 *                             example: "#3B82F6"
 *                           reqWeekday:
 *                             type: integer
 *                             description: Required staff for weekdays
 *                             example: 5
 *                           reqWeekend:
 *                             type: integer
 *                             description: Required staff for weekends
 *                             example: 3
 *                       example: [{"id": "morning", "name": "Morning Shift", "time": "09:00 - 17:00"}]
 *                     employees:
 *                       type: array
 *                       description: Array of employee configurations
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             description: Employee identifier
 *                             example: "emp_001"
 *                           name:
 *                             type: string
 *                             description: Employee name
 *                             example: "John Doe"
 *                           email:
 *                             type: string
 *                             format: email
 *                             description: Employee email
 *                             example: "john.doe@company.com"
 *                           role:
 *                             type: string
 *                             description: Employee role
 *                             example: "Nurse"
 *                           skills:
 *                             type: array
 *                             items:
 *                               type: string
 *                             description: Employee skills
 *                             example: ["CPR", "IV Therapy"]
 *                       example: [{"id": "emp_001", "name": "John Doe", "email": "john.doe@company.com"}]
 *                     leaves:
 *                       type: array
 *                       description: Array of leave configurations
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             description: Leave identifier
 *                             example: "leave_001"
 *                           employeeId:
 *                             type: string
 *                             description: Employee requesting leave
 *                             example: "emp_001"
 *                           startDate:
 *                             type: string
 *                             format: date
 *                             description: Leave start date
 *                             example: "2024-01-15"
 *                           endDate:
 *                             type: string
 *                             format: date
 *                             description: Leave end date
 *                             example: "2024-01-20"
 *                           type:
 *                             type: string
 *                             description: Leave type
 *                             example: "vacation"
 *                           reason:
 *                             type: string
 *                             description: Leave reason
 *                             example: "Family vacation"
 *                       example: [{"id": "leave_001", "employeeId": "emp_001", "startDate": "2024-01-15"}]
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Internal server error
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
 *     tags: [Roster - Config]
 *     summary: Save roster configuration
 *     description: Save or update the active roster configuration with shifts, employees, and leave data. Requires admin or manager role.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               shifts:
 *                 type: array
 *                 description: Array of shift configurations to save
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Shift identifier
 *                       example: "morning"
 *                     name:
 *                       type: string
 *                       description: Shift display name
 *                       example: "Morning Shift"
 *                     time:
 *                       type: string
 *                       description: Shift time range
 *                       example: "09:00 - 17:00"
 *                     color:
 *                       type: string
 *                       description: Shift color
 *                       example: "#3B82F6"
 *                     reqWeekday:
 *                       type: integer
 *                       description: Required staff for weekdays
 *                       example: 5
 *                     reqWeekend:
 *                       type: integer
 *                       description: Required staff for weekends
 *                       example: 3
 *                 example: [{"id": "morning", "name": "Morning Shift", "time": "09:00 - 17:00"}]
 *               employees:
 *                 type: array
 *                 description: Array of employee configurations to save
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Employee identifier
 *                       example: "emp_001"
 *                     name:
 *                       type: string
 *                       description: Employee name
 *                       example: "John Doe"
 *                     email:
 *                       type: string
 *                       format: email
 *                       description: Employee email
 *                       example: "john.doe@company.com"
 *                     role:
 *                       type: string
 *                       description: Employee role
 *                       example: "Nurse"
 *                     skills:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Employee skills
 *                       example: ["CPR", "IV Therapy"]
 *                 example: [{"id": "emp_001", "name": "John Doe", "email": "john.doe@company.com"}]
 *               leaves:
 *                 type: array
 *                 description: Array of leave configurations to save
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Leave identifier
 *                       example: "leave_001"
 *                     employeeId:
 *                       type: string
 *                       description: Employee requesting leave
 *                       example: "emp_001"
 *                     startDate:
 *                       type: string
 *                       format: date
 *                       description: Leave start date
 *                       example: "2024-01-15"
 *                     endDate:
 *                       type: string
 *                       format: date
 *                       description: Leave end date
 *                       example: "2024-01-20"
 *                     type:
 *                       type: string
 *                       description: Leave type
 *                       example: "vacation"
 *                     reason:
 *                       type: string
 *                       description: Leave reason
 *                       example: "Family vacation"
 *                 example: [{"id": "leave_001", "employeeId": "emp_001", "startDate": "2024-01-15"}]
 *     responses:
 *       200:
 *         description: Roster configuration saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   description: Saved configuration object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       description: Configuration record ID
 *                       example: 1
 *                     shifts:
 *                       type: array
 *                       description: Saved shifts configuration
 *                     employees:
 *                       type: array
 *                       description: Saved employees configuration
 *                     leaves:
 *                       type: array
 *                       description: Saved leaves configuration
 *                     updatedBy:
 *                       type: integer
 *                       description: User ID who updated the config
 *                       example: 1
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       description: When the config was updated
 *                       example: "2024-01-15T14:30:00.000Z"
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Admin or manager role required
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /roster/current-shift:
 *   get:
 *     tags: [Roster - Dashboard]
 *     summary: Get current active shift details
 *     description: Retrieve information about the currently active shift based on the current time, including shift details, available resources, and shift lead information.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Current shift information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     currentShift:
 *                       type: object
 *                       nullable: true
 *                       description: Details of the currently active shift, null if no shift is active
 *                       properties:
 *                         id:
 *                           type: integer
 *                           description: Shift ID
 *                           example: 1
 *                         label:
 *                           type: string
 *                           description: Shift display name
 *                           example: "Morning Shift"
 *                         startTime:
 *                           type: string
 *                           format: time
 *                           description: Shift start time
 *                           example: "09:00"
 *                         endTime:
 *                           type: string
 *                           format: time
 *                           description: Shift end time
 *                           example: "17:00"
 *                         color:
 *                           type: string
 *                           description: Shift color code
 *                           example: "#3B82F6"
 *                       example: {"id": 1, "label": "Morning Shift", "startTime": "09:00", "endTime": "17:00", "color": "#3B82F6"}
 *                     totalEmployees:
 *                       type: integer
 *                       description: Total number of active employees
 *                       example: 25
 *                     availableResources:
 *                       type: integer
 *                       description: Number of employees available (total minus those on leave today)
 *                       example: 22
 *                     onLeaveToday:
 *                       type: integer
 *                       description: Number of employees on leave today
 *                       example: 3
 *                     shiftLead:
 *                       type: string
 *                       nullable: true
 *                       description: Name of the current shift lead, if any
 *                       example: "Sarah Johnson"
 *                     serverTime:
 *                       type: string
 *                       format: date-time
 *                       description: Current server timestamp
 *                       example: "2024-01-15T14:30:45.123Z"
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /roster/stats:
 *   get:
 *     tags: [Roster - Dashboard]
 *     summary: Get roster module statistics
 *     description: Retrieve key statistics for the roster module dashboard, including counts of shifts, employees, leaves, and schedules.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Roster statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalShifts:
 *                       type: integer
 *                       description: Total number of active shifts
 *                       example: 4
 *                     totalEmployees:
 *                       type: integer
 *                       description: Total number of active employees
 *                       example: 25
 *                     totalLeaves:
 *                       type: integer
 *                       description: Total number of leave records (all time)
 *                       example: 45
 *                     pendingLeaves:
 *                       type: integer
 *                       description: Number of pending leave requests
 *                       example: 3
 *                     totalSchedules:
 *                       type: integer
 *                       description: Total number of saved schedules
 *                       example: 12
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Internal server error
 */
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
