/**
 * Audit Service - Centralized audit logging
 * Provides a clean interface for creating audit logs with JSONB details
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

const AuditLog = require('../models/AuditLog');

class AuditService {
  /**
   * Log an action to the audit trail
   * @param {string} actorId - UUID of the user performing the action
   * @param {string} action - Action type (e.g., 'CHECK_IN', 'CHECK_OUT', 'CREATE_BOOKING', 'CREATE_ROOM', 'UPDATE_ROOM')
   * @param {Object} details - Details object containing previous_value, new_value, and affected_entity_id
   * @param {*} details.previous_value - The state before the action (null for create operations)
   * @param {*} details.new_value - The state after the action
   * @param {string} details.affected_entity_id - ID of the entity affected by the action
   * @returns {Promise<Object>} Created audit log object
   */
  static async logAction(actorId, action, details) {
    // Validate required parameters
    if (!actorId) {
      throw new Error('Actor ID is required for audit logging');
    }

    if (!action) {
      throw new Error('Action type is required for audit logging');
    }

    if (!details || typeof details !== 'object') {
      throw new Error('Details object is required for audit logging');
    }

    // Format details as JSONB-compatible object
    const formattedDetails = {
      previous_value: details.previous_value !== undefined ? details.previous_value : null,
      new_value: details.new_value !== undefined ? details.new_value : null,
      affected_entity_id: details.affected_entity_id || null,
      // Include any additional metadata
      ...details
    };

    // Call AuditLog model to persist
    const auditLog = await AuditLog.create({
      actor_id: actorId,
      action,
      details: formattedDetails
    });

    return auditLog;
  }

  /**
   * Get audit logs for a specific actor
   * @param {string} actorId - UUID of the actor
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of audit log objects
   */
  static async getLogsByActor(actorId, options = {}) {
    return await AuditLog.findByActorId(actorId, options);
  }

  /**
   * Get audit logs for a specific action type
   * @param {string} action - Action type
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of audit log objects
   */
  static async getLogsByAction(action, options = {}) {
    return await AuditLog.findByAction(action, options);
  }

  /**
   * Get all audit logs with optional filtering
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of audit log objects
   */
  static async getAllLogs(options = {}) {
    return await AuditLog.findAll(options);
  }

  /**
   * Get count of audit logs
   * @param {Object} filters - Optional filters
   * @returns {Promise<number>} Total count of matching audit logs
   */
  static async getLogsCount(filters = {}) {
    return await AuditLog.count(filters);
  }
}

module.exports = AuditService;
