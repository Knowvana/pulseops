import { Sequelize } from 'sequelize';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const dbConfig = require('./src/config/database.json');

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: console.log,
  }
);

async function test() {
  try {
    await sequelize.authenticate();
    console.log('Connected to database');
    
    const schema = 'public';
    
    // Test 1: Direct query without type
    console.log('\n=== Test 1: Query without type ===');
    const result1 = await sequelize.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = '${schema}' AND table_type = 'BASE TABLE' LIMIT 5`);
    console.log('Result:', result1);
    console.log('Result[0]:', result1[0]);
    console.log('Result[0] type:', typeof result1[0]);
    console.log('Result[0] length:', result1[0]?.length);
    
    // Test 2: Query with QueryTypes.SELECT
    console.log('\n=== Test 2: Query with QueryTypes.SELECT ===');
    const { QueryTypes } = require('sequelize');
    const result2 = await sequelize.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = '${schema}' AND table_type = 'BASE TABLE' LIMIT 5`, { type: QueryTypes.SELECT });
    console.log('Result:', result2);
    console.log('Result type:', typeof result2);
    console.log('Result length:', result2?.length);
    
    // Test 3: List all schemas
    console.log('\n=== Test 3: List all schemas ===');
    const schemas = await sequelize.query(`SELECT schema_name FROM information_schema.schemata ORDER BY schema_name`);
    console.log('Schemas:', schemas[0]);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

test();
