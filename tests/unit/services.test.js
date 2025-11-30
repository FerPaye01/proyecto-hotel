/**
 * Unit Tests for Service Layer
 * Tests authentication service business logic
 * Requirements: 8.1, 8.5
 */

const { login, register } = require('../../src/services/authService');
const { verifyToken } = require('../../src/utils/jwt');
const User = require('../../src/models/User');
const pool = require('../../src/config/database');

describe('Authentication Service', () => {
  // Clean up test data after each test
  afterEach(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', ['test-auth-%']);
  });

  // Don't close pool here - let other test suites use it
  afterAll(async () => {
    // Pool will be closed at the end of all tests
  });

  describe('register', () => {
    test('should register a new user with valid data', async () => {
      const userData = {
        email: 'test-auth-register@example.com',
        password: 'securePassword123',
        role: 'client',
        full_name: 'Test User'
      };

      const result = await register(userData);

      // Should return token and user info
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(userData.email);
      expect(result.user.role).toBe(userData.role);
      expect(result.user.full_name).toBe(userData.full_name);
      expect(result.user.id).toBeDefined();

      // Should not return password hash
      expect(result.user.password_hash).toBeUndefined();

      // Token should be valid and contain correct data
      const decoded = verifyToken(result.token);
      expect(decoded.userId).toBe(result.user.id);
      expect(decoded.role).toBe(userData.role);

      // User should exist in database
      const dbUser = await User.findByEmail(userData.email);
      expect(dbUser).toBeDefined();
      expect(dbUser.email).toBe(userData.email);
      expect(dbUser.password_hash).toBeDefined();
      expect(dbUser.password_hash).not.toBe(userData.password); // Password should be hashed
    });

    test('should throw error if email already exists', async () => {
      const userData = {
        email: 'test-auth-duplicate@example.com',
        password: 'password123',
        role: 'client',
        full_name: 'Test User'
      };

      // Register first user
      await register(userData);

      // Try to register with same email
      await expect(register(userData)).rejects.toThrow('Email already registered');
    });
  });

  describe('login', () => {
    const testUser = {
      email: 'test-auth-login@example.com',
      password: 'mySecurePassword',
      role: 'staff',
      full_name: 'Login Test User'
    };

    beforeEach(async () => {
      // Register a test user before each login test
      await register(testUser);
    });

    test('should login with valid credentials', async () => {
      const result = await login(testUser.email, testUser.password);

      // Should return token and user info
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(testUser.email);
      expect(result.user.role).toBe(testUser.role);
      expect(result.user.full_name).toBe(testUser.full_name);

      // Should not return password hash
      expect(result.user.password_hash).toBeUndefined();

      // Token should be valid
      const decoded = verifyToken(result.token);
      expect(decoded.userId).toBe(result.user.id);
      expect(decoded.role).toBe(testUser.role);
    });

    test('should throw generic error with invalid email', async () => {
      await expect(
        login('nonexistent@example.com', testUser.password)
      ).rejects.toThrow('Invalid credentials');
    });

    test('should throw generic error with invalid password', async () => {
      await expect(
        login(testUser.email, 'wrongPassword')
      ).rejects.toThrow('Invalid credentials');
    });

    test('should throw same error message for invalid email and invalid password', async () => {
      let errorMessage1;
      let errorMessage2;

      // Test with invalid email
      try {
        await login('nonexistent@example.com', testUser.password);
      } catch (error) {
        errorMessage1 = error.message;
      }

      // Test with invalid password
      try {
        await login(testUser.email, 'wrongPassword');
      } catch (error) {
        errorMessage2 = error.message;
      }

      // Both should return the same generic error message
      expect(errorMessage1).toBe('Invalid credentials');
      expect(errorMessage2).toBe('Invalid credentials');
      expect(errorMessage1).toBe(errorMessage2);
    });
  });
});

/**
 * Unit Tests for Room Service
 * Tests room management business logic
 * Requirements: 4.2, 6.1
 */

const roomService = require('../../src/services/roomService');
const Room = require('../../src/models/Room');
const AuditLog = require('../../src/models/AuditLog');

