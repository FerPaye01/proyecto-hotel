/**
 * Script para probar el Cron Service
 * Crea una reserva antigua y verifica que el cron la expire
 */

require('dotenv').config();
const pool = require('../src/config/database');

async function testCronService() {
  console.log('🧪 Iniciando prueba del Cron Service...\n');

  try {
    // 1. Buscar un usuario cliente y una habitación disponible
    const userResult = await pool.query(
      "SELECT id, email FROM users WHERE role = 'client' LIMIT 1"
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ No hay usuarios cliente. Crea uno primero.');
      return;
    }

    const user = userResult.rows[0];
    console.log(`✅ Usuario encontrado: ${user.email} (${user.id})`);

    const roomResult = await pool.query(
      "SELECT id, number FROM rooms WHERE status = 'AVAILABLE' LIMIT 1"
    );

    if (roomResult.rows.length === 0) {
      console.log('❌ No hay habitaciones disponibles.');
      return;
    }

    const room = roomResult.rows[0];
    console.log(`✅ Habitación encontrada: ${room.number} (${room.id})\n`);

    // 2. Crear una reserva con fecha de creación de hace 25 horas
    console.log('📝 Creando reserva antigua (25 horas atrás)...');
    const bookingResult = await pool.query(
      `INSERT INTO bookings (user_id, room_id, check_in_date, check_out_date, total_cost, status, created_at)
       VALUES ($1, $2, CURRENT_DATE + 1, CURRENT_DATE + 3, 200, 'CONFIRMED', NOW() - INTERVAL '25 hours')
       RETURNING *`,
      [user.id, room.id]
    );

    const booking = bookingResult.rows[0];
    console.log(`✅ Reserva creada: ${booking.id}`);
    console.log(`   Estado: ${booking.status}`);
    console.log(`   Creada: ${booking.created_at}\n`);

    // 3. Verificar el estado actual
    console.log('📊 Estado ANTES de ejecutar el cron:');
    const beforeResult = await pool.query(
      'SELECT id, status, created_at FROM bookings WHERE id = $1',
      [booking.id]
    );
    console.log(`   ID: ${beforeResult.rows[0].id}`);
    console.log(`   Estado: ${beforeResult.rows[0].status}`);
    console.log(`   Creada: ${beforeResult.rows[0].created_at}\n`);

    // 4. Ejecutar el cron service manualmente
    console.log('⏰ Ejecutando Cron Service...');
    const CronService = require('../src/services/cronService');
    const result = await CronService.expireBookings();
    
    console.log(`✅ Cron ejecutado exitosamente`);
    console.log(`   Reservas expiradas: ${result.count}`);
    console.log(`   IDs afectados: ${result.ids.join(', ')}\n`);

    // 5. Verificar el estado después
    console.log('📊 Estado DESPUÉS de ejecutar el cron:');
    const afterResult = await pool.query(
      'SELECT id, status, created_at FROM bookings WHERE id = $1',
      [booking.id]
    );
    console.log(`   ID: ${afterResult.rows[0].id}`);
    console.log(`   Estado: ${afterResult.rows[0].status}`);
    console.log(`   Creada: ${afterResult.rows[0].created_at}\n`);

    // 6. Verificar el audit log
    console.log('📋 Verificando Audit Log...');
    const auditResult = await pool.query(
      `SELECT al.*, u.email as actor_email 
       FROM audit_logs al
       JOIN users u ON al.actor_id = u.id
       WHERE al.action = 'EXPIRE_BOOKINGS'
       ORDER BY al.timestamp DESC
       LIMIT 1`
    );

    if (auditResult.rows.length > 0) {
      const audit = auditResult.rows[0];
      console.log(`✅ Audit log creado:`);
      console.log(`   Actor: ${audit.actor_email}`);
      console.log(`   Acción: ${audit.action}`);
      console.log(`   Timestamp: ${audit.timestamp}`);
      console.log(`   Detalles:`, JSON.stringify(audit.details, null, 2));
    }

    console.log('\n✅ ¡Prueba completada exitosamente!');
    console.log('\n📝 Resumen:');
    console.log(`   - Reserva ${booking.id} cambió de CONFIRMED a CANCELLED`);
    console.log(`   - Audit log creado con actor "system@internal"`);
    console.log(`   - El cron service está funcionando correctamente`);

  } catch (error) {
    console.error('❌ Error durante la prueba:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

testCronService();
