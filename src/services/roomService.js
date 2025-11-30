/**
 * Room Service
 * Handles room management operations with audit logging
 * Requirements: 4.2, 6.1, 1.2
 */

const Room = require('../models/Room');
const AuditService = require('./auditService');
const { validateEnum } = require('../utils/validators');

// Socket.IO instance for broadcasting (set by server initialization)
let io = null;

/**
 * Set the Socket.IO instance for broadcasting
 * @param {Server} socketIo - Socket.IO server instance
 */
function setSocketIO(socketIo) {
  io = socketIo;
}

/**
 * Create a new room
 * @param {string} actorId - UUID of the user creating the room
 * @param {Object} roomData - Room data
 * @param {string} roomData.number - Room number
 * @param {string} roomData.type - Room type (simple, doble, suite)
 * @param {number} roomData.price_per_night - Price per night
 * @param {string} roomData.status - Room status (AVAILABLE, OCCUPIED, MAINTENANCE, CLEANING)
 * @returns {Promise<Object>} Created room object
 * @throws {Error} If validation fails
 */
async function createRoom(actorId, roomData) {
  const { number, type, price_per_night, status = 'AVAILABLE' } = roomData;

  // Validate room data
  if (!number || typeof number !== 'string') {
    throw new Error('Room number is required and must be a string');
  }

  // Validate room type
  const validTypes = ['simple', 'doble', 'suite'];
  const typeValidation = validateEnum(type, validTypes, 'type');
  if (!typeValidation.valid) {
    throw new Error(typeValidation.error);
  }

  // Validate price
  if (!price_per_night || typeof price_per_night !== 'number' || price_per_night <= 0) {
    throw new Error('Price per night must be a positive number');
  }

  // Validate status
  const validStatuses = ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'CLEANING'];
  const statusValidation = validateEnum(status, validStatuses, 'status');
  if (!statusValidation.valid) {
    throw new Error(statusValidation.error);
  }

  // Create room in database
  const newRoom = await Room.create({
    number,
    type,
    price_per_night,
    status
  });

  // Log the action to audit trail
  await AuditService.logAction(actorId, 'CREATE_ROOM', {
    previous_value: null,
    new_value: newRoom,
    affected_entity_id: newRoom.id.toString()
  });

  // Broadcast room creation to all connected clients (after database commit)
  if (io) {
    io.emit('room_update', {
      action: 'created',
      room: newRoom,
      timestamp: new Date().toISOString()
    });
  }

  return newRoom;
}

/**
 * Update an existing room
 * @param {string} actorId - UUID of the user updating the room
 * @param {number} roomId - Room ID to update
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated room object
 * @throws {Error} If room not found or validation fails
 */
async function updateRoom(actorId, roomId, updates) {
  // Get current room state for audit log
  const previousRoom = await Room.findById(roomId);
  
  if (!previousRoom) {
    throw new Error('Room not found');
  }

  // Validate updates if provided
  if (updates.type) {
    const validTypes = ['simple', 'doble', 'suite'];
    const typeValidation = validateEnum(updates.type, validTypes, 'type');
    if (!typeValidation.valid) {
      throw new Error(typeValidation.error);
    }
  }

  if (updates.status) {
    const validStatuses = ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'CLEANING'];
    const statusValidation = validateEnum(updates.status, validStatuses, 'status');
    if (!statusValidation.valid) {
      throw new Error(statusValidation.error);
    }
  }

  if (updates.price_per_night !== undefined) {
    if (typeof updates.price_per_night !== 'number' || updates.price_per_night <= 0) {
      throw new Error('Price per night must be a positive number');
    }
  }

  // Update room in database
  const updatedRoom = await Room.update(roomId, updates);

  if (!updatedRoom) {
    throw new Error('Failed to update room');
  }

  // Log the action to audit trail
  await AuditService.logAction(actorId, 'UPDATE_ROOM', {
    previous_value: previousRoom,
    new_value: updatedRoom,
    affected_entity_id: roomId.toString()
  });

  // Broadcast room update to all connected clients (after database commit)
  if (io) {
    io.emit('room_update', {
      action: 'updated',
      room: updatedRoom,
      timestamp: new Date().toISOString()
    });
  }

  return updatedRoom;
}

/**
 * Get rooms by status
 * @param {string} status - Room status to filter by
 * @returns {Promise<Array>} Array of rooms with matching status
 * @throws {Error} If status is invalid
 */
async function getRoomsByStatus(status) {
  // Validate status
  const validStatuses = ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'CLEANING'];
  const statusValidation = validateEnum(status, validStatuses, 'status');
  if (!statusValidation.valid) {
    throw new Error(statusValidation.error);
  }

  return await Room.findByStatus(status);
}

/**
 * Get all rooms
 * @returns {Promise<Array>} Array of all rooms
 */
async function getAllRooms() {
  return await Room.findAll();
}

/**
 * Get room by ID
 * @param {number} roomId - Room ID
 * @returns {Promise<Object|null>} Room object or null if not found
 */
async function getRoomById(roomId) {
  return await Room.findById(roomId);
}

module.exports = {
  setSocketIO,
  createRoom,
  updateRoom,
  getRoomsByStatus,
  getAllRooms,
  getRoomById
};