describe('Room Service', () => {
  let testActorId;

  beforeAll(async () => {
    // Create a test admin user to use as actor
    const testUser = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-room-service@example.com', 'hash123', 'admin', 'Test Admin']
    );
    testActorId = testUser.rows[0].id;
  });

  afterEach(async () => {
    // Clean up test rooms and audit logs
    await pool.query('DELETE FROM audit_logs');
    await pool.query(`DELETE FROM rooms WHERE number LIKE 'UNIT-%'`);
  });

  afterAll(async () => {
    // Clean up test user
    await pool.query('DELETE FROM users WHERE id = $1', [testActorId]);
  });

  describe('createRoom', () => {
    test('should create room with valid data', async () => {
      const roomData = {
        number: 'UNIT-101',
        type: 'simple',
        price_per_night: 100.50,
        status: 'AVAILABLE'
      };

      const result = await roomService.createRoom(testActorId, roomData);

      // Should return created room
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.number).toBe(roomData.number);
      expect(result.type).toBe(roomData.type);
      expect(parseFloat(result.price_per_night)).toBeCloseTo(roomData.price_per_night, 2);
      expect(result.status).toBe(roomData.status);

      // Room should exist in database
      const dbRoom = await Room.findById(result.id);
      expect(dbRoom).toBeDefined();
      expect(dbRoom.number).toBe(roomData.number);

      // Audit log should be created
      const auditLogs = await AuditLog.findByActorId(testActorId);
      expect(auditLogs.length).toBeGreaterThan(0);
      const createLog = auditLogs.find(log => log.action === 'CREATE_ROOM');
      expect(createLog).toBeDefined();
    });

    test('should throw error with invalid room type', async () => {
      const roomData = {
        number: 'UNIT-102',
        type: 'invalid_type',
        price_per_night: 100,
        status: 'AVAILABLE'
      };

      await expect(
        roomService.createRoom(testActorId, roomData)
      ).rejects.toThrow();
    });

    test('should throw error with invalid status', async () => {
      const roomData = {
        number: 'UNIT-103',
        type: 'simple',
        price_per_night: 100,
        status: 'INVALID_STATUS'
      };

      await expect(
        roomService.createRoom(testActorId, roomData)
      ).rejects.toThrow();
    });

    test('should throw error with negative price', async () => {
      const roomData = {
        number: 'UNIT-104',
        type: 'simple',
        price_per_night: -50,
        status: 'AVAILABLE'
      };

      await expect(
        roomService.createRoom(testActorId, roomData)
      ).rejects.toThrow('Price per night must be a positive number');
    });

    test('should throw error with missing room number', async () => {
      const roomData = {
        type: 'simple',
        price_per_night: 100,
        status: 'AVAILABLE'
      };

      await expect(
        roomService.createRoom(testActorId, roomData)
      ).rejects.toThrow('Room number is required');
    });
  });

  describe('getRoomsByStatus', () => {
    beforeEach(async () => {
      // Create test rooms with different statuses
      await roomService.createRoom(testActorId, {
        number: 'UNIT-201',
        type: 'simple',
        price_per_night: 100,
        status: 'AVAILABLE'
      });
      await roomService.createRoom(testActorId, {
        number: 'UNIT-202',
        type: 'doble',
        price_per_night: 150,
        status: 'OCCUPIED'
      });
      await roomService.createRoom(testActorId, {
        number: 'UNIT-203',
        type: 'suite',
        price_per_night: 250,
        status: 'AVAILABLE'
      });
      await roomService.createRoom(testActorId, {
        number: 'UNIT-204',
        type: 'simple',
        price_per_night: 100,
        status: 'MAINTENANCE'
      });
    });

    test('should return only AVAILABLE rooms', async () => {
      const availableRooms = await roomService.getRoomsByStatus('AVAILABLE');

      // Filter to only test rooms
      const testRooms = availableRooms.filter(r => r.number.startsWith('UNIT-'));
      
      expect(testRooms.length).toBe(2);
      testRooms.forEach(room => {
        expect(room.status).toBe('AVAILABLE');
      });
    });

    test('should return only OCCUPIED rooms', async () => {
      const occupiedRooms = await roomService.getRoomsByStatus('OCCUPIED');

      // Filter to only test rooms
      const testRooms = occupiedRooms.filter(r => r.number.startsWith('UNIT-'));
      
      expect(testRooms.length).toBe(1);
      expect(testRooms[0].number).toBe('UNIT-202');
      expect(testRooms[0].status).toBe('OCCUPIED');
    });

    test('should return only MAINTENANCE rooms', async () => {
      const maintenanceRooms = await roomService.getRoomsByStatus('MAINTENANCE');

      // Filter to only test rooms
      const testRooms = maintenanceRooms.filter(r => r.number.startsWith('UNIT-'));
      
      expect(testRooms.length).toBe(1);
      expect(testRooms[0].number).toBe('UNIT-204');
      expect(testRooms[0].status).toBe('MAINTENANCE');
    });

    test('should throw error with invalid status', async () => {
      await expect(
        roomService.getRoomsByStatus('INVALID_STATUS')
      ).rejects.toThrow();
    });
  });

  describe('updateRoom', () => {
    let testRoomId;

    beforeEach(async () => {
      // Create a test room
      const room = await roomService.createRoom(testActorId, {
        number: 'UNIT-301',
        type: 'simple',
        price_per_night: 100,
        status: 'AVAILABLE'
      });
      testRoomId = room.id;

      // Clear audit logs from creation
      await pool.query('DELETE FROM audit_logs WHERE action = $1', ['CREATE_ROOM']);
    });

    test('should update room with valid updates', async () => {
      const updates = {
        status: 'OCCUPIED',
        price_per_night: 120
      };

      const result = await roomService.updateRoom(testActorId, testRoomId, updates);

      // Should return updated room
      expect(result).toBeDefined();
      expect(result.id).toBe(testRoomId);
      expect(result.status).toBe(updates.status);
      expect(parseFloat(result.price_per_night)).toBeCloseTo(updates.price_per_night, 2);

      // Room should be updated in database
      const dbRoom = await Room.findById(testRoomId);
      expect(dbRoom.status).toBe(updates.status);
      expect(parseFloat(dbRoom.price_per_night)).toBeCloseTo(updates.price_per_night, 2);

      // Audit log should be created
      const auditLogs = await AuditLog.findByAction('UPDATE_ROOM');
      expect(auditLogs.length).toBeGreaterThan(0);
      const updateLog = auditLogs.find(log => 
        log.details.affected_entity_id === testRoomId.toString()
      );
      expect(updateLog).toBeDefined();
      expect(updateLog.details.previous_value).toBeDefined();
      expect(updateLog.details.new_value).toBeDefined();
    });

    test('should throw error when updating non-existent room', async () => {
      await expect(
        roomService.updateRoom(testActorId, 99999, { status: 'OCCUPIED' })
      ).rejects.toThrow('Room not found');
    });

    test('should throw error with invalid status update', async () => {
      await expect(
        roomService.updateRoom(testActorId, testRoomId, { status: 'INVALID_STATUS' })
      ).rejects.toThrow();
    });

    test('should throw error with invalid type update', async () => {
      await expect(
        roomService.updateRoom(testActorId, testRoomId, { type: 'invalid_type' })
      ).rejects.toThrow();
    });

    test('should throw error with negative price update', async () => {
      await expect(
        roomService.updateRoom(testActorId, testRoomId, { price_per_night: -50 })
      ).rejects.toThrow('Price per night must be a positive number');
    });
  });

  describe('getAllRooms', () => {
    beforeEach(async () => {
      // Create test rooms
      await roomService.createRoom(testActorId, {
        number: 'UNIT-401',
        type: 'simple',
        price_per_night: 100,
        status: 'AVAILABLE'
      });
      await roomService.createRoom(testActorId, {
        number: 'UNIT-402',
        type: 'doble',
        price_per_night: 150,
        status: 'OCCUPIED'
      });
    });

    test('should return all rooms', async () => {
      const allRooms = await roomService.getAllRooms();

      // Filter to only test rooms
      const testRooms = allRooms.filter(r => r.number.startsWith('UNIT-'));
      
      expect(testRooms.length).toBeGreaterThanOrEqual(2);
      
      // Should include rooms with different statuses
      const statuses = testRooms.map(r => r.status);
      expect(statuses).toContain('AVAILABLE');
      expect(statuses).toContain('OCCUPIED');
    });
  });

  describe('getRoomById', () => {
    let testRoomId;

    beforeEach(async () => {
      // Create a test room
      const room = await roomService.createRoom(testActorId, {
        number: 'UNIT-501',
        type: 'suite',
        price_per_night: 250,
        status: 'AVAILABLE'
      });
      testRoomId = room.id;
    });

    test('should return room by ID', async () => {
      const room = await roomService.getRoomById(testRoomId);

      expect(room).toBeDefined();
      expect(room.id).toBe(testRoomId);
      expect(room.number).toBe('UNIT-501');
      expect(room.type).toBe('suite');
      expect(parseFloat(room.price_per_night)).toBeCloseTo(250, 2);
      expect(room.status).toBe('AVAILABLE');
    });

    test('should return null for non-existent room', async () => {
      const room = await roomService.getRoomById(99999);

      expect(room).toBeNull();
    });
  });
});


