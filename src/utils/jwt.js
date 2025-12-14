/**
 * JWT Utilities Module
 * Provides JWT token generation and verification
 * Validates: Requirements 8.1
 */

const jwt = require('jsonwebtoken');
const loadAndValidateEnv = require('../config/env');

const config = loadAndValidateEnv();

/**
 * Generate a JWT token for a user
 * @param {string} userId - The user's UUID
 * @param {string} role - The user's role (admin, staff, client)
 * @returns {string} JWT token valid for 24 hours
 */
function generateToken(userId, role) {
  const payload = {
    userId,
    role
  };

  const options = {
    expiresIn: '24h'
  };

  return jwt.sign(payload, config.JWT_SECRET, options);
}

/**
 * Verify and decode a JWT token
 * @param {string} token - The JWT token to verify
 * @returns {object} Decoded token payload containing userId and role
 * @throws {TokenExpiredError} If token has expired
 * @throws {JsonWebTokenError} If token is invalid or tampered
 */
function verifyToken(token) {
  // jwt.verify will throw TokenExpiredError or JsonWebTokenError
  // We let these propagate so the caller can handle them appropriately
  return jwt.verify(token, config.JWT_SECRET);
}

module.exports = {
  generateToken,
  verifyToken
};
