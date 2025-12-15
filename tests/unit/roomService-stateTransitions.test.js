/**
 * Room Service - State Transition Tests
 * Tests for strict state transition rules to prevent conflicts with check-in/check-out
 */

const RoomService = require('../../src/services/roomService');
const Room = require('../../src/models/Room');
const AuditService = require('../../src/services/auditService');
const pool = require('../../src/config/database');

// Mock dependencies
jest.mock('../../src/models/Room');
jest.mock('../../src/services/auditService');
jest.mock('../../src/config/database');

describe('RoomService - State Transitions', () => {
  const mockActorId = 'actor-123';
  const mockRoomId = 1;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock audit service
    AuditService.logAction.mockResolvedValue({ id: 'audit-123' });
  });

  describe('Valid Transitions', () => {
    test('CLEANING → AVAILABLE should succeed', async () => {
      const mockRoom = { id: mockRoomId, number: '101', status: 'CLEANING' };
      Room.findById.mockResolvedValue(mockRoom);
      Room.update.mockResolvedValue({ ...mockRoom, status: 'AVAILABLE' });
      
      // Mock no active bookings
      pool.query = jest.fn().mockResolvedValue({ rows: [{ count: '0' }] });

      const result = await RoomService.updateRoomStatus(
        mockActorId,
        'staff',
        mockRoomId,
        'AVAILABLE'
      );

      expect(result.status).toBe('AVAILABLE');
      expect(Room.update).toHaveBeenCalledWith(mockRoomId, { status: 'AVAILABLE' });
    });

    test('MAINTENANCE → AVAILABLE should succeed', async () => {
      const mockRoom = { id: mockRoomId, number: '101', status: 'MAINTENANCE' };
      Room.findById.mockResolvedValue(mockRoom);
      Room.update.mockResolvedValue({ ...mockRoom, status: 'AVAILABLE' });
      
      // Mock no active bookings
      pool.query = jest.fn().mockResolvedValue({ rows: [{ count: '0' }] });

      const result = await RoomService.updateRoomStatus(
        mockActorId,
        'staff',
        mockRoomId,
        'AVAILABLE'
      );

      expect(result.status).toBe('AVAILABLE');
    });

    test('AVAILABLE → MAINTENANCE should succeed', async () => {
      const mockRoom = { id: mockRoomId, number: '101', status: 'AVAILABLE' };
      Room.findById.mockResolvedValue(mockRoom);
      Room.update.mockResolvedValue({ ...mockRoom, status: 'MAINTENANCE' });

      const result = await RoomService.updateRoomStatus(
        mockActorId,
        'staff',
        mockRoomId,
        'MAINTENANCE'
      );

      expect(result.status).toBe('MAINTENANCE');
    });

    test('AVAILABLE → CLEANING should succeed', async () => {
      const mockRoom = { id: mockRoomId, number: '101', status: 'AVAILABLE' };
      Room.findById.mockResolvedValue(mockRoom);
      Room.update.mockResolvedValue({ ...mockRoom, status: 'CLEANING' });

      const result = await RoomService.updateRoomStatus(
        mockActorId,
        'staff',
        mockRoomId,
        'CLEANING'
      );

      expect(result.status).toBe('CLEANING');
    });

    test('OCCUPIED → MAINTENANCE should succeed (emergency)', async () => {
      const mockRoom = { id: mockRoomId, number: '101', status: 'OCCUPIED' };
      Room.findById.mockResolvedValue(mockRoom);
      Room.update.mockResolvedValue({ ...mockRoom, status: 'MAINTENANCE' });

      const result = await RoomService.updateRoomStatus(
        mockActorId,
        'staff',
        mockRoomId,
        'MAINTENANCE'
      );

      expect(result.status).toBe('MAINTENANCE');
    });

    test('CLEANING → MAINTENANCE should succeed', async () => {
      const mockRoom = { id: mockRoomId, number: '101', status: 'CLEANING' };
      Room.findById.mockResolvedValue(mockRoom);
      Room.update.mockResolvedValue({ ...mockRoom, status: 'MAINTENANCE' });

      const result = await RoomService.updateRoomStatus(
        mockActorId,
        'staff',
        mockRoomId,
        'MAINTENANCE'
      );

      expect(result.status).toBe('MAINTENANCE');
    });

    test('MAINTENANCE → CLEANING should succeed', async () => {
      const mockRoom = { id: mockRoomId, number: '101', status: 'MAINTENANCE' };
      Room.findById.mockResolvedValue(mockRoom);
      Room.update.mockResolvedValue({ ...mockRoom, status: 'CLEANING' });

      const result = await RoomService.updateRoomStatus(
        mockActorId,
        'staff',
        mockRoomId,
        'CLEANING'
      );

      expect(result.status).toBe('CLEANING');
    });
  });

  describe('Invalid Transitions - Should Fail', () => {
    test('OCCUPIED → AVAILABLE should fail', async () => {
      const mockRoom = { id: mockRoomId, number: '101', status: 'OCCUPIED' };
      Room.findById.mockResolvedValue(mockRoom);

      await expect(
        RoomService.updateRoomStatus(mockActorId, 'staff', mockRoomId, 'AVAILABLE')
      ).rejects.toThrow('Cannot change OCCUPIED room to AVAILABLE');
    });

    test('Setting status to OCCUPIED manually should fail', async () => {
      const mockRoom = { id: mockRoomId, number: '101', status: 'AVAILABLE' };
      Room.findById.mockResolvedValue(mockRoom);

      await expect(
        RoomService.updateRoomStatus(mockActorId, 'staff', mockRoomId, 'OCCUPIED')
      ).rejects.toThrow('Cannot manually set room to OCCUPIED');
    });

    test('OCCUPIED → CLEANING should fail', async () => {
      const mockRoom = { id: mockRoomId, number: '101', status: 'OCCUPIED' };
      Room.findById.mockResolvedValue(mockRoom);

      await expect(
        RoomService.updateRoomStatus(mockActorId, 'staff', mockRoomId, 'CLEANING')
      ).rejects.toThrow('Invalid status transition');
    });

    test('AVAILABLE → AVAILABLE with active booking should fail', async () => {
      const mockRoom = { id: mockRoomId, number: '101', status: 'AVAILABLE' };
      Room.findById.mockResolvedValue(mockRoom);
      
      // Mock active booking exists
      pool.query = jest.fn().mockResolvedValue({ rows: [{ count: '1' }] });

      await expect(
        RoomService.updateRoomStatus(mockActorId, 'staff', mockRoomId, 'AVAILABLE')
      ).rejects.toThrow('Cannot set room to AVAILABLE while guest is checked in');
    });
  });

  describe('Authorization', () => {
    test('Client role should not be able to update room status', async () => {
      const mockRoom = { id: mockRoomId, number: '101', status: 'AVAILABLE' };
      Room.findById.mockResolvedValue(mockRoom);

      await expect(
        RoomService.updateRoomStatus(mockActorId, 'client', mockRoomId, 'MAINTENANCE')
      ).rejects.toThrow('Insufficient permissions');
    });

    test('Staff role should be able to update room status', async () => {
      const mockRoom = { id: mockRoomId, number: '101', status: 'AVAILABLE' };
      Room.findById.mockResolvedValue(mockRoom);
      Room.update.mockResolvedValue({ ...mockRoom, status: 'MAINTENANCE' });

      const result = await RoomService.updateRoomStatus(
        mockActorId,
        'staff',
        mockRoomId,
        'MAINTENANCE'
      );

      expect(result.status).toBe('MAINTENANCE');
    });

    test('Admin role should be able to update room status', async () => {
      const mockRoom = { id: mockRoomId, number: '101', status: 'AVAILABLE' };
      Room.findById.mockResolvedValue(mockRoom);
      Room.update.mockResolvedValue({ ...mockRoom, status: 'MAINTENANCE' });

      const result = await RoomService.updateRoomStatus(
        mockActorId,
        'admin',
        mockRoomId,
        'MAINTENANCE'
      );

      expect(result.status).toBe('MAINTENANCE');
    });
  });

  describe('Audit Logging', () => {
    test('Should create audit log with transition_type: manual', async () => {
      const mockRoom = { id: mockRoomId, number: '101', status: 'AVAILABLE' };
      Room.findById.mockResolvedValue(mockRoom);
      Room.update.mockResolvedValue({ ...mockRoom, status: 'MAINTENANCE' });

      await RoomService.updateRoomStatus(
        mockActorId,
        'staff',
        mockRoomId,
        'MAINTENANCE'
      );

      expect(AuditService.logAction).toHaveBeenCalledWith(
        mockActorId,
        'UPDATE_ROOM_STATUS',
        expect.objectContaining({
          transition_type: 'manual',
          previous_status: 'AVAILABLE',
          new_status: 'MAINTENANCE'
        })
      );
    });
  });
});