/**
 * Unit Tests for Booking Service
 * Tests booking management business logic
 * Requirements: 6.2, 6.3
 */

const bookingService = require('../../src/services/bookingService');
const Booking = require('../../src/models/Booking');

describe('Booking Service', () => {
  let testActorId;
  let testUserId;
  let testRoom;

  beforeAll(async () => {
    // Clean up any existing test data
    await pool.query(`DELETE FROM users WHERE email LIKE 'test-booking-service-%'`);
    await pool.query(`DELETE FROM rooms WHERE number LIKE 'UB-%'`);

    // Create test users
    const actorResult = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-booking-service-actor@example.com', 'hash123', 'admin', 'Test Actor']
    );
    testActorId = actorResult.rows[0].id;

    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-booking-service-user@example.com', 'hash123', 'client', 'Test User']
    );
    testUserId = userResult.rows[0].id;

    // Create a test room
    testRoom = await Room.create({
      number: 'UB-101',
      type: 'simple',
      price_per_night: 100.00,
      status: 'AVAILABLE'
    });
  });

  afterEach(async () => {
    // Clean up bookings after each test
    await pool.query('DELETE FROM bookings WHERE room_id = $1', [testRoom.id]);
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM bookings WHERE room_id = $1', [testRoom.id]);
    await pool.query('DELETE FROM rooms WHERE id = $1', [testRoom.id]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [testActorId, testUserId]);
  });

  describe('calculateTotalCost', () => {
    test('should calculate total cost for valid date range', async () => {
      const checkInDate = '2025-01-01';
      const checkOutDate = '2025-01-05';

      const totalCost = await bookingService.calculateTotalCost(testRoom.id, checkInDate, checkOutDate);

      // 4 nights * 100 per night = 400
      expect(totalCost).toBe(400);
    });

    test('should calculate total cost for single night', async () => {
      const checkInDate = '2025-01-01';
      const checkOutDate = '2025-01-02';

      const totalCost = await bookingService.calculateTotalCost(testRoom.id, checkInDate, checkOutDate);

      // 1 night * 100 per night = 100
      expect(totalCost).toBe(100);
    });

    test('should throw error if check-out date is before check-in date', async () => {
      const checkInDate = '2025-01-05';
      const checkOutDate = '2025-01-01';

      await expect(
        bookingService.calculateTotalCost(testRoom.id, checkInDate, checkOutDate)
      ).rejects.toThrow('Check-out date must be after check-in date');
    });

    test('should throw error if check-out date equals check-in date', async () => {
      const checkInDate = '2025-01-01';
      const checkOutDate = '2025-01-01';

      await expect(
        bookingService.calculateTotalCost(testRoom.id, checkInDate, checkOutDate)
      ).rejects.toThrow('Check-out date must be after check-in date');
    });

    test('should throw error if room does not exist', async () => {
      const checkInDate = '2025-01-01';
      const checkOutDate = '2025-01-05';

      await expect(
        bookingService.calculateTotalCost(99999, checkInDate, checkOutDate)
      ).rejects.toThrow('Room not found');
    });
  });

  describe('createBooking', () => {
    test('should create booking with valid data', async () => {
      const bookingData = {
        user_id: testUserId,
        room_id: testRoom.id,
        check_in_date: '2025-02-01',
        check_out_date: '2025-02-05'
      };

      const result = await bookingService.createBooking(testActorId, bookingData);

      // Should return created booking
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.user_id).toBe(testUserId);
      expect(result.room_id).toBe(testRoom.id);
      expect(result.check_in_date).toBeDefined();
      expect(result.check_out_date).toBeDefined();
      expect(result.status).toBe('CONFIRMED');
      expect(parseFloat(result.total_cost)).toBe(400); // 4 nights * 100

      // Booking should exist in database
      const dbBooking = await Booking.findById(result.id);
      expect(dbBooking).toBeDefined();
      expect(dbBooking.user_id).toBe(testUserId);
      expect(dbBooking.room_id).toBe(testRoom.id);
    });

    test('should throw error with conflicting dates', async () => {
      // Create first booking
      const firstBooking = {
        user_id: testUserId,
        room_id: testRoom.id,
        check_in_date: '2025-03-01',
        check_out_date: '2025-03-05'
      };
      await bookingService.createBooking(testActorId, firstBooking);

      // Try to create overlapping booking
      const conflictingBooking = {
        user_id: testUserId,
        room_id: testRoom.id,
        check_in_date: '2025-03-03',
        check_out_date: '2025-03-07'
      };

      await expect(
        bookingService.createBooking(testActorId, conflictingBooking)
      ).rejects.toThrow(/conflict/i);
    });

    test('should throw error with missing required fields', async () => {
      const invalidBooking = {
        user_id: testUserId,
        room_id: testRoom.id
        // Missing dates
      };

      await expect(
        bookingService.createBooking(testActorId, invalidBooking)
      ).rejects.toThrow('Missing required booking fields');
    });

    test('should throw error if check-out date is before check-in date', async () => {
      const invalidBooking = {
        user_id: testUserId,
        room_id: testRoom.id,
        check_in_date: '2025-04-05',
        check_out_date: '2025-04-01'
      };

      await expect(
        bookingService.createBooking(testActorId, invalidBooking)
      ).rejects.toThrow('Check-out date must be after check-in date');
    });

    test('should throw error if room does not exist', async () => {
      const bookingData = {
        user_id: testUserId,
        room_id: 99999,
        check_in_date: '2025-05-01',
        check_out_date: '2025-05-05'
      };

      await expect(
        bookingService.createBooking(testActorId, bookingData)
      ).rejects.toThrow('Room not found');
    });
  });

  describe('getBookingsByUserId', () => {
    beforeEach(async () => {
      // Create test bookings
      await bookingService.createBooking(testActorId, {
        user_id: testUserId,
        room_id: testRoom.id,
        check_in_date: '2025-06-01',
        check_out_date: '2025-06-05'
      });
      await bookingService.createBooking(testActorId, {
        user_id: testUserId,
        room_id: testRoom.id,
        check_in_date: '2025-07-01',
        check_out_date: '2025-07-05'
      });
    });

    test('should return all bookings for user', async () => {
      const bookings = await bookingService.getBookingsByUserId(testUserId);

      // Filter to only test bookings
      const testBookings = bookings.filter(b => b.room_id === testRoom.id);
      
      expect(testBookings.length).toBe(2);
      testBookings.forEach(booking => {
        expect(booking.user_id).toBe(testUserId);
      });
    });

    test('should return empty array for user with no bookings', async () => {
      // Create another user
      const anotherUserResult = await pool.query(
        `INSERT INTO users (email, password_hash, role, full_name) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id`,
        ['test-booking-service-another@example.com', 'hash123', 'client', 'Another User']
      );
      const anotherUserId = anotherUserResult.rows[0].id;

      const bookings = await bookingService.getBookingsByUserId(anotherUserId);

      expect(bookings.length).toBe(0);

      // Clean up
      await pool.query('DELETE FROM users WHERE id = $1', [anotherUserId]);
    });

    test('should throw error if user ID is missing', async () => {
      await expect(
        bookingService.getBookingsByUserId(null)
      ).rejects.toThrow('User ID is required');
    });
  });
});


