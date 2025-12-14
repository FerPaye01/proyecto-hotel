/**
 * Operations Controller
 * HTTP endpoints for staff operations (check-in, check-out)
 * Requirements: 5.1, 5.2
 */

const express = require('express');
const OperationsService = require('../services/operationsService');
const { authenticateJWT } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

/**
 * POST /api/operations/checkin
 * Check in a guest (staff only)
 */
router.post('/checkin', authenticateJWT, requireRole('staff'), async (req, res, next) => {
  try {
    const { booking_id } = req.body;

    // Validate request body
    if (!booking_id) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'booking_id is required'
      });
    }

    // Perform check-in using operations service
    const result = await OperationsService.checkIn(req.user.id, req.user.role, booking_id);

    res.status(200).json({
      message: 'Check-in successful',
      booking: result.booking,
      room: result.room
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/operations/checkout
 * Check out a guest (staff only)
 */
router.post('/checkout', authenticateJWT, requireRole('staff'), async (req, res, next) => {
  try {
    const { room_id } = req.body;

    // Validate request body
    if (!room_id) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'room_id is required'
      });
    }

    // Validate room_id is a number
    const roomId = parseInt(room_id);
    if (isNaN(roomId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'room_id must be a valid number'
      });
    }

    // Perform check-out using operations service
    const result = await OperationsService.checkOut(req.user.id, req.user.role, roomId);

    res.status(200).json({
      message: 'Check-out successful',
      booking: result.booking,
      room: result.room,
      late_penalty: result.late_penalty
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
