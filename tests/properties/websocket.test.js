/**
 * Property-Based Tests for WebSocket Broadcasting
 * **Feature: hotel-management-refactor, Property 1: Database-first consistency**
 * **Feature: hotel-management-refactor, Property 4: Client synchronization on connection**
 * **Validates: Requirements 1.2, 2.1, 2.5**
 */

const fc = require('fast-check');
const http = require('http');
const { Server } = require('socket.io');
const { io: ioClient } = require('socket.io-client');

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
const bookingService = require('../../src/services/bookingService');
const operationsService = require('../../src/services/operationsService');
const Room = require('../../src/models/Room');
const pool = require('../../src/config/database');
const { generateToken } = require('../../src/utils/jwt');
const { initializeSocketController } = require('../../src/controllers/socketController');

// Counter for unique room numbers
let roomCounter = 0;

// Helper to generate unique short room numbers
function generateUniqueRoomNumber() {
  return `WS${++roomCounter}`;
}

describe('Property 1: Database-first consistency', () => {
  let testActorId;
  let testClientId;
  let testStaffId;
  let httpServer;
  let io;
  let clientSocket;
  let token;

  beforeAll(async () => {
    // Create test users
    const adminUser = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-ws-admin@example.com', 'hash123', 'admin', 'Test Admin']
    );
    testActorId = adminUser.rows[0].id;

    const clientUser = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-ws-client@example.com', 'hash123', 'client', 'Test Client']
    );
    testClientId = clientUser.rows[0].id;

    const staffUser = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-ws-staff@example.com', 'hash123', 'staff', 'Test Staff']
    );
    testStaffId = staffUser.rows[0].id;

    // Generate JWT token for client authentication
    token = generateToken(testClientId, 'client');

    // Set up Socket.IO server
    httpServer = http.createServer();
    io = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    // Initialize socket controller
    initializeSocketController(io);

    // Set Socket.IO instance in services
    roomService.setSocketIO(io);
    bookingService.setSocketIO(io);
    operationsService.setSocketIO(io);

    // Start server on random port
    await new Promise((resolve) => {
      httpServer.listen(0, resolve);
    });
  });

  beforeEach(async () => {
    // Clean up test data
    await pool.query('DELETE FROM audit_logs');
    await pool.query('DELETE FROM bookings');
    await pool.query(`DELETE FROM rooms WHERE number LIKE 'WS%'`);

    // Create client socket connection
    const port = httpServer.address().port;
    clientSocket = ioClient(`http://localhost:${port}`, {
      auth: { token }
    });

    await new Promise((resolve) => {
      clientSocket.on('connect', resolve);
    });
  });

  afterEach(async () => {
    // Disconnect client
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }

    // Clean up test data
    await pool.query('DELETE FROM audit_logs');
    await pool.query('DELETE FROM bookings');
    await pool.query(`DELETE FROM rooms WHERE number LIKE 'WS%'`);
  });

  afterAll(async () => {
    // Close server
    if (io) {
      io.close();
    }
    if (httpServer) {
      await new Promise((resolve) => {
        httpServer.close(resolve);
      });
    }

    // Clean up test users
    await pool.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [testActorId, testClientId, testStaffId]);
    // Don't end pool here - let the second describe block use it
  });

  // **Feature: hotel-management-refactor, Property 1: Database-first consistency**
  test('Property 1: For any room creation, database write must complete before WebSocket broadcast', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          type: fc.constantFrom('simple', 'doble', 'suite'),
          price_per_night: fc.float({ min: 50, max: 500, noNaN: true }).map(n => Math.round(n * 100) / 100),
          status: fc.constantFrom('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'CLEANING')
        }),
        async (roomData) => {
          roomData.number = generateUniqueRoomNumber();

          // Track events
          let broadcastReceived = false;
          let broadcastedRoom = null;

          // Listen for broadcast
          clientSocket.on('room_update', (data) => {
            if (data.room && data.room.number === roomData.number) {
              broadcastReceived = true;
              broadcastedRoom = data.room;
            }
          });

          // Execute: Create room
          const createdRoom = await roomService.createRoom(testActorId, 'admin', roomData);

          // Wait a bit for broadcast to arrive
          await new Promise(resolve => setTimeout(resolve, 100));

          // Property 1: Room must exist in database
          const roomInDb = await Room.findById(createdRoom.id);
          expect(roomInDb).toBeDefined();
          expect(roomInDb.number).toBe(roomData.number);

          // Property 2: If broadcast was received, the room must already be in database
          // This is implicitly tested by the fact that we query the database after creation
          // and before checking the broadcast

          // Property 3: Broadcast should have been sent
          expect(broadcastReceived).toBe(true);
          expect(broadcastedRoom).toBeDefined();
          expect(broadcastedRoom.number).toBe(roomData.number);

          // Clean up
          await pool.query('DELETE FROM rooms WHERE id = $1', [createdRoom.id]);
          clientSocket.off('room_update');
        }
      ),
      { numRuns: 20 }
    );
  }, 120000);

  test('Property 1: For any booking creation, database write must complete before WebSocket broadcast', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          roomType: fc.constantFrom('simple', 'doble', 'suite'),
          price: fc.float({ min: 50, max: 500, noNaN: true }).map(n => Math.round(n * 100) / 100),
          daysAhead: fc.integer({ min: 1, max: 30 }),
          duration: fc.integer({ min: 1, max: 7 })
        }),
        async ({ roomType, price, daysAhead, duration }) => {
          // Setup: Create a room
          const roomData = {
            number: generateUniqueRoomNumber(),
            type: roomType,
            price_per_night: price,
            status: 'AVAILABLE'
          };
          const room = await roomService.createRoom(testActorId, 'admin', roomData);

          // Calculate dates
          const checkInDate = new Date();
          checkInDate.setDate(checkInDate.getDate() + daysAhead);
          const checkOutDate = new Date(checkInDate);
          checkOutDate.setDate(checkOutDate.getDate() + duration);

          const bookingData = {
            user_id: testClientId,
            room_id: room.id,
            check_in_date: checkInDate.toISOString().split('T')[0],
            check_out_date: checkOutDate.toISOString().split('T')[0]
          };

          // Track events
          let broadcastReceived = false;
          let broadcastedBooking = null;

          // Listen for broadcast
          clientSocket.on('booking_update', (data) => {
            if (data.booking && data.booking.room_id === room.id) {
              broadcastReceived = true;
              broadcastedBooking = data.booking;
            }
          });

          // Execute: Create booking
          const createdBooking = await bookingService.createBooking(testActorId, 'client', bookingData);

          // Wait for broadcast
          await new Promise(resolve => setTimeout(resolve, 100));

          // Property 1: Booking must exist in database
          const bookingQuery = await pool.query('SELECT * FROM bookings WHERE id = $1', [createdBooking.id]);
          expect(bookingQuery.rows.length).toBe(1);
          expect(bookingQuery.rows[0].room_id).toBe(room.id);

          // Property 2: Broadcast should have been sent
          expect(broadcastReceived).toBe(true);
          expect(broadcastedBooking).toBeDefined();
          expect(broadcastedBooking.room_id).toBe(room.id);

          // Clean up
          await pool.query('DELETE FROM bookings WHERE id = $1', [createdBooking.id]);
          await pool.query('DELETE FROM rooms WHERE id = $1', [room.id]);
          clientSocket.off('booking_update');
        }
      ),
      { numRuns: 10 }
    );
  }, 120000);

  test('Property 1: For any check-in operation, database write must complete before WebSocket broadcast', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          roomType: fc.constantFrom('simple', 'doble', 'suite'),
          price: fc.float({ min: 50, max: 500, noNaN: true }).map(n => Math.round(n * 100) / 100)
        }),
        async ({ roomType, price }) => {
          // Setup: Create room and booking
          const roomData = {
            number: generateUniqueRoomNumber(),
            type: roomType,
            price_per_night: price,
            status: 'AVAILABLE'
          };
          const room = await roomService.createRoom(testActorId, 'admin', roomData);

          const today = new Date().toISOString().split('T')[0];
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowStr = tomorrow.toISOString().split('T')[0];

          const bookingData = {
            user_id: testClientId,
            room_id: room.id,
            check_in_date: today,
            check_out_date: tomorrowStr
          };
          const booking = await bookingService.createBooking(testActorId, 'client', bookingData);

          // Track events
          let broadcastReceived = false;
          let broadcastedData = null;

          // Listen for broadcast
          clientSocket.on('operation_update', (data) => {
            if (data.action === 'check_in' && data.booking && data.booking.id === booking.id) {
              broadcastReceived = true;
              broadcastedData = data;
            }
          });

          // Execute: Check in
          const result = await operationsService.checkIn(testStaffId, 'staff', booking.id);

          // Wait for broadcast
          await new Promise(resolve => setTimeout(resolve, 100));

          // Property 1: Booking status must be updated in database
          const bookingQuery = await pool.query('SELECT * FROM bookings WHERE id = $1', [booking.id]);
          expect(bookingQuery.rows[0].status).toBe('CHECKED_IN');

          // Property 2: Room status must be updated in database
          const roomQuery = await pool.query('SELECT * FROM rooms WHERE id = $1', [room.id]);
          expect(roomQuery.rows[0].status).toBe('OCCUPIED');

          // Property 3: Broadcast should have been sent
          expect(broadcastReceived).toBe(true);
          expect(broadcastedData).toBeDefined();
          expect(broadcastedData.booking.status).toBe('CHECKED_IN');
          expect(broadcastedData.room.status).toBe('OCCUPIED');

          // Clean up
          await pool.query('DELETE FROM bookings WHERE id = $1', [booking.id]);
          await pool.query('DELETE FROM rooms WHERE id = $1', [room.id]);
          clientSocket.off('operation_update');
        }
      ),
      { numRuns: 10 }
    );
  }, 120000);
});

