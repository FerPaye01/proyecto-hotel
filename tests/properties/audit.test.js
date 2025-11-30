/**
 * Property-Based Tests for Audit Trail Completeness
 * **Feature: hotel-management-refactor, Property 5: Audit trail completeness**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 */

const fc = require('fast-check');

// Load environment variables from .env file
require('dotenv').config();

// Set up test environment variables if not already set
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-secret-key-min-32-chars-long-for-testing';
}
if (!process.env.PORT) {
  process.env.PORT = '3000';
}

// Ensure DATABASE_URL is set (should come from .env file)
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required for tests. Please set it in your .env file.');
}

const AuditService = require('../../src/services/auditService');
const AuditLog = require('../../src/models/AuditLog');
const pool = require('../../src/config/database');

describe('Property 5: Audit trail completeness', () => {
  // Clean up audit logs and test users before and after tests
  beforeEach(async () => {
    await pool.query('DELETE FROM audit_logs');
    await pool.query(`DELETE FROM users WHERE email LIKE 'test-%@example.com'`);
  });

  afterEach(async () => {
    await pool.query('DELETE FROM audit_logs');
    await pool.query(`DELETE FROM users WHERE email LIKE 'test-%@example.com'`);
  });

  afterAll(async () => {
    await pool.end();
  });

  // **Feature: hotel-management-refactor, Property 5: Audit trail completeness**
  test('Property 5: For any critical operation, system must create audit log with actor_id, action, JSONB details, and timestamp', async () => {
    // Create a test user to use as actor
    const testUser = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-audit@example.com', 'hash123', 'admin', 'Test User']
    );
    const testActorId = testUser.rows[0].id;

    await fc.assert(
      fc.asyncProperty(
        // Generate random critical operations
        fc.record({
          action: fc.constantFrom(
            'CHECK_IN',
            'CHECK_OUT',
            'CREATE_BOOKING',
            'CREATE_ROOM',
            'UPDATE_ROOM',
            'MODIFY_ROOM'
          ),
          details: fc.record({
            previous_value: fc.oneof(
              fc.constant(null),
              fc.record({
                status: fc.constantFrom('AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'),
                room_number: fc.string({ minLength: 1, maxLength: 10 })
              })
            ),
            new_value: fc.record({
              status: fc.constantFrom('AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'),
              room_number: fc.string({ minLength: 1, maxLength: 10 })
            }),
            affected_entity_id: fc.uuid()
          })
        }),
        async ({ action, details }) => {
          // Execute: Log the action using audit service with the test user
          const auditLog = await AuditService.logAction(testActorId, action, details);

          // Property 1: Audit log must be created and returned
          expect(auditLog).toBeDefined();
          expect(auditLog.id).toBeDefined();

          // Property 2: Audit log must contain actor_id
          expect(auditLog.actor_id).toBe(testActorId);

          // Property 3: Audit log must contain action type
          expect(auditLog.action).toBe(action);

          // Property 4: Audit log must contain JSONB details with previous_value and new_value
          expect(auditLog.details).toBeDefined();
          const parsedDetails = typeof auditLog.details === 'string' 
            ? JSON.parse(auditLog.details) 
            : auditLog.details;
          
          expect(parsedDetails).toHaveProperty('previous_value');
          expect(parsedDetails).toHaveProperty('new_value');
          expect(parsedDetails).toHaveProperty('affected_entity_id');

          // Property 5: Audit log must contain timestamp
          expect(auditLog.timestamp).toBeDefined();
          expect(new Date(auditLog.timestamp)).toBeInstanceOf(Date);

          // Property 6: Audit log must be retrievable from database
          const retrievedLogs = await AuditLog.findByActorId(testActorId);
          expect(retrievedLogs.length).toBeGreaterThan(0);
          
          const matchingLog = retrievedLogs.find(log => log.id === auditLog.id);
          expect(matchingLog).toBeDefined();
          expect(matchingLog.action).toBe(action);
        }
      ),
      { numRuns: 100 }
    );

    // Clean up test user
    await pool.query('DELETE FROM users WHERE id = $1', [testActorId]);
  }, 60000);

  test('Property 5 (validation): Audit service must reject operations without required fields', async () => {
    // Create a test user to use as actor
    const testUser = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-validation@example.com', 'hash123', 'admin', 'Test User']
    );
    const testActorId = testUser.rows[0].id;

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          hasActorId: fc.boolean(),
          hasAction: fc.boolean(),
          hasDetails: fc.boolean(),
          action: fc.constantFrom('CHECK_IN', 'CHECK_OUT', 'CREATE_BOOKING'),
          details: fc.record({
            previous_value: fc.constant(null),
            new_value: fc.record({ status: fc.string() }),
            affected_entity_id: fc.uuid()
          })
        }),
        async ({ hasActorId, hasAction, hasDetails, action, details }) => {
          // Property: If any required field is missing, service must throw error
          const allFieldsPresent = hasActorId && hasAction && hasDetails;

          if (allFieldsPresent) {
            // Should succeed
            const auditLog = await AuditService.logAction(testActorId, action, details);
            expect(auditLog).toBeDefined();
          } else {
            // Should throw error
            await expect(
              AuditService.logAction(
                hasActorId ? testActorId : null,
                hasAction ? action : null,
                hasDetails ? details : null
              )
            ).rejects.toThrow();
          }
        }
      ),
      { numRuns: 100 }
    );

    // Clean up test user
    await pool.query('DELETE FROM users WHERE id = $1', [testActorId]);
  }, 60000);

  test('Property 5 (immutability): Audit logs must be immutable (no update or delete)', async () => {
    // Create a test user to use as actor
    const testUser = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-immutable@example.com', 'hash123', 'admin', 'Test User']
    );
    const testActorId = testUser.rows[0].id;

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          action: fc.constantFrom('CHECK_IN', 'CHECK_OUT', 'CREATE_BOOKING'),
          details: fc.record({
            previous_value: fc.constant(null),
            new_value: fc.record({ status: fc.string() }),
            affected_entity_id: fc.uuid()
          })
        }),
        async ({ action, details }) => {
          // Create an audit log
          const auditLog = await AuditService.logAction(testActorId, action, details);
          
          // Property: AuditLog model should not have update or delete methods
          expect(AuditLog.update).toBeUndefined();
          expect(AuditLog.delete).toBeUndefined();
          
          // Verify the log persists and cannot be modified
          const retrievedLogs = await AuditLog.findByActorId(testActorId);
          const matchingLog = retrievedLogs.find(log => log.id === auditLog.id);
          
          expect(matchingLog).toBeDefined();
          expect(matchingLog.action).toBe(action);
        }
      ),
      { numRuns: 100 }
    );

    // Clean up test user
    await pool.query('DELETE FROM users WHERE id = $1', [testActorId]);
  }, 60000);

  test('Property 5 (query by action): Audit logs must be queryable by action type', async () => {
    // Create a test user to use as actor
    const testUser = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['test-query@example.com', 'hash123', 'admin', 'Test User']
    );
    const testActorId = testUser.rows[0].id;

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            action: fc.constantFrom('CHECK_IN', 'CHECK_OUT', 'CREATE_BOOKING', 'CREATE_ROOM'),
            details: fc.record({
              previous_value: fc.constant(null),
              new_value: fc.record({ status: fc.string() }),
              affected_entity_id: fc.uuid()
            })
          }),
          { minLength: 1, maxLength: 5 }
        ),
        fc.constantFrom('CHECK_IN', 'CHECK_OUT', 'CREATE_BOOKING', 'CREATE_ROOM'),
        async (operations, queryAction) => {
          // Clean up before this iteration
          await pool.query('DELETE FROM audit_logs');

          // Create multiple audit logs
          for (const op of operations) {
            await AuditService.logAction(testActorId, op.action, op.details);
          }

          // Query by specific action type
          const logs = await AuditService.getLogsByAction(queryAction);

          // Property: All returned logs must have the queried action type
          for (const log of logs) {
            expect(log.action).toBe(queryAction);
          }

          // Property: Count should match the number of operations with that action
          const expectedCount = operations.filter(op => op.action === queryAction).length;
          expect(logs.length).toBe(expectedCount);
        }
      ),
      { numRuns: 20 }
    );

    // Clean up test user
    await pool.query('DELETE FROM users WHERE id = $1', [testActorId]);
  }, 120000);
});
