// ============================================================================
// Roster Utilities — PulseOps UI
//
// PURPOSE: Pure utility functions for the Shift Roster Planner module.
// Includes date key formatting and the roster generation algorithm.
//
// ARCHITECTURE: Module-specific utilities. The generateRoster function
// implements a fair-distribution algorithm that balances shifts across
// employees while respecting leaves, max 5 days/week, and weekend equity.
// ============================================================================

/**
 * Format a Date object to a safe, sortable string key (YYYY-MM-DD).
 * @param {Date} date
 * @returns {string}
 */
export const getSafeDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Generate a fair roster schedule for a given month.
 * @param {Array} employees - List of employee objects { id, name, role }
 * @param {Array} shifts - List of shift objects { id, label, time, reqWeekday, reqWeekend }
 * @param {number} baseYear - Year to generate for
 * @param {number} baseMonth - Month (0-indexed) to generate for
 * @param {Array} leaves - List of leave objects { empId, date }
 * @returns {{ roster: Object, employeeStats: Object }}
 */
export const generateRoster = (employees, shifts, baseYear, baseMonth, leaves = []) => {
  const roster = {};
  const employeeStats = {};

  employees.forEach(emp => {
    employeeStats[emp.id] = { totalDaysWorked: 0, weekendDaysWorked: 0, weeklyDetails: {} };
  });

  const startDate = new Date(baseYear, baseMonth - 1, 1);
  const endDate = new Date(baseYear, baseMonth + 2, 0);
  const shuffle = (array) => array.sort(() => Math.random() - 0.5);

  let currentLoopDate = new Date(startDate);

  while (currentLoopDate <= endDate) {
    const dateKey = getSafeDateKey(currentLoopDate);
    const dayOfWeek = currentLoopDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const weekStart = new Date(currentLoopDate);
    weekStart.setDate(currentLoopDate.getDate() - dayOfWeek);
    const weekKey = getSafeDateKey(weekStart);

    roster[dateKey] = {};
    shifts.forEach(s => roster[dateKey][s.id] = []);

    for (const shift of shifts) {
      let needed = isWeekend ? shift.reqWeekend : shift.reqWeekday;

      let candidates = employees.filter(emp => {
        const isOnLeave = leaves.some(l => l.empId === emp.id && l.date === dateKey);
        if (isOnLeave) return false;

        const workedToday = roster[dateKey] && Object.values(roster[dateKey]).some(list => list.includes(emp.id));
        if (workedToday) return false;

        const daysWorkedThisWeek = employeeStats[emp.id].weeklyDetails[weekKey] || 0;
        if (daysWorkedThisWeek >= 5) return false;

        return true;
      });

      candidates = shuffle(candidates);
      candidates.sort((a, b) => {
        const statsA = employeeStats[a.id];
        const statsB = employeeStats[b.id];
        if (isWeekend) {
          if (statsA.weekendDaysWorked !== statsB.weekendDaysWorked) return statsA.weekendDaysWorked - statsB.weekendDaysWorked;
        }
        return statsA.totalDaysWorked - statsB.totalDaysWorked;
      });

      const chosen = candidates.slice(0, needed);

      chosen.forEach(worker => {
        roster[dateKey][shift.id].push(worker.id);
        employeeStats[worker.id].totalDaysWorked += 1;
        if (isWeekend) employeeStats[worker.id].weekendDaysWorked += 1;
        if (!employeeStats[worker.id].weeklyDetails[weekKey]) employeeStats[worker.id].weeklyDetails[weekKey] = 0;
        employeeStats[worker.id].weeklyDetails[weekKey] += 1;
      });
    }
    currentLoopDate.setDate(currentLoopDate.getDate() + 1);
  }
  return { roster, employeeStats };
};
