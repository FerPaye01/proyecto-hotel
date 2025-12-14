/**
 * Unit Tests for Cron Service
 * Tests automated maintenance tasks
 */

const CronService = require('../../src/services/cronService');
const pool = require('../../src/config/database');
const User = require('../../src/models/User');
const Booking = require('../../src/models/Booking');
const AuditLog = require('../../src/models/AuditLog');

describe('CronService', () => {
  let testUser;
  let systemUser;
  let testRoom;

  beforeAll(async () => {
    // Get or create system user
    systemUser = await User.findByEmail('system@internal');
    if (!systemUser) {
      systemUser = await User.create({
        email: 'system@internal',
        password_hash: 'LOCKED',
        role: 'system',
        full_name: 'System Automated Actor'
      });
    }

    // Create test user
    testUser = await User.create({
      email: `test-cron-${Date.now()}@example.com`,
      password_hash: 'hashedpassword',
      role: 'client',
      full_name: 'Test User'
    });

    // Create test room
    const roomResult = await pool.query(
      `INSERT INTO rooms (number, type, price_per_night, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      ['999', 'simple', 100, 'AVAILABLE']
    );
    testRoom = roomResult.rows[0];
  });

  afterAll(async () => {
    // Clean up test data
    try {
      if (testUser) {
        await pool.query('DELETE FROM bookings WHERE user_id = $1', [testUser.id]);
        // Note: Cannot delete user due to audit_logs foreign key constraint
        // Audit logs are immutable and use ON DELETE SET NULL
      }
      if (testRoom) {
        await pool.query('DELETE FROM rooms WHERE id = $1', [testRoom.id]);
      }
    } catch (error) {
      console.error('Cleanup error:', error.message);
    } finally {
      await pool.end();
    }
  });

  describe('expireBookings', () => {
    it('should expire bookings older than 24 hours in CONFIRMED status', async () => {
      // Create an old booking (simulate by setting created_at to 25 hours ago)
      const oldBooking = await pool.query(
        `INSERT INTO bookings (user_id, room_id, check_in_date, check_out_date, total_cost, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '25 hours')
         RETURNING *`,
        [testUser.id, testRoom.id, '2024-12-20', '2024-12-22', 200, 'CONFIRMED']
      );

      const result = await CronService.expireBookings();

      expect(result.count).toBeGreaterThanOrEqual(1);
      expect(result.ids).toContain(oldBooking.rows[0].id);

      // Verify booking status was updated
      const updatedBooking = await Booking.findById(oldBooking.rows[0].id);
      expect(updatedBooking.status).toBe('CANCELLED');

      // Verify audit log was created
      const auditLogs = await pool.query(
        'SELECT * FROM audit_logs WHERE action = $1 AND actor_id = $2 ORDER BY timestamp DESC LIMIT 1',
        ['EXPIRE_BOOKINGS', systemUser.id]
      );
      expect(auditLogs.rows.length).toBeGreaterThan(0);
      expect(auditLogs.rows[0].details.affected_count).toBeGreaterThanOrEqual(1);
    });

    it('should not expire recent bookings in CONFIRMED status', async () => {
      // Create a recent booking
      const recentBooking = await pool.query(
        `INSERT INTO bookings (user_id, room_id, check_in_date, check_out_date, total_cost, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [testUser.id, testRoom.id, '2024-12-21', '2024-12-23', 200, 'CONFIRMED']
      );

      const result = await CronService.expireBookings();

      // Verify recent booking was not expired
      const booking = await Booking.findById(recentBooking.rows[0].id);
      expect(booking.status).toBe('CONFIRMED');
    });

    it('should not expire bookings in other statuses', async () => {
      // Create an old booking with CHECKED_IN status
      const checkedInBooking = await pool.query(
        `INSERT INTO bookings (user_id, room_id, check_in_date, check_out_date, total_cost, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '25 hours')
         RETURNING *`,
        [testUser.id, testRoom.id, '2024-12-22', '2024-12-24', 200, 'CHECKED_IN']
      );

      await CronService.expireBookings();

      // Verify CHECKED_IN booking was not expired
      const booking = await Booking.findById(checkedInBooking.rows[0].id);
      expect(booking.status).toBe('CHECKED_IN');
    });
  });

  describe('runCleanupJob', () => {
    it('should run cleanup job successfully', async () => {
      const result = await CronService.runCleanupJob();

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('expiredBookings');
      expect(result).toHaveProperty('errors');
      expect(result.success).toBe(true);
      expect(result.expiredBookings).toHaveProperty('count');
      expect(result.expiredBookings).toHaveProperty('ids');
    });

    it('should handle errors gracefully', async () => {
      // Mock expireBookings to throw an error
      const originalExpireBookings = CronService.expireBookings;
      CronService.expireBookings = jest.fn().mockRejectedValue(new Error('Database error'));

      const result = await CronService.runCleanupJob();

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].operation).toBe('expireBookings');

      // Restore original function
      CronService.expireBookings = originalExpireBookings;
    });
  });

  describe('startCleanupJob', () => {
    it('should return an interval ID', () => {
      const intervalId = CronService.startCleanupJob();

      expect(intervalId).toBeDefined();
      expect(typeof intervalId).toBe('object'); // setInterval returns a Timeout object in Node.js

      // Clean up the interval
      clearInterval(intervalId);
    });
  });
});
