/**
 * Booking Service - Business logic for booking operations
 * Implements transaction management for atomicity and conflict detection
 * Requirements: 6.2, 6.3, 7.1, 7.2, 7.3, 7.4
 */

const pool = require('../config/database');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const AuditService = require('./auditService');

// Socket.IO instance for broadcasting (set by server initialization)
let io = null;

/**
 * Set the Socket.IO instance for broadcasting
 * @param {Server} socketIo - Socket.IO server instance
 */
function setSocketIO(socketIo) {
  io = socketIo;
}

class BookingService {
  /**
   * Calculate total cost for a booking
   * @param {number} roomId - Room ID
   * @param {string} checkInDate - Check-in date (YYYY-MM-DD)
   * @param {string} checkOutDate - Check-out date (YYYY-MM-DD)
   * @returns {Promise<number>} Total cost for the booking
   */
  static async calculateTotalCost(roomId, checkInDate, checkOutDate) {
    // Validate dates
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    if (checkOut <= checkIn) {
      throw new Error('Check-out date must be after check-in date');
    }

    // Get room to retrieve price
    const room = await Room.findById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    // Calculate number of nights
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

    // Calculate total cost
    const totalCost = parseFloat(room.price_per_night) * nights;

    return totalCost;
  }

  /**
   * Get all bookings for a specific user
   * Ensures user_id filtering to prevent data leakage across users
   * @param {string} userId - UUID of the user
   * @returns {Promise<Array>} Array of booking objects
   */
  static async getBookingsByUserId(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // The Booking.findByUserId method includes WHERE clause with user_id filter
    // This prevents cross-user data access (Requirements: 5.3, 9.4)
    return await Booking.findByUserId(userId);
  }

  /**
   * Check in a booking
   * Atomically updates booking status to CHECKED_IN and room status to OCCUPIED
   * @param {string} actorId - UUID of the actor performing check-in
   * @param {string} actorRole - Role of the actor (must be 'staff' or 'admin')
   * @param {string} bookingId - UUID of the booking to check in
   * @returns {Promise<Object>} Object containing updated booking and room
   */
  static async checkIn(actorId, actorRole, bookingId) {
    // Verify actor role
    if (actorRole !== 'staff' && actorRole !== 'admin') {
      throw new Error('AUTHORIZATION_ERROR: Only staff and admin can perform check-in operations');
    }

    // Validate required fields
    if (!bookingId) {
      throw new Error('Booking ID is required');
    }

    const client = await pool.connect();

    try {
      // Start transaction
      await client.query('BEGIN');

      // Get booking with lock
      const bookingQuery = 'SELECT * FROM bookings WHERE id = $1 FOR UPDATE';
      const bookingResult = await client.query(bookingQuery, [bookingId]);

      if (bookingResult.rows.length === 0) {
        throw new Error('Booking not found');
      }

      const previousBooking = bookingResult.rows[0];

      // Verify booking is in CONFIRMED status
      if (previousBooking.status !== 'CONFIRMED') {
        throw new Error(`Cannot check in booking with status ${previousBooking.status}`);
      }

      // Get room with lock
      const roomQuery = 'SELECT * FROM rooms WHERE id = $1 FOR UPDATE';
      const roomResult = await client.query(roomQuery, [previousBooking.room_id]);

      if (roomResult.rows.length === 0) {
        throw new Error('Room not found');
      }

      const previousRoom = roomResult.rows[0];

      // Update booking status to CHECKED_IN
      const updateBookingQuery = `
        UPDATE bookings
        SET status = $1
        WHERE id = $2
        RETURNING *
      `;
      const updatedBookingResult = await client.query(updateBookingQuery, ['CHECKED_IN', bookingId]);
      const updatedBooking = updatedBookingResult.rows[0];

      // Update room status to OCCUPIED
      const updateRoomQuery = `
        UPDATE rooms
        SET status = $1
        WHERE id = $2
        RETURNING *
      `;
      const updatedRoomResult = await client.query(updateRoomQuery, ['OCCUPIED', previousBooking.room_id]);
      const updatedRoom = updatedRoomResult.rows[0];

      // Commit transaction
      await client.query('COMMIT');

      // Create audit log entry with status changes
      await AuditService.logAction(actorId, 'CHECK_IN', {
        booking_id: bookingId,
        room_id: previousBooking.room_id,
        previous_booking_status: previousBooking.status,
        new_booking_status: updatedBooking.status,
        previous_room_status: previousRoom.status,
        new_room_status: updatedRoom.status,
        affected_entity_id: bookingId
      });

      // Broadcast check-in to all connected clients
      if (io) {
        io.emit('booking_update', {
          action: 'checked_in',
          booking: updatedBooking,
          room: updatedRoom,
          timestamp: new Date().toISOString()
        });
      }

      return {
        booking: updatedBooking,
        room: updatedRoom
      };
    } catch (error) {
      // Rollback transaction on failure
      await client.query('ROLLBACK');
      throw error;
    } finally {
      // Release client back to pool
      client.release();
    }
  }

