/**
 * Authentication Service
 * Handles user authentication, registration, and JWT token generation
 * Requirements: 8.1, 8.5, 4.1
 */

const User = require('../models/User');
const { hashPassword, verifyPassword } = require('../utils/password');
const { generateToken } = require('../utils/jwt');

/**
 * Authenticate user with email and password
 * @param {string} email - User's email address
 * @param {string} password - User's plaintext password
 * @returns {Promise<Object>} Object containing JWT token and user info
 * @throws {Error} Generic error for invalid credentials (doesn't reveal which field was wrong)
 */
async function login(email, password) {
  // Find user by email
  const user = await User.findByEmail(email);
  
  // Return generic error if user not found (don't reveal email doesn't exist)
  if (!user) {
    throw new Error('Invalid credentials');
  }

  // Verify password hash
  const isPasswordValid = await verifyPassword(password, user.password_hash);
  
  // Return generic error if password is wrong (don't reveal which field was wrong)
  if (!isPasswordValid) {
    throw new Error('Invalid credentials');
  }

  // Generate JWT token with user ID and role
  const token = generateToken(user.id, user.role);

  // Return token and user info (excluding password hash)
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name
    }
  };
}

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @param {string} userData.email - Email address
 * @param {string} userData.password - Plaintext password (will be hashed)
 * @param {string} userData.role - User role (admin, staff, client)
 * @param {string} userData.full_name - Full name
 * @returns {Promise<Object>} Object containing JWT token and created user info
 * @throws {Error} If email already exists or validation fails
 */
async function register(userData) {
  const { email, password, role, full_name } = userData;

  // Check if user with email already exists
  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    throw new Error('Email already registered');
  }

  // Hash the password before storing
  const password_hash = await hashPassword(password);

  // Create user in database
  const newUser = await User.create({
    email,
    password_hash,
    role,
    full_name
  });

  // Generate JWT token for the new user
  const token = generateToken(newUser.id, newUser.role);

  // Return token and user info (excluding password hash)
  return {
    token,
    user: {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      full_name: newUser.full_name
    }
  };
}

module.exports = {
  login,
  register
};
