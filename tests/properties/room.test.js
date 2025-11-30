/**
 * Property-Based Tests for Room Service
 * **Feature: hotel-management-refactor, Property 7: Room creation with broadcast**
 * **Feature: hotel-management-refactor, Property 12: Availability filtering**
 * **Validates: Requirements 4.2, 6.1**
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

const roomService = require('../../src/services/roomService');
const Room = require('../../src/models/Room');
const AuditLog = require('../../src/models/AuditLog');
const pool = require('../../src/config/database');

// Counter for unique room numbers
let roomCounter = 0;

// Helper to generate unique short room numbers
function generateUniqueRoomNumber() {
  return `T${++roomCounter}`;
}

describe('Property 7: Room creation with broadcast', () => {
  let testActorId;

  beforeAll(async () => {
    // Create a test admin user to use as actor
    const testUser = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-room-admin@example.com', 'hash123', 'admin', 'Test Admin']
    );
    testActorId = testUser.rows[0].id;
  });

  beforeEach(async () => {
    // Clean up in correct dependency order
    await pool.query('DELETE FROM audit_logs WHERE actor_id = $1', [testActorId]);
    await pool.query('DELETE FROM bookings WHERE room_id IN (SELECT id FROM rooms WHERE number LIKE $1)', ['T%']);
    await pool.query(`DELETE FROM rooms WHERE number LIKE 'T%'`);
  });

  afterEach(async () => {
    // Clean up in correct dependency order
    await pool.query('DELETE FROM audit_logs WHERE actor_id = $1', [testActorId]);
    await pool.query('DELETE FROM bookings WHERE room_id IN (SELECT id FROM rooms WHERE number LIKE $1)', ['T%']);
    await pool.query(`DELETE FROM rooms WHERE number LIKE 'T%'`);
  });

  afterAll(async () => {
    // Clean up audit logs first (foreign key dependency)
    await pool.query('DELETE FROM audit_logs WHERE actor_id = $1', [testActorId]);
    // Clean up test user (don't end pool - let second describe block use it)
    await pool.query('DELETE FROM users WHERE id = $1', [testActorId]);
  });

  // **Feature: hotel-management-refactor, Property 7: Room creation with broadcast**
  test('Property 7: For any room creation by an admin actor, system must insert room record and create audit log', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random room data
        fc.record({
          type: fc.constantFrom('simple', 'doble', 'suite'),
          price_per_night: fc.float({ min: 50, max: 500, noNaN: true }).map(n => Math.round(n * 100) / 100),
          status: fc.constantFrom('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'CLEANING')
        }),
        async (roomData) => {
          // Generate unique room number for each test
          roomData.number = generateUniqueRoomNumber();
          // Execute: Create room using room service
          const createdRoom = await roomService.createRoom(testActorId, roomData);

          // Property 1: Room must be created and returned
          expect(createdRoom).toBeDefined();
          expect(createdRoom.id).toBeDefined();
          expect(createdRoom.number).toBe(roomData.number);
          expect(createdRoom.type).toBe(roomData.type);
          expect(parseFloat(createdRoom.price_per_night)).toBeCloseTo(roomData.price_per_night, 2);
          expect(createdRoom.status).toBe(roomData.status);

          // Property 2: Room must be inserted into database
          const roomInDb = await Room.findById(createdRoom.id);
          expect(roomInDb).toBeDefined();
          expect(roomInDb.number).toBe(roomData.number);
          expect(roomInDb.type).toBe(roomData.type);
          expect(parseFloat(roomInDb.price_per_night)).toBeCloseTo(roomData.price_per_night, 2);
          expect(roomInDb.status).toBe(roomData.status);

          // Property 3: Audit log must be created for room creation
          const auditLogs = await AuditLog.findByActorId(testActorId);
          expect(auditLogs.length).toBeGreaterThan(0);

          const roomCreationLog = auditLogs.find(log => 
            log.action === 'CREATE_ROOM' && 
            log.details.affected_entity_id === createdRoom.id.toString()
          );
          
          expect(roomCreationLog).toBeDefined();
          expect(roomCreationLog.actor_id).toBe(testActorId);
          expect(roomCreationLog.action).toBe('CREATE_ROOM');
          
          // Property 4: Audit log details must contain previous_value (null), new_value, and affected_entity_id
          const details = typeof roomCreationLog.details === 'string' 
            ? JSON.parse(roomCreationLog.details) 
            : roomCreationLog.details;
          
          expect(details.previous_value).toBeNull();
          expect(details.new_value).toBeDefined();
          expect(details.new_value.number).toBe(roomData.number);
          expect(details.affected_entity_id).toBe(createdRoom.id.toString());

          // Don't clean up here - let afterEach handle it
        }
      ),
      { numRuns: 5 }
    );
  }, 120000);

  test('Property 7 (validation): Room creation must reject invalid room data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          hasValidNumber: fc.boolean(),
          type: fc.oneof(
            fc.constant('invalid_type'),
            fc.constantFrom('simple', 'doble', 'suite')
          ),
          price_per_night: fc.oneof(
            fc.constant(-10),
            fc.constant(0),
            fc.float({ min: 50, max: 500, noNaN: true }).map(n => Math.round(n * 100) / 100)
          ),
          status: fc.oneof(
            fc.constant('INVALID_STATUS'),
            fc.constantFrom('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'CLEANING')
          )
        }),
        async (testData) => {
          // Generate unique room number
          const roomData = {
            number: testData.hasValidNumber ? generateUniqueRoomNumber() : null,
            type: testData.type,
            price_per_night: testData.price_per_night,
            status: testData.status
          };
          // Determine if data is valid
          const isValidNumber = roomData.number && typeof roomData.number === 'string' && roomData.number.length > 0;
          const isValidType = ['simple', 'doble', 'suite'].includes(roomData.type);
          const isValidPrice = typeof roomData.price_per_night === 'number' && roomData.price_per_night > 0;
          const isValidStatus = ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'CLEANING'].includes(roomData.status);
          
          const isValid = isValidNumber && isValidType && isValidPrice && isValidStatus;

          if (isValid) {
            // Should succeed
            const createdRoom = await roomService.createRoom(testActorId, roomData);
            expect(createdRoom).toBeDefined();
            expect(createdRoom.number).toBe(roomData.number);
            
            // Don't clean up here - let afterEach handle it
          } else {
            // Should throw error
            await expect(
              roomService.createRoom(testActorId, roomData)
            ).rejects.toThrow();
          }
        }
      ),
      { numRuns: 5 }
    );
  }, 120000);

  test('Property 7 (update): Room update must create audit log with previous and new values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          initialRoom: fc.record({
            type: fc.constantFrom('simple', 'doble', 'suite'),
            price_per_night: fc.float({ min: 50, max: 500, noNaN: true }).map(n => Math.round(n * 100) / 100),
            status: fc.constantFrom('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'CLEANING')
          }),
          updates: fc.record({
            status: fc.constantFrom('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'CLEANING'),
            price_per_night: fc.float({ min: 50, max: 500, noNaN: true }).map(n => Math.round(n * 100) / 100)
          })
        }),
        async ({ initialRoom, updates }) => {
          // Generate unique room number
          initialRoom.number = generateUniqueRoomNumber();
          
          // Setup: Create initial room
          const createdRoom = await roomService.createRoom(testActorId, initialRoom);
          
          // Clear audit logs from creation
          await pool.query('DELETE FROM audit_logs WHERE action = $1', ['CREATE_ROOM']);

          // Execute: Update room
          const updatedRoom = await roomService.updateRoom(testActorId, createdRoom.id, updates);

          // Property 1: Room must be updated in database
          expect(updatedRoom).toBeDefined();
          expect(updatedRoom.status).toBe(updates.status);
          expect(parseFloat(updatedRoom.price_per_night)).toBeCloseTo(updates.price_per_night, 2);

          // Property 2: Audit log must be created for room update
          const auditLogs = await AuditLog.findByAction('UPDATE_ROOM');
          expect(auditLogs.length).toBeGreaterThan(0);

          const updateLog = auditLogs.find(log => 
            log.details.affected_entity_id === createdRoom.id.toString()
          );
          
          expect(updateLog).toBeDefined();
          expect(updateLog.actor_id).toBe(testActorId);
          
          // Property 3: Audit log must contain both previous and new values
          const details = typeof updateLog.details === 'string' 
            ? JSON.parse(updateLog.details) 
            : updateLog.details;
          
          expect(details.previous_value).toBeDefined();
          expect(details.previous_value.status).toBe(initialRoom.status);
          expect(details.new_value).toBeDefined();
          expect(details.new_value.status).toBe(updates.status);

          // Don't clean up here - let afterEach handle it
        }
      ),
      { numRuns: 5 }
    );
  }, 120000);
});

describe('Property 12: Availability filtering', () => {
  let testActorId;

  beforeAll(async () => {
    // Clean up any existing test user first
    await pool.query('DELETE FROM users WHERE email = $1', ['test-room-filter@example.com']);
    
    // Create a test admin user to use as actor
    const testUser = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-room-filter@example.com', 'hash123', 'admin', 'Test Admin']
    );
    testActorId = testUser.rows[0].id;
  });

  beforeEach(async () => {
    // Clean up in correct dependency order
    await pool.query('DELETE FROM audit_logs WHERE actor_id = $1', [testActorId]);
    await pool.query('DELETE FROM bookings WHERE room_id IN (SELECT id FROM rooms WHERE number LIKE $1)', ['T%']);
    await pool.query(`DELETE FROM rooms WHERE number LIKE 'T%'`);
  });

  afterEach(async () => {
    // Clean up in correct dependency order
    await pool.query('DELETE FROM audit_logs WHERE actor_id = $1', [testActorId]);
    await pool.query('DELETE FROM bookings WHERE room_id IN (SELECT id FROM rooms WHERE number LIKE $1)', ['T%']);
    await pool.query(`DELETE FROM rooms WHERE number LIKE 'T%'`);
  });

  afterAll(async () => {
    // Clean up audit logs first (foreign key dependency)
    await pool.query('DELETE FROM audit_logs WHERE actor_id = $1', [testActorId]);
    // Clean up test user and end pool
    await pool.query('DELETE FROM users WHERE id = $1', [testActorId]);
    await pool.end();
  });

  // **Feature: hotel-management-refactor, Property 12: Availability filtering**
  test('Property 12: For any room availability query, system must return only rooms with AVAILABLE status', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate an array of rooms with various statuses
        fc.array(
          fc.record({
            type: fc.constantFrom('simple', 'doble', 'suite'),
            price_per_night: fc.float({ min: 50, max: 500, noNaN: true }).map(n => Math.round(n * 100) / 100),
            status: fc.constantFrom('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'CLEANING')
          }),
          { minLength: 5, maxLength: 10 }
        ),
        async (roomsData) => {
          // Add unique numbers to each room
          roomsData.forEach(room => {
            room.number = generateUniqueRoomNumber();
          });
          // Setup: Create multiple rooms with different statuses
          const createdRooms = [];
          for (const roomData of roomsData) {
            try {
              const room = await roomService.createRoom(testActorId, roomData);
              createdRooms.push(room);
            } catch (error) {
              // Skip duplicate room numbers
              if (!error.message.includes('duplicate')) {
                throw error;
              }
            }
          }

          // Execute: Query for available rooms
          const availableRooms = await roomService.getRoomsByStatus('AVAILABLE');

          // Property 1: All returned rooms must have AVAILABLE status
          for (const room of availableRooms) {
            if (room.number.startsWith('TEST-')) {
              expect(room.status).toBe('AVAILABLE');
            }
          }

          // Property 2: Count of available rooms should match expected count
          const expectedAvailableCount = createdRooms.filter(r => r.status === 'AVAILABLE').length;
          const actualAvailableCount = availableRooms.filter(r => 
            createdRooms.some(cr => cr.id === r.id)
          ).length;
          
          expect(actualAvailableCount).toBe(expectedAvailableCount);

          // Property 3: No rooms with other statuses should be returned
          const testRoomIds = createdRooms.map(r => r.id);
          const returnedTestRooms = availableRooms.filter(r => testRoomIds.includes(r.id));
          
          for (const room of returnedTestRooms) {
            expect(room.status).toBe('AVAILABLE');
          }

          // Don't clean up here - let afterEach handle it
        }
      ),
      { numRuns: 5 }
    );
  }, 120000);

  test('Property 12 (all statuses): getRoomsByStatus must correctly filter for any valid status', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            type: fc.constantFrom('simple', 'doble', 'suite'),
            price_per_night: fc.float({ min: 50, max: 500, noNaN: true }).map(n => Math.round(n * 100) / 100),
            status: fc.constantFrom('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'CLEANING')
          }),
          { minLength: 5, maxLength: 10 }
        ),
        fc.constantFrom('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'CLEANING'),
        async (roomsData, queryStatus) => {
          // Add unique numbers to each room
          roomsData.forEach(room => {
            room.number = generateUniqueRoomNumber();
          });
          // Setup: Create multiple rooms with different statuses
          const createdRooms = [];
          for (const roomData of roomsData) {
            try {
              const room = await roomService.createRoom(testActorId, roomData);
              createdRooms.push(room);
            } catch (error) {
              // Skip duplicate room numbers
              if (!error.message.includes('duplicate')) {
                throw error;
              }
            }
          }

          // Execute: Query for rooms with specific status
          const filteredRooms = await roomService.getRoomsByStatus(queryStatus);

          // Property: All returned rooms must have the queried status
          const testRoomIds = createdRooms.map(r => r.id);
          const returnedTestRooms = filteredRooms.filter(r => testRoomIds.includes(r.id));
          
          for (const room of returnedTestRooms) {
            expect(room.status).toBe(queryStatus);
          }

          // Property: Count should match expected count
          const expectedCount = createdRooms.filter(r => r.status === queryStatus).length;
          expect(returnedTestRooms.length).toBe(expectedCount);

          // Don't clean up here - let afterEach handle it
        }
      ),
      { numRuns: 5 }
    );
  }, 120000);
});