  /**
   * Check out a booking
   * Atomically updates booking status to CHECKED_OUT, room status to CLEANING, and calculates final charges
   * @param {string} actorId - UUID of the actor performing check-out
   * @param {string} actorRole - Role of the actor (must be 'staff' or 'admin')
   * @param {string} bookingId - UUID of the booking to check out
   * @returns {Promise<Object>} Object containing updated booking, room, and final charges
   */
  static async checkOut(actorId, actorRole, bookingId) {
    // Verify actor role
    if (actorRole !== 'staff' && actorRole !== 'admin') {
      throw new Error('AUTHORIZATION_ERROR: Only staff and admin can perform check-out operations');
    }

    // Validate required fields
    if (!bookingId) {
      throw new Error('Booking ID is required');
    }

    const client = await pool.connect();

    try {
      // Start transaction
      await client.query('BEGIN');

      // Get booking with lock
      const bookingQuery = 'SELECT * FROM bookings WHERE id = $1 FOR UPDATE';
      const bookingResult = await client.query(bookingQuery, [bookingId]);

      if (bookingResult.rows.length === 0) {
        throw new Error('Booking not found');
      }

      const previousBooking = bookingResult.rows[0];

      // Verify booking is in CHECKED_IN status
      if (previousBooking.status !== 'CHECKED_IN') {
        throw new Error(`Cannot check out booking with status ${previousBooking.status}`);
      }

      // Get room with lock
      const roomQuery = 'SELECT * FROM rooms WHERE id = $1 FOR UPDATE';
      const roomResult = await client.query(roomQuery, [previousBooking.room_id]);

      if (roomResult.rows.length === 0) {
        throw new Error('Room not found');
      }

      const previousRoom = roomResult.rows[0];

      // Calculate final charges including late fees
      const checkOutDate = new Date(previousBooking.check_out_date);
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0); // Normalize to start of day
      checkOutDate.setHours(0, 0, 0, 0);

      let finalCharges = parseFloat(previousBooking.total_cost);
      let lateFee = 0;

      // Calculate late fee if checking out after scheduled check-out date
      if (currentDate > checkOutDate) {
        const lateDays = Math.ceil((currentDate - checkOutDate) / (1000 * 60 * 60 * 24));
        const roomPricePerNight = parseFloat(previousRoom.price_per_night);
        lateFee = lateDays * roomPricePerNight;
        finalCharges += lateFee;
      }

      // Update booking status to CHECKED_OUT
      const updateBookingQuery = `
        UPDATE bookings
        SET status = $1, total_cost = $2
        WHERE id = $3
        RETURNING *
      `;
      const updatedBookingResult = await client.query(updateBookingQuery, ['CHECKED_OUT', finalCharges, bookingId]);
      const updatedBooking = updatedBookingResult.rows[0];

      // Update room status to CLEANING
      const updateRoomQuery = `
        UPDATE rooms
        SET status = $1
        WHERE id = $2
        RETURNING *
      `;
      const updatedRoomResult = await client.query(updateRoomQuery, ['CLEANING', previousBooking.room_id]);
      const updatedRoom = updatedRoomResult.rows[0];

      // Commit transaction
      await client.query('COMMIT');

      // Create audit log entry with status changes
      await AuditService.logAction(actorId, 'CHECK_OUT', {
        booking_id: bookingId,
        room_id: previousBooking.room_id,
        previous_booking_status: previousBooking.status,
        new_booking_status: updatedBooking.status,
        previous_room_status: previousRoom.status,
        new_room_status: updatedRoom.status,
        previous_total_cost: previousBooking.total_cost,
        final_charges: finalCharges,
        late_fee: lateFee,
        affected_entity_id: bookingId
      });

      // Broadcast check-out to all connected clients
      if (io) {
        io.emit('booking_update', {
          action: 'checked_out',
          booking: updatedBooking,
          room: updatedRoom,
          finalCharges,
          lateFee,
          timestamp: new Date().toISOString()
        });
      }

      return {
        booking: updatedBooking,
        room: updatedRoom,
        finalCharges,
        lateFee
      };
    } catch (error) {
      // Rollback transaction on failure
      await client.query('ROLLBACK');
      throw error;
    } finally {
      // Release client back to pool
      client.release();
    }
  }

  /**
   * Process payment for a booking
   * Records payment transaction and creates audit log
   * @param {string} actorId - UUID of the actor processing payment
   * @param {string} actorRole - Role of the actor (must be 'staff' or 'admin')
   * @param {string} bookingId - UUID of the booking
   * @param {Object} paymentData - Payment data
   * @param {number} paymentData.amount - Payment amount
   * @param {string} paymentData.payment_method - Payment method (cash, card, transfer)
   * @returns {Promise<Object>} Payment confirmation object
   */
  static async processPayment(actorId, actorRole, bookingId, paymentData) {
    // Verify actor role
    if (actorRole !== 'staff' && actorRole !== 'admin') {
      throw new Error('AUTHORIZATION_ERROR: Only staff and admin can process payments');
    }

    // Validate required fields
    if (!bookingId) {
      throw new Error('Booking ID is required');
    }

    if (!paymentData || !paymentData.amount || !paymentData.payment_method) {
      throw new Error('Payment amount and payment method are required');
    }

    // Validate payment method
    const validPaymentMethods = ['cash', 'card', 'transfer'];
    if (!validPaymentMethods.includes(paymentData.payment_method)) {
      throw new Error(`Invalid payment method. Must be one of: ${validPaymentMethods.join(', ')}`);
    }

    // Get booking to verify it exists
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }

    // Create payment record (in a real system, this would be a separate payments table)
    const paymentRecord = {
      booking_id: bookingId,
      amount: parseFloat(paymentData.amount),
      payment_method: paymentData.payment_method,
      processed_at: new Date().toISOString(),
      processed_by: actorId
    };

    // Create audit log entry with payment details
    await AuditService.logAction(actorId, 'PROCESS_PAYMENT', {
      booking_id: bookingId,
      room_id: booking.room_id,
      amount: paymentRecord.amount,
      payment_method: paymentRecord.payment_method,
      processed_at: paymentRecord.processed_at,
      affected_entity_id: bookingId
    });

    // Broadcast payment to all connected clients
    if (io) {
      io.emit('payment_processed', {
        booking_id: bookingId,
        amount: paymentRecord.amount,
        payment_method: paymentRecord.payment_method,
        timestamp: paymentRecord.processed_at
      });
    }

    return {
      success: true,
      payment: paymentRecord,
      booking
    };
  }

  /**
   * Create a new booking with transaction management
   * Implements conflict detection and row-level locking
   * @param {string} actorId - UUID of the user creating the booking
   * @param {string} actorRole - Role of the actor ('client', 'staff', or 'admin')
   * @param {Object} bookingData - Booking data
   * @param {string} bookingData.user_id - UUID of the user making the booking
   * @param {number} bookingData.room_id - Room ID
   * @param {string} bookingData.check_in_date - Check-in date (YYYY-MM-DD)
   * @param {string} bookingData.check_out_date - Check-out date (YYYY-MM-DD)
   * @returns {Promise<Object>} Created booking object
   * @throws {Error} If authorization fails or validation fails
   */
  static async createBooking(actorId, actorRole, bookingData) {
    // Verify actor role is 'client', 'staff', or 'admin'
    const allowedRoles = ['client', 'staff', 'admin'];
    if (!allowedRoles.includes(actorRole)) {
      const error = new Error('Insufficient permissions to create bookings');
      error.code = 'AUTHORIZATION_ERROR';
      error.statusCode = 403;
      throw error;
    }

    const { user_id, room_id, check_in_date, check_out_date } = bookingData;

    // Validate required fields
    if (!user_id || !room_id || !check_in_date || !check_out_date) {
      throw new Error('Missing required booking fields');
    }

    // Validate dates
    const checkIn = new Date(check_in_date);
    const checkOut = new Date(check_out_date);

    if (checkOut <= checkIn) {
      throw new Error('Check-out date must be after check-in date');
    }

    const client = await pool.connect();

    try {
      // Start transaction
      await client.query('BEGIN');

      // Lock room record with SELECT FOR UPDATE to prevent concurrent modifications
      const lockQuery = 'SELECT * FROM rooms WHERE id = $1 FOR UPDATE';
      const roomResult = await client.query(lockQuery, [room_id]);

      if (roomResult.rows.length === 0) {
        throw new Error('Room not found');
      }

      const room = roomResult.rows[0];

      // Check for date conflicts using Booking model
      // Note: We need to use the client connection for consistency
      const conflictQuery = `
        SELECT *
        FROM bookings
        WHERE room_id = $1
          AND status IN ('CONFIRMED', 'CHECKED_IN')
          AND check_in_date < $3
          AND check_out_date > $2
      `;
      const conflictResult = await client.query(conflictQuery, [room_id, check_in_date, check_out_date]);

      if (conflictResult.rows.length > 0) {
        throw new Error('Booking conflict: Room is not available for the selected dates');
      }

      // Calculate total cost
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      const total_cost = parseFloat(room.price_per_night) * nights;

      // Insert booking
      const insertQuery = `
        INSERT INTO bookings (user_id, room_id, check_in_date, check_out_date, total_cost, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      const bookingResult = await client.query(insertQuery, [
        user_id,
        room_id,
        check_in_date,
        check_out_date,
        total_cost,
        'CONFIRMED'
      ]);

      const booking = bookingResult.rows[0];

      // DO NOT modify room status when creating a booking (Requirement 11.2)
      // Room status should only change to OCCUPIED during check-in by staff/admin
      // Booking status is set to 'CONFIRMED' and room status remains unchanged

      // Commit transaction
      await client.query('COMMIT');

      // Log to audit after successful commit with booking details
      await AuditService.logAction(actorId, 'CREATE_BOOKING', {
        booking_id: booking.id,
        room_id: room_id,
        user_id: user_id,
        check_in_date: check_in_date,
        check_out_date: check_out_date,
        total_cost: total_cost,
        status: 'CONFIRMED',
        previous_value: null,
        new_value: booking,
        affected_entity_id: booking.id
      });

      // Broadcast booking creation to all connected clients (after database commit)
      if (io) {
        io.emit('booking_update', {
          action: 'created',
          booking: booking,
          room: room,
          timestamp: new Date().toISOString()
        });
      }

      return booking;
    } catch (error) {
      // Rollback transaction on failure
      await client.query('ROLLBACK');
      throw error;
    } finally {
      // Release client back to pool
      client.release();
    }
  }
}

module.exports = BookingService;
module.exports.setSocketIO = setSocketIO;
