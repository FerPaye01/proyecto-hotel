/**
 * Property-Based Tests for Password Hashing
 * **Feature: hotel-management-refactor, Property 6: Password hashing security**
 * **Validates: Requirements 4.1**
 */

const fc = require('fast-check');
const { hashPassword, verifyPassword } = require('../../src/utils/password');

describe('Password Hashing Properties', () => {
  // **Feature: hotel-management-refactor, Property 6: Password hashing security**
  test('Property 6: For any user creation, password must be stored as bcrypt hash and be verifiable', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (plaintext) => {
          // Hash the password
          const hash = await hashPassword(plaintext);

          // Property 1: Hash must not equal plaintext (not stored in plaintext)
          expect(hash).not.toBe(plaintext);

          // Property 2: Hash must be a bcrypt hash (starts with $2b$ or $2a$)
          expect(hash).toMatch(/^\$2[ab]\$/);

          // Property 3: Hash must be verifiable against original password
          const isValid = await verifyPassword(plaintext, hash);
          expect(isValid).toBe(true);

          // Property 4: Hash must reject incorrect passwords
          if (plaintext.length > 0) {
            const wrongPassword = plaintext + 'wrong';
            const isInvalid = await verifyPassword(wrongPassword, hash);
            expect(isInvalid).toBe(false);
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  test('Property 6 (idempotence): Hashing the same password twice produces different hashes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (plaintext) => {
          // Hash the same password twice
          const hash1 = await hashPassword(plaintext);
          const hash2 = await hashPassword(plaintext);

          // Property: Hashes should be different (due to random salt)
          expect(hash1).not.toBe(hash2);

          // But both should verify against the original password
          expect(await verifyPassword(plaintext, hash1)).toBe(true);
          expect(await verifyPassword(plaintext, hash2)).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);
});