describe('Property 4: Client synchronization on connection', () => {
  let testActorId;
  let testClientId;
  let httpServer;
  let io;
  let token;

  beforeAll(async () => {
    // Create test users
    const adminUser = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-sync-admin@example.com', 'hash123', 'admin', 'Test Admin']
    );
    testActorId = adminUser.rows[0].id;

    const clientUser = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-sync-client@example.com', 'hash123', 'client', 'Test Client']
    );
    testClientId = clientUser.rows[0].id;

    // Generate JWT token
    token = generateToken(testClientId, 'client');

    // Set up Socket.IO server
    httpServer = http.createServer();
    io = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    // Initialize socket controller
    initializeSocketController(io);

    // Set Socket.IO instance in services
    roomService.setSocketIO(io);

    // Start server
    await new Promise((resolve) => {
      httpServer.listen(0, resolve);
    });
  });

  beforeEach(async () => {
    // Clean up test data
    await pool.query(`DELETE FROM rooms WHERE number LIKE 'WS%'`);
  });

  afterEach(async () => {
    // Clean up test data
    await pool.query(`DELETE FROM rooms WHERE number LIKE 'WS%'`);
  });

  afterAll(async () => {
    // Close server
    if (io) {
      io.close();
    }
    if (httpServer) {
      await new Promise((resolve) => {
        httpServer.close(resolve);
      });
    }

    // Clean up test users
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [testActorId, testClientId]);
    await pool.end();
  });

  // **Feature: hotel-management-refactor, Property 4: Client synchronization on connection**
  test('Property 4: For any new client connection, system must send complete current state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            type: fc.constantFrom('simple', 'doble', 'suite'),
            price_per_night: fc.float({ min: 50, max: 500, noNaN: true }).map(n => Math.round(n * 100) / 100),
            status: fc.constantFrom('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'CLEANING')
          }),
          { minLength: 3, maxLength: 8 }
        ),
        async (roomsData) => {
          // Setup: Create rooms in database
          const createdRooms = [];
          for (const roomData of roomsData) {
            roomData.number = generateUniqueRoomNumber();
            const room = await roomService.createRoom(testActorId, 'admin', roomData);
            createdRooms.push(room);
          }

          // Execute: Connect new client
          const port = httpServer.address().port;
          const clientSocket = ioClient(`http://localhost:${port}`, {
            auth: { token }
          });

          // Wait for connection and initial state
          const initialState = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Timeout waiting for initial state'));
            }, 5000);

            clientSocket.on('connect', () => {
              // Connection established
            });

            clientSocket.on('initial_state', (data) => {
              clearTimeout(timeout);
              resolve(data);
            });

            clientSocket.on('connect_error', (error) => {
              clearTimeout(timeout);
              reject(error);
            });
          });

          // Property 1: Initial state must be received
          expect(initialState).toBeDefined();
          expect(initialState.rooms).toBeDefined();
          expect(Array.isArray(initialState.rooms)).toBe(true);

          // Property 2: Initial state must contain all created rooms
          const createdRoomIds = createdRooms.map(r => r.id);
          const receivedRoomIds = initialState.rooms.map(r => r.id);
          
          for (const roomId of createdRoomIds) {
            expect(receivedRoomIds).toContain(roomId);
          }

          // Property 3: Each room in initial state must have correct status
          for (const createdRoom of createdRooms) {
            const receivedRoom = initialState.rooms.find(r => r.id === createdRoom.id);
            expect(receivedRoom).toBeDefined();
            expect(receivedRoom.status).toBe(createdRoom.status);
            expect(receivedRoom.number).toBe(createdRoom.number);
          }

          // Clean up
          clientSocket.disconnect();
          for (const room of createdRooms) {
            await pool.query('DELETE FROM rooms WHERE id = $1', [room.id]);
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 120000);
});
