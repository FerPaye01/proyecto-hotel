/**
 * User Model - Repository Pattern
 * Handles all database operations for users table
 * Requirements: 4.1, 8.1
 */

const pool = require('../config/database');

class User {
  /**
   * Find user by ID
   * @param {string} id - UUID of the user
   * @returns {Promise<Object|null>} User object or null if not found
   */
  static async findById(id) {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find user by email
   * @param {string} email - Email address
   * @returns {Promise<Object|null>} User object or null if not found
   */
  static async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await pool.query(query, [email]);
    return result.rows[0] || null;
  }

  /**
   * Create a new user
   * @param {Object} userData - User data
   * @param {string} userData.email - Email address
   * @param {string} userData.password_hash - Hashed password
   * @param {string} userData.role - User role (admin, staff, client)
   * @param {string} userData.full_name - Full name
   * @returns {Promise<Object>} Created user object
   */
  static async create({ email, password_hash, role, full_name }) {
    const query = `
      INSERT INTO users (email, password_hash, role, full_name)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await pool.query(query, [email, password_hash, role, full_name]);
    return result.rows[0];
  }

  /**
   * Update user data
   * @param {string} id - UUID of the user
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated user object or null if not found
   */
  static async update(id, updates) {
    const allowedFields = ['email', 'password_hash', 'role', 'full_name'];
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
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete user by ID
   * @param {string} id - UUID of the user
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  static async delete(id) {
    const query = 'DELETE FROM users WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [id]);
    return result.rowCount > 0;
  }

  /**
   * Get all users
   * @returns {Promise<Array>} Array of all user objects
   */
  static async findAll() {
    const query = 'SELECT id, email, role, full_name, created_at, updated_at FROM users ORDER BY created_at DESC';
    const result = await pool.query(query);
    return result.rows;
  }
}

module.exports = User;
