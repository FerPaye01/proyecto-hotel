/**
 * Unit Tests for Data Models (Repository Pattern)
 * Validates: Requirements 4.1, 4.2, 6.2
 */

const User = require('../../src/models/User');
const Room = require('../../src/models/Room');
const Booking = require('../../src/models/Booking');
const AuditLog = require('../../src/models/AuditLog');
const pool = require('../../src/config/database');

// Mock the database pool
jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
}));

describe('User Model', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    test('should return user when found', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        role: 'client',
        full_name: 'Test User',
      };

      pool.query.mockResolvedValue({ rows: [mockUser] });

      const result = await User.findById('123e4567-e89b-12d3-a456-426614174000');

      expect(result).toEqual(mockUser);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1',
        ['123e4567-e89b-12d3-a456-426614174000']
      );
    });

    test('should return null when user not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await User.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    test('should return user when found by email', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        role: 'client',
      };

      pool.query.mockResolvedValue({ rows: [mockUser] });

      const result = await User.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = $1',
        ['test@example.com']
      );
    });
  });

  describe('create', () => {
    test('should create new user with all fields', async () => {
      const userData = {
        email: 'new@example.com',
        password_hash: 'hashed_password',
        role: 'client',
        full_name: 'New User',
      };

      const mockCreatedUser = { id: 'new-id', ...userData };
      pool.query.mockResolvedValue({ rows: [mockCreatedUser] });

      const result = await User.create(userData);

      expect(result).toEqual(mockCreatedUser);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        [userData.email, userData.password_hash, userData.role, userData.full_name]
      );
    });
  });

  describe('update', () => {
    test('should update user fields', async () => {
      const updates = { full_name: 'Updated Name', role: 'staff' };
      const mockUpdatedUser = { id: 'user-id', ...updates };

      pool.query.mockResolvedValue({ rows: [mockUpdatedUser] });

      const result = await User.update('user-id', updates);

      expect(result).toEqual(mockUpdatedUser);
      expect(pool.query).toHaveBeenCalled();
    });

    test('should return existing user when no valid fields to update', async () => {
      const mockUser = { id: 'user-id', email: 'test@example.com' };
      pool.query.mockResolvedValue({ rows: [mockUser] });

      const result = await User.update('user-id', {});

      expect(result).toEqual(mockUser);
    });
  });

  describe('delete', () => {
    test('should delete user and return true', async () => {
      pool.query.mockResolvedValue({ rowCount: 1 });

      const result = await User.delete('user-id');

      expect(result).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        'DELETE FROM users WHERE id = $1 RETURNING id',
        ['user-id']
      );
    });

    test('should return false when user not found', async () => {
      pool.query.mockResolvedValue({ rowCount: 0 });

      const result = await User.delete('nonexistent-id');

      expect(result).toBe(false);
    });
  });
});

