/**
 * Booking Controller
 * HTTP endpoints for booking management
 * Requirements: 6.2, 6.4
 */

const express = require('express');
const BookingService = require('../services/bookingService');
const { authenticateJWT } = require('../middleware/auth');
const { requireAnyRole } = require('../middleware/rbac');
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
    const booking = await BookingService.createBooking(req.user.id, req.user.role, {
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

/**
 * POST /api/bookings/check-in
 * Check in a booking (staff and admin only)
 * Requirements: 3.1, 5.1
 */
router.post('/check-in', authenticateJWT, requireAnyRole('staff', 'admin'), async (req, res, next) => {
  try {
    const { booking_id } = req.body;

    // Validate request body
    if (!booking_id) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'booking_id is required'
      });
    }

    // Call bookingService.checkIn with actor information
    const result = await BookingService.checkIn(req.user.id, req.user.role, booking_id);

    res.status(200).json({
      success: true,
      booking: result.booking,
      room: result.room
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/bookings/check-out
 * Check out a booking (staff and admin only)
 * Requirements: 3.2, 5.2
 */
router.post('/check-out', authenticateJWT, requireAnyRole('staff', 'admin'), async (req, res, next) => {
  try {
    const { booking_id } = req.body;

    // Validate request body
    if (!booking_id) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'booking_id is required'
      });
    }

    // Call bookingService.checkOut with actor information
    const result = await BookingService.checkOut(req.user.id, req.user.role, booking_id);

    res.status(200).json({
      success: true,
      booking: result.booking,
      room: result.room,
      finalCharges: result.finalCharges,
      lateFee: result.lateFee
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/bookings/:id/payment
 * Process payment for a booking (staff and admin only)
 * Requirements: 3.5
 */
router.post('/:id/payment', authenticateJWT, requireAnyRole('staff', 'admin'), async (req, res, next) => {
  try {
    const bookingId = req.params.id;
    const { amount, payment_method } = req.body;

    // Validate request body
    if (!amount || !payment_method) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'amount and payment_method are required'
      });
    }

    // Call bookingService.processPayment with actor information
    const result = await BookingService.processPayment(
      req.user.id,
      req.user.role,
      bookingId,
      { amount, payment_method }
    );

    res.status(200).json({
      success: result.success,
      payment: result.payment,
      booking: result.booking
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/bookings/my
 * Get own bookings for authenticated user
 * Requirements: 5.3
 */
router.get('/my', authenticateJWT, async (req, res, next) => {
  try {
    // Call bookingService.getBookingsByUserId with user_id filter
    // This ensures only the user's own bookings are returned
    const bookings = await BookingService.getBookingsByUserId(req.user.id);
    
    res.status(200).json({ bookings });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
