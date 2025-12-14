/**
 * Quick verification that system user exists
 */

require('dotenv').config();
const pool = require('../src/config/database');

async function verify() {
  try {
    // Check if system user exists
    const query = 'SELECT id, email, role, full_name FROM users WHERE role = $1';
    const result = await pool.query(query, ['system']);
    
    if (result.rows.length > 0) {
      console.log('✓ System user found:');
      console.log('  Email:', result.rows[0].email);
      console.log('  Role:', result.rows[0].role);
      console.log('  Name:', result.rows[0].full_name);
      console.log('  ID:', result.rows[0].id);
    } else {
      console.log('✗ System user NOT found');
      process.exit(1);
    }
    
    // Check updated_at column
    const columnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'updated_at'
    `;
    const columnResult = await pool.query(columnQuery);
    
    if (columnResult.rows.length > 0) {
      console.log('✓ updated_at column exists');
    } else {
      console.log('✗ updated_at column NOT found');
      process.exit(1);
    }
    
    console.log('\n✓ Migration 005 verified successfully!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Verification failed:', error.message);
    process.exit(1);
  }
}

verify();

