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
      // Use Sequelize's QueryInterface to get all tables in the schema
      const allTables = await sequelize.getQueryInterface().showAllTables();
      console.log('Tables found:', allTables);
      return Array.isArray(allTables) ? allTables : [];
    } catch (err) {
      console.error('getTablesBySchema error:', err.message);
      // Fallback to raw query if showAllTables fails
      try {
        const sql = `SELECT table_name FROM information_schema.tables WHERE table_schema = '${SCHEMA}' AND table_type = 'BASE TABLE' ORDER BY table_name`;
        const [rows] = await sequelize.query(sql);
        return Array.isArray(rows) ? rows.map(r => r.table_name) : [];
      } catch (fallbackErr) {
        console.error('Fallback query also failed:', fallbackErr.message);
        return [];
      }
    }
  },

  async getTableStats() {
    const sql = resolveQuery(queries.database.getTableStats);
    const results = await sequelize.query(sql, { type: QueryTypes.SELECT });
    return Array.isArray(results) ? results : [];
  },

  async dropTable(tableName) {
    const sql = resolveQuery(queries.database.dropTable, { tableName });
    await sequelize.query(sql, { type: QueryTypes.RAW });
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
