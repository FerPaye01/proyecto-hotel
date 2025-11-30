/**
 * Property-Based Tests for Operations Service
 * **Feature: hotel-management-refactor, Property 9: Check-in state transitions**
 * **Feature: hotel-management-refactor, Property 10: Check-out state transitions**
 * **Feature: hotel-management-refactor, Property 11: Late checkout penalty calculation**
 * **Validates: Requirements 5.1, 5.2, 5.4**
 */

const fc = require('fast-check');

// Load environment variables from .env file
require('dotenv').config();

// Set up test environment variables if not already set
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-secret-key-min-32-chars-long-for-testing';
}
if (!process.env.PORT) {
  process.env.PORT = '3000';
}

// Ensure DATABASE_URL is set (should come from .env file)
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required for tests. Please set it in your .env file.');
}

const operationsService = require('../../src/services/operationsService');
const bookingService = require('../../src/services/bookingService');
const Room = require('../../src/models/Room');
const pool = require('../../src/config/database');

// Counter for unique room numbers
let roomCounter = 0;

// Helper to generate unique room numbers
function generateUniqueRoomNumber() {
  return `OT${++roomCounter}`;
}

// Helper to format date as YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Helper to add days to a date
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

describe('Property 9: Check-in state transitions', () => {
  let testActorId;
  let testUserId;
  let testRoom;

  beforeAll(async () => {
    // Clean up any existing test data first
    await pool.query(`DELETE FROM users WHERE email LIKE 'test-checkin-%'`);

    // Create test users
    const actorResult = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-checkin-actor@example.com', 'hash123', 'staff', 'Test Staff']
    );
    testActorId = actorResult.rows[0].id;

    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-checkin-user@example.com', 'hash123', 'client', 'Test User']
    );
    testUserId = userResult.rows[0].id;

    // Create a test room
    testRoom = await Room.create({
      number: generateUniqueRoomNumber(),
      type: 'simple',
      price_per_night: 100.00,
      status: 'AVAILABLE'
    });
  });

  beforeEach(async () => {
    // Clean up bookings and reset room status before each test
    await pool.query('DELETE FROM audit_logs WHERE action IN ($1, $2)', ['CHECK_IN', 'CREATE_BOOKING']);
    await pool.query('DELETE FROM bookings WHERE room_id = $1', [testRoom.id]);
    await pool.query('UPDATE rooms SET status = $1 WHERE id = $2', ['AVAILABLE', testRoom.id]);
  });

  afterEach(async () => {
    // Clean up after each test
    await pool.query('DELETE FROM audit_logs WHERE action IN ($1, $2)', ['CHECK_IN', 'CREATE_BOOKING']);
    await pool.query('DELETE FROM bookings WHERE room_id = $1', [testRoom.id]);
    await pool.query('UPDATE rooms SET status = $1 WHERE id = $2', ['AVAILABLE', testRoom.id]);
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM bookings WHERE room_id = $1', [testRoom.id]);
    await pool.query('DELETE FROM rooms WHERE id = $1', [testRoom.id]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [testActorId, testUserId]);
  });

  // **Feature: hotel-management-refactor, Property 9: Check-in state transitions**
  test('Property 9: For any valid check-in operation, system must atomically update booking status to CHECKED_IN and room status to OCCUPIED', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Check-in date offset (0 = today, negative = past, positive = future)
          checkInOffset: fc.integer({ min: -5, max: 0 }),
          duration: fc.integer({ min: 1, max: 7 })
        }),
        async ({ checkInOffset, duration }) => {
          // Setup: Create a confirmed booking
          const baseDate = new Date();
          const checkInDate = addDays(baseDate, checkInOffset);
          const checkOutDate = addDays(checkInDate, duration);

          const bookingData = {
            user_id: testUserId,
            room_id: testRoom.id,
            check_in_date: formatDate(checkInDate),
            check_out_date: formatDate(checkOutDate)
          };

          const booking = await bookingService.createBooking(testActorId, bookingData);
          expect(booking.status).toBe('CONFIRMED');

          // Get initial room state
          const roomBefore = await Room.findById(testRoom.id);

          try {
            // Execute: Perform check-in
            const result = await operationsService.checkIn(testActorId, booking.id);

            // Property 1: Booking status must be CHECKED_IN
            expect(result.booking.status).toBe('CHECKED_IN');
            expect(result.booking.id).toBe(booking.id);

            // Property 2: Room status must be OCCUPIED
            expect(result.room.status).toBe('OCCUPIED');
            expect(result.room.id).toBe(testRoom.id);

            // Property 3: Verify in database (atomicity check)
            const bookingInDb = await pool.query('SELECT * FROM bookings WHERE id = $1', [booking.id]);
            expect(bookingInDb.rows[0].status).toBe('CHECKED_IN');

            const roomInDb = await pool.query('SELECT * FROM rooms WHERE id = $1', [testRoom.id]);
            expect(roomInDb.rows[0].status).toBe('OCCUPIED');

            // Property 4: Audit log should be created
            const auditLogs = await pool.query(
              `SELECT * FROM audit_logs WHERE action = $1 AND details->>'affected_entity_id' = $2`,
              ['CHECK_IN', booking.id]
            );
            expect(auditLogs.rows.length).toBeGreaterThan(0);
            expect(auditLogs.rows[0].actor_id).toBe(testActorId);
          } finally {
            // Clean up
            await pool.query('DELETE FROM bookings WHERE id = $1', [booking.id]);
            await pool.query('UPDATE rooms SET status = $1 WHERE id = $2', ['AVAILABLE', testRoom.id]);
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);

  test('Property 9 (edge case): Check-in before scheduled date should be rejected', async () => {
    // Setup: Create a booking for future date
    const baseDate = new Date();
    const checkInDate = addDays(baseDate, 5); // 5 days in future
    const checkOutDate = addDays(checkInDate, 3);

    const bookingData = {
      user_id: testUserId,
      room_id: testRoom.id,
      check_in_date: formatDate(checkInDate),
      check_out_date: formatDate(checkOutDate)
    };

    const booking = await bookingService.createBooking(testActorId, bookingData);

    try {
      // Execute: Attempt check-in before scheduled date
      await expect(
        operationsService.checkIn(testActorId, booking.id)
      ).rejects.toThrow(/before the scheduled check-in date/i);

      // Property: Booking and room status should remain unchanged
      const bookingInDb = await pool.query('SELECT * FROM bookings WHERE id = $1', [booking.id]);
      expect(bookingInDb.rows[0].status).toBe('CONFIRMED');

      const roomInDb = await pool.query('SELECT * FROM rooms WHERE id = $1', [testRoom.id]);
      expect(roomInDb.rows[0].status).toBe('AVAILABLE');
    } finally {
      // Clean up
      await pool.query('DELETE FROM bookings WHERE id = $1', [booking.id]);
    }
  });
});

