/**
 * Database Seed Script
 * Seeds initial admin user and sample rooms
 * Requirements: 4.1, 4.2
 * 
 * Usage: node scripts/seed.js
 */

require('dotenv').config();
const pool = require('../src/config/database');
const { hashPassword } = require('../src/utils/password');

/**
 * Seed initial admin user
 */
async function seedAdminUser() {
  console.log('[SEED] Creating admin user...');
  
  const email = 'admin@hotel.com';
  const plainPassword = 'admin123';
  const role = 'admin';
  const fullName = 'System Administrator';

  try {
    // Check if admin already exists
    const checkQuery = 'SELECT id FROM users WHERE email = $1';
    const checkResult = await pool.query(checkQuery, [email]);

    if (checkResult.rows.length > 0) {
      console.log('[SEED] Admin user already exists, skipping...');
      return;
    }

    // Hash password before insertion
    const passwordHash = await hashPassword(plainPassword);

    // Insert admin user
    const insertQuery = `
      INSERT INTO users (email, password_hash, role, full_name)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, role, full_name
    `;
    const result = await pool.query(insertQuery, [email, passwordHash, role, fullName]);

    console.log('[SEED] Admin user created successfully:', result.rows[0]);
  } catch (error) {
    console.error('[SEED] Error creating admin user:', error.message);
    throw error;
  }
}

/**
 * Seed sample rooms
 */
async function seedRooms() {
  console.log('[SEED] Creating sample rooms...');

  const rooms = [
    { number: '101', type: 'simple', price_per_night: 50.00, status: 'AVAILABLE' },
    { number: '102', type: 'simple', price_per_night: 50.00, status: 'AVAILABLE' },
    { number: '103', type: 'doble', price_per_night: 80.00, status: 'AVAILABLE' },
    { number: '104', type: 'doble', price_per_night: 80.00, status: 'OCCUPIED' },
    { number: '201', type: 'doble', price_per_night: 85.00, status: 'AVAILABLE' },
    { number: '202', type: 'suite', price_per_night: 150.00, status: 'AVAILABLE' },
    { number: '203', type: 'suite', price_per_night: 150.00, status: 'CLEANING' },
    { number: '301', type: 'simple', price_per_night: 55.00, status: 'AVAILABLE' },
    { number: '302', type: 'doble', price_per_night: 90.00, status: 'MAINTENANCE' },
    { number: '303', type: 'suite', price_per_night: 160.00, status: 'AVAILABLE' }
  ];

  try {
    for (const room of rooms) {
      // Check if room already exists
      const checkQuery = 'SELECT id FROM rooms WHERE number = $1';
      const checkResult = await pool.query(checkQuery, [room.number]);

      if (checkResult.rows.length > 0) {
        console.log(`[SEED] Room ${room.number} already exists, skipping...`);
        continue;
      }

      // Insert room
      const insertQuery = `
        INSERT INTO rooms (number, type, price_per_night, status)
        VALUES ($1, $2, $3, $4)
        RETURNING id, number, type, status
      `;
      const result = await pool.query(insertQuery, [
        room.number,
        room.type,
        room.price_per_night,
        room.status
      ]);

      console.log(`[SEED] Room created:`, result.rows[0]);
    }

    console.log('[SEED] All sample rooms created successfully');
  } catch (error) {
    console.error('[SEED] Error creating rooms:', error.message);
    throw error;
  }
}

/**
 * Main seed function
 */
async function seed() {
  console.log('[SEED] Starting database seeding...');
  console.log('[SEED] ================================');

  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('[SEED] Database connection successful');

    // Seed admin user
    await seedAdminUser();

    // Seed sample rooms
    await seedRooms();

    console.log('[SEED] ================================');
    console.log('[SEED] Database seeding completed successfully!');
    console.log('[SEED] ');
    console.log('[SEED] Admin credentials:');
    console.log('[SEED]   Email: admin@hotel.com');
    console.log('[SEED]   Password: admin123');
    console.log('[SEED] ');
    
    process.exit(0);
  } catch (error) {
    console.error('[SEED] ================================');
    console.error('[SEED] Seeding failed:', error.message);
    console.error('[SEED] ================================');
    process.exit(1);
  }
}

// Run seed if executed directly
if (require.main === module) {
  seed();
}

module.exports = { seed, seedAdminUser, seedRooms };
