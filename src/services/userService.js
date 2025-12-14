/**
 * User Service - Role-based user management
 * Handles user creation, updates, and profile management with authorization
 * Requirements: 1.2, 4.1, 5.4, 10.2, 12.1
 */

const User = require('../models/User');
const { hashPassword, verifyPassword } = require('../utils/password');
const AuditService = require('./auditService');

/**
 * Create a new user with role-based authorization
 * @param {string} actorId - UUID of the user performing the action
 * @param {string} actorRole - Role of the actor ('admin', 'staff', 'client')
 * @param {Object} userData - User data for the new user
 * @param {string} userData.email - Email address
 * @param {string} userData.password - Plaintext password (will be hashed)
 * @param {string} userData.role - Target user role ('admin', 'staff', 'client')
 * @param {string} userData.full_name - Full name
 * @returns {Promise<Object>} Object containing success status and created user info
 * @throws {Error} If authorization fails or validation fails
 * Requirements: 1.2, 4.1, 10.2
 */
async function createUser(actorId, actorRole, userData) {
  const { email, password, role, full_name } = userData;

  // Verify actor role is 'admin'
  if (actorRole !== 'admin') {
    const error = new Error('Insufficient permissions to create users');
    error.code = 'AUTHORIZATION_ERROR';
    error.statusCode = 403;
    throw error;
  }

  // Verify target role is not 'admin' unless actor is 'admin'
  // (This is redundant since we already checked actorRole === 'admin', but kept for clarity)
  if (role === 'admin' && actorRole !== 'admin') {
    const error = new Error('Only administrators can create admin users');
    error.code = 'AUTHORIZATION_ERROR';
    error.statusCode = 403;
    throw error;
  }

  // Validate required fields
  if (!email || !password || !role || !full_name) {
    const error = new Error('Missing required fields: email, password, role, full_name');
    error.code = 'VALIDATION_ERROR';
    error.statusCode = 400;
    throw error;
  }

  // Validate role value
  const validRoles = ['admin', 'staff', 'client'];
  if (!validRoles.includes(role)) {
    const error = new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    error.code = 'VALIDATION_ERROR';
    error.statusCode = 400;
    throw error;
  }

  // Check if user with email already exists
  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    const error = new Error('Email already registered');
    error.code = 'VALIDATION_ERROR';
    error.statusCode = 400;
    throw error;
  }

  // Hash password
  const password_hash = await hashPassword(password);

  // Insert user record
  const newUser = await User.create({
    email,
    password_hash,
    role,
    full_name
  });

  // Create audit log entry with user management details
  await AuditService.logAction(actorId, 'USER_CREATE', {
    target_user_id: newUser.id,
    action_type: 'create',
    changed_fields: ['email', 'role', 'full_name'],
    previous_values: null,
    new_values: {
      email: newUser.email,
      role: newUser.role,
      full_name: newUser.full_name
    }
  });

  // Return success with user info (excluding password hash)
  return {
    success: true,
    user: {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      full_name: newUser.full_name,
      created_at: newUser.created_at
    }
  };
}

/**
 * Update an existing user with role-based authorization
 * @param {string} actorId - UUID of the user performing the action
 * @param {string} actorRole - Role of the actor ('admin', 'staff', 'client')
 * @param {string} targetUserId - UUID of the user to update
 * @param {Object} updates - Fields to update
 * @param {string} [updates.email] - New email address
 * @param {string} [updates.password] - New plaintext password (will be hashed)
 * @param {string} [updates.role] - New role
 * @param {string} [updates.full_name] - New full name
 * @returns {Promise<Object>} Object containing success status and updated user info
 * @throws {Error} If authorization fails or validation fails
 * Requirements: 4.1, 10.2, 12.1
 */
