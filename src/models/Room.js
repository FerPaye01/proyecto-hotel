/**
 * Room Model - Repository Pattern
 * Handles all database operations for rooms table
 * Requirements: 4.2, 6.1
 */

const pool = require('../config/database');

class Room {
  /**
   * Find room by ID
   * @param {number} id - Room ID
   * @returns {Promise<Object|null>} Room object or null if not found
   */
  static async findById(id) {
    const query = 'SELECT * FROM rooms WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find all rooms
   * @returns {Promise<Array>} Array of all room objects
   */
  static async findAll() {
    const query = 'SELECT * FROM rooms ORDER BY number';
    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Find rooms by status
   * @param {string} status - Room status (AVAILABLE, OCCUPIED, MAINTENANCE, CLEANING)
   * @returns {Promise<Array>} Array of room objects with matching status
   */
  static async findByStatus(status) {
    const query = 'SELECT * FROM rooms WHERE status = $1 ORDER BY number';
    const result = await pool.query(query, [status]);
    return result.rows;
  }

  /**
   * Check room availability for a date range
   * @param {number} roomId - Room ID
   * @param {string} checkInDate - Check-in date (YYYY-MM-DD)
   * @param {string} checkOutDate - Check-out date (YYYY-MM-DD)
   * @returns {Promise<boolean>} True if room is available, false if conflicts exist
   */
  static async checkAvailability(roomId, checkInDate, checkOutDate) {
    // Check if room exists and has AVAILABLE status
    const roomQuery = 'SELECT status FROM rooms WHERE id = $1';
    const roomResult = await pool.query(roomQuery, [roomId]);
    
    if (roomResult.rows.length === 0) {
      return false; // Room doesn't exist
    }

    // Check for date conflicts with existing bookings
    // A conflict exists if the date ranges overlap
    // Overlap occurs when: new_start < existing_end AND new_end > existing_start
    const conflictQuery = `
      SELECT COUNT(*) as conflict_count
      FROM bookings
      WHERE room_id = $1
        AND status IN ('CONFIRMED', 'CHECKED_IN')
        AND check_in_date < $3
        AND check_out_date > $2
    `;
    const conflictResult = await pool.query(conflictQuery, [roomId, checkInDate, checkOutDate]);
    
    return parseInt(conflictResult.rows[0].conflict_count) === 0;
  }

  /**
   * Create a new room
   * @param {Object} roomData - Room data
   * @param {string} roomData.number - Room number
   * @param {string} roomData.type - Room type (simple, doble, suite)
   * @param {number} roomData.price_per_night - Price per night
   * @param {string} roomData.status - Room status (AVAILABLE, OCCUPIED, MAINTENANCE, CLEANING)
   * @param {string} [roomData.image_1] - Primary image (base64 or URL)
   * @param {string} [roomData.image_2] - Second image for suites (base64 or URL)
   * @param {string} [roomData.image_3] - Third image for suites (base64 or URL)
   * @returns {Promise<Object>} Created room object
   */
  static async create({ number, type, price_per_night, status = 'AVAILABLE', image_1, image_2, image_3 }) {
    const query = `
      INSERT INTO rooms (number, type, price_per_night, status, image_1, image_2, image_3)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const result = await pool.query(query, [number, type, price_per_night, status, image_1 || null, image_2 || null, image_3 || null]);
    return result.rows[0];
  }

  /**
   * Update room data
   * @param {number} id - Room ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated room object or null if not found
   */
  static async update(id, updates) {
    const allowedFields = ['number', 'type', 'price_per_night', 'status', 'image_1', 'image_2', 'image_3'];
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
      UPDATE rooms
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete room by ID
   * @param {number} id - Room ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  static async delete(id) {
    const query = 'DELETE FROM rooms WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [id]);
    return result.rowCount > 0;
  }
}

module.exports = Room;
