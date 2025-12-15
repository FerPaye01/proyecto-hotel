/**
 * Rollback migration 006: Remove room images columns
 * Use this if you need to undo the migration
 */

const pool = require('../src/config/database');

async function rollbackMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting rollback of migration 006: Remove room images...\n');
    
    // Start transaction
    await client.query('BEGIN');
    console.log('📦 Transaction started');
    
    // Check if columns exist
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'rooms' 
      AND column_name LIKE 'image_%'
    `);
    
    if (checkResult.rows.length === 0) {
      console.log('⚠️  No image columns found - nothing to rollback');
      await client.query('ROLLBACK');
      client.release();
      process.exit(0);
    }
    
    console.log('📄 Found columns to remove:');
    checkResult.rows.forEach(row => console.log(`   - ${row.column_name}`));
    
    // Check if any rooms have images
    const imagesCheck = await client.query(`
      SELECT COUNT(*) as count 
      FROM rooms 
      WHERE image_1 IS NOT NULL 
         OR image_2 IS NOT NULL 
         OR image_3 IS NOT NULL
    `);
    
    if (imagesCheck.rows[0].count > 0) {
      console.log(`\n⚠️  WARNING: ${imagesCheck.rows[0].count} room(s) have images that will be deleted!`);
    }
    
    // Remove columns
    console.log('\n🗑️  Removing image columns...');
    await client.query(`
      ALTER TABLE rooms 
      DROP COLUMN IF EXISTS image_1,
      DROP COLUMN IF EXISTS image_2,
      DROP COLUMN IF EXISTS image_3
    `);
    
    // Drop index
    await client.query('DROP INDEX IF EXISTS idx_rooms_with_images');
    
    // Verify columns were removed
    const verifyResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'rooms' 
      AND column_name LIKE 'image_%'
    `);
    
    if (verifyResult.rows.length > 0) {
      throw new Error('Failed to remove all image columns');
    }
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('✅ Transaction committed\n');
    
    console.log('✅ Rollback completed successfully!');
    console.log('📊 Removed columns: image_1, image_2, image_3');
    console.log('📊 Removed index: idx_rooms_with_images\n');
    
    client.release();
    process.exit(0);
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('\n❌ Rollback failed - Transaction rolled back');
    console.error('Error:', error.message);
    
    if (error.code) {
      console.error('Error Code:', error.code);
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

rollbackMigration();
