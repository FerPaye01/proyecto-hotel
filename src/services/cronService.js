/**
 * Cron Service - Automated maintenance tasks
 * Handles scheduled cleanup jobs for expired bookings and sessions
 * Requirements: 7.2, 7.3, 7.4, 7.5, 8.2, 8.5
 */

const pool = require('../config/database');
const AuditService = require('./auditService');

class CronService {
  /**
   * Expire bookings that have been in CONFIRMED status for more than 24 hours
   * @returns {Promise<Object>} Object containing count of affected bookings and their IDs
   * Requirements: 7.2, 8.2
   */
  static async expireBookings() {
    const client = await pool.connect();
    
    try {
      // Query bookings in 'CONFIRMED' status older than 24 hours
      const query = `
        UPDATE bookings
        SET status = 'CANCELLED'
        WHERE status = 'CONFIRMED'
          AND created_at < NOW() - INTERVAL '24 hours'
        RETURNING id
      `;
      
      const result = await client.query(query);
      const affectedIds = result.rows.map(row => row.id);
      const affectedCount = result.rowCount;

      // Create audit log entries with system actor_id
      if (affectedCount > 0) {
        await AuditService.logSystemAction(
          'EXPIRE_BOOKINGS',
          affectedCount,
          affectedIds,
          'bookings older than 24 hours in CONFIRMED status'
        );
      }

      return {
        count: affectedCount,
        ids: affectedIds
      };
    } catch (error) {
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Run the cleanup job - expires bookings and handles errors gracefully
   * @returns {Promise<Object>} Object containing results of cleanup operations
   * Requirements: 7.3, 7.5
   */
  static async runCleanupJob() {
    const results = {
      success: true,
      expiredBookings: { count: 0, ids: [] },
      errors: []
    };

    try {
      // Call expireBookings
      const bookingResults = await this.expireBookings();
      results.expiredBookings = bookingResults;

      // Log results with system actor attribution
      console.log(`[CronService] Cleanup job completed successfully. Expired ${bookingResults.count} booking(s).`);
      
      if (bookingResults.count > 0) {
        console.log(`[CronService] Affected booking IDs: ${bookingResults.ids.join(', ')}`);
      }
    } catch (error) {
      // Handle errors gracefully without halting
      results.success = false;
      results.errors.push({
        operation: 'expireBookings',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      console.error(`[CronService] Error during cleanup job:`, error);
    }

    return results;
  }

  /**
   * Start the cleanup job scheduler
   * Uses setInterval to run cleanup every 1 hour
   * Requirements: 7.4
   */
  static startCleanupJob() {
    // Run cleanup every 1 hour (3600000 milliseconds)
    const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

    console.log('[CronService] Starting cleanup job scheduler (runs every 1 hour)');

    // Run immediately on startup
    this.runCleanupJob().catch(error => {
      console.error('[CronService] Error during initial cleanup job:', error);
    });

    // Schedule recurring cleanup
    const intervalId = setInterval(async () => {
      try {
        await this.runCleanupJob();
      } catch (error) {
        console.error('[CronService] Error during scheduled cleanup job:', error);
      }
    }, CLEANUP_INTERVAL);

    // Return interval ID for potential cleanup/testing
    return intervalId;
  }
}

module.exports = CronService;
