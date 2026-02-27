// ============================================================================
// ServiceNow ENUM to STRING Migration — PulseOps API
//
// PURPOSE: Migrates existing ENUM columns to STRING to support generic
// ServiceNow instances with different field value configurations.
//
// USAGE: Run this script once to migrate existing data without dropping tables
// node src/modules/servicenow/utils/migrateEnumsToStrings.js
// ============================================================================
import sequelize from '#core/database/sequelize.js';
import logger from '#core/logger.js';

async function migrateEnumsToStrings() {
  const transaction = await sequelize.transaction();
  
  try {
    logger.info('Starting ENUM to STRING migration for ServiceNow tables');

    // Migrate servicenow_incidents table
    logger.info('Migrating servicenow_incidents columns...');
    
    // Change priority from ENUM to VARCHAR
    await sequelize.query(
      `ALTER TABLE servicenow_incidents 
       ALTER COLUMN priority TYPE VARCHAR(20) USING priority::text,
       ALTER COLUMN priority SET DEFAULT '3'`,
      { transaction }
    );
    logger.info('Migrated incidents.priority to VARCHAR(20)');

    // Change severity from ENUM to VARCHAR
    await sequelize.query(
      `ALTER TABLE servicenow_incidents 
       ALTER COLUMN severity TYPE VARCHAR(20) USING severity::text,
       ALTER COLUMN severity SET DEFAULT '2'`,
      { transaction }
    );
    logger.info('Migrated incidents.severity to VARCHAR(20)');

    // Change state from ENUM to VARCHAR
    await sequelize.query(
      `ALTER TABLE servicenow_incidents 
       ALTER COLUMN state TYPE VARCHAR(50) USING state::text,
       ALTER COLUMN state SET DEFAULT ''`,
      { transaction }
    );
    logger.info('Migrated incidents.state to VARCHAR(50)');

    // Change contactType from ENUM to VARCHAR
    await sequelize.query(
      `ALTER TABLE servicenow_incidents 
       ALTER COLUMN "contactType" TYPE VARCHAR(50) USING "contactType"::text,
       ALTER COLUMN "contactType" SET DEFAULT ''`,
      { transaction }
    );
    logger.info('Migrated incidents.contactType to VARCHAR(50)');

    // Change impact from ENUM to VARCHAR
    await sequelize.query(
      `ALTER TABLE servicenow_incidents 
       ALTER COLUMN impact TYPE VARCHAR(20) USING impact::text,
       ALTER COLUMN impact SET DEFAULT ''`,
      { transaction }
    );
    logger.info('Migrated incidents.impact to VARCHAR(20)');

    // Change urgency from ENUM to VARCHAR
    await sequelize.query(
      `ALTER TABLE servicenow_incidents 
       ALTER COLUMN urgency TYPE VARCHAR(20) USING urgency::text,
       ALTER COLUMN urgency SET DEFAULT ''`,
      { transaction }
    );
    logger.info('Migrated incidents.urgency to VARCHAR(20)');

    // Migrate servicenow_ritms table
    logger.info('Migrating servicenow_ritms columns...');
    
    await sequelize.query(
      `ALTER TABLE servicenow_ritms 
       ALTER COLUMN state TYPE VARCHAR(50) USING state::text,
       ALTER COLUMN state SET DEFAULT '1'`,
      { transaction }
    );
    logger.info('Migrated ritms.state to VARCHAR(50)');

    await sequelize.query(
      `ALTER TABLE servicenow_ritms 
       ALTER COLUMN priority TYPE VARCHAR(20) USING priority::text,
       ALTER COLUMN priority SET DEFAULT '3'`,
      { transaction }
    );
    logger.info('Migrated ritms.priority to VARCHAR(20)');

    // Migrate servicenow_changes table
    logger.info('Migrating servicenow_changes columns...');
    
    await sequelize.query(
      `ALTER TABLE servicenow_changes 
       ALTER COLUMN type TYPE VARCHAR(50) USING type::text,
       ALTER COLUMN type SET DEFAULT 'normal'`,
      { transaction }
    );
    logger.info('Migrated changes.type to VARCHAR(50)');

    await sequelize.query(
      `ALTER TABLE servicenow_changes 
       ALTER COLUMN state TYPE VARCHAR(50) USING state::text,
       ALTER COLUMN state SET DEFAULT 'new'`,
      { transaction }
    );
    logger.info('Migrated changes.state to VARCHAR(50)');

    await sequelize.query(
      `ALTER TABLE servicenow_changes 
       ALTER COLUMN risk TYPE VARCHAR(50) USING risk::text,
       ALTER COLUMN risk SET DEFAULT 'moderate'`,
      { transaction }
    );
    logger.info('Migrated changes.risk to VARCHAR(50)');

    await sequelize.query(
      `ALTER TABLE servicenow_changes 
       ALTER COLUMN impact TYPE VARCHAR(20) USING impact::text,
       ALTER COLUMN impact SET DEFAULT '2'`,
      { transaction }
    );
    logger.info('Migrated changes.impact to VARCHAR(20)');

    // Drop old ENUM types if they exist
    logger.info('Dropping old ENUM types...');
    
    const enumTypes = [
      'enum_servicenow_incidents_priority',
      'enum_servicenow_incidents_severity',
      'enum_servicenow_incidents_state',
      'enum_servicenow_incidents_contactType',
      'enum_servicenow_incidents_impact',
      'enum_servicenow_incidents_urgency',
      'enum_servicenow_ritms_state',
      'enum_servicenow_ritms_priority',
      'enum_servicenow_changes_type',
      'enum_servicenow_changes_state',
      'enum_servicenow_changes_risk',
      'enum_servicenow_changes_impact',
    ];

    for (const enumType of enumTypes) {
      try {
        await sequelize.query(`DROP TYPE IF EXISTS ${enumType} CASCADE`, { transaction });
        logger.info(`Dropped ENUM type: ${enumType}`);
      } catch (err) {
        logger.warn(`Failed to drop ENUM type ${enumType}`, { error: err.message });
      }
    }

    await transaction.commit();
    logger.info('✅ Migration completed successfully! All ENUM columns converted to STRING.');
    logger.info('You can now sync data from any ServiceNow instance.');
    
    process.exit(0);
  } catch (err) {
    await transaction.rollback();
    logger.error('❌ Migration failed', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

// Run migration
migrateEnumsToStrings();
