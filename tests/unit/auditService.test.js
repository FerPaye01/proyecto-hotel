/**
 * Unit tests for AuditService detailed logging functions
 * Tests the new logging functions added in task 7
 */

const AuditService = require('../../src/services/auditService');
const AuditLog = require('../../src/models/AuditLog');
const User = require('../../src/models/User');
const pool = require('../../src/config/database');

describe('AuditService - Detailed Logging Functions', () => {
  let testActorId;
  let testTargetUserId;
  let systemUserId;

  beforeAll(async () => {
    // Clean up any existing test users first
    await pool.query(`DELETE FROM audit_logs WHERE actor_id IN (SELECT id FROM users WHERE email IN ('test-actor@example.com', 'test-target@example.com'))`);
    await pool.query(`DELETE FROM users WHERE email IN ('test-actor@example.com', 'test-target@example.com')`);

    // Create test users
    const testActor = await pool.query(`
      INSERT INTO users (email, password_hash, role, full_name)
      VALUES ('test-actor@example.com', 'hash', 'admin', 'Test Actor')
      RETURNING id
    `);
    testActorId = testActor.rows[0].id;

    const testTarget = await pool.query(`
      INSERT INTO users (email, password_hash, role, full_name)
      VALUES ('test-target@example.com', 'hash', 'client', 'Test Target')
      RETURNING id
    `);
    testTargetUserId = testTarget.rows[0].id;

    // Get system user
    const systemUser = await User.findByEmail('system@internal');
    systemUserId = systemUser?.id;
  });

  afterAll(async () => {
    // Clean up test data - delete audit logs first due to foreign key constraint
    await pool.query('DELETE FROM audit_logs WHERE actor_id = $1 OR actor_id = $2', [testActorId, systemUserId]);
    await pool.query(`DELETE FROM users WHERE email IN ('test-actor@example.com', 'test-target@example.com')`);
    await pool.end();
  });

  beforeEach(async () => {
    // Clean audit logs before each test
    await pool.query('DELETE FROM audit_logs WHERE actor_id = $1 OR actor_id = $2', [testActorId, systemUserId]);
  });

  describe('logUserManagement', () => {
    it('should create audit log with user management details', async () => {
      const changedFields = ['role', 'email'];
      const previousValues = { role: 'client', email: 'old@example.com' };
      const newValues = { role: 'staff', email: 'new@example.com' };

      const auditLog = await AuditService.logUserManagement(
        testActorId,
        'UPDATE_USER',
        testTargetUserId,
        changedFields,
        previousValues,
        newValues
      );

      expect(auditLog).toBeDefined();
      expect(auditLog.actor_id).toBe(testActorId);
      expect(auditLog.action).toBe('UPDATE_USER');
      expect(auditLog.details.target_user_id).toBe(testTargetUserId);
      expect(auditLog.details.changed_fields).toEqual(changedFields);
      expect(auditLog.details.previous_values).toEqual(previousValues);
      expect(auditLog.details.new_values).toEqual(newValues);
    });
  });

  describe('logCheckInOut', () => {
    it('should create audit log with check-in/out details', async () => {
      const bookingId = 'test-booking-id';
      const roomId = 101;
      const statusChanges = {
        previousBookingStatus: 'CONFIRMED',
        newBookingStatus: 'CHECKED_IN',
        previousRoomStatus: 'AVAILABLE',
        newRoomStatus: 'OCCUPIED'
      };

      const auditLog = await AuditService.logCheckInOut(
        testActorId,
        'CHECK_IN',
        bookingId,
        roomId,
        statusChanges
      );

      expect(auditLog).toBeDefined();
      expect(auditLog.actor_id).toBe(testActorId);
      expect(auditLog.action).toBe('CHECK_IN');
      expect(auditLog.details.booking_id).toBe(bookingId);
      expect(auditLog.details.room_id).toBe(roomId);
      expect(auditLog.details.previous_booking_status).toBe('CONFIRMED');
      expect(auditLog.details.new_booking_status).toBe('CHECKED_IN');
      expect(auditLog.details.previous_room_status).toBe('AVAILABLE');
      expect(auditLog.details.new_room_status).toBe('OCCUPIED');
    });
  });

  describe('logBookingCreation', () => {
    it('should create audit log with booking creation details', async () => {
      const bookingId = 'test-booking-id';
      const roomId = 101;
      const dates = {
        checkInDate: '2024-01-15',
        checkOutDate: '2024-01-20'
      };
      const totalCost = 500.00;

      const auditLog = await AuditService.logBookingCreation(
        testActorId,
        bookingId,
        roomId,
        dates,
        totalCost
      );

      expect(auditLog).toBeDefined();
      expect(auditLog.actor_id).toBe(testActorId);
      expect(auditLog.action).toBe('CREATE_BOOKING');
      expect(auditLog.details.booking_id).toBe(bookingId);
      expect(auditLog.details.room_id).toBe(roomId);
      expect(auditLog.details.check_in_date).toBe('2024-01-15');
      expect(auditLog.details.check_out_date).toBe('2024-01-20');
      expect(auditLog.details.total_cost).toBe(500.00);
    });
  });

  describe('logSystemAction', () => {
    it('should create audit log with system action details using system user', async () => {
      if (!systemUserId) {
        console.warn('System user not found, skipping test');
        return;
      }

      const actionType = 'EXPIRE_BOOKINGS';
      const affectedCount = 3;
      const affectedIds = ['booking-1', 'booking-2', 'booking-3'];
      const criteria = 'bookings older than 24 hours in CONFIRMED status';

      const auditLog = await AuditService.logSystemAction(
        actionType,
        affectedCount,
        affectedIds,
        criteria
      );

      expect(auditLog).toBeDefined();
      expect(auditLog.actor_id).toBe(systemUserId);
      expect(auditLog.action).toBe(actionType);
      expect(auditLog.details.action_type).toBe(actionType);
      expect(auditLog.details.affected_count).toBe(affectedCount);
      expect(auditLog.details.affected_ids).toEqual(affectedIds);
      expect(auditLog.details.criteria).toBe(criteria);
    });

    it('should throw error if system user does not exist', async () => {
      // Temporarily mock User.findByEmail to return null
      const originalFindByEmail = User.findByEmail;
      User.findByEmail = jest.fn().mockResolvedValue(null);

      await expect(
        AuditService.logSystemAction('TEST_ACTION', 0, [], 'test')
      ).rejects.toThrow('System user not found');

      // Restore original function
      User.findByEmail = originalFindByEmail;
    });
  });
});
