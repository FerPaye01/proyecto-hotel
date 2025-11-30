/**
 * AuditLog Model - Repository Pattern
 * Handles all database operations for audit_logs table
 * Immutable logs - no update or delete methods
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

const pool = require('../config/database');

class AuditLog {
  /**
   * Create a new audit log entry
   * @param {Object} logData - Audit log data
   * @param {string} logData.actor_id - UUID of the user performing the action
   * @param {string} logData.action - Action type (e.g., 'CHECK_IN', 'CHECK_OUT', 'CREATE_BOOKING')
   * @param {Object} logData.details - JSONB details including previous_value, new_value, affected_entity_id
   * @returns {Promise<Object>} Created audit log object
   */
  static async create({ actor_id, action, details }) {
    const query = `
      INSERT INTO audit_logs (actor_id, action, details)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await pool.query(query, [actor_id, action, JSON.stringify(details)]);
    return result.rows[0];
  }

  /**
   * Find all audit logs for a specific actor
   * @param {string} actorId - UUID of the actor
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of records to return
   * @param {number} options.offset - Number of records to skip
   * @returns {Promise<Array>} Array of audit log objects
   */
  static async findByActorId(actorId, { limit = 100, offset = 0 } = {}) {
    const query = `
      SELECT a.*, u.email as actor_email, u.full_name as actor_name
      FROM audit_logs a
      LEFT JOIN users u ON a.actor_id = u.id
      WHERE a.actor_id = $1
      ORDER BY a.timestamp DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [actorId, limit, offset]);
    return result.rows;
  }

  /**
   * Find all audit logs for a specific action type
   * @param {string} action - Action type
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of records to return
   * @param {number} options.offset - Number of records to skip
   * @returns {Promise<Array>} Array of audit log objects
   */
  static async findByAction(action, { limit = 100, offset = 0 } = {}) {
    const query = `
      SELECT a.*, u.email as actor_email, u.full_name as actor_name
      FROM audit_logs a
      LEFT JOIN users u ON a.actor_id = u.id
      WHERE a.action = $1
      ORDER BY a.timestamp DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [action, limit, offset]);
    return result.rows;
  }

  /**
   * Find all audit logs with optional filtering
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of records to return
   * @param {number} options.offset - Number of records to skip
   * @param {string} options.startDate - Filter logs after this date (ISO format)
   * @param {string} options.endDate - Filter logs before this date (ISO format)
   * @returns {Promise<Array>} Array of audit log objects
   */
  static async findAll({ limit = 100, offset = 0, startDate = null, endDate = null } = {}) {
    let query = `
      SELECT a.*, u.email as actor_email, u.full_name as actor_name
      FROM audit_logs a
      LEFT JOIN users u ON a.actor_id = u.id
    `;
    const params = [];
    const conditions = [];
    let paramIndex = 1;

    // Add date filters if provided
    if (startDate) {
      conditions.push(`a.timestamp >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`a.timestamp <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ` ORDER BY a.timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Get count of audit logs (useful for pagination)
   * @param {Object} filters - Optional filters
   * @param {string} filters.actorId - Filter by actor ID
   * @param {string} filters.action - Filter by action type
   * @returns {Promise<number>} Total count of matching audit logs
   */
  static async count({ actorId = null, action = null } = {}) {
    let query = 'SELECT COUNT(*) as total FROM audit_logs';
    const params = [];
    const conditions = [];
    let paramIndex = 1;

    if (actorId) {
      conditions.push(`actor_id = $${paramIndex}`);
      params.push(actorId);
      paramIndex++;
    }

    if (action) {
      conditions.push(`action = $${paramIndex}`);
      params.push(action);
      paramIndex++;
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const result = await pool.query(query, params);
    return parseInt(result.rows[0].total);
  }
}

module.exports = AuditLog;
