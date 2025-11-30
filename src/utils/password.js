/**
 * Password Hashing Utilities Module
 * Provides secure password hashing and verification using bcrypt
 * Validates: Requirements 4.1
 */

const bcrypt = require('bcrypt');

// Default to 10 salt rounds as per requirements
const SALT_ROUNDS = 10;

/**
 * Hash a plaintext password using bcrypt
 * @param {string} plaintext - The plaintext password to hash
 * @returns {Promise<string>} The hashed password
 */
async function hashPassword(plaintext) {
  return await bcrypt.hash(plaintext, SALT_ROUNDS);
}

/**
 * Verify a plaintext password against a hash
 * @param {string} plaintext - The plaintext password to verify
 * @param {string} hash - The hashed password to compare against
 * @returns {Promise<boolean>} True if password matches, false otherwise
 */
async function verifyPassword(plaintext, hash) {
  return await bcrypt.compare(plaintext, hash);
}

module.exports = {
  hashPassword,
  verifyPassword
};
