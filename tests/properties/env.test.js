/**
 * Property-Based Tests for Environment Configuration
 * **Feature: hotel-management-refactor, Property 19: Configuration validation on startup**
 * **Validates: Requirements 11.5**
 */

const fc = require('fast-check');

describe('Environment Configuration Properties', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    // Clear the require cache to reload the module with new env vars
    delete require.cache[require.resolve('../../src/config/env.js')];
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    // Clear the require cache again
    delete require.cache[require.resolve('../../src/config/env.js')];
  });

  // **Feature: hotel-management-refactor, Property 19: Configuration validation on startup**
  test('Property 19: For any missing required environment variable, the system must throw an error and refuse to start', () => {
    fc.assert(
      fc.property(
        fc.record({
          hasDatabaseUrl: fc.boolean(),
          hasJwtSecret: fc.boolean()
        }),
        ({ hasDatabaseUrl, hasJwtSecret }) => {
          // Setup environment based on property inputs
          if (hasDatabaseUrl) {
            process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
          } else {
            delete process.env.DATABASE_URL;
          }

          if (hasJwtSecret) {
            process.env.JWT_SECRET = 'test-secret-key-min-32-chars-long';
          } else {
            delete process.env.JWT_SECRET;
          }

          const loadAndValidateEnv = require('../../src/config/env.js');

          // Property: If any required variable is missing, system must throw error
          const allRequiredPresent = hasDatabaseUrl && hasJwtSecret;

          if (allRequiredPresent) {
            // Should succeed without throwing
            expect(() => loadAndValidateEnv()).not.toThrow();
          } else {
            // Should throw error and refuse to start
            expect(() => loadAndValidateEnv()).toThrow();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 19 (extended): Configuration must provide default for PORT when not specified', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(undefined),
          fc.integer({ min: 1, max: 65535 }).map(String)
        ),
        (portValue) => {
          // Set required variables
          process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
          process.env.JWT_SECRET = 'test-secret-key-min-32-chars-long';

          if (portValue === undefined) {
            delete process.env.PORT;
          } else {
            process.env.PORT = portValue;
          }

          const loadAndValidateEnv = require('../../src/config/env.js');
          const config = loadAndValidateEnv();

          // Property: PORT must always have a value (default 3000 if not specified)
          expect(config.PORT).toBeDefined();
          
          if (portValue === undefined) {
            expect(config.PORT).toBe(3000);
          } else {
            expect(config.PORT).toBe(portValue);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
