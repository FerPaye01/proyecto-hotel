/**
 * Run migration 006: Add room images
 */

const fs = require('fs');
const path = require('path');
const pool = require('../src/config/database');

async function runMigration() {
  try {
    console.log('Running migration 006: Add room images...');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/006_add_room_images.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration 006 completed successfully');
    console.log('Added columns: image_1, image_2, image_3 to rooms table');
    
    // Verify columns were added
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'rooms' 
      AND column_name LIKE 'image_%'
      ORDER BY column_name
    `);
    
    console.log('\nImage columns in rooms table:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
