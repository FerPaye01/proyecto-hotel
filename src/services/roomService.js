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
 * @param {string} actorRole - Role of the actor (must be 'admin')
 * @param {Object} roomData - Room data
 * @param {string} roomData.number - Room number
 * @param {string} roomData.type - Room type (simple, doble, suite)
 * @param {number} roomData.price_per_night - Price per night
 * @param {string} roomData.status - Room status (AVAILABLE, OCCUPIED, MAINTENANCE, CLEANING)
 * @param {string} [roomData.image_1] - Primary image (base64 or URL)
 * @param {string} [roomData.image_2] - Second image for suites (base64 or URL)
 * @param {string} [roomData.image_3] - Third image for suites (base64 or URL)
 * @returns {Promise<Object>} Created room object
 * @throws {Error} If authorization fails or validation fails
 */
async function createRoom(actorId, actorRole, roomData) {
  // Verify actor role is 'admin'
  if (actorRole !== 'admin') {
    const error = new Error('Insufficient permissions to create rooms');
    error.code = 'AUTHORIZATION_ERROR';
    error.statusCode = 403;
    throw error;
  }

  const { number, type, price_per_night, status = 'AVAILABLE', image_1, image_2, image_3 } = roomData;

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
  let newRoom;
  try {
    newRoom = await Room.create({
      number,
      type,
      price_per_night,
      status,
      image_1,
      image_2,
      image_3
    });
  } catch (dbError) {
    // Handle PostgreSQL unique constraint violation
    if (dbError.code === '23505' && dbError.constraint === 'rooms_number_key') {
      const error = new Error(`La habitación con número "${number}" ya existe. Por favor, use un número diferente.`);
      error.code = 'DUPLICATE_ROOM_NUMBER';
      error.statusCode = 409;
      throw error;
    }
    // Re-throw other database errors
    throw dbError;
  }

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
 * @param {string} actorRole - Role of the actor (must be 'admin')
 * @param {number} roomId - Room ID to update
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated room object
 * @throws {Error} If authorization fails, room not found, or validation fails
 */
async function updateRoom(actorId, actorRole, roomId, updates) {
  // Verify actor role is 'admin'
  if (actorRole !== 'admin') {
    const error = new Error('Insufficient permissions to update rooms');
    error.code = 'AUTHORIZATION_ERROR';
    error.statusCode = 403;
    throw error;
  }

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

/**
 * Update room status with authorization and broadcasting
 * Implements strict state transition rules to prevent conflicts with check-in/check-out
 * Requirements: 3.3, 3.4, 11.1
 * @param {string} actorId - UUID of the user updating the room status
 * @param {string} actorRole - Role of the actor ('staff' or 'admin')
 * @param {number} roomId - Room ID to update
 * @param {string} newStatus - New room status (AVAILABLE, OCCUPIED, MAINTENANCE, CLEANING)
 * @returns {Promise<Object>} Updated room object
 * @throws {Error} If authorization fails, room not found, validation fails, or invalid transition
 */
async function updateRoomStatus(actorId, actorRole, roomId, newStatus) {
  // Verify actor role is 'staff' or 'admin'
  if (actorRole !== 'staff' && actorRole !== 'admin') {
    const error = new Error('Insufficient permissions to update room status');
    error.code = 'AUTHORIZATION_ERROR';
    throw error;
  }

  // Validate status
  const validStatuses = ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'CLEANING'];
  const statusValidation = validateEnum(newStatus, validStatuses, 'status');
  if (!statusValidation.valid) {
    throw new Error(statusValidation.error);
  }

  // Get current room state for validation
  const previousRoom = await Room.findById(roomId);
  
  if (!previousRoom) {
    throw new Error('Room not found');
  }

  const currentStatus = previousRoom.status;

  // CRITICAL: Validate state transitions to prevent conflicts with check-in/check-out
  // OCCUPIED status can ONLY be set via check-in, never manually
  if (newStatus === 'OCCUPIED') {
    throw new Error('Cannot manually set room to OCCUPIED. Use check-in operation instead.');
  }

  // OCCUPIED → AVAILABLE is FORBIDDEN (must go through check-out first)
  if (currentStatus === 'OCCUPIED' && newStatus === 'AVAILABLE') {
    throw new Error('Cannot change OCCUPIED room to AVAILABLE. Must perform check-out first.');
  }

  // Check for active bookings when trying to change to AVAILABLE
  if (newStatus === 'AVAILABLE') {
    const pool = require('../config/database');
    const activeBookingCheck = await pool.query(
      `SELECT COUNT(*) as count FROM bookings 
       WHERE room_id = $1 AND status = 'CHECKED_IN'`,
      [roomId]
    );

    if (parseInt(activeBookingCheck.rows[0].count) > 0) {
      throw new Error('Cannot set room to AVAILABLE while guest is checked in. Perform check-out first.');
    }

    // Only allow AVAILABLE from CLEANING or MAINTENANCE
    if (currentStatus !== 'CLEANING' && currentStatus !== 'MAINTENANCE' && currentStatus !== 'AVAILABLE') {
      throw new Error(`Cannot change from ${currentStatus} to AVAILABLE. Room must be in CLEANING or MAINTENANCE status first.`);
    }
  }

  // Define valid manual transitions
  const validTransitions = {
    'AVAILABLE': ['MAINTENANCE', 'CLEANING'],
    'OCCUPIED': ['MAINTENANCE'], // Only emergency maintenance allowed
    'CLEANING': ['AVAILABLE', 'MAINTENANCE'],
    'MAINTENANCE': ['AVAILABLE', 'CLEANING']
  };

  // Check if transition is valid
  if (!validTransitions[currentStatus].includes(newStatus)) {
    throw new Error(
      `Invalid status transition from ${currentStatus} to ${newStatus}. ` +
      `Valid transitions from ${currentStatus}: ${validTransitions[currentStatus].join(', ')}`
    );
  }

  // Update room status in database
  const updatedRoom = await Room.update(roomId, { status: newStatus });

  if (!updatedRoom) {
    throw new Error('Failed to update room status');
  }

  // Create audit log entry
  await AuditService.logAction(actorId, 'UPDATE_ROOM_STATUS', {
    previous_value: { status: previousRoom.status },
    new_value: { status: updatedRoom.status },
    affected_entity_id: roomId.toString(),
    room_id: roomId,
    previous_status: previousRoom.status,
    new_status: updatedRoom.status,
    transition_type: 'manual'
  });

  // Emit WebSocket broadcast to all clients
  if (io) {
    io.emit('room_update', {
      action: 'status_updated',
      room: updatedRoom,
      previous_status: previousRoom.status,
      timestamp: new Date().toISOString()
    });
  }

  return updatedRoom;
}

/**
 * Update room pricing and type with authorization and broadcasting
 * Requirements: 1.3, 4.4
 * @param {string} actorId - UUID of the user updating the room pricing
 * @param {string} actorRole - Role of the actor (must be 'admin')
 * @param {number} roomId - Room ID to update
 * @param {Object} pricing - Pricing data to update
 * @param {number} [pricing.price_per_night] - New price per night
 * @param {string} [pricing.type] - New room type (simple, doble, suite)
 * @param {string} [pricing.image_1] - Primary image (base64 or URL)
 * @param {string} [pricing.image_2] - Second image for suites (base64 or URL)
 * @param {string} [pricing.image_3] - Third image for suites (base64 or URL)
 * @returns {Promise<Object>} Updated room object
 * @throws {Error} If authorization fails, room not found, or validation fails
 */
async function updateRoomPricing(actorId, actorRole, roomId, pricing) {
  // Verify actor role is 'admin'
  if (actorRole !== 'admin') {
    const error = new Error('Insufficient permissions to update room pricing');
    error.code = 'AUTHORIZATION_ERROR';
    throw error;
  }

  // Validate pricing data
  if (!pricing || typeof pricing !== 'object') {
    throw new Error('Pricing data is required');
  }

  const updates = {};

  // Validate and add price_per_night if provided
  if (pricing.price_per_night !== undefined) {
    if (typeof pricing.price_per_night !== 'number' || pricing.price_per_night <= 0) {
      throw new Error('Price per night must be a positive number');
    }
    updates.price_per_night = pricing.price_per_night;
  }

  // Validate and add type if provided
  if (pricing.type !== undefined) {
    const validTypes = ['simple', 'doble', 'suite'];
    const typeValidation = validateEnum(pricing.type, validTypes, 'type');
    if (!typeValidation.valid) {
      throw new Error(typeValidation.error);
    }
    updates.type = pricing.type;
  }

  // Add images if provided
  if (pricing.image_1 !== undefined) {
    updates.image_1 = pricing.image_1;
  }
  if (pricing.image_2 !== undefined) {
    updates.image_2 = pricing.image_2;
  }
  if (pricing.image_3 !== undefined) {
    updates.image_3 = pricing.image_3;
  }

  // Ensure at least one field is being updated
  if (Object.keys(updates).length === 0) {
    throw new Error('At least one field must be provided for update');
  }

  // Get current room state for audit log
  const previousRoom = await Room.findById(roomId);
  
  if (!previousRoom) {
    throw new Error('Room not found');
  }

  // Update room pricing and type in database
  const updatedRoom = await Room.update(roomId, updates);

  if (!updatedRoom) {
    throw new Error('Failed to update room pricing');
  }

  // Create audit log entry
  await AuditService.logAction(actorId, 'UPDATE_ROOM_PRICING', {
    previous_value: {
      price_per_night: previousRoom.price_per_night,
      type: previousRoom.type
    },
    new_value: {
      price_per_night: updatedRoom.price_per_night,
      type: updatedRoom.type
    },
    affected_entity_id: roomId.toString(),
    room_id: roomId,
    changed_fields: Object.keys(updates)
  });

  // Emit WebSocket broadcast to all clients
  if (io) {
    io.emit('room_update', {
      action: 'pricing_updated',
      room: updatedRoom,
      changed_fields: Object.keys(updates),
      timestamp: new Date().toISOString()
    });
  }

  return updatedRoom;
}

/**
 * Delete a room with authorization and audit logging
 * @param {string} actorId - UUID of the user deleting the room
 * @param {string} actorRole - Role of the actor (must be 'admin')
 * @param {number} roomId - Room ID to delete
 * @returns {Promise<Object>} Deleted room object
 * @throws {Error} If authorization fails or room not found
 */
async function deleteRoom(actorId, actorRole, roomId) {
  // Verify actor role is 'admin'
  if (actorRole !== 'admin') {
    const error = new Error('Insufficient permissions to delete rooms');
    error.code = 'AUTHORIZATION_ERROR';
    throw error;
  }

  // Get room data before deletion for audit log
  const room = await Room.findById(roomId);
  
  if (!room) {
    throw new Error('Room not found');
  }

  // Check if room has active bookings
  const pool = require('../config/database');
  const bookingCheck = await pool.query(
    `SELECT COUNT(*) as count FROM bookings 
     WHERE room_id = $1 AND status IN ('CONFIRMED', 'CHECKED_IN')`,
    [roomId]
  );

  if (parseInt(bookingCheck.rows[0].count) > 0) {
    throw new Error('Cannot delete room with active bookings');
  }

  // Delete room from database
  const deleted = await Room.delete(roomId);

  if (!deleted) {
    throw new Error('Failed to delete room');
  }

  // Create audit log entry
  await AuditService.logAction(actorId, 'DELETE_ROOM', {
    previous_value: room,
    new_value: null,
    affected_entity_id: roomId.toString(),
    room_number: room.number,
    room_type: room.type
  });

  // Emit WebSocket broadcast to all clients
  if (io) {
    io.emit('room_update', {
      action: 'deleted',
      room_id: roomId,
      timestamp: new Date().toISOString()
    });
  }

  return room;
}

module.exports = {
  setSocketIO,
  createRoom,
  updateRoom,
  getRoomsByStatus,
  getAllRooms,
  getRoomById,
  updateRoomStatus,
  updateRoomPricing,
  deleteRoom
};
