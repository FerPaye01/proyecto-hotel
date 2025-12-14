/**
 * Database Migration Runner
 * Applies SQL migration files in order
 * 
 * Usage: node scripts/migrate.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/database');

/**
 * Get all migration files sorted by name
 */
function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Sort alphabetically (001_, 002_, etc.)
  
  return files.map(file => ({
    name: file,
    path: path.join(migrationsDir, file)
  }));
}

/**
 * Apply a single migration file
 */
async function applyMigration(migration) {
  console.log(`[MIGRATE] Applying ${migration.name}...`);
  
  try {
    const sql = fs.readFileSync(migration.path, 'utf8');
    await pool.query(sql);
    console.log(`[MIGRATE] ✓ ${migration.name} applied successfully`);
    return true;
  } catch (error) {
    console.error(`[MIGRATE] ✗ Error applying ${migration.name}:`, error.message);
    throw error;
  }
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('[MIGRATE] Starting database migrations...');
  console.log('[MIGRATE] ================================');

  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('[MIGRATE] Database connection successful');
    console.log('[MIGRATE] ');

    // Get all migration files
    const migrations = getMigrationFiles();
    console.log(`[MIGRATE] Found ${migrations.length} migration file(s)`);
    console.log('[MIGRATE] ');

    // Apply each migration
    for (const migration of migrations) {
      await applyMigration(migration);
    }

    console.log('[MIGRATE] ');
    console.log('[MIGRATE] ================================');
    console.log('[MIGRATE] All migrations completed successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('[MIGRATE] ================================');
    console.error('[MIGRATE] Migration failed:', error.message);
    console.error('[MIGRATE] ================================');
    process.exit(1);
  }
}

// Run migration if executed directly
if (require.main === module) {
  migrate();
}

module.exports = { migrate };

