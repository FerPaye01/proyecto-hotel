/**
 * Operations Controller
 * HTTP endpoints for staff operations (check-in, check-out, payment)
 * Requirements: 5.1, 5.2, 3.5
 */

const express = require('express');
const BookingService = require('../services/bookingService');
const { authenticateJWT } = require('../middleware/auth');
const { requireAnyRole } = require('../middleware/rbac');

const router = express.Router();

/**
 * POST /api/operations/checkin
 * Check in a guest (staff/admin only)
 */
router.post('/checkin', authenticateJWT, requireAnyRole('staff', 'admin'), async (req, res, next) => {
  try {
    const { booking_id } = req.body;

    // Validate request body
    if (!booking_id) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'booking_id is required'
      });
    }

    // Perform check-in using booking service
    const result = await BookingService.checkIn(req.user.id, req.user.role, booking_id);

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
 * Check out a guest (staff/admin only)
 */
router.post('/checkout', authenticateJWT, requireAnyRole('staff', 'admin'), async (req, res, next) => {
  try {
    const { booking_id } = req.body;

    // Validate request body
    if (!booking_id) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'booking_id is required'
      });
    }

    // Perform check-out using booking service
    const result = await BookingService.checkOut(req.user.id, req.user.role, booking_id);

    res.status(200).json({
      message: 'Check-out successful',
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
 * POST /api/operations/payment
 * Process payment for a booking (staff/admin only)
 */
router.post('/payment', authenticateJWT, requireAnyRole('staff', 'admin'), async (req, res, next) => {
  try {
    const { booking_id, amount, payment_method } = req.body;

    // Validate request body
    if (!booking_id || !amount || !payment_method) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'booking_id, amount, and payment_method are required'
      });
    }

    // Perform payment processing using booking service
    const result = await BookingService.processPayment(
      req.user.id,
      req.user.role,
      booking_id,
      { amount, payment_method }
    );

    res.status(200).json({
      message: 'Payment processed successfully',
      payment: result.payment,
      booking: result.booking
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
