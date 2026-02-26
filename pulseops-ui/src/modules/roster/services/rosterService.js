// ============================================================================
// RosterService — PulseOps UI (Roster Module)
//
// PURPOSE: Frontend service for communicating with the /api/roster endpoints.
// Handles CRUD operations for shifts, employees, and leaves. All API calls
// are logged for audit purposes and error tracking.
//
// ARCHITECTURE: Uses ApiClient for all HTTP calls. All roster data is
// persisted in the database, ensuring data consistency across sessions.
//
// USAGE:
//   import RosterService from '@modules/roster/services/rosterService';
//   const result = await RosterService.createShift(shiftData);
//   const shifts = await RosterService.getShifts();
// ============================================================================
import ApiClient from '@shared/services/apiClient';
import Logger from '@shared/services/logger';
import urls from '@shared/config/urls.json';
import logsConfig from '@shared/config/logs.json';

const SHIFTS_URL = urls.rosterShiftsEndpoint;
const EMPLOYEES_URL = urls.rosterEmployeesEndpoint;
const LEAVES_URL = urls.rosterLeavesEndpoint;

const RosterService = {
  /**
   * Create a new shift in the database.
   * @param {Object} shiftData - { label, time, color, reqWeekday, reqWeekend }
   *   time format: "HH:MM - HH:MM" (e.g., "09:00 - 17:00")
   * @returns {Promise<Object>} { success, data, error }
   */
  async createShift(shiftData) {
    try {
      Logger.info('RosterService', 'Creating new shift', { 
        label: shiftData.label, 
        time: shiftData.time 
      });

      // Transform time format from "HH:MM - HH:MM" to separate startTime and endTime
      const timeParts = shiftData.time.split('-').map(t => t.trim());
      if (timeParts.length !== 2) {
        Logger.error('RosterService', 'Invalid time format', {
          time: shiftData.time,
          expectedFormat: 'HH:MM - HH:MM'
        });
        return { 
          success: false, 
          error: { 
            message: 'Invalid time format. Expected HH:MM - HH:MM', 
            code: 'INVALID_TIME_FORMAT' 
          } 
        };
      }

      // Build API payload with transformed time fields
      const apiPayload = {
        label: shiftData.label,
        startTime: timeParts[0],
        endTime: timeParts[1],
        color: shiftData.color,
        reqWeekday: shiftData.reqWeekday,
        reqWeekend: shiftData.reqWeekend,
      };

      Logger.debug('RosterService', 'Sending shift data to API', {
        label: apiPayload.label,
        startTime: apiPayload.startTime,
        endTime: apiPayload.endTime,
      });

      const response = await ApiClient.post(SHIFTS_URL, apiPayload);

      if (!response.success) {
        Logger.error('RosterService', logsConfig.messages.common.actionFailed, { 
          action: 'createShift', 
          error: response.error?.message 
        });
        return { success: false, error: response.error };
      }

      Logger.info('RosterService', logsConfig.messages.common.actionSuccess, { 
        action: 'createShift',
        shiftId: response.data?.id 
      });

      return { success: true, data: response.data };
    } catch (err) {
      Logger.error('RosterService', logsConfig.messages.common.actionFailed, { 
        action: 'createShift', 
        error: err.message 
      });
      return { success: false, error: { message: err.message, code: 'CREATE_SHIFT_ERROR' } };
    }
  },

  /**
   * Check if a shift name already exists in the database.
   * @param {string} shiftName - The shift name to validate
   * @returns {Promise<Object>} { exists: boolean, error?: string }
   */
  async checkDuplicateShiftName(shiftName) {
    try {
      Logger.debug('RosterService', 'Checking for duplicate shift name', { 
        shiftName 
      });

      const response = await ApiClient.get(`${SHIFTS_URL}?name=${encodeURIComponent(shiftName)}`);

      if (!response.success) {
        Logger.error('RosterService', 'Failed to check duplicate shift name', { 
          shiftName,
          error: response.error?.message 
        });
        return { exists: false, error: response.error?.message };
      }

      // Check if any shift with this name exists
      const isDuplicate = response.data && response.data.length > 0;

      Logger.debug('RosterService', 'Duplicate check completed', { 
        shiftName,
        isDuplicate 
      });

      return { exists: isDuplicate };
    } catch (err) {
      Logger.error('RosterService', 'Error checking duplicate shift name', { 
        shiftName,
        error: err.message 
      });
      return { exists: false, error: err.message };
    }
  },

  /**
   * Fetch all shifts from the database.
   * @returns {Promise<Array>} List of shift records
   */
  async getShifts() {
    try {
      Logger.debug('RosterService', 'Fetching all shifts');
      const response = await ApiClient.get(SHIFTS_URL);

      if (!response.success) {
        Logger.warn('RosterService', logsConfig.messages.common.actionFailed, { 
          action: 'getShifts', 
          error: response.error?.message 
        });
        return [];
      }

      Logger.info('RosterService', 'Shifts fetched successfully', { 
        count: response.data?.length || 0 
      });

      return response.data || [];
    } catch (err) {
      Logger.error('RosterService', logsConfig.messages.common.actionFailed, { 
        action: 'getShifts', 
        error: err.message 
      });
      return [];
    }
  },

  /**
   * Update an existing shift.
   * @param {string} shiftId
   * @param {Object} shiftData - Partial shift object with fields to update
   * @returns {Promise<Object>} { success, data, error }
   */
  async updateShift(shiftId, shiftData) {
    try {
      Logger.info('RosterService', 'Updating shift', { shiftId });

      const response = await ApiClient.put(`${SHIFTS_URL}/${shiftId}`, shiftData);

      if (!response.success) {
        Logger.error('RosterService', logsConfig.messages.common.actionFailed, { 
          action: 'updateShift', 
          shiftId, 
          error: response.error?.message 
        });
        return { success: false, error: response.error };
      }

      Logger.info('RosterService', logsConfig.messages.common.actionSuccess, { 
        action: 'updateShift', 
        shiftId 
      });

      return { success: true, data: response.data };
    } catch (err) {
      Logger.error('RosterService', logsConfig.messages.common.actionFailed, { 
        action: 'updateShift', 
        shiftId, 
        error: err.message 
      });
      return { success: false, error: { message: err.message, code: 'UPDATE_SHIFT_ERROR' } };
    }
  },

  /**
   * Delete a shift from the database.
   * @param {string} shiftId
   * @returns {Promise<Object>} { success, error }
   */
  async deleteShift(shiftId) {
    try {
      Logger.info('RosterService', 'Deleting shift', { shiftId });

      const response = await ApiClient.delete(`${SHIFTS_URL}/${shiftId}`);

      if (!response.success) {
        Logger.error('RosterService', logsConfig.messages.common.actionFailed, { 
          action: 'deleteShift', 
          shiftId, 
          error: response.error?.message 
        });
        return { success: false, error: response.error };
      }

      Logger.info('RosterService', logsConfig.messages.common.actionSuccess, { 
        action: 'deleteShift', 
        shiftId 
      });

      return { success: true };
    } catch (err) {
      Logger.error('RosterService', logsConfig.messages.common.actionFailed, { 
        action: 'deleteShift', 
        shiftId, 
        error: err.message 
      });
      return { success: false, error: { message: err.message, code: 'DELETE_SHIFT_ERROR' } };
    }
  },

  /**
   * Create a new employee in the database.
   * @param {Object} employeeData - { name, role }
   * @returns {Promise<Object>} { success, data, error }
   */
  async createEmployee(employeeData) {
    try {
      Logger.info('RosterService', 'Creating new employee', { name: employeeData.name });

      const response = await ApiClient.post(EMPLOYEES_URL, employeeData);

      if (!response.success) {
        Logger.error('RosterService', logsConfig.messages.common.actionFailed, { 
          action: 'createEmployee', 
          error: response.error?.message 
        });
        return { success: false, error: response.error };
      }

      Logger.info('RosterService', logsConfig.messages.common.actionSuccess, { 
        action: 'createEmployee',
        employeeId: response.data?.id 
      });

      return { success: true, data: response.data };
    } catch (err) {
      Logger.error('RosterService', logsConfig.messages.common.actionFailed, { 
        action: 'createEmployee', 
        error: err.message 
      });
      return { success: false, error: { message: err.message, code: 'CREATE_EMPLOYEE_ERROR' } };
    }
  },

  /**
   * Fetch all employees from the database.
   * @returns {Promise<Array>} List of employee records
   */
  async getEmployees() {
    try {
      Logger.debug('RosterService', 'Fetching all employees');
      const response = await ApiClient.get(EMPLOYEES_URL);

      if (!response.success) {
        Logger.warn('RosterService', logsConfig.messages.common.actionFailed, { 
          action: 'getEmployees', 
          error: response.error?.message 
        });
        return [];
      }

      Logger.info('RosterService', 'Employees fetched successfully', { 
        count: response.data?.length || 0 
      });

      return response.data || [];
    } catch (err) {
      Logger.error('RosterService', logsConfig.messages.common.actionFailed, { 
        action: 'getEmployees', 
        error: err.message 
      });
      return [];
    }
  },

  /**
   * Delete an employee from the database.
   * @param {string} employeeId
   * @returns {Promise<Object>} { success, error }
   */
  async deleteEmployee(employeeId) {
    try {
      Logger.info('RosterService', 'Deleting employee', { employeeId });

      const response = await ApiClient.delete(`${EMPLOYEES_URL}/${employeeId}`);

      if (!response.success) {
        Logger.error('RosterService', logsConfig.messages.common.actionFailed, { 
          action: 'deleteEmployee', 
          employeeId, 
          error: response.error?.message 
        });
        return { success: false, error: response.error };
      }

      Logger.info('RosterService', logsConfig.messages.common.actionSuccess, { 
        action: 'deleteEmployee', 
        employeeId 
      });

      return { success: true };
    } catch (err) {
      Logger.error('RosterService', logsConfig.messages.common.actionFailed, { 
        action: 'deleteEmployee', 
        employeeId, 
        error: err.message 
      });
      return { success: false, error: { message: err.message, code: 'DELETE_EMPLOYEE_ERROR' } };
    }
  },

  /**
   * Create a new leave record in the database.
   * @param {Object} leaveData - { empId, date }
   * @returns {Promise<Object>} { success, data, error }
   */
  async createLeave(leaveData) {
    try {
      Logger.info('RosterService', 'Creating new leave', { empId: leaveData.empId });

      const response = await ApiClient.post(LEAVES_URL, leaveData);

      if (!response.success) {
        Logger.error('RosterService', logsConfig.messages.common.actionFailed, { 
          action: 'createLeave', 
          error: response.error?.message 
        });
        return { success: false, error: response.error };
      }

      Logger.info('RosterService', logsConfig.messages.common.actionSuccess, { 
        action: 'createLeave',
        leaveId: response.data?.id 
      });

      return { success: true, data: response.data };
    } catch (err) {
      Logger.error('RosterService', logsConfig.messages.common.actionFailed, { 
        action: 'createLeave', 
        error: err.message 
      });
      return { success: false, error: { message: err.message, code: 'CREATE_LEAVE_ERROR' } };
    }
  },

  /**
   * Fetch all leaves from the database.
   * @returns {Promise<Array>} List of leave records
   */
  async getLeaves() {
    try {
      Logger.debug('RosterService', 'Fetching all leaves');
      const response = await ApiClient.get(LEAVES_URL);

      if (!response.success) {
        Logger.warn('RosterService', logsConfig.messages.common.actionFailed, { 
          action: 'getLeaves', 
          error: response.error?.message 
        });
        return [];
      }

      Logger.info('RosterService', 'Leaves fetched successfully', { 
        count: response.data?.length || 0 
      });

      return response.data || [];
    } catch (err) {
      Logger.error('RosterService', logsConfig.messages.common.actionFailed, { 
        action: 'getLeaves', 
        error: err.message 
      });
      return [];
    }
  },

  /**
   * Delete a leave record from the database.
   * @param {string} leaveId
   * @returns {Promise<Object>} { success, error }
   */
  async deleteLeave(leaveId) {
    try {
      Logger.info('RosterService', 'Deleting leave', { leaveId });

      const response = await ApiClient.delete(`${LEAVES_URL}/${leaveId}`);

      if (!response.success) {
        Logger.error('RosterService', logsConfig.messages.common.actionFailed, { 
          action: 'deleteLeave', 
          leaveId, 
          error: response.error?.message 
        });
        return { success: false, error: response.error };
      }

      Logger.info('RosterService', logsConfig.messages.common.actionSuccess, { 
        action: 'deleteLeave', 
        leaveId 
      });

      return { success: true };
    } catch (err) {
      Logger.error('RosterService', logsConfig.messages.common.actionFailed, { 
        action: 'deleteLeave', 
        leaveId, 
        error: err.message 
      });
      return { success: false, error: { message: err.message, code: 'DELETE_LEAVE_ERROR' } };
    }
  },

  /**
   * Load demo data for the Roster module.
   * @returns {Promise<Object>} { success, data, error }
   */
  async loadDemoData() {
    try {
      Logger.info('RosterService', 'Loading demo data for roster module');

      const response = await ApiClient.post(`${SHIFTS_URL.replace('/shifts', '')}/demo-data`, {});

      if (!response.success) {
        Logger.error('RosterService', 'Failed to load demo data', { 
          error: response.error?.message 
        });
        return { success: false, error: response.error };
      }

      Logger.info('RosterService', 'Demo data loaded successfully', { 
        counts: response.data?.counts 
      });

      return { success: true, data: response.data };
    } catch (err) {
      Logger.error('RosterService', 'Error loading demo data', { 
        error: err.message 
      });
      return { success: false, error: { message: err.message, code: 'LOAD_DEMO_ERROR' } };
    }
  },

  /**
   * Remove all roster data (hard reset).
   * @returns {Promise<Object>} { success, error }
   */
  async hardResetRosterData() {
    try {
      Logger.warn('RosterService', 'Initiating hard reset of roster data');

      const response = await ApiClient.delete(`${SHIFTS_URL.replace('/shifts', '')}/all`);

      if (!response.success) {
        Logger.error('RosterService', 'Failed to hard reset roster data', { 
          error: response.error?.message 
        });
        return { success: false, error: response.error };
      }

      Logger.info('RosterService', 'Roster data hard reset completed successfully');

      return { success: true };
    } catch (err) {
      Logger.error('RosterService', 'Error during hard reset', { 
        error: err.message 
      });
      return { success: false, error: { message: err.message, code: 'HARD_RESET_ERROR' } };
    }
  },

  /**
   * Remove demo data from the roster.
   * @returns {Promise<Object>} { success, error }
   */
  async removeDemoData() {
    try {
      Logger.info('RosterService', 'Removing demo data from roster');

      const response = await ApiClient.delete(`${SHIFTS_URL.replace('/shifts', '')}/demo-data`);

      if (!response.success) {
        Logger.error('RosterService', 'Failed to remove demo data', { 
          error: response.error?.message 
        });
        return { success: false, error: response.error };
      }

      Logger.info('RosterService', 'Demo data removed successfully');

      return { success: true };
    } catch (err) {
      Logger.error('RosterService', 'Error removing demo data', { 
        error: err.message 
      });
      return { success: false, error: { message: err.message, code: 'REMOVE_DEMO_ERROR' } };
    }
  },
};

export default RosterService;
