/**
 * Property-Based Tests for Booking Service
 * **Feature: hotel-management-refactor, Property 13: Booking conflict detection**
 * **Feature: hotel-management-refactor, Property 14: User data isolation**
 * **Feature: hotel-management-refactor, Property 15: Concurrent booking serialization**
 * **Feature: hotel-management-refactor, Property 16: Transaction atomicity**
 * **Validates: Requirements 6.2, 6.3, 6.4, 7.2, 7.3, 7.4, 7.5**
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

const bookingService = require('../../src/services/bookingService');
const Booking = require('../../src/models/Booking');
const Room = require('../../src/models/Room');
const AuditLog = require('../../src/models/AuditLog');
const pool = require('../../src/config/database');

// Counter for unique room numbers
let roomCounter = 0;

// Helper to generate unique room numbers
function generateUniqueRoomNumber() {
  return `BT${++roomCounter}`;
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

describe('Property 13: Booking conflict detection', () => {
  let testActorId;
  let testUserId;
  let testRoom;

  beforeAll(async () => {
    // Clean up any existing test data first
    await pool.query(`DELETE FROM users WHERE email LIKE 'test-booking-%'`);
    await pool.query(`DELETE FROM rooms WHERE number LIKE 'BT%'`);

    // Create test users
    const actorResult = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-booking-actor@example.com', 'hash123', 'admin', 'Test Actor']
    );
    testActorId = actorResult.rows[0].id;

    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-booking-user@example.com', 'hash123', 'client', 'Test User']
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
    // Clean up bookings and audit logs before each test
    await pool.query('DELETE FROM audit_logs WHERE action = $1', ['CREATE_BOOKING']);
    await pool.query('DELETE FROM bookings WHERE room_id = $1', [testRoom.id]);
  });

  afterEach(async () => {
    // Clean up after each test
    await pool.query('DELETE FROM audit_logs WHERE action = $1', ['CREATE_BOOKING']);
    await pool.query('DELETE FROM bookings WHERE room_id = $1', [testRoom.id]);
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM bookings WHERE room_id = $1', [testRoom.id]);
    await pool.query('DELETE FROM rooms WHERE id = $1', [testRoom.id]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [testActorId, testUserId]);
  });

  // **Feature: hotel-management-refactor, Property 13: Booking conflict detection**
  test('Property 13: For any booking creation request, system must verify date range does not overlap with existing bookings', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate two booking date ranges
        fc.record({
          existingBooking: fc.record({
            startOffset: fc.integer({ min: 1, max: 30 }),
            duration: fc.integer({ min: 1, max: 7 })
          }),
          newBooking: fc.record({
            startOffset: fc.integer({ min: 1, max: 30 }),
            duration: fc.integer({ min: 1, max: 7 })
          })
        }),
        async ({ existingBooking, newBooking }) => {
          // Calculate dates for existing booking
          const baseDate = new Date();
          const existingCheckIn = addDays(baseDate, existingBooking.startOffset);
          const existingCheckOut = addDays(existingCheckIn, existingBooking.duration);

          // Calculate dates for new booking
          const newCheckIn = addDays(baseDate, newBooking.startOffset);
          const newCheckOut = addDays(newCheckIn, newBooking.duration);

          // Setup: Create existing booking
          const existingBookingData = {
            user_id: testUserId,
            room_id: testRoom.id,
            check_in_date: formatDate(existingCheckIn),
            check_out_date: formatDate(existingCheckOut)
          };

          const createdBooking = await bookingService.createBooking(testActorId, existingBookingData);
          expect(createdBooking).toBeDefined();

          try {
            // Determine if dates overlap
            // Overlap occurs when: new_start < existing_end AND new_end > existing_start
            const hasOverlap = newCheckIn < existingCheckOut && newCheckOut > existingCheckIn;

            // Execute: Attempt to create new booking
            const newBookingData = {
              user_id: testUserId,
              room_id: testRoom.id,
              check_in_date: formatDate(newCheckIn),
              check_out_date: formatDate(newCheckOut)
            };

            if (hasOverlap) {
              // Property: If dates overlap, booking should be rejected
              await expect(
                bookingService.createBooking(testActorId, newBookingData)
              ).rejects.toThrow(/conflict/i);
            } else {
              // Property: If dates don't overlap, booking should succeed
              const newBookingResult = await bookingService.createBooking(testActorId, newBookingData);
              expect(newBookingResult).toBeDefined();
              expect(newBookingResult.room_id).toBe(testRoom.id);
              expect(newBookingResult.status).toBe('CONFIRMED');

              // Clean up the new booking
              await pool.query('DELETE FROM bookings WHERE id = $1', [newBookingResult.id]);
            }
          } finally {
            // Clean up the existing booking
            await pool.query('DELETE FROM bookings WHERE id = $1', [createdBooking.id]);
          }
        }
      ),
      { numRuns: 5 }
    );
  }, 60000);
});

describe('Property 14: User data isolation', () => {
  let testActorId;
  let testUser1Id;
  let testUser2Id;
  let testRoom1;
  let testRoom2;

  beforeAll(async () => {
    // Clean up any existing test data first
    await pool.query(`DELETE FROM users WHERE email LIKE 'test-isolation-%'`);

    // Create test users
    const actorResult = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-isolation-actor@example.com', 'hash123', 'admin', 'Test Actor']
    );
    testActorId = actorResult.rows[0].id;

    const user1Result = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-isolation-user1@example.com', 'hash123', 'client', 'Test User 1']
    );
    testUser1Id = user1Result.rows[0].id;

    const user2Result = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-isolation-user2@example.com', 'hash123', 'client', 'Test User 2']
    );
    testUser2Id = user2Result.rows[0].id;

    // Create separate test rooms for each user to avoid conflicts
    testRoom1 = await Room.create({
      number: generateUniqueRoomNumber(),
      type: 'simple',
      price_per_night: 100.00,
      status: 'AVAILABLE'
    });

    testRoom2 = await Room.create({
      number: generateUniqueRoomNumber(),
      type: 'doble',
      price_per_night: 150.00,
      status: 'AVAILABLE'
    });
  });

  beforeEach(async () => {
    // Clean up bookings before each test
    await pool.query('DELETE FROM bookings WHERE room_id IN ($1, $2)', [testRoom1.id, testRoom2.id]);
  });

  afterEach(async () => {
    // Clean up after each test
    await pool.query('DELETE FROM bookings WHERE room_id IN ($1, $2)', [testRoom1.id, testRoom2.id]);
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM bookings WHERE room_id IN ($1, $2)', [testRoom1.id, testRoom2.id]);
    await pool.query('DELETE FROM rooms WHERE id IN ($1, $2)', [testRoom1.id, testRoom2.id]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [testActorId, testUser1Id, testUser2Id]);
  });

  // **Feature: hotel-management-refactor, Property 14: User data isolation**
  test('Property 14: For any booking history request, system must return only bookings where user_id matches requesting actor', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate bookings for both users
        fc.record({
          user1Bookings: fc.array(
            fc.record({
              startOffset: fc.integer({ min: 1, max: 30 }),
              duration: fc.integer({ min: 1, max: 5 })
            }),
            { minLength: 1, maxLength: 2 }
          ),
          user2Bookings: fc.array(
            fc.record({
              startOffset: fc.integer({ min: 100, max: 150 }),
              duration: fc.integer({ min: 1, max: 5 })
            }),
            { minLength: 1, maxLength: 2 }
          )
        }),
        async ({ user1Bookings, user2Bookings }) => {
          // Clean up any existing bookings before this iteration
          await pool.query('DELETE FROM bookings WHERE room_id IN ($1, $2)', [testRoom1.id, testRoom2.id]);
          
          const baseDate = new Date();
          const createdBookingIds = [];

          // Setup: Create bookings for user 1 (using testRoom1)
          for (const bookingData of user1Bookings) {
            const checkIn = addDays(baseDate, bookingData.startOffset);
            const checkOut = addDays(checkIn, bookingData.duration);

            const booking = await bookingService.createBooking(testActorId, {
              user_id: testUser1Id,
              room_id: testRoom1.id,
              check_in_date: formatDate(checkIn),
              check_out_date: formatDate(checkOut)
            });
            createdBookingIds.push(booking.id);
          }

          // Setup: Create bookings for user 2 (using testRoom2)
          for (const bookingData of user2Bookings) {
            const checkIn = addDays(baseDate, bookingData.startOffset);
            const checkOut = addDays(checkIn, bookingData.duration);

            const booking = await bookingService.createBooking(testActorId, {
              user_id: testUser2Id,
              room_id: testRoom2.id,
              check_in_date: formatDate(checkIn),
              check_out_date: formatDate(checkOut)
            });
            createdBookingIds.push(booking.id);
          }

          // Execute: Get bookings for user 1
          const user1BookingsResult = await bookingService.getBookingsByUserId(testUser1Id);

          // Property 1: All returned bookings must belong to user 1
          for (const booking of user1BookingsResult) {
            expect(booking.user_id).toBe(testUser1Id);
          }

          // Property 2: Count should match expected count
          const expectedUser1Count = user1Bookings.length;
          const actualUser1Count = user1BookingsResult.filter(b => 
            createdBookingIds.includes(b.id)
          ).length;
          expect(actualUser1Count).toBe(expectedUser1Count);

          // Execute: Get bookings for user 2
          const user2BookingsResult = await bookingService.getBookingsByUserId(testUser2Id);

          // Property 3: All returned bookings must belong to user 2
          for (const booking of user2BookingsResult) {
            expect(booking.user_id).toBe(testUser2Id);
          }

          // Property 4: Count should match expected count
          const expectedUser2Count = user2Bookings.length;
          const actualUser2Count = user2BookingsResult.filter(b => 
            createdBookingIds.includes(b.id)
          ).length;
          expect(actualUser2Count).toBe(expectedUser2Count);

          // Property 5: User 1 should never see user 2's bookings
          const user1BookingIds = user1BookingsResult.map(b => b.id);
          const user2BookingIds = user2BookingsResult.map(b => b.id);
          
          for (const id of user1BookingIds) {
            expect(user2BookingIds).not.toContain(id);
          }

          // Clean up
          for (const id of createdBookingIds) {
            await pool.query('DELETE FROM bookings WHERE id = $1', [id]);
          }
        }
      ),
      { numRuns: 5 }
    );
  }, 60000);
});

describe('Property 15: Concurrent booking serialization', () => {
  let testActorId;
  let testUserId;
  let testRoom;

  beforeAll(async () => {
    // Clean up any existing test data first
    await pool.query(`DELETE FROM users WHERE email LIKE 'test-concurrent-%'`);

    // Create test users
    const actorResult = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-concurrent-actor@example.com', 'hash123', 'admin', 'Test Actor']
    );
    testActorId = actorResult.rows[0].id;

    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-concurrent-user@example.com', 'hash123', 'client', 'Test User']
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
    // Clean up bookings before each test
    await pool.query('DELETE FROM bookings WHERE room_id = $1', [testRoom.id]);
  });

  afterEach(async () => {
    // Clean up after each test
    await pool.query('DELETE FROM bookings WHERE room_id = $1', [testRoom.id]);
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM bookings WHERE room_id = $1', [testRoom.id]);
    await pool.query('DELETE FROM rooms WHERE id = $1', [testRoom.id]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [testActorId, testUserId]);
  });

  // **Feature: hotel-management-refactor, Property 15: Concurrent booking serialization**
  test('Property 15: For any two concurrent booking requests targeting same room and overlapping dates, only one should succeed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          startOffset: fc.integer({ min: 1, max: 30 }),
          duration: fc.integer({ min: 2, max: 7 })
        }),
        async ({ startOffset, duration }) => {
          const baseDate = new Date();
          const checkIn = addDays(baseDate, startOffset);
          const checkOut = addDays(checkIn, duration);

          // Create two identical booking requests
          const bookingData1 = {
            user_id: testUserId,
            room_id: testRoom.id,
            check_in_date: formatDate(checkIn),
            check_out_date: formatDate(checkOut)
          };

          const bookingData2 = {
            user_id: testUserId,
            room_id: testRoom.id,
            check_in_date: formatDate(checkIn),
            check_out_date: formatDate(checkOut)
          };

          // Execute: Attempt concurrent bookings
          const results = await Promise.allSettled([
            bookingService.createBooking(testActorId, bookingData1),
            bookingService.createBooking(testActorId, bookingData2)
          ]);

          // Property 1: Exactly one should succeed
          const successCount = results.filter(r => r.status === 'fulfilled').length;
          const failureCount = results.filter(r => r.status === 'rejected').length;

          expect(successCount).toBe(1);
          expect(failureCount).toBe(1);

          // Property 2: The failure should be due to conflict
          const failedResult = results.find(r => r.status === 'rejected');
          expect(failedResult.reason.message).toMatch(/conflict/i);

          // Property 3: Only one booking should exist in database
          const bookingsInDb = await pool.query(
            'SELECT * FROM bookings WHERE room_id = $1 AND check_in_date = $2 AND check_out_date = $3',
            [testRoom.id, formatDate(checkIn), formatDate(checkOut)]
          );
          expect(bookingsInDb.rows.length).toBe(1);

          // Clean up
          await pool.query('DELETE FROM bookings WHERE room_id = $1', [testRoom.id]);
        }
      ),
      { numRuns: 5 }
    );
  }, 60000);
});

describe('Property 16: Transaction atomicity', () => {
  let testActorId;
  let testUserId;
  let testRoom;

  beforeAll(async () => {
    // Clean up any existing test data first
    await pool.query(`DELETE FROM users WHERE email LIKE 'test-atomicity-%'`);

    // Create test users
    const actorResult = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-atomicity-actor@example.com', 'hash123', 'admin', 'Test Actor']
    );
    testActorId = actorResult.rows[0].id;

    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-atomicity-user@example.com', 'hash123', 'client', 'Test User']
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
    // Clean up bookings and audit logs before each test
    await pool.query('DELETE FROM audit_logs WHERE action = $1', ['CREATE_BOOKING']);
    await pool.query('DELETE FROM bookings WHERE room_id = $1', [testRoom.id]);
  });

  afterEach(async () => {
    // Clean up after each test
    await pool.query('DELETE FROM audit_logs WHERE action = $1', ['CREATE_BOOKING']);
    await pool.query('DELETE FROM bookings WHERE room_id = $1', [testRoom.id]);
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM bookings WHERE room_id = $1', [testRoom.id]);
    await pool.query('DELETE FROM rooms WHERE id = $1', [testRoom.id]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [testActorId, testUserId]);
    await pool.end();
  });

  // **Feature: hotel-management-refactor, Property 16: Transaction atomicity**
  test('Property 16: For any booking operation, either all changes commit together or all rollback together', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          validBooking: fc.boolean(),
          startOffset: fc.integer({ min: 1, max: 30 }),
          duration: fc.integer({ min: 1, max: 7 })
        }),
        async ({ validBooking, startOffset, duration }) => {
          const baseDate = new Date();
          const checkIn = addDays(baseDate, startOffset);
          const checkOut = addDays(checkIn, duration);

          // Create booking data (valid or invalid)
          const bookingData = {
            user_id: validBooking ? testUserId : 'invalid-uuid',
            room_id: testRoom.id,
            check_in_date: formatDate(checkIn),
            check_out_date: formatDate(checkOut)
          };

          // Count bookings and audit logs before operation
          const bookingsBeforeResult = await pool.query(
            'SELECT COUNT(*) FROM bookings WHERE room_id = $1',
            [testRoom.id]
          );
          const bookingsCountBefore = parseInt(bookingsBeforeResult.rows[0].count);

          const auditLogsBeforeResult = await pool.query(
            'SELECT COUNT(*) FROM audit_logs WHERE action = $1 AND actor_id = $2',
            ['CREATE_BOOKING', testActorId]
          );
          const auditLogsCountBefore = parseInt(auditLogsBeforeResult.rows[0].count);

          // Execute: Attempt to create booking
          if (validBooking) {
            // Should succeed
            const booking = await bookingService.createBooking(testActorId, bookingData);
            expect(booking).toBeDefined();

            // Property 1: Booking should be in database
            const bookingsAfterResult = await pool.query(
              'SELECT COUNT(*) FROM bookings WHERE room_id = $1',
              [testRoom.id]
            );
            const bookingsCountAfter = parseInt(bookingsAfterResult.rows[0].count);
            expect(bookingsCountAfter).toBe(bookingsCountBefore + 1);

            // Property 2: Audit log should be created
            const auditLogsAfterResult = await pool.query(
              'SELECT COUNT(*) FROM audit_logs WHERE action = $1 AND actor_id = $2',
              ['CREATE_BOOKING', testActorId]
            );
            const auditLogsCountAfter = parseInt(auditLogsAfterResult.rows[0].count);
            expect(auditLogsCountAfter).toBe(auditLogsCountBefore + 1);

            // Clean up
            await pool.query('DELETE FROM bookings WHERE id = $1', [booking.id]);
          } else {
            // Should fail
            await expect(
              bookingService.createBooking(testActorId, bookingData)
            ).rejects.toThrow();

            // Property 3: No booking should be in database (rollback)
            const bookingsAfterResult = await pool.query(
              'SELECT COUNT(*) FROM bookings WHERE room_id = $1',
              [testRoom.id]
            );
            const bookingsCountAfter = parseInt(bookingsAfterResult.rows[0].count);
            expect(bookingsCountAfter).toBe(bookingsCountBefore);

            // Property 4: No audit log should be created (rollback)
            const auditLogsAfterResult = await pool.query(
              'SELECT COUNT(*) FROM audit_logs WHERE action = $1 AND actor_id = $2',
              ['CREATE_BOOKING', testActorId]
            );
            const auditLogsCountAfter = parseInt(auditLogsAfterResult.rows[0].count);
            expect(auditLogsCountAfter).toBe(auditLogsCountBefore);
          }
        }
      ),
      { numRuns: 5 }
    );
  }, 60000);
});
