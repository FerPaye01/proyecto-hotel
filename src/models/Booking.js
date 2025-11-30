/**
 * Booking Model - Repository Pattern
 * Handles all database operations for bookings table
 * Requirements: 6.2, 6.3, 7.2
 */

const pool = require('../config/database');

class Booking {
  /**
   * Find booking by ID
   * @param {string} id - UUID of the booking
   * @returns {Promise<Object|null>} Booking object or null if not found
   */
  static async findById(id) {
    const query = 'SELECT * FROM bookings WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find all bookings for a specific user
   * @param {string} userId - UUID of the user
   * @returns {Promise<Array>} Array of booking objects
   */
  static async findByUserId(userId) {
    const query = `
      SELECT b.*, r.number as room_number, r.type as room_type
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      WHERE b.user_id = $1
      ORDER BY b.check_in_date DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  /**
   * Find all bookings for a specific room
   * @param {number} roomId - Room ID
   * @returns {Promise<Array>} Array of booking objects
   */
  static async findByRoomId(roomId) {
    const query = `
      SELECT b.*, u.email as user_email, u.full_name as user_name
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      WHERE b.room_id = $1
      ORDER BY b.check_in_date DESC
    `;
    const result = await pool.query(query, [roomId]);
    return result.rows;
  }

  /**
   * Find conflicting bookings for a room and date range
   * Used to prevent double-bookings
   * @param {number} roomId - Room ID
   * @param {string} checkInDate - Check-in date (YYYY-MM-DD)
   * @param {string} checkOutDate - Check-out date (YYYY-MM-DD)
   * @param {string} excludeBookingId - Optional booking ID to exclude (for updates)
   * @returns {Promise<Array>} Array of conflicting booking objects
   */
  static async findConflictingBookings(roomId, checkInDate, checkOutDate, excludeBookingId = null) {
    // Date ranges overlap when: new_start < existing_end AND new_end > existing_start
    // Only consider active bookings (CONFIRMED or CHECKED_IN)
    let query = `
      SELECT *
      FROM bookings
      WHERE room_id = $1
        AND status IN ('CONFIRMED', 'CHECKED_IN')
        AND check_in_date < $3
        AND check_out_date > $2
    `;
    const params = [roomId, checkInDate, checkOutDate];

    // Optionally exclude a specific booking (useful for updates)
    if (excludeBookingId) {
      query += ' AND id != $4';
      params.push(excludeBookingId);
    }

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Create a new booking
   * @param {Object} bookingData - Booking data
   * @param {string} bookingData.user_id - UUID of the user
   * @param {number} bookingData.room_id - Room ID
   * @param {string} bookingData.check_in_date - Check-in date (YYYY-MM-DD)
   * @param {string} bookingData.check_out_date - Check-out date (YYYY-MM-DD)
   * @param {number} bookingData.total_cost - Total cost
   * @param {string} bookingData.status - Booking status (default: CONFIRMED)
   * @returns {Promise<Object>} Created booking object
   */
  static async create({ user_id, room_id, check_in_date, check_out_date, total_cost, status = 'CONFIRMED' }) {
    const query = `
      INSERT INTO bookings (user_id, room_id, check_in_date, check_out_date, total_cost, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await pool.query(query, [user_id, room_id, check_in_date, check_out_date, total_cost, status]);
    return result.rows[0];
  }

  /**
   * Update booking data
   * @param {string} id - UUID of the booking
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated booking object or null if not found
   */
  static async update(id, updates) {
    const allowedFields = ['check_in_date', 'check_out_date', 'total_cost', 'status'];
    const fields = [];
    const values = [];
    let paramIndex = 1;

    // Build dynamic UPDATE query with only provided fields
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      // No valid fields to update
      return await this.findById(id);
    }

    values.push(id);
    const query = `
      UPDATE bookings
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete booking by ID
   * @param {string} id - UUID of the booking
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  static async delete(id) {
    const query = 'DELETE FROM bookings WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [id]);
    return result.rowCount > 0;
  }
}

module.exports = Booking;
