require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function getBookings() {
  try {
    const result = await pool.query(`
      SELECT 
        b.id,
        b.user_id,
        b.room_id,
        r.number as room_number,
        b.check_in_date,
        b.check_out_date,
        b.status,
        b.total_cost
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      ORDER BY b.created_at DESC
      LIMIT 10
    `);
    
    console.log('\n📋 Últimas 10 reservas:');
    console.log('='.repeat(100));
    
    if (result.rows.length === 0) {
      console.log('No hay reservas en la base de datos');
    } else {
      result.rows.forEach(booking => {
        console.log(`\nBooking ID: ${booking.id}`);
        console.log(`  Habitación: ${booking.room_number}`);
        console.log(`  Estado: ${booking.status}`);
        console.log(`  Check-in: ${booking.check_in_date}`);
        console.log(`  Check-out: ${booking.check_out_date}`);
        console.log(`  Costo: $${booking.total_cost}`);
      });
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

getBookings();
