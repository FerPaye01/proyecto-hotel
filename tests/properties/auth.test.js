/**
 * Property-Based Tests for Authentication
 * **Feature: hotel-management-refactor, Property 17: Authentication token generation**
 * **Feature: hotel-management-refactor, Property 18: Credential error obscurity**
 * **Validates: Requirements 8.1, 8.5**
 */

const fc = require('fast-check');
const { login, register } = require('../../src/services/authService');
const { verifyToken } = require('../../src/utils/jwt');
const User = require('../../src/models/User');
const pool = require('../../src/config/database');

describe('Authentication Properties', () => {
  // Clean up test data after each test
  afterEach(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', ['test-%']);
  });

  // Close database pool after all tests
  afterAll(async () => {
    await pool.end();
  });

  // **Feature: hotel-management-refactor, Property 17: Authentication token generation**
  test('Property 17: For any valid credential submission, system must verify password and generate valid JWT with user id and role', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.string({ minLength: 5, maxLength: 50 }).map(s => `test-${s}@example.com`),
          password: fc.string({ minLength: 8, maxLength: 50 }),
          role: fc.constantFrom('admin', 'staff', 'client'),
          full_name: fc.string({ minLength: 3, maxLength: 50 })
        }),
        async (userData) => {
          // Register a user first
          const registrationResult = await register(userData);
          
          // Property 1: Registration must return a token
          expect(registrationResult.token).toBeDefined();
          expect(typeof registrationResult.token).toBe('string');
          
          // Property 2: Token must be a valid JWT that can be verified
          const decodedFromRegistration = verifyToken(registrationResult.token);
          expect(decodedFromRegistration).toBeDefined();
          expect(decodedFromRegistration.userId).toBe(registrationResult.user.id);
          expect(decodedFromRegistration.role).toBe(userData.role);
          
          // Property 3: User info must match registered data (excluding password)
          expect(registrationResult.user.email).toBe(userData.email);
          expect(registrationResult.user.role).toBe(userData.role);
          expect(registrationResult.user.full_name).toBe(userData.full_name);
          expect(registrationResult.user.password_hash).toBeUndefined();
          
          // Now test login with the same credentials
          const loginResult = await login(userData.email, userData.password);
          
          // Property 4: Login must return a token
          expect(loginResult.token).toBeDefined();
          expect(typeof loginResult.token).toBe('string');
          
          // Property 5: Token must contain user's id and role
          const decoded = verifyToken(loginResult.token);
          expect(decoded.userId).toBe(loginResult.user.id);
          expect(decoded.role).toBe(userData.role);
          
          // Property 6: Login returns same user data as registration
          expect(loginResult.user.id).toBe(registrationResult.user.id);
          expect(loginResult.user.email).toBe(registrationResult.user.email);
          expect(loginResult.user.role).toBe(registrationResult.user.role);
        }
      ),
      { numRuns: 5 }
    );
  }, 180000);

  // **Feature: hotel-management-refactor, Property 18: Credential error obscurity**
  test('Property 18: For any invalid credential submission, system must return generic error without revealing which field was incorrect', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.string({ minLength: 5, maxLength: 50 }).map(s => `test-${s}@example.com`),
          password: fc.string({ minLength: 8, maxLength: 50 }),
          role: fc.constantFrom('admin', 'staff', 'client'),
          full_name: fc.string({ minLength: 3, maxLength: 50 })
        }),
        async (userData) => {
          // Register a user first
          await register(userData);
          
          // Test 1: Invalid email (user doesn't exist)
          const invalidEmail = `nonexistent-${userData.email}`;
          let errorMessage1;
          try {
            await login(invalidEmail, userData.password);
            throw new Error('Should have thrown error');
          } catch (error) {
            errorMessage1 = error.message;
          }
          
          // Property 1: Error message must be generic
          expect(errorMessage1).toBe('Invalid credentials');
          
          // Test 2: Invalid password (wrong password)
          const wrongPassword = userData.password + 'wrong';
          let errorMessage2;
          try {
            await login(userData.email, wrongPassword);
            throw new Error('Should have thrown error');
          } catch (error) {
            errorMessage2 = error.message;
          }
          
          // Property 2: Error message must be the same generic message
          expect(errorMessage2).toBe('Invalid credentials');
          
          // Property 3: Both error messages must be identical (don't reveal which field was wrong)
          expect(errorMessage1).toBe(errorMessage2);
        }
      ),
      { numRuns: 5 }
    );
  }, 180000);
});
