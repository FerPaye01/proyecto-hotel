/**
 * Integration Tests for HTTP Controllers and WebSocket Events
 * Tests auth, room, booking, and operations endpoints
 * Requirements: 8.1, 4.2, 6.2, 5.1, 2.1, 2.2, 2.5
 */

const request = require('supertest');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { io: ioClient } = require('socket.io-client');
const pool = require('../../src/config/database');
const authController = require('../../src/controllers/authController');
const roomController = require('../../src/controllers/roomController');
const bookingController = require('../../src/controllers/bookingController');
const operationsController = require('../../src/controllers/operationsController');
const { errorHandler } = require('../../src/middleware/errorHandler');
const { hashPassword } = require('../../src/utils/password');
const { generateToken } = require('../../src/utils/jwt');
const { initializeSocketController } = require('../../src/controllers/socketController');
const roomService = require('../../src/services/roomService');
const bookingService = require('../../src/services/bookingService');
const operationsService = require('../../src/services/operationsService');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/auth', authController);
app.use('/api/rooms', roomController);
app.use('/api/bookings', bookingController);
app.use('/api/operations', operationsController);
app.use(errorHandler);

describe('HTTP Controllers Integration Tests', () => {
  let testUser;
  let testStaff;
  let testAdmin;
  let testRoom;
  let clientToken;
  let staffToken;
  let adminToken;

  beforeAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM bookings WHERE 1=1');
    await pool.query('DELETE FROM rooms WHERE number LIKE $1', ['TEST-%']);
    await pool.query('DELETE FROM users WHERE email LIKE $1', ['test-%@test.com']);

    // Create test users
    const password_hash = await hashPassword('password123');
    
    const clientResult = await pool.query(
      'INSERT INTO users (email, password_hash, role, full_name) VALUES ($1, $2, $3, $4) RETURNING *',
      ['test-client@test.com', password_hash, 'client', 'Test Client']
    );
    testUser = clientResult.rows[0];

    const staffResult = await pool.query(
      'INSERT INTO users (email, password_hash, role, full_name) VALUES ($1, $2, $3, $4) RETURNING *',
      ['test-staff@test.com', password_hash, 'staff', 'Test Staff']
    );
    testStaff = staffResult.rows[0];

    const adminResult = await pool.query(
      'INSERT INTO users (email, password_hash, role, full_name) VALUES ($1, $2, $3, $4) RETURNING *',
      ['test-admin@test.com', password_hash, 'admin', 'Test Admin']
    );
    testAdmin = adminResult.rows[0];

    // Create test room
    const roomResult = await pool.query(
      'INSERT INTO rooms (number, type, price_per_night, status) VALUES ($1, $2, $3, $4) RETURNING *',
      ['TEST-101', 'simple', 100.00, 'AVAILABLE']
    );
    testRoom = roomResult.rows[0];
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM bookings WHERE 1=1');
    await pool.query('DELETE FROM rooms WHERE number LIKE $1', ['TEST-%']);
    await pool.query('DELETE FROM users WHERE email LIKE $1', ['test-%@test.com']);
    
    // Don't close pool here - let WebSocket tests use it
  });

  describe('Auth Endpoints', () => {
    test('POST /api/auth/login with valid credentials returns token', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test-client@test.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('test-client@test.com');
      expect(response.body.user.role).toBe('client');
      expect(response.body).toHaveProperty('redirectUrl');
      
      clientToken = response.body.token;
    });

    test('POST /api/auth/login with staff credentials returns correct redirect', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test-staff@test.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.redirectUrl).toBe('/staff/operations.html');
      
      staffToken = response.body.token;
    });

    test('POST /api/auth/login with admin credentials returns correct redirect', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test-admin@test.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.redirectUrl).toBe('/admin/dashboard.html');
      
      adminToken = response.body.token;
    });

    test('POST /api/auth/login with invalid credentials returns error', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test-client@test.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(500);
    });

    test('POST /api/auth/register creates new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test-newuser@test.com',
          password: 'password123',
          role: 'client',
          full_name: 'New User'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe('test-newuser@test.com');
    });
  });

  describe('Room Endpoints', () => {
    test('GET /api/rooms returns all rooms for authenticated user', async () => {
      const response = await request(app)
        .get('/api/rooms')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('rooms');
      expect(Array.isArray(response.body.rooms)).toBe(true);
    });

    test('GET /api/rooms/available returns only available rooms', async () => {
      const response = await request(app)
        .get('/api/rooms/available')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('rooms');
      expect(Array.isArray(response.body.rooms)).toBe(true);
      
      // All returned rooms should have AVAILABLE status
      response.body.rooms.forEach(room => {
        expect(room.status).toBe('AVAILABLE');
      });
    });

    test('POST /api/rooms creates room for admin', async () => {
      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          number: 'TEST-201',
          type: 'doble',
          price_per_night: 150.00,
          status: 'AVAILABLE'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('room');
      expect(response.body.room.number).toBe('TEST-201');
    });

    test('POST /api/rooms rejects non-admin users', async () => {
      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          number: 'TEST-202',
          type: 'simple',
          price_per_night: 100.00
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('AUTHORIZATION_ERROR');
    });

    test('PUT /api/rooms/:id updates room for admin', async () => {
      const response = await request(app)
        .put(`/api/rooms/${testRoom.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          price_per_night: 120.00
        });

      expect(response.status).toBe(200);
      expect(response.body.room.price_per_night).toBe('120.00');
    });
  });

  describe('Booking Endpoints', () => {
    let testBooking;

    test('POST /api/bookings creates booking for authenticated client', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date();
      dayAfter.setDate(dayAfter.getDate() + 2);

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          room_id: testRoom.id,
          check_in_date: tomorrow.toISOString().split('T')[0],
          check_out_date: dayAfter.toISOString().split('T')[0]
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('booking');
      expect(response.body.booking.room_id).toBe(testRoom.id);
      expect(response.body.booking.status).toBe('CONFIRMED');
      
      testBooking = response.body.booking;
    });

    test('POST /api/bookings rejects conflicting dates', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date();
      dayAfter.setDate(dayAfter.getDate() + 2);

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          room_id: testRoom.id,
          check_in_date: tomorrow.toISOString().split('T')[0],
          check_out_date: dayAfter.toISOString().split('T')[0]
        });

      expect(response.status).toBe(500);
    });

    test('GET /api/bookings/my-history returns user bookings', async () => {
      const response = await request(app)
        .get('/api/bookings/my-history')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('bookings');
      expect(Array.isArray(response.body.bookings)).toBe(true);
      expect(response.body.bookings.length).toBeGreaterThan(0);
      
      // All bookings should belong to the authenticated user
      response.body.bookings.forEach(booking => {
        expect(booking.user_id).toBe(testUser.id);
      });
    });
  });

  describe('Operations Endpoints', () => {
    test('POST /api/operations/checkin rejects non-staff users', async () => {
      const response = await request(app)
        .post('/api/operations/checkin')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          booking_id: 'some-booking-id'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('AUTHORIZATION_ERROR');
    });

    test('POST /api/operations/checkout rejects non-staff users', async () => {
      const response = await request(app)
        .post('/api/operations/checkout')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          room_id: testRoom.id
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('AUTHORIZATION_ERROR');
    });
  });
});

describe('WebSocket Integration Tests', () => {
  let httpServer;
  let io;
  let clientSocket1;
  let clientSocket2;
  let testUser;
  let testAdmin;
  let testStaff;
  let clientToken;
  let adminToken;
  let staffToken;
  let testRoom;

  beforeAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM bookings WHERE 1=1');
    await pool.query('DELETE FROM rooms WHERE number LIKE $1', ['WST-%']);
    await pool.query('DELETE FROM users WHERE email LIKE $1', ['ws-test-%@test.com']);

    // Create test users
    const password_hash = await hashPassword('password123');
    
    const clientResult = await pool.query(
      'INSERT INTO users (email, password_hash, role, full_name) VALUES ($1, $2, $3, $4) RETURNING *',
      ['ws-test-client@test.com', password_hash, 'client', 'WS Test Client']
    );
    testUser = clientResult.rows[0];
    clientToken = generateToken(testUser.id, testUser.role);

    const adminResult = await pool.query(
      'INSERT INTO users (email, password_hash, role, full_name) VALUES ($1, $2, $3, $4) RETURNING *',
      ['ws-test-admin@test.com', password_hash, 'admin', 'WS Test Admin']
    );
    testAdmin = adminResult.rows[0];
    adminToken = generateToken(testAdmin.id, testAdmin.role);

    const staffResult = await pool.query(
      'INSERT INTO users (email, password_hash, role, full_name) VALUES ($1, $2, $3, $4) RETURNING *',
      ['ws-test-staff@test.com', password_hash, 'staff', 'WS Test Staff']
    );
    testStaff = staffResult.rows[0];
    staffToken = generateToken(testStaff.id, testStaff.role);

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

    // Start server
    await new Promise((resolve) => {
      httpServer.listen(0, resolve);
    });
  });

  afterAll(async () => {
    // Close sockets
    if (clientSocket1 && clientSocket1.connected) {
      clientSocket1.disconnect();
    }
    if (clientSocket2 && clientSocket2.connected) {
      clientSocket2.disconnect();
    }

    // Close server
    if (io) {
      io.close();
    }
    if (httpServer) {
      await new Promise((resolve) => {
        httpServer.close(resolve);
      });
    }

    // Clean up test data
    await pool.query('DELETE FROM bookings WHERE 1=1');
    await pool.query('DELETE FROM rooms WHERE number LIKE $1', ['WST-%']);
    await pool.query('DELETE FROM users WHERE email LIKE $1', ['ws-test-%@test.com']);
    
    // Close pool after all tests
    await pool.end();
  });

  describe('Socket Authentication', () => {
    test('Socket connection with valid token succeeds', async () => {
      const port = httpServer.address().port;
      clientSocket1 = ioClient(`http://localhost:${port}`, {
        auth: { token: clientToken }
      });

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 5000);

        clientSocket1.on('connect', () => {
          clearTimeout(timeout);
          expect(clientSocket1.connected).toBe(true);
          resolve();
        });

        clientSocket1.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });

    test('Socket connection without token fails', async () => {
      const port = httpServer.address().port;
      const badSocket = ioClient(`http://localhost:${port}`);

      await new Promise((resolve) => {
        badSocket.on('connect_error', (error) => {
          expect(error.message).toContain('Authentication');
          badSocket.disconnect();
          resolve();
        });

        badSocket.on('connect', () => {
          badSocket.disconnect();
          throw new Error('Should not connect without token');
        });
      });
    });
  });

  describe('Initial State Delivery', () => {
    test('Client receives initial state on connection', async () => {
      // Create a test room first
      testRoom = await pool.query(
        'INSERT INTO rooms (number, type, price_per_night, status) VALUES ($1, $2, $3, $4) RETURNING *',
        ['WST-101', 'simple', 100.00, 'AVAILABLE']
      );
      testRoom = testRoom.rows[0];

      const port = httpServer.address().port;
      const socket = ioClient(`http://localhost:${port}`, {
        auth: { token: clientToken }
      });

      const initialState = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for initial state'));
        }, 5000);

        socket.on('initial_state', (data) => {
          clearTimeout(timeout);
          resolve(data);
        });

        socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      expect(initialState).toBeDefined();
      expect(initialState.rooms).toBeDefined();
      expect(Array.isArray(initialState.rooms)).toBe(true);
      
      // Should contain our test room
      const foundRoom = initialState.rooms.find(r => r.id === testRoom.id);
      expect(foundRoom).toBeDefined();
      expect(foundRoom.number).toBe('WST-101');

      socket.disconnect();
    });
  });

  describe('Broadcast Events After State Mutations', () => {
    beforeEach(async () => {
      // Connect two clients
      const port = httpServer.address().port;
      
      if (!clientSocket1 || !clientSocket1.connected) {
        clientSocket1 = ioClient(`http://localhost:${port}`, {
          auth: { token: clientToken }
        });
        await new Promise((resolve) => {
          clientSocket1.on('connect', resolve);
        });
      }

      clientSocket2 = ioClient(`http://localhost:${port}`, {
        auth: { token: adminToken }
      });
      await new Promise((resolve) => {
        clientSocket2.on('connect', resolve);
      });
    });

    afterEach(() => {
      if (clientSocket2 && clientSocket2.connected) {
        clientSocket2.disconnect();
      }
    });

    test('Room creation broadcasts to all clients', async () => {
      const roomData = {
        number: 'WST-201',
        type: 'doble',
        price_per_night: 150.00,
        status: 'AVAILABLE'
      };

      // Set up listeners on both clients
      const client1Promise = new Promise((resolve) => {
        clientSocket1.once('room_update', (data) => {
          resolve(data);
        });
      });

      const client2Promise = new Promise((resolve) => {
        clientSocket2.once('room_update', (data) => {
          resolve(data);
        });
      });

      // Create room
      const createdRoom = await roomService.createRoom(testAdmin.id, roomData);

      // Wait for broadcasts
      const [client1Data, client2Data] = await Promise.all([
        client1Promise,
        client2Promise
      ]);

      // Both clients should receive the broadcast
      expect(client1Data.action).toBe('created');
      expect(client1Data.room.number).toBe('WST-201');
      expect(client2Data.action).toBe('created');
      expect(client2Data.room.number).toBe('WST-201');

      // Clean up
      await pool.query('DELETE FROM rooms WHERE id = $1', [createdRoom.id]);
    });

    test('Booking creation broadcasts to all clients', async () => {
      // Create a room for booking
      const room = await pool.query(
        'INSERT INTO rooms (number, type, price_per_night, status) VALUES ($1, $2, $3, $4) RETURNING *',
        ['WST-301', 'simple', 100.00, 'AVAILABLE']
      );
      const roomId = room.rows[0].id;

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date();
      dayAfter.setDate(dayAfter.getDate() + 2);

      const bookingData = {
        user_id: testUser.id,
        room_id: roomId,
        check_in_date: tomorrow.toISOString().split('T')[0],
        check_out_date: dayAfter.toISOString().split('T')[0]
      };

      // Set up listeners
      const client1Promise = new Promise((resolve) => {
        clientSocket1.once('booking_update', (data) => {
          resolve(data);
        });
      });

      const client2Promise = new Promise((resolve) => {
        clientSocket2.once('booking_update', (data) => {
          resolve(data);
        });
      });

      // Create booking
      const createdBooking = await bookingService.createBooking(testUser.id, bookingData);

      // Wait for broadcasts
      const [client1Data, client2Data] = await Promise.all([
        client1Promise,
        client2Promise
      ]);

      // Both clients should receive the broadcast
      expect(client1Data.action).toBe('created');
      expect(client1Data.booking.room_id).toBe(roomId);
      expect(client2Data.action).toBe('created');
      expect(client2Data.booking.room_id).toBe(roomId);

      // Clean up
      await pool.query('DELETE FROM bookings WHERE id = $1', [createdBooking.id]);
      await pool.query('DELETE FROM rooms WHERE id = $1', [roomId]);
    });

    test('Check-in operation broadcasts to all clients', async () => {
      // Create room and booking
      const room = await pool.query(
        'INSERT INTO rooms (number, type, price_per_night, status) VALUES ($1, $2, $3, $4) RETURNING *',
        ['WST-401', 'simple', 100.00, 'AVAILABLE']
      );
      const roomId = room.rows[0].id;

      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const booking = await pool.query(
        'INSERT INTO bookings (user_id, room_id, check_in_date, check_out_date, total_cost, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [testUser.id, roomId, today, tomorrowStr, 100.00, 'CONFIRMED']
      );
      const bookingId = booking.rows[0].id;

      // Set up listeners
      const client1Promise = new Promise((resolve) => {
        clientSocket1.once('operation_update', (data) => {
          resolve(data);
        });
      });

      const client2Promise = new Promise((resolve) => {
        clientSocket2.once('operation_update', (data) => {
          resolve(data);
        });
      });

      // Perform check-in
      await operationsService.checkIn(testStaff.id, bookingId);

      // Wait for broadcasts
      const [client1Data, client2Data] = await Promise.all([
        client1Promise,
        client2Promise
      ]);

      // Both clients should receive the broadcast
      expect(client1Data.action).toBe('check_in');
      expect(client1Data.booking.status).toBe('CHECKED_IN');
      expect(client1Data.room.status).toBe('OCCUPIED');
      expect(client2Data.action).toBe('check_in');
      expect(client2Data.booking.status).toBe('CHECKED_IN');
      expect(client2Data.room.status).toBe('OCCUPIED');

      // Clean up
      await pool.query('DELETE FROM bookings WHERE id = $1', [bookingId]);
      await pool.query('DELETE FROM rooms WHERE id = $1', [roomId]);
    });
  });

  describe('Multiple Clients Receiving Same Broadcast', () => {
    test('Three clients all receive room update broadcast', async () => {
      const port = httpServer.address().port;
      
      // Connect three clients
      const socket1 = ioClient(`http://localhost:${port}`, {
        auth: { token: clientToken }
      });
      const socket2 = ioClient(`http://localhost:${port}`, {
        auth: { token: adminToken }
      });
      const socket3 = ioClient(`http://localhost:${port}`, {
        auth: { token: staffToken }
      });

      // Wait for all connections
      await Promise.all([
        new Promise((resolve) => socket1.on('connect', resolve)),
        new Promise((resolve) => socket2.on('connect', resolve)),
        new Promise((resolve) => socket3.on('connect', resolve))
      ]);

      const roomData = {
        number: 'WST-501',
        type: 'suite',
        price_per_night: 250.00,
        status: 'AVAILABLE'
      };

      // Set up listeners on all three clients
      const promises = [
        new Promise((resolve) => socket1.once('room_update', resolve)),
        new Promise((resolve) => socket2.once('room_update', resolve)),
        new Promise((resolve) => socket3.once('room_update', resolve))
      ];

      // Create room
      const createdRoom = await roomService.createRoom(testAdmin.id, roomData);

      // Wait for all broadcasts
      const results = await Promise.all(promises);

      // All three clients should receive the same broadcast
      results.forEach((data) => {
        expect(data.action).toBe('created');
        expect(data.room.number).toBe('WST-501');
      });

      // Clean up
      socket1.disconnect();
      socket2.disconnect();
      socket3.disconnect();
      await pool.query('DELETE FROM rooms WHERE id = $1', [createdRoom.id]);
    });
  });
});
