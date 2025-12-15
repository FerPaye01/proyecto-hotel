/**
 * Room Controller
 * HTTP endpoints for room management
 * Requirements: 4.2, 6.1
 */

const express = require('express');
const roomService = require('../services/roomService');
const { authenticateJWT, optionalAuth } = require('../middleware/auth');
const { requireRole, requireAnyRole } = require('../middleware/rbac');

const router = express.Router();

/**
 * GET /api/rooms
 * Get all rooms (authenticated users)
 */
router.get('/', authenticateJWT, async (req, res, next) => {
  try {
    const rooms = await roomService.getAllRooms();
    res.status(200).json({ rooms });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rooms/available
 * Get all available rooms (public access allowed, authentication optional)
 * This endpoint is public to allow visitors to browse and quote rooms
 */
router.get('/available', optionalAuth, async (req, res, next) => {
  try {
    const rooms = await roomService.getRoomsByStatus('AVAILABLE');
    res.status(200).json({ rooms });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rooms
 * Create a new room (admin only)
 */
router.post('/', authenticateJWT, requireRole('admin'), async (req, res, next) => {
  try {
    const { number, type, price_per_night, status, image_1, image_2, image_3 } = req.body;

    // Validate request body
    if (!number || !type || !price_per_night) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Room number, type, and price_per_night are required'
      });
    }

    // Build room data object
    const roomData = {
      number,
      type,
      price_per_night,
      status
    };

    // Add images if provided
    if (image_1) roomData.image_1 = image_1;
    if (image_2) roomData.image_2 = image_2;
    if (image_3) roomData.image_3 = image_3;

    // Create room using service
    const room = await roomService.createRoom(req.user.id, req.user.role, roomData);

    res.status(201).json({ room });
  } catch (error) {
    // Handle duplicate room number error
    if (error.code === 'DUPLICATE_ROOM_NUMBER') {
      return res.status(409).json({
        error: 'DUPLICATE_ROOM_NUMBER',
        message: error.message
      });
    }
    
    // Handle authorization errors
    if (error.code === 'AUTHORIZATION_ERROR') {
      return res.status(403).json({
        error: 'AUTHORIZATION_ERROR',
        message: error.message
      });
    }
    
    next(error);
  }
});

/**
 * PUT /api/rooms/:id
 * Update an existing room (admin only)
 */
router.put('/:id', authenticateJWT, requireRole('admin'), async (req, res, next) => {
  try {
    const roomId = parseInt(req.params.id);
    
    if (isNaN(roomId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid room ID'
      });
    }

    const { number, type, price_per_night, status } = req.body;

    // Build updates object with only provided fields
    const updates = {};
    if (number !== undefined) updates.number = number;
    if (type !== undefined) updates.type = type;
    if (price_per_night !== undefined) updates.price_per_night = price_per_night;
    if (status !== undefined) updates.status = status;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'No valid fields to update'
      });
    }

    // Update room using service
    const room = await roomService.updateRoom(req.user.id, req.user.role, roomId, updates);

    res.status(200).json({ room });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/rooms/:id/status
 * Update room status (staff or admin)
 * Requirements: 3.3, 3.4, 11.1
 */
router.put('/:id/status', authenticateJWT, requireAnyRole('staff', 'admin'), async (req, res, next) => {
  try {
    const roomId = parseInt(req.params.id);
    
    if (isNaN(roomId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid room ID'
      });
    }

    const { status } = req.body;

    // Validate status is provided
    if (!status) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Status is required'
      });
    }

    // Call roomService.updateRoomStatus
    const room = await roomService.updateRoomStatus(
      req.user.id,
      req.user.role,
      roomId,
      status
    );

    res.status(200).json({ room });
  } catch (error) {
    // Handle authorization errors
    if (error.code === 'AUTHORIZATION_ERROR') {
      return res.status(403).json({
        error: 'AUTHORIZATION_ERROR',
        message: error.message
      });
    }
    next(error);
  }
});

/**
 * PUT /api/rooms/:id/pricing
 * Update room pricing (admin only)
 * Requirements: 1.3, 4.4
 */
router.put('/:id/pricing', authenticateJWT, requireRole('admin'), async (req, res, next) => {
  try {
    const roomId = parseInt(req.params.id);
    
    if (isNaN(roomId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid room ID'
      });
    }

    const { price_per_night, type, image_1, image_2, image_3 } = req.body;

    // Validate at least one pricing field is provided
    if (price_per_night === undefined && type === undefined && image_1 === undefined && image_2 === undefined && image_3 === undefined) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'At least one pricing field (price_per_night, type, or images) is required'
      });
    }

    // Build pricing object
    const pricing = {};
    if (price_per_night !== undefined) pricing.price_per_night = price_per_night;
    if (type !== undefined) pricing.type = type;
    if (image_1 !== undefined) pricing.image_1 = image_1;
    if (image_2 !== undefined) pricing.image_2 = image_2;
    if (image_3 !== undefined) pricing.image_3 = image_3;

    // Call roomService.updateRoomPricing
    const room = await roomService.updateRoomPricing(
      req.user.id,
      req.user.role,
      roomId,
      pricing
    );

    res.status(200).json({ room });
  } catch (error) {
    // Handle authorization errors
    if (error.code === 'AUTHORIZATION_ERROR') {
      return res.status(403).json({
        error: 'AUTHORIZATION_ERROR',
        message: error.message
      });
    }
    next(error);
  }
});

/**
 * DELETE /api/rooms/:id
 * Delete a room (admin only)
 * Requirements: Admin management
 */
router.delete('/:id', authenticateJWT, requireRole('admin'), async (req, res, next) => {
  try {
    const roomId = parseInt(req.params.id);
    
    if (isNaN(roomId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid room ID'
      });
    }

    // Call roomService.deleteRoom
    const deletedRoom = await roomService.deleteRoom(
      req.user.id,
      req.user.role,
      roomId
    );

    res.status(200).json({ 
      message: 'Room deleted successfully',
      room: deletedRoom 
    });
  } catch (error) {
    // Handle authorization errors
    if (error.code === 'AUTHORIZATION_ERROR') {
      return res.status(403).json({
        error: 'AUTHORIZATION_ERROR',
        message: error.message
      });
    }
    
    // Handle specific errors
    if (error.message === 'Room not found') {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: error.message
      });
    }
    
    if (error.message.includes('active bookings')) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.message
      });
    }
    
    next(error);
  }
});

module.exports = router;