describe('Room Model', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    test('should return room when found', async () => {
      const mockRoom = {
        id: 1,
        number: '101',
        type: 'simple',
        price_per_night: 100.00,
        status: 'AVAILABLE',
      };

      pool.query.mockResolvedValue({ rows: [mockRoom] });

      const result = await Room.findById(1);

      expect(result).toEqual(mockRoom);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM rooms WHERE id = $1',
        [1]
      );
    });
  });

  describe('findAll', () => {
    test('should return all rooms ordered by number', async () => {
      const mockRooms = [
        { id: 1, number: '101', status: 'AVAILABLE' },
        { id: 2, number: '102', status: 'OCCUPIED' },
      ];

      pool.query.mockResolvedValue({ rows: mockRooms });

      const result = await Room.findAll();

      expect(result).toEqual(mockRooms);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM rooms ORDER BY number'
      );
    });
  });

  describe('findByStatus', () => {
    test('should return rooms with matching status', async () => {
      const mockRooms = [
        { id: 1, number: '101', status: 'AVAILABLE' },
        { id: 3, number: '103', status: 'AVAILABLE' },
      ];

      pool.query.mockResolvedValue({ rows: mockRooms });

      const result = await Room.findByStatus('AVAILABLE');

      expect(result).toEqual(mockRooms);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM rooms WHERE status = $1 ORDER BY number',
        ['AVAILABLE']
      );
    });
  });

  describe('checkAvailability', () => {
    test('should return true when room is available with no conflicts', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ status: 'AVAILABLE' }] })
        .mockResolvedValueOnce({ rows: [{ conflict_count: '0' }] });

      const result = await Room.checkAvailability(1, '2024-01-01', '2024-01-05');

      expect(result).toBe(true);
    });

    test('should return false when room has booking conflicts', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ status: 'AVAILABLE' }] })
        .mockResolvedValueOnce({ rows: [{ conflict_count: '1' }] });

      const result = await Room.checkAvailability(1, '2024-01-01', '2024-01-05');

      expect(result).toBe(false);
    });

    test('should return false when room does not exist', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await Room.checkAvailability(999, '2024-01-01', '2024-01-05');

      expect(result).toBe(false);
    });
  });

  describe('create', () => {
    test('should create new room', async () => {
      const roomData = {
        number: '201',
        type: 'doble',
        price_per_night: 150.00,
        status: 'AVAILABLE',
      };

      const mockCreatedRoom = { id: 10, ...roomData };
      pool.query.mockResolvedValue({ rows: [mockCreatedRoom] });

      const result = await Room.create(roomData);

      expect(result).toEqual(mockCreatedRoom);
    });
  });

  describe('update', () => {
    test('should update room status', async () => {
      const updates = { status: 'OCCUPIED' };
      const mockUpdatedRoom = { id: 1, number: '101', status: 'OCCUPIED' };

      pool.query.mockResolvedValue({ rows: [mockUpdatedRoom] });

      const result = await Room.update(1, updates);

      expect(result).toEqual(mockUpdatedRoom);
    });
  });

  describe('delete', () => {
    test('should delete room and return true', async () => {
      pool.query.mockResolvedValue({ rowCount: 1 });

      const result = await Room.delete(1);

      expect(result).toBe(true);
    });
  });
});

describe('Booking Model', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    test('should return booking when found', async () => {
      const mockBooking = {
        id: 'booking-id',
        user_id: 'user-id',
        room_id: 1,
        check_in_date: '2024-01-01',
        check_out_date: '2024-01-05',
        status: 'CONFIRMED',
      };

      pool.query.mockResolvedValue({ rows: [mockBooking] });

      const result = await Booking.findById('booking-id');

      expect(result).toEqual(mockBooking);
    });
  });

  describe('findByUserId', () => {
    test('should return all bookings for a user with room details', async () => {
      const mockBookings = [
        {
          id: 'booking-1',
          user_id: 'user-id',
          room_id: 1,
          room_number: '101',
          room_type: 'simple',
        },
      ];

      pool.query.mockResolvedValue({ rows: mockBookings });

      const result = await Booking.findByUserId('user-id');

      expect(result).toEqual(mockBookings);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('JOIN rooms'),
        ['user-id']
      );
    });
  });

  describe('findByRoomId', () => {
    test('should return all bookings for a room with user details', async () => {
      const mockBookings = [
        {
          id: 'booking-1',
          room_id: 1,
          user_email: 'user@example.com',
          user_name: 'Test User',
        },
      ];

      pool.query.mockResolvedValue({ rows: mockBookings });

      const result = await Booking.findByRoomId(1);

      expect(result).toEqual(mockBookings);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('JOIN users'),
        [1]
      );
    });
  });

  describe('findConflictingBookings', () => {
    test('should find overlapping bookings', async () => {
      const mockConflicts = [
        {
          id: 'existing-booking',
          room_id: 1,
          check_in_date: '2024-01-03',
          check_out_date: '2024-01-07',
        },
      ];

      pool.query.mockResolvedValue({ rows: mockConflicts });

      const result = await Booking.findConflictingBookings(1, '2024-01-01', '2024-01-05');

      expect(result).toEqual(mockConflicts);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('check_in_date < $3'),
        [1, '2024-01-01', '2024-01-05']
      );
    });

    test('should exclude specific booking when provided', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await Booking.findConflictingBookings(1, '2024-01-01', '2024-01-05', 'exclude-id');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('id != $4'),
        [1, '2024-01-01', '2024-01-05', 'exclude-id']
      );
    });
  });

  describe('create', () => {
    test('should create new booking', async () => {
      const bookingData = {
        user_id: 'user-id',
        room_id: 1,
        check_in_date: '2024-01-01',
        check_out_date: '2024-01-05',
        total_cost: 400.00,
        status: 'CONFIRMED',
      };

      const mockCreatedBooking = { id: 'new-booking-id', ...bookingData };
      pool.query.mockResolvedValue({ rows: [mockCreatedBooking] });

      const result = await Booking.create(bookingData);

      expect(result).toEqual(mockCreatedBooking);
    });
  });

  describe('update', () => {
    test('should update booking status', async () => {
      const updates = { status: 'CHECKED_IN' };
      const mockUpdatedBooking = { id: 'booking-id', status: 'CHECKED_IN' };

      pool.query.mockResolvedValue({ rows: [mockUpdatedBooking] });

      const result = await Booking.update('booking-id', updates);

      expect(result).toEqual(mockUpdatedBooking);
    });
  });

  describe('delete', () => {
    test('should delete booking and return true', async () => {
      pool.query.mockResolvedValue({ rowCount: 1 });

      const result = await Booking.delete('booking-id');

      expect(result).toBe(true);
    });
  });
});

