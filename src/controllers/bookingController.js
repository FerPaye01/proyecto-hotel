/**
 * Booking Controller
 * HTTP endpoints for booking management
 * Requirements: 6.2, 6.4
 */

const express = require('express');
const BookingService = require('../services/bookingService');
const { authenticateJWT } = require('../middleware/auth');
const { validateDateRange } = require('../utils/validators');

const router = express.Router();

/**
 * POST /api/bookings
 * Create a new booking (authenticated clients)
 */
router.post('/', authenticateJWT, async (req, res, next) => {
  try {
    const { room_id, check_in_date, check_out_date } = req.body;

    // Validate request body
    if (!room_id || !check_in_date || !check_out_date) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'room_id, check_in_date, and check_out_date are required'
      });
    }

    // Validate date range
    const dateValidation = validateDateRange(check_in_date, check_out_date);
    if (!dateValidation.valid) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: dateValidation.error,
        field: 'dates'
      });
    }

    // Create booking using service
    // Use authenticated user's ID as the user_id for the booking
    const booking = await BookingService.createBooking(req.user.id, {
      user_id: req.user.id,
      room_id,
      check_in_date,
      check_out_date
    });

    res.status(201).json({ booking });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/bookings/my-history
 * Get booking history for authenticated user
 */
router.get('/my-history', authenticateJWT, async (req, res, next) => {
  try {
    // Filter bookings by authenticated user's ID
    const bookings = await BookingService.getBookingsByUserId(req.user.id);
    
    res.status(200).json({ bookings });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