describe('Property 10: Check-out state transitions', () => {
  let testActorId;
  let testUserId;
  let testRoom;

  beforeAll(async () => {
    // Clean up any existing test data first
    await pool.query(`DELETE FROM users WHERE email LIKE 'test-checkout-%'`);

    // Create test users
    const actorResult = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-checkout-actor@example.com', 'hash123', 'staff', 'Test Staff']
    );
    testActorId = actorResult.rows[0].id;

    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-checkout-user@example.com', 'hash123', 'client', 'Test User']
    );
    testUserId = userResult.rows[0].id;

    // Create a test room
    testRoom = await Room.create({
      number: generateUniqueRoomNumber(),
      type: 'doble',
      price_per_night: 150.00,
      status: 'AVAILABLE'
    });
  });

  beforeEach(async () => {
    // Clean up bookings and reset room status before each test
    await pool.query('DELETE FROM audit_logs WHERE action IN ($1, $2, $3)', ['CHECK_IN', 'CHECK_OUT', 'CREATE_BOOKING']);
    await pool.query('DELETE FROM bookings WHERE room_id = $1', [testRoom.id]);
    await pool.query('UPDATE rooms SET status = $1 WHERE id = $2', ['AVAILABLE', testRoom.id]);
  });

  afterEach(async () => {
    // Clean up after each test
    await pool.query('DELETE FROM audit_logs WHERE action IN ($1, $2, $3)', ['CHECK_IN', 'CHECK_OUT', 'CREATE_BOOKING']);
    await pool.query('DELETE FROM bookings WHERE room_id = $1', [testRoom.id]);
    await pool.query('UPDATE rooms SET status = $1 WHERE id = $2', ['AVAILABLE', testRoom.id]);
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM bookings WHERE room_id = $1', [testRoom.id]);
    await pool.query('DELETE FROM rooms WHERE id = $1', [testRoom.id]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [testActorId, testUserId]);
  });

  // **Feature: hotel-management-refactor, Property 10: Check-out state transitions**
  test('Property 10: For any valid check-out operation, system must atomically update booking status to CHECKED_OUT and room status to CLEANING', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          checkInOffset: fc.integer({ min: -10, max: -1 }),
          duration: fc.integer({ min: 1, max: 5 })
        }),
        async ({ checkInOffset, duration }) => {
          // Setup: Create a booking and check in
          const baseDate = new Date();
          const checkInDate = addDays(baseDate, checkInOffset);
          const checkOutDate = addDays(checkInDate, duration);

          const bookingData = {
            user_id: testUserId,
            room_id: testRoom.id,
            check_in_date: formatDate(checkInDate),
            check_out_date: formatDate(checkOutDate)
          };

          const booking = await bookingService.createBooking(testActorId, bookingData);
          
          // Perform check-in
          await operationsService.checkIn(testActorId, booking.id);

          // Verify checked-in state
          const bookingAfterCheckIn = await pool.query('SELECT * FROM bookings WHERE id = $1', [booking.id]);
          expect(bookingAfterCheckIn.rows[0].status).toBe('CHECKED_IN');

          const roomAfterCheckIn = await pool.query('SELECT * FROM rooms WHERE id = $1', [testRoom.id]);
          expect(roomAfterCheckIn.rows[0].status).toBe('OCCUPIED');

          try {
            // Execute: Perform check-out
            const result = await operationsService.checkOut(testActorId, testRoom.id);

            // Property 1: Booking status must be CHECKED_OUT
            expect(result.booking.status).toBe('CHECKED_OUT');
            expect(result.booking.id).toBe(booking.id);

            // Property 2: Room status must be CLEANING
            expect(result.room.status).toBe('CLEANING');
            expect(result.room.id).toBe(testRoom.id);

            // Property 3: Verify in database (atomicity check)
            const bookingInDb = await pool.query('SELECT * FROM bookings WHERE id = $1', [booking.id]);
            expect(bookingInDb.rows[0].status).toBe('CHECKED_OUT');

            const roomInDb = await pool.query('SELECT * FROM rooms WHERE id = $1', [testRoom.id]);
            expect(roomInDb.rows[0].status).toBe('CLEANING');

            // Property 4: Audit log should be created
            const auditLogs = await pool.query(
              `SELECT * FROM audit_logs WHERE action = $1 AND (details->>'room_id')::int = $2`,
              ['CHECK_OUT', testRoom.id]
            );
            expect(auditLogs.rows.length).toBeGreaterThan(0);
            expect(auditLogs.rows[0].actor_id).toBe(testActorId);
          } finally {
            // Clean up
            await pool.query('DELETE FROM bookings WHERE id = $1', [booking.id]);
            await pool.query('UPDATE rooms SET status = $1 WHERE id = $2', ['AVAILABLE', testRoom.id]);
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);
});