describe('AuditLog Model', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    test('should create new audit log entry', async () => {
      const logData = {
        actor_id: 'user-id',
        action: 'CHECK_IN',
        details: {
          previous_value: { status: 'CONFIRMED' },
          new_value: { status: 'CHECKED_IN' },
          affected_entity_id: 'booking-id',
        },
      };

      const mockCreatedLog = { id: 1, ...logData, timestamp: new Date() };
      pool.query.mockResolvedValue({ rows: [mockCreatedLog] });

      const result = await AuditLog.create(logData);

      expect(result).toEqual(mockCreatedLog);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        [logData.actor_id, logData.action, JSON.stringify(logData.details)]
      );
    });
  });

  describe('findByActorId', () => {
    test('should return audit logs for specific actor', async () => {
      const mockLogs = [
        {
          id: 1,
          actor_id: 'user-id',
          action: 'CHECK_IN',
          actor_email: 'user@example.com',
        },
      ];

      pool.query.mockResolvedValue({ rows: mockLogs });

      const result = await AuditLog.findByActorId('user-id');

      expect(result).toEqual(mockLogs);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE a.actor_id = $1'),
        ['user-id', 100, 0]
      );
    });

    test('should respect limit and offset options', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await AuditLog.findByActorId('user-id', { limit: 50, offset: 10 });

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['user-id', 50, 10]
      );
    });
  });

  describe('findByAction', () => {
    test('should return audit logs for specific action', async () => {
      const mockLogs = [
        { id: 1, action: 'CHECK_IN' },
        { id: 2, action: 'CHECK_IN' },
      ];

      pool.query.mockResolvedValue({ rows: mockLogs });

      const result = await AuditLog.findByAction('CHECK_IN');

      expect(result).toEqual(mockLogs);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE a.action = $1'),
        ['CHECK_IN', 100, 0]
      );
    });
  });

  describe('findAll', () => {
    test('should return all audit logs with default options', async () => {
      const mockLogs = [{ id: 1 }, { id: 2 }];
      pool.query.mockResolvedValue({ rows: mockLogs });

      const result = await AuditLog.findAll();

      expect(result).toEqual(mockLogs);
    });

    test('should filter by date range when provided', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await AuditLog.findAll({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        limit: 50,
        offset: 0,
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE'),
        ['2024-01-01', '2024-01-31', 50, 0]
      );
    });
  });

  describe('count', () => {
    test('should return total count of audit logs', async () => {
      pool.query.mockResolvedValue({ rows: [{ total: '42' }] });

      const result = await AuditLog.count();

      expect(result).toBe(42);
    });

    test('should filter count by actor and action', async () => {
      pool.query.mockResolvedValue({ rows: [{ total: '5' }] });

      const result = await AuditLog.count({
        actorId: 'user-id',
        action: 'CHECK_IN',
      });

      expect(result).toBe(5);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE'),
        ['user-id', 'CHECK_IN']
      );
    });
  });
});
