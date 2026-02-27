// ============================================================================
// Query Service — PulseOps API
//
// PURPOSE: Centralized SQL query execution. All raw SQL queries are read
// from queries.json — NO inline SQL anywhere in the codebase. Handles
// schema substitution from database.json config.
//
// ARCHITECTURE: Singleton service. Uses Sequelize's raw query method.
// Replaces :schema placeholder with the configured schema name.
//
// USAGE:
//   import queryService from '#core/database/queryService.js';
//   const tables = await queryService.getTablesBySchema();
//   await queryService.dropTable('system_users');
// ============================================================================
import sequelize from '#core/database/sequelize.js';
import { QueryTypes } from 'sequelize';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const queries = require('#config/queries.json');
const dbConfig = require('#config/database.json');

const SCHEMA = process.env.DB_SCHEMA || dbConfig.schema || 'public';

function resolveQuery(template, params = {}) {
  let sql = template
    .replace(/\{schemaQuoted\}/g, `'${SCHEMA}'`)  // For WHERE clauses: 'public'
    .replace(/\{schema\}/g, SCHEMA);               // For identifiers: "public"
  
  for (const [key, value] of Object.entries(params)) {
    sql = sql.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  
  if (sql.includes('{')) {
    console.warn('resolveQuery: unresolved placeholders in SQL:', { sql, SCHEMA, params });
  }
  return sql;
}

const queryService = {
  getSchema() {
    return SCHEMA;
  },

  async getConnectionInfo() {
    const sql = resolveQuery(queries.database.getConnectionInfo);
    const results = await sequelize.query(sql, { type: QueryTypes.SELECT });
    return Array.isArray(results) ? results[0] : null;
  },

  async getVersion() {
    const sql = resolveQuery(queries.database.getVersion);
    const results = await sequelize.query(sql, { type: QueryTypes.SELECT });
    return Array.isArray(results) ? results[0]?.version : null;
  },

  async getSystemTime() {
    const sql = resolveQuery(queries.database.getSystemTime);
    const results = await sequelize.query(sql, { type: QueryTypes.SELECT });
    return Array.isArray(results) ? results[0]?.current_time : null;
  },

  async getTablesBySchema() {
    try {
      // Use raw SQL query to get table names from information_schema
      const sql = `SELECT table_name FROM information_schema.tables WHERE table_schema = '${SCHEMA}' AND table_type = 'BASE TABLE' ORDER BY table_name`;
      console.log('getTablesBySchema SQL:', { sql, SCHEMA });
      const rows = await sequelize.query(sql, { type: QueryTypes.SELECT });
      
      // Sequelize returns results as arrays: [['table1'], ['table2'], ...]
      // Extract the first element from each array
      const tableNames = Array.isArray(rows) ? rows.map(r => {
        // If row is an array, get first element; if object, get table_name field
        if (Array.isArray(r)) {
          return r[0]; // Extract first element from array
        } else if (typeof r === 'object' && r !== null) {
          return r.table_name; // Extract from object
        }
        return r; // Return as-is if neither
      }).filter(t => t && typeof t === 'string') : [];
      
      console.log('getTablesBySchema result:', { tableNames, rowCount: rows.length, rawRows: rows });
      return tableNames;
    } catch (err) {
      console.error('getTablesBySchema error:', { error: err.message, stack: err.stack, SCHEMA });
      return [];
    }
  },

  async tableExists(tableName) {
    try {
      const sql = `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = '${SCHEMA}' AND table_name = '${tableName}') AS exists`;
      const rows = await sequelize.query(sql, { type: QueryTypes.SELECT });
      
      // Handle both array format [true/false] and object format { exists: true/false }
      let result = false;
      if (Array.isArray(rows) && rows.length > 0) {
        const row = rows[0];
        if (Array.isArray(row)) {
          result = row[0] === true; // Extract first element from array
        } else if (typeof row === 'object' && row !== null) {
          result = row.exists === true; // Extract from object
        }
      }
      
      console.log('tableExists result:', { tableName, exists: result, rawRows: rows });
      return result;
    } catch (err) {
      console.error('tableExists error:', { tableName, error: err.message });
      return false;
    }
  },

  async getTableStats() {
    const sql = resolveQuery(queries.database.getTableStats);
    const results = await sequelize.query(sql, { type: QueryTypes.SELECT });
    return Array.isArray(results) ? results : [];
  },

  async dropTable(tableName) {
    const sql = resolveQuery(queries.database.dropTable, { tableName });
    console.log('dropTable SQL:', { sql, tableName });
    try {
      const result = await sequelize.query(sql, { type: QueryTypes.RAW, raw: true });
      console.log('dropTable result:', { tableName, result });
      return result;
    } catch (err) {
      console.error('dropTable error:', { tableName, sql, error: err.message, stack: err.stack });
      throw err;
    }
  },

  async getEnumTypes() {
    const sql = resolveQuery(queries.database.getEnumTypes);
    const results = await sequelize.query(sql, { type: QueryTypes.SELECT });
    return Array.isArray(results) ? results.map(r => r.typname) : [];
  },

  async dropEnumType(typeName) {
    const sql = resolveQuery(queries.database.dropEnumType, { typeName });
    await sequelize.query(sql, { type: QueryTypes.RAW });
  },

  async ensureSchema() {
    if (SCHEMA !== 'public') {
      const sql = resolveQuery(queries.database.createSchema);
      await sequelize.query(sql, { type: QueryTypes.RAW });
      const searchPathSql = resolveQuery(queries.database.setSearchPath);
      await sequelize.query(searchPathSql, { type: QueryTypes.RAW });
    }
  },
};

export default queryService;
