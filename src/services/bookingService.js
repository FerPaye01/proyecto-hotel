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
   * @param {string} userId - UUID of the user
   * @returns {Promise<Array>} Array of booking objects
   */
  static async getBookingsByUserId(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    return await Booking.findByUserId(userId);
  }

  /**
   * Create a new booking with transaction management
   * Implements conflict detection and row-level locking
   * @param {string} actorId - UUID of the user creating the booking
   * @param {Object} bookingData - Booking data
   * @param {string} bookingData.user_id - UUID of the user making the booking
   * @param {number} bookingData.room_id - Room ID
   * @param {string} bookingData.check_in_date - Check-in date (YYYY-MM-DD)
   * @param {string} bookingData.check_out_date - Check-out date (YYYY-MM-DD)
   * @returns {Promise<Object>} Created booking object
   */
  static async createBooking(actorId, bookingData) {
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

      // Update room status if applicable (optional - depends on business logic)
      // For now, we'll keep the room status as is until check-in
      // This can be modified based on requirements

      // Commit transaction
      await client.query('COMMIT');

      // Log to audit after successful commit
      await AuditService.logAction(actorId, 'CREATE_BOOKING', {
        previous_value: null,
        new_value: booking,
        affected_entity_id: booking.id,
        room_id: room_id,
        user_id: user_id
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
