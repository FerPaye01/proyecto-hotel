/**
 * Interactive Database Query Tool
 * Ejecuta consultas SQL directamente desde la terminal
 * 
 * Uso: node scripts/query-db.js "SELECT * FROM users"
 */

require('dotenv').config();
const pool = require('../src/config/database');

async function executeQuery(sqlQuery) {
  console.log('\n[QUERY] Ejecutando consulta...');
  console.log('[QUERY] SQL:', sqlQuery);
  console.log('[QUERY] ================================\n');

  try {
    const result = await pool.query(sqlQuery);
    
    if (result.rows && result.rows.length > 0) {
      console.log(`[QUERY] ✓ ${result.rows.length} fila(s) encontrada(s):\n`);
      console.table(result.rows);
    } else if (result.rowCount !== undefined) {
      console.log(`[QUERY] ✓ Operación completada. Filas afectadas: ${result.rowCount}`);
    } else {
      console.log('[QUERY] ✓ Consulta ejecutada sin resultados');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('[QUERY] ✗ Error ejecutando consulta:');
    console.error('[QUERY] Mensaje:', error.message);
    if (error.detail) console.error('[QUERY] Detalle:', error.detail);
    if (error.hint) console.error('[QUERY] Sugerencia:', error.hint);
    process.exit(1);
  }
}

// Obtener la consulta desde argumentos de línea de comandos
const query = process.argv[2];

if (!query) {
  console.log('\n[QUERY] Uso: node scripts/query-db.js "TU_CONSULTA_SQL"');
  console.log('\n[QUERY] Ejemplos:');
  console.log('  node scripts/query-db.js "SELECT * FROM users"');
  console.log('  node scripts/query-db.js "SELECT * FROM users WHERE role = \'system\'"');
  console.log('  node scripts/query-db.js "SELECT COUNT(*) FROM audit_logs"');
  console.log('  node scripts/query-db.js "SELECT * FROM rooms LIMIT 5"');
  console.log('');
  process.exit(1);
}

executeQuery(query);
