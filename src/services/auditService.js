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

  /**
   * Log user management actions (create, update, delete)
   * @param {string} actorId - UUID of the actor performing the action
   * @param {string} action - Action type (e.g., 'CREATE_USER', 'UPDATE_USER', 'DELETE_USER')
   * @param {string} targetUserId - UUID of the user being managed
   * @param {Array<string>} changedFields - Array of field names that were changed
   * @param {Object} previousValues - Object containing previous values of changed fields
   * @param {Object} newValues - Object containing new values of changed fields
   * @returns {Promise<Object>} Created audit log object
   * Requirements: 10.2
   */
  static async logUserManagement(actorId, action, targetUserId, changedFields, previousValues, newValues) {
    const details = {
      target_user_id: targetUserId,
      action_type: action,
      changed_fields: changedFields || [],
      previous_values: previousValues || {},
      new_values: newValues || {}
    };

    return await this.logAction(actorId, action, details);
  }

  /**
   * Log check-in/check-out operations
   * @param {string} actorId - UUID of the actor performing the action
   * @param {string} action - Action type ('CHECK_IN' or 'CHECK_OUT')
   * @param {string} bookingId - UUID of the booking
   * @param {number} roomId - ID of the room
   * @param {Object} statusChanges - Object containing status changes
   * @param {string} statusChanges.previousBookingStatus - Previous booking status
   * @param {string} statusChanges.newBookingStatus - New booking status
   * @param {string} statusChanges.previousRoomStatus - Previous room status
   * @param {string} statusChanges.newRoomStatus - New room status
   * @returns {Promise<Object>} Created audit log object
   * Requirements: 10.3
   */
  static async logCheckInOut(actorId, action, bookingId, roomId, statusChanges) {
    const details = {
      booking_id: bookingId,
      room_id: roomId,
      previous_booking_status: statusChanges.previousBookingStatus || null,
      new_booking_status: statusChanges.newBookingStatus || null,
      previous_room_status: statusChanges.previousRoomStatus || null,
      new_room_status: statusChanges.newRoomStatus || null
    };

    return await this.logAction(actorId, action, details);
  }

  /**
   * Log booking creation
   * @param {string} actorId - UUID of the actor creating the booking
   * @param {string} bookingId - UUID of the created booking
   * @param {number} roomId - ID of the room
   * @param {Object} dates - Object containing check-in and check-out dates
   * @param {string} dates.checkInDate - Check-in date
   * @param {string} dates.checkOutDate - Check-out date
   * @param {number} totalCost - Total cost of the booking
   * @returns {Promise<Object>} Created audit log object
   * Requirements: 10.4
   */
  static async logBookingCreation(actorId, bookingId, roomId, dates, totalCost) {
    const details = {
      booking_id: bookingId,
      room_id: roomId,
      check_in_date: dates.checkInDate,
      check_out_date: dates.checkOutDate,
      total_cost: totalCost
    };

    return await this.logAction(actorId, 'CREATE_BOOKING', details);
  }

  /**
   * Log system/cron automated actions
   * @param {string} actionType - Type of system action (e.g., 'EXPIRE_BOOKINGS', 'EXPIRE_SESSIONS')
   * @param {number} affectedCount - Number of entities affected
   * @param {Array<string>} affectedIds - Array of UUIDs of affected entities
   * @param {string} criteria - Description of the criteria used for the action
   * @returns {Promise<Object>} Created audit log object
   * Requirements: 10.5
   */
  static async logSystemAction(actionType, affectedCount, affectedIds, criteria) {
    // Get system user ID
    const User = require('../models/User');
    const systemUser = await User.findByEmail('system@internal');
    
    if (!systemUser) {
      throw new Error('System user not found. Please ensure system user is created in the database.');
    }

    const details = {
      action_type: actionType,
      affected_count: affectedCount,
      affected_ids: affectedIds || [],
      criteria: criteria
    };

    return await this.logAction(systemUser.id, actionType, details);
  }
}

module.exports = AuditService;