describe('Property 11: Late checkout penalty calculation', () => {
  let testActorId;
  let testUserId;
  let testRoom;

  beforeAll(async () => {
    // Clean up any existing test data first
    await pool.query(`DELETE FROM users WHERE email LIKE 'test-penalty-%'`);

    // Create test users
    const actorResult = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-penalty-actor@example.com', 'hash123', 'staff', 'Test Staff']
    );
    testActorId = actorResult.rows[0].id;

    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-penalty-user@example.com', 'hash123', 'client', 'Test User']
    );
    testUserId = userResult.rows[0].id;

    // Create a test room
    testRoom = await Room.create({
      number: generateUniqueRoomNumber(),
      type: 'suite',
      price_per_night: 200.00,
      status: 'AVAILABLE'
    });
  });

  beforeEach(async () => {
    // Clean up bookings and reset room status before each test
    await pool.query('DELETE FROM audit_logs WHERE action IN ($1, $2, $3)', ['CHECK_IN', 'CHECK_OUT', 'CREATE_BOOKING']);
    await pool.query('DELETE FROM bookings WHERE room_id = $1', [testRoom.id]);
    await pool.query('UPDATE rooms SET status = $1 WHERE id = $2', ['AVAILABLE', testRoom.id]);
  });

  afterEach(async () => {
    // Clean up after each test
    await pool.query('DELETE FROM audit_logs WHERE action IN ($1, $2, $3)', ['CHECK_IN', 'CHECK_OUT', 'CREATE_BOOKING']);
    await pool.query('DELETE FROM bookings WHERE room_id = $1', [testRoom.id]);
    await pool.query('UPDATE rooms SET status = $1 WHERE id = $2', ['AVAILABLE', testRoom.id]);
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM bookings WHERE room_id = $1', [testRoom.id]);
    await pool.query('DELETE FROM rooms WHERE id = $1', [testRoom.id]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [testActorId, testUserId]);
    await pool.end();
  });

  // **Feature: hotel-management-refactor, Property 11: Late checkout penalty calculation**
  test('Property 11: For any check-out after scheduled time, system must calculate late fee and include it in total_cost', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Create bookings that ended in the past (late checkout scenario)
          checkInOffset: fc.integer({ min: -10, max: -5 }),
          duration: fc.integer({ min: 1, max: 3 })
        }),
        async ({ checkInOffset, duration }) => {
          // Setup: Create a booking that has already passed its checkout date
          const baseDate = new Date();
          const checkInDate = addDays(baseDate, checkInOffset);
          const checkOutDate = addDays(checkInDate, duration);

          const bookingData = {
            user_id: testUserId,
            room_id: testRoom.id,
            check_in_date: formatDate(checkInDate),
            check_out_date: formatDate(checkOutDate)
          };

          const booking = await bookingService.createBooking(testActorId, bookingData);
          const originalTotalCost = parseFloat(booking.total_cost);
          
          // Perform check-in
          await operationsService.checkIn(testActorId, booking.id);

          try {
            // Execute: Perform check-out (which is late)
            const result = await operationsService.checkOut(testActorId, testRoom.id);

            // Determine if checkout is actually late
            const now = new Date();
            const checkOutDateTime = new Date(checkOutDate);
            checkOutDateTime.setHours(23, 59, 59, 999);
            const isLate = now > checkOutDateTime;

            if (isLate) {
              // Property 1: Late penalty should be calculated (50% of one night)
              const expectedPenalty = parseFloat(testRoom.price_per_night) * 0.5;
              expect(result.late_penalty).toBeCloseTo(expectedPenalty, 2);

              // Property 2: Total cost should include penalty
              const expectedTotalCost = originalTotalCost + expectedPenalty;
              expect(parseFloat(result.booking.total_cost)).toBeCloseTo(expectedTotalCost, 2);

              // Property 3: Verify in database
              const bookingInDb = await pool.query('SELECT * FROM bookings WHERE id = $1', [booking.id]);
              expect(parseFloat(bookingInDb.rows[0].total_cost)).toBeCloseTo(expectedTotalCost, 2);

              // Property 4: Audit log should include penalty information
              const auditLogs = await pool.query(
                `SELECT * FROM audit_logs WHERE action = $1 AND (details->>'room_id')::int = $2`,
                ['CHECK_OUT', testRoom.id]
              );
              expect(auditLogs.rows.length).toBeGreaterThan(0);
              const auditDetails = auditLogs.rows[0].details;
              expect(parseFloat(auditDetails.late_penalty)).toBeCloseTo(expectedPenalty, 2);
            } else {
              // Property 5: No penalty if not late
              expect(result.late_penalty).toBe(0);
              expect(parseFloat(result.booking.total_cost)).toBeCloseTo(originalTotalCost, 2);
            }
          } finally {
            // Clean up
            await pool.query('DELETE FROM bookings WHERE id = $1', [booking.id]);
            await pool.query('UPDATE rooms SET status = $1 WHERE id = $2', ['AVAILABLE', testRoom.id]);
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);

  test('Property 11 (edge case): On-time checkout should have no penalty', async () => {
    // Setup: Create a booking for today with future checkout
    const baseDate = new Date();
    const checkInDate = addDays(baseDate, -1); // Yesterday
    const checkOutDate = addDays(baseDate, 5); // 5 days from now (not late)

    const bookingData = {
      user_id: testUserId,
      room_id: testRoom.id,
      check_in_date: formatDate(checkInDate),
      check_out_date: formatDate(checkOutDate)
    };

    const booking = await bookingService.createBooking(testActorId, bookingData);
    const originalTotalCost = parseFloat(booking.total_cost);
    
    // Perform check-in
    await operationsService.checkIn(testActorId, booking.id);

    try {
      // Execute: Perform on-time check-out
      const result = await operationsService.checkOut(testActorId, testRoom.id);

      // Property: No penalty for on-time checkout
      expect(result.late_penalty).toBe(0);
      expect(parseFloat(result.booking.total_cost)).toBeCloseTo(originalTotalCost, 2);

      // Verify in database
      const bookingInDb = await pool.query('SELECT * FROM bookings WHERE id = $1', [booking.id]);
      expect(parseFloat(bookingInDb.rows[0].total_cost)).toBeCloseTo(originalTotalCost, 2);
    } finally {
      // Clean up
      await pool.query('DELETE FROM bookings WHERE id = $1', [booking.id]);
      await pool.query('UPDATE rooms SET status = $1 WHERE id = $2', ['AVAILABLE', testRoom.id]);
    }
  });
});