async function updateUser(actorId, actorRole, targetUserId, updates) {
  // Verify actor role is 'admin'
  if (actorRole !== 'admin') {
    const error = new Error('Insufficient permissions to update users');
    error.code = 'AUTHORIZATION_ERROR';
    error.statusCode = 403;
    throw error;
  }

  // Prevent role modification if target is self
  if (actorId === targetUserId && updates.role !== undefined) {
    const error = new Error('Cannot modify your own role');
    error.code = 'AUTHORIZATION_ERROR';
    error.statusCode = 403;
    throw error;
  }

  // Get current user data for audit logging
  const currentUser = await User.findById(targetUserId);
  if (!currentUser) {
    const error = new Error('User not found');
    error.code = 'NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  // Validate role if being updated
  if (updates.role !== undefined) {
    const validRoles = ['admin', 'staff', 'client'];
    if (!validRoles.includes(updates.role)) {
      const error = new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
      error.code = 'VALIDATION_ERROR';
      error.statusCode = 400;
      throw error;
    }
  }

  // Hash password if being updated
  const updateData = { ...updates };
  if (updates.password) {
    updateData.password_hash = await hashPassword(updates.password);
    delete updateData.password;
  }

  // Track changed fields for audit log
  const changedFields = [];
  const previousValues = {};
  const newValues = {};

  for (const field of ['email', 'role', 'full_name']) {
    if (updateData[field] !== undefined && updateData[field] !== currentUser[field]) {
      changedFields.push(field);
      previousValues[field] = currentUser[field];
      newValues[field] = updateData[field];
    }
  }

  // Include password_hash in changed fields if password was updated
  if (updateData.password_hash) {
    changedFields.push('password');
    previousValues.password = '[REDACTED]';
    newValues.password = '[REDACTED]';
  }

  // Update user record with allowed fields
  const updatedUser = await User.update(targetUserId, updateData);

  // Create audit log entry with previous and new values
  if (changedFields.length > 0) {
    await AuditService.logAction(actorId, 'USER_UPDATE', {
      target_user_id: targetUserId,
      action_type: 'update',
      changed_fields: changedFields,
      previous_values: previousValues,
      new_values: newValues
    });
  }

  // Return success with updated user info (excluding password hash)
  return {
    success: true,
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      full_name: updatedUser.full_name,
      updated_at: updatedUser.updated_at
    }
  };
}

/**
 * Update own profile with restricted field access
 * @param {string} userId - UUID of the user updating their own profile
 * @param {Object} updates - Fields to update
 * @param {string} [updates.full_name] - New full name
 * @param {string} [updates.email] - New email address
 * @param {string} [updates.password] - New plaintext password (requires currentPassword)
 * @param {string} [currentPassword] - Current password for verification (required for password changes)
 * @returns {Promise<Object>} Object containing success status and updated user info
 * @throws {Error} If validation fails or unauthorized field modification attempted
 * Requirements: 5.4
 */
async function updateOwnProfile(userId, updates, currentPassword) {
  // Get current user data
  const currentUser = await User.findById(userId);
  if (!currentUser) {
    const error = new Error('User not found');
    error.code = 'NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  // Reject role modification attempts
  if (updates.role !== undefined) {
    const error = new Error('Cannot modify your own role');
    error.code = 'AUTHORIZATION_ERROR';
    error.statusCode = 403;
    throw error;
  }

  // Allow modification of full_name and email only
  const allowedFields = ['full_name', 'email', 'password'];
  const updateData = {};

  for (const field of Object.keys(updates)) {
    if (!allowedFields.includes(field)) {
      const error = new Error(`Field '${field}' cannot be modified through profile update`);
      error.code = 'AUTHORIZATION_ERROR';
      error.statusCode = 403;
      throw error;
    }
  }

  // Require current password verification for password changes
  if (updates.password) {
    if (!currentPassword) {
      const error = new Error('Current password is required to change password');
      error.code = 'VALIDATION_ERROR';
      error.statusCode = 400;
      throw error;
    }

    // Verify current password
    const isPasswordValid = await verifyPassword(currentPassword, currentUser.password_hash);
    if (!isPasswordValid) {
      const error = new Error('Current password is incorrect');
      error.code = 'AUTHENTICATION_ERROR';
      error.statusCode = 401;
      throw error;
    }

    // Hash new password
    updateData.password_hash = await hashPassword(updates.password);
  }

  // Add other allowed fields
  if (updates.full_name !== undefined) {
    updateData.full_name = updates.full_name;
  }
  if (updates.email !== undefined) {
    updateData.email = updates.email;
  }

  // Track changed fields for audit log
  const changedFields = [];
  const previousValues = {};
  const newValues = {};

  for (const field of ['email', 'full_name']) {
    if (updateData[field] !== undefined && updateData[field] !== currentUser[field]) {
      changedFields.push(field);
      previousValues[field] = currentUser[field];
      newValues[field] = updateData[field];
    }
  }

  if (updateData.password_hash) {
    changedFields.push('password');
    previousValues.password = '[REDACTED]';
    newValues.password = '[REDACTED]';
  }

  // Update user record
  const updatedUser = await User.update(userId, updateData);

  // Create audit log entry
  if (changedFields.length > 0) {
    await AuditService.logAction(userId, 'PROFILE_UPDATE', {
      target_user_id: userId,
      action_type: 'profile_update',
      changed_fields: changedFields,
      previous_values: previousValues,
      new_values: newValues
    });
  }

  // Return success with updated user info (excluding password hash)
  return {
    success: true,
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      full_name: updatedUser.full_name,
      updated_at: updatedUser.updated_at
    }
  };
}

module.exports = {
  createUser,
  updateUser,
  updateOwnProfile
};
