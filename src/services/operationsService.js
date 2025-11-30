/**
 * Operations Service - Staff workflow operations
 * Handles check-in and check-out operations with state transitions
 * Requirements: 5.1, 5.2, 5.3, 5.4
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

class OperationsService {
  /**
   * Check in a guest
   * Updates booking status to CHECKED_IN and room status to OCCUPIED
   * @param {string} actorId - UUID of the staff member performing check-in
   * @param {string} bookingId - UUID of the booking
   * @returns {Promise<Object>} Object containing updated booking and room
   * @throws {Error} If validation fails or check-in is before check_in_date
   */
  static async checkIn(actorId, bookingId) {
    // Validate required parameters
    if (!actorId) {
      throw new Error('Actor ID is required');
    }

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

      const booking = bookingResult.rows[0];

      // Validate check-in date (reject if before check_in_date)
      // Get today's date in UTC to match database date format
      const today = new Date();
      const todayDateString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
      const checkInDateString = booking.check_in_date.toISOString ? 
        booking.check_in_date.toISOString().split('T')[0] : 
        booking.check_in_date.split('T')[0];

      // Compare date strings to avoid timezone issues
      if (todayDateString < checkInDateString) {
        throw new Error('Cannot check in before the scheduled check-in date');
      }

      // Validate booking status
      if (booking.status !== 'CONFIRMED') {
        throw new Error(`Cannot check in booking with status: ${booking.status}`);
      }

      // Get room with lock
      const roomQuery = 'SELECT * FROM rooms WHERE id = $1 FOR UPDATE';
      const roomResult = await client.query(roomQuery, [booking.room_id]);

      if (roomResult.rows.length === 0) {
        throw new Error('Room not found');
      }

      const previousRoom = roomResult.rows[0];

      // Update booking status to CHECKED_IN
      const updateBookingQuery = `
        UPDATE bookings
        SET status = 'CHECKED_IN'
        WHERE id = $1
        RETURNING *
      `;
      const updatedBookingResult = await client.query(updateBookingQuery, [bookingId]);
      const updatedBooking = updatedBookingResult.rows[0];

      // Update room status to OCCUPIED
      const updateRoomQuery = `
        UPDATE rooms
        SET status = 'OCCUPIED'
        WHERE id = $1
        RETURNING *
      `;
      const updatedRoomResult = await client.query(updateRoomQuery, [booking.room_id]);
      const updatedRoom = updatedRoomResult.rows[0];

      // Commit transaction
      await client.query('COMMIT');

      // Log to audit after successful commit
      await AuditService.logAction(actorId, 'CHECK_IN', {
        previous_value: {
          booking: booking,
          room: previousRoom
        },
        new_value: {
          booking: updatedBooking,
          room: updatedRoom
        },
        affected_entity_id: bookingId,
        room_id: booking.room_id
      });

      const result = {
        booking: updatedBooking,
        room: updatedRoom
      };

      // Broadcast check-in operation to all connected clients (after database commit)
      if (io) {
        io.emit('operation_update', {
          action: 'check_in',
          booking: updatedBooking,
          room: updatedRoom,
          timestamp: new Date().toISOString()
        });
      }

      return result;
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
   * Check out a guest
   * Updates booking status to CHECKED_OUT and room status to CLEANING
   * Calculates late checkout penalties if applicable
   * @param {string} actorId - UUID of the staff member performing check-out
   * @param {number} roomId - Room ID
   * @returns {Promise<Object>} Object containing updated booking and room
   * @throws {Error} If validation fails or room has no active booking
   */
  static async checkOut(actorId, roomId) {
    // Validate required parameters
    if (!actorId) {
      throw new Error('Actor ID is required');
    }

    if (!roomId) {
      throw new Error('Room ID is required');
    }

    const client = await pool.connect();

    try {
      // Start transaction
      await client.query('BEGIN');

      // Get room with lock
      const roomQuery = 'SELECT * FROM rooms WHERE id = $1 FOR UPDATE';
      const roomResult = await client.query(roomQuery, [roomId]);

      if (roomResult.rows.length === 0) {
        throw new Error('Room not found');
      }

      const previousRoom = roomResult.rows[0];

      // Find active booking for this room (CHECKED_IN status)
      const bookingQuery = `
        SELECT * FROM bookings
        WHERE room_id = $1 AND status = 'CHECKED_IN'
        ORDER BY check_in_date DESC
        LIMIT 1
        FOR UPDATE
      `;
      const bookingResult = await client.query(bookingQuery, [roomId]);

      if (bookingResult.rows.length === 0) {
        throw new Error('No active booking found for this room');
      }

      const booking = bookingResult.rows[0];

      // Calculate late checkout penalty if applicable
      const now = new Date();
      const checkOutDate = new Date(booking.check_out_date);
      
      // Set checkout time to end of day (23:59:59)
      checkOutDate.setHours(23, 59, 59, 999);

      let latePenalty = 0;
      let updatedTotalCost = parseFloat(booking.total_cost);

      if (now > checkOutDate) {
        // Calculate late fee (e.g., 50% of one night's rate)
        // First, get the room's price per night
        const pricePerNight = parseFloat(previousRoom.price_per_night);
        latePenalty = pricePerNight * 0.5;
        updatedTotalCost += latePenalty;
      }

      // Update booking status to CHECKED_OUT and apply late penalty if any
      const updateBookingQuery = `
        UPDATE bookings
        SET status = 'CHECKED_OUT', total_cost = $1
        WHERE id = $2
        RETURNING *
      `;
      const updatedBookingResult = await client.query(updateBookingQuery, [updatedTotalCost, booking.id]);
      const updatedBooking = updatedBookingResult.rows[0];

      // Update room status to CLEANING
      const updateRoomQuery = `
        UPDATE rooms
        SET status = 'CLEANING'
        WHERE id = $1
        RETURNING *
      `;
      const updatedRoomResult = await client.query(updateRoomQuery, [roomId]);
      const updatedRoom = updatedRoomResult.rows[0];

      // Commit transaction
      await client.query('COMMIT');

      // Log to audit after successful commit
      await AuditService.logAction(actorId, 'CHECK_OUT', {
        previous_value: {
          booking: booking,
          room: previousRoom
        },
        new_value: {
          booking: updatedBooking,
          room: updatedRoom
        },
        affected_entity_id: booking.id,
        room_id: roomId,
        late_penalty: latePenalty
      });

      const result = {
        booking: updatedBooking,
        room: updatedRoom,
        late_penalty: latePenalty
      };

      // Broadcast check-out operation to all connected clients (after database commit)
      if (io) {
        io.emit('operation_update', {
          action: 'check_out',
          booking: updatedBooking,
          room: updatedRoom,
          late_penalty: latePenalty,
          timestamp: new Date().toISOString()
        });
      }

      return result;
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

module.exports = OperationsService;
module.exports.setSocketIO = setSocketIO;