/**
 * Unit Tests for Operations Service
 * Tests check-in and check-out operations
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

const operationsService = require('../../src/services/operationsService');
// bookingService and Room are already imported above

describe('Operations Service', () => {
  let testActorId;
  let testUserId;
  let testRoom;

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

  beforeAll(async () => {
    // Clean up any existing test data first
    await pool.query(`DELETE FROM users WHERE email LIKE 'test-ops-%'`);

    // Create test users
    const actorResult = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-ops-actor@example.com', 'hash123', 'staff', 'Test Staff']
    );
    testActorId = actorResult.rows[0].id;

    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-ops-user@example.com', 'hash123', 'client', 'Test User']
    );
    testUserId = userResult.rows[0].id;

    // Create a test room
    testRoom = await Room.create({
      number: 'OPS-101',
      type: 'simple',
      price_per_night: 100.00,
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

  describe('checkIn', () => {
    test('should check in with valid booking', async () => {
      // Create a booking for today
      const baseDate = new Date();
      const checkInDate = baseDate;
      const checkOutDate = addDays(checkInDate, 3);

      const bookingData = {
        user_id: testUserId,
        room_id: testRoom.id,
        check_in_date: formatDate(checkInDate),
        check_out_date: formatDate(checkOutDate)
      };

      const booking = await bookingService.createBooking(testActorId, bookingData);

      // Perform check-in
      const result = await operationsService.checkIn(testActorId, booking.id);

      // Verify results
      expect(result.booking).toBeDefined();
      expect(result.booking.status).toBe('CHECKED_IN');
      expect(result.booking.id).toBe(booking.id);

      expect(result.room).toBeDefined();
      expect(result.room.status).toBe('OCCUPIED');
      expect(result.room.id).toBe(testRoom.id);

      // Verify in database
      const bookingInDb = await pool.query('SELECT * FROM bookings WHERE id = $1', [booking.id]);
      expect(bookingInDb.rows[0].status).toBe('CHECKED_IN');

      const roomInDb = await pool.query('SELECT * FROM rooms WHERE id = $1', [testRoom.id]);
      expect(roomInDb.rows[0].status).toBe('OCCUPIED');
    });

    test('should reject check-in before check_in_date', async () => {
      // Create a booking for future date
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

      // Attempt check-in before scheduled date
      await expect(
        operationsService.checkIn(testActorId, booking.id)
      ).rejects.toThrow(/before the scheduled check-in date/i);

      // Verify booking and room status remain unchanged
      const bookingInDb = await pool.query('SELECT * FROM bookings WHERE id = $1', [booking.id]);
      expect(bookingInDb.rows[0].status).toBe('CONFIRMED');

      const roomInDb = await pool.query('SELECT * FROM rooms WHERE id = $1', [testRoom.id]);
      expect(roomInDb.rows[0].status).toBe('AVAILABLE');
    });

    test('should reject check-in with invalid booking ID', async () => {
      const invalidBookingId = '00000000-0000-0000-0000-000000000000';

      await expect(
        operationsService.checkIn(testActorId, invalidBookingId)
      ).rejects.toThrow(/Booking not found/i);
    });

    test('should reject check-in for already checked-in booking', async () => {
      // Create and check in a booking
      const baseDate = new Date();
      const checkInDate = baseDate;
      const checkOutDate = addDays(checkInDate, 3);

      const bookingData = {
        user_id: testUserId,
        room_id: testRoom.id,
        check_in_date: formatDate(checkInDate),
        check_out_date: formatDate(checkOutDate)
      };

      const booking = await bookingService.createBooking(testActorId, bookingData);
      await operationsService.checkIn(testActorId, booking.id);

      // Attempt to check in again
      await expect(
        operationsService.checkIn(testActorId, booking.id)
      ).rejects.toThrow(/Cannot check in booking with status/i);
    });
  });

  describe('checkOut', () => {
    test('should check out with valid room', async () => {
      // Create a booking and check in
      const baseDate = new Date();
      const checkInDate = addDays(baseDate, -2); // 2 days ago
      const checkOutDate = addDays(baseDate, 1); // Tomorrow

      const bookingData = {
        user_id: testUserId,
        room_id: testRoom.id,
        check_in_date: formatDate(checkInDate),
        check_out_date: formatDate(checkOutDate)
      };

      const booking = await bookingService.createBooking(testActorId, bookingData);
      await operationsService.checkIn(testActorId, booking.id);

      // Perform check-out
      const result = await operationsService.checkOut(testActorId, testRoom.id);

      // Verify results
      expect(result.booking).toBeDefined();
      expect(result.booking.status).toBe('CHECKED_OUT');
      expect(result.booking.id).toBe(booking.id);

      expect(result.room).toBeDefined();
      expect(result.room.status).toBe('CLEANING');
      expect(result.room.id).toBe(testRoom.id);

      expect(result.late_penalty).toBeDefined();
      expect(result.late_penalty).toBe(0); // No penalty for on-time checkout

      // Verify in database
      const bookingInDb = await pool.query('SELECT * FROM bookings WHERE id = $1', [booking.id]);
      expect(bookingInDb.rows[0].status).toBe('CHECKED_OUT');

      const roomInDb = await pool.query('SELECT * FROM rooms WHERE id = $1', [testRoom.id]);
      expect(roomInDb.rows[0].status).toBe('CLEANING');
    });

    test('should calculate late checkout penalty', async () => {
      // Create a booking that ended in the past
      const baseDate = new Date();
      const checkInDate = addDays(baseDate, -5); // 5 days ago
      const checkOutDate = addDays(baseDate, -2); // 2 days ago (definitely late!)

      const bookingData = {
        user_id: testUserId,
        room_id: testRoom.id,
        check_in_date: formatDate(checkInDate),
        check_out_date: formatDate(checkOutDate)
      };

      const booking = await bookingService.createBooking(testActorId, bookingData);
      const originalTotalCost = parseFloat(booking.total_cost);
      
      await operationsService.checkIn(testActorId, booking.id);

      // Perform late check-out
      const result = await operationsService.checkOut(testActorId, testRoom.id);

      // Verify late penalty was calculated (50% of one night)
      const expectedPenalty = parseFloat(testRoom.price_per_night) * 0.5;
      expect(result.late_penalty).toBeCloseTo(expectedPenalty, 2);

      // Verify total cost includes penalty
      const expectedTotalCost = originalTotalCost + expectedPenalty;
      expect(parseFloat(result.booking.total_cost)).toBeCloseTo(expectedTotalCost, 2);

      // Verify in database
      const bookingInDb = await pool.query('SELECT * FROM bookings WHERE id = $1', [booking.id]);
      expect(parseFloat(bookingInDb.rows[0].total_cost)).toBeCloseTo(expectedTotalCost, 2);
    });

    test('should reject check-out with invalid room ID', async () => {
      const invalidRoomId = 99999;

      await expect(
        operationsService.checkOut(testActorId, invalidRoomId)
      ).rejects.toThrow(/Room not found/i);
    });

    test('should reject check-out for room with no active booking', async () => {
      // Room exists but has no checked-in booking
      await expect(
        operationsService.checkOut(testActorId, testRoom.id)
      ).rejects.toThrow(/No active booking found/i);
    });
  });
});

// Close database pool after all test suites
afterAll(async () => {
  await pool.end();
});
