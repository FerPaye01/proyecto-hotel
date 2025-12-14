/**
 * Unit tests for BookingService check-in/out operations
 * Tests the new functions added in task 6
 */

const BookingService = require('../../src/services/bookingService');
const pool = require('../../src/config/database');
const Booking = require('../../src/models/Booking');
const Room = require('../../src/models/Room');

describe('BookingService Check-in/Out Operations', () => {
  let testActorId;
  let testUserId;
  let testRoom;
  let testBooking;

  beforeAll(async () => {
    // Create test users
    const actorResult = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-booking-service-staff@test.com', 'hash', 'staff', 'Test Staff']
    );
    testActorId = actorResult.rows[0].id;

    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-booking-service-client@test.com', 'hash', 'client', 'Test Client']
    );
    testUserId = userResult.rows[0].id;

    // Create test room
    testRoom = await Room.create({
      number: 'BS-101',
      type: 'simple',
      price_per_night: 100,
      status: 'AVAILABLE'
    });
  });

  beforeEach(async () => {
    // Create a fresh booking for each test
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);

    testBooking = await Booking.create({
      user_id: testUserId,
      room_id: testRoom.id,
      check_in_date: tomorrow.toISOString().split('T')[0],
      check_out_date: dayAfter.toISOString().split('T')[0],
      total_cost: 100,
      status: 'CONFIRMED'
    });
  });

  afterEach(async () => {
    // Clean up bookings and audit logs
    await pool.query('DELETE FROM audit_logs WHERE actor_id = $1', [testActorId]);
    await pool.query('DELETE FROM bookings WHERE room_id = $1', [testRoom.id]);
    await pool.query('UPDATE rooms SET status = $1 WHERE id = $2', ['AVAILABLE', testRoom.id]);
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM audit_logs WHERE actor_id = $1', [testActorId]);
    await pool.query('DELETE FROM bookings WHERE room_id = $1', [testRoom.id]);
    await pool.query('DELETE FROM rooms WHERE id = $1', [testRoom.id]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [testActorId, testUserId]);
  });

  describe('checkIn', () => {
    test('should check in a booking and update statuses', async () => {
      const result = await BookingService.checkIn(testActorId, 'staff', testBooking.id);

      expect(result).toBeDefined();
      expect(result.booking).toBeDefined();
      expect(result.room).toBeDefined();
      expect(result.booking.status).toBe('CHECKED_IN');
      expect(result.room.status).toBe('OCCUPIED');
    });

    test('should reject check-in by non-staff/admin', async () => {
      await expect(
        BookingService.checkIn(testUserId, 'client', testBooking.id)
      ).rejects.toThrow('AUTHORIZATION_ERROR');
    });

    test('should reject check-in of non-CONFIRMED booking', async () => {
      // Update booking to CHECKED_IN
      await Booking.update(testBooking.id, { status: 'CHECKED_IN' });

      await expect(
        BookingService.checkIn(testActorId, 'staff', testBooking.id)
      ).rejects.toThrow('Cannot check in booking with status CHECKED_IN');
    });
  });

  describe('checkOut', () => {
    test('should check out a booking and update statuses', async () => {
      // First check in
      await BookingService.checkIn(testActorId, 'staff', testBooking.id);

      // Then check out
      const result = await BookingService.checkOut(testActorId, 'staff', testBooking.id);

      expect(result).toBeDefined();
      expect(result.booking).toBeDefined();
      expect(result.room).toBeDefined();
      expect(result.booking.status).toBe('CHECKED_OUT');
      expect(result.room.status).toBe('CLEANING');
      expect(result.finalCharges).toBeDefined();
      expect(result.lateFee).toBeDefined();
    });

    test('should reject check-out by non-staff/admin', async () => {
      await expect(
        BookingService.checkOut(testUserId, 'client', testBooking.id)
      ).rejects.toThrow('AUTHORIZATION_ERROR');
    });

    test('should reject check-out of non-CHECKED_IN booking', async () => {
      await expect(
        BookingService.checkOut(testActorId, 'staff', testBooking.id)
      ).rejects.toThrow('Cannot check out booking with status CONFIRMED');
    });
  });

  describe('processPayment', () => {
    test('should process payment and create audit log', async () => {
      const paymentData = {
        amount: 100,
        payment_method: 'card'
      };

      const result = await BookingService.processPayment(
        testActorId,
        'staff',
        testBooking.id,
        paymentData
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.payment).toBeDefined();
      expect(result.payment.amount).toBe(100);
      expect(result.payment.payment_method).toBe('card');
    });

    test('should reject payment by non-staff/admin', async () => {
      const paymentData = {
        amount: 100,
        payment_method: 'card'
      };

      await expect(
        BookingService.processPayment(testUserId, 'client', testBooking.id, paymentData)
      ).rejects.toThrow('AUTHORIZATION_ERROR');
    });

    test('should reject invalid payment method', async () => {
      const paymentData = {
        amount: 100,
        payment_method: 'bitcoin'
      };

      await expect(
        BookingService.processPayment(testActorId, 'staff', testBooking.id, paymentData)
      ).rejects.toThrow('Invalid payment method');
    });
  });

  describe('getBookingsByUserId', () => {
    test('should return only bookings for specified user', async () => {
      const bookings = await BookingService.getBookingsByUserId(testUserId);

      expect(Array.isArray(bookings)).toBe(true);
      expect(bookings.length).toBeGreaterThan(0);
      expect(bookings.every(b => b.user_id === testUserId)).toBe(true);
    });

    test('should throw error if user_id is missing', async () => {
      await expect(
        BookingService.getBookingsByUserId(null)
      ).rejects.toThrow('User ID is required');
    });
  });
});
