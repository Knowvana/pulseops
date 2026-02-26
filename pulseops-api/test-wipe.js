import sequelize from './src/core/database/sequelize.js';
import { QueryTypes } from 'sequelize';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const dbConfig = require('./src/config/database.json');

async function testWipe() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Connected!');
    
    const schema = dbConfig.schema || 'public';
    console.log('Schema:', schema);
    
    // Test 1: Direct SQL query
    console.log('\n--- Test 1: Direct SQL Query ---');
    const sql = `SELECT table_name FROM information_schema.tables WHERE table_schema = '${schema}' AND table_type = 'BASE TABLE' ORDER BY table_name`;
    console.log('SQL:', sql);
    
    const results = await sequelize.query(sql, { type: QueryTypes.SELECT });
    console.log('Results type:', typeof results);
    console.log('Is array:', Array.isArray(results));
    console.log('Results length:', results.length);
    console.log('Results:', results);
    
    if (Array.isArray(results) && results.length > 0) {
      const tableNames = results.map(r => r.table_name);
      console.log('Table names:', tableNames);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

testWipe();
