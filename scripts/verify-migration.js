/**
 * Verify Migration 005 - System User and Schema Enhancements
 */

require('dotenv').config();
const pool = require('../src/config/database');

async function verify() {
  console.log('[VERIFY] Checking migration 005 changes...');
  console.log('[VERIFY] ================================');

  const client = await pool.connect();
  
  try {
    // Test 1: Check if system user exists
    console.log('[VERIFY] Test 1: System user exists');
    const systemUserQuery = `
      SELECT email, role, full_name, password_hash, created_at, updated_at 
      FROM users 
      WHERE role = 'system'
    `;
    const systemUserResult = await client.query(systemUserQuery);
    
    if (systemUserResult.rows.length > 0) {
      console.log('[VERIFY] ✓ System user found:', systemUserResult.rows[0]);
    } else {
      console.log('[VERIFY] ✗ System user NOT found');
    }

    // Test 2: Check if updated_at column exists
    console.log('\n[VERIFY] Test 2: updated_at column exists');
    const columnQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'updated_at'
    `;
    const columnResult = await client.query(columnQuery);
    
    if (columnResult.rows.length > 0) {
      console.log('[VERIFY] ✓ updated_at column exists:', columnResult.rows[0]);
    } else {
      console.log('[VERIFY] ✗ updated_at column NOT found');
    }

    // Test 3: Check if role constraint includes 'system'
    console.log('\n[VERIFY] Test 3: Role constraint includes system');
    const constraintQuery = `
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'users_role_check'
    `;
    const constraintResult = await client.query(constraintQuery);
    
    if (constraintResult.rows.length > 0) {
      const definition = constraintResult.rows[0].definition;
      if (definition.includes('system')) {
        console.log('[VERIFY] ✓ Role constraint includes system:', definition);
      } else {
        console.log('[VERIFY] ✗ Role constraint does NOT include system:', definition);
      }
    } else {
      console.log('[VERIFY] ✗ Role constraint NOT found');
    }

    // Test 4: Check if audit_logs rules exist
    console.log('\n[VERIFY] Test 4: Audit logs immutability rules');
    const rulesQuery = `
      SELECT rulename, ev_type
      FROM pg_rules
      WHERE tablename = 'audit_logs'
    `;
    const rulesResult = await client.query(rulesQuery);
    
    if (rulesResult.rows.length > 0) {
      console.log('[VERIFY] ✓ Audit logs rules found:');
      rulesResult.rows.forEach(rule => {
        console.log(`[VERIFY]   - ${rule.rulename} (event: ${rule.ev_type})`);
      });
    } else {
      console.log('[VERIFY] ✗ Audit logs rules NOT found');
    }

    // Test 5: Try to insert a test user with system role (should work)
    console.log('\n[VERIFY] Test 5: System role is valid for new users');
    try {
      const testQuery = `
        INSERT INTO users (email, password_hash, role, full_name)
        VALUES ('test-system@test.com', 'TEST', 'system', 'Test System User')
        RETURNING id, email, role
      `;
      const testResult = await client.query(testQuery);
      console.log('[VERIFY] ✓ System role accepted for new user:', testResult.rows[0]);
      
      // Clean up test user
      await client.query('DELETE FROM users WHERE email = $1', ['test-system@test.com']);
      console.log('[VERIFY] ✓ Test user cleaned up');
    } catch (error) {
      console.log('[VERIFY] ✗ System role NOT accepted:', error.message);
    }

    console.log('\n[VERIFY] ================================');
    console.log('[VERIFY] Verification completed!');
    
    client.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('[VERIFY] ================================');
    console.error('[VERIFY] Verification failed:', error.message);
    console.error('[VERIFY] ================================');
    client.release();
    await pool.end();
    process.exit(1);
  }
}

verify();

