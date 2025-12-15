/**
 * Run migration 006: Add room images
 * Enhanced with transaction support and rollback capability
 */

const fs = require('fs');
const path = require('path');
const pool = require('../src/config/database');

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting migration 006: Add room images...\n');
    
    // Start transaction
    await client.query('BEGIN');
    console.log('📦 Transaction started');
    
    // Check if columns already exist
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'rooms' 
      AND column_name LIKE 'image_%'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('⚠️  Image columns already exist:');
      checkResult.rows.forEach(row => console.log(`   - ${row.column_name}`));
      console.log('\n✅ Migration already applied, skipping...');
      await client.query('ROLLBACK');
      client.release();
      process.exit(0);
    }
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/006_add_room_images.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Executing migration SQL...');
    
    // Execute migration
    await client.query(migrationSQL);
    
    // Verify columns were added
    const verifyResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'rooms' 
      AND column_name LIKE 'image_%'
      ORDER BY column_name
    `);
    
    if (verifyResult.rows.length !== 3) {
      throw new Error(`Expected 3 image columns, but found ${verifyResult.rows.length}`);
    }
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('✅ Transaction committed\n');
    
    console.log('✅ Migration 006 completed successfully!');
    console.log('📊 Added columns to rooms table:\n');
    verifyResult.rows.forEach(row => {
      console.log(`   ✓ ${row.column_name.padEnd(10)} | Type: ${row.data_type.padEnd(10)} | Nullable: ${row.is_nullable}`);
    });
    
    // Show current room count
    const roomCount = await client.query('SELECT COUNT(*) as count FROM rooms');
    console.log(`\n📌 Total rooms in database: ${roomCount.rows[0].count}`);
    console.log('💡 Existing rooms will have NULL values for images until updated\n');
    
    client.release();
    process.exit(0);
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed - Transaction rolled back');
    console.error('Error:', error.message);
    
    if (error.code) {
      console.error('Error Code:', error.code);
    }
    
    if (error.detail) {
      console.error('Detail:', error.detail);
    }
    
    client.release();
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

runMigration();
