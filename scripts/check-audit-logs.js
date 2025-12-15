// scripts/check-audit-logs.js
const pool = require('../src/config/database');

async function checkAuditLogs() {
  try {
    const result = await pool.query(`
      SELECT 
        al.id,
        al.action,
        u.email as actor_email,
        u.role as actor_role,
        al.details,
        al.timestamp
      FROM audit_logs al
      LEFT JOIN users u ON al.actor_id = u.id
      ORDER BY al.timestamp DESC
      LIMIT 20
    `);
    
    console.log('\n=== ÚLTIMOS 20 REGISTROS DE AUDITORÍA ===\n');
    result.rows.forEach(log => {
      console.log(`[${log.timestamp}] ${log.action}`);
      console.log(`  Actor: ${log.actor_email} (${log.actor_role})`);
      console.log(`  Detalles:`, JSON.stringify(log.details, null, 2));
      console.log('---');
    });
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAuditLogs();
