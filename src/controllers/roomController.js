/**
 * Room Controller
 * HTTP endpoints for room management
 * Requirements: 4.2, 6.1
 */

const express = require('express');
const roomService = require('../services/roomService');
const { authenticateJWT } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

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
 * Get all available rooms (authenticated users)
 */
router.get('/available', authenticateJWT, async (req, res, next) => {
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
    const { number, type, price_per_night, status } = req.body;

    // Validate request body
    if (!number || !type || !price_per_night) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Room number, type, and price_per_night are required'
      });
    }

    // Create room using service
    const room = await roomService.createRoom(req.user.id, {
      number,
      type,
      price_per_night,
      status
    });

    res.status(201).json({ room });
  } catch (error) {
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
    const room = await roomService.updateRoom(req.user.id, roomId, updates);

    res.status(200).json({ room });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
