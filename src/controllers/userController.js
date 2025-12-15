/**
 * User Controller
 * HTTP endpoints for user management (admin-only) and profile updates
 * Requirements: 1.2, 4.1, 5.4
 */

const express = require('express');
const userService = require('../services/userService');
const User = require('../models/User');
const { authenticateJWT } = require('../middleware/auth');
const { requireRole, preventSelfRoleModification, preventNonAdminAdminCreation } = require('../middleware/rbac');

const router = express.Router();

/**
 * POST /api/users
 * Create a new user (admin only)
 * Requirements: 1.2, 4.1
 */
router.post('/', 
  authenticateJWT, 
  requireRole('admin'),
  preventNonAdminAdminCreation,
  async (req, res, next) => {
    try {
      const { email, password, role, full_name } = req.body;

      // Call userService.createUser
      const result = await userService.createUser(
        req.user.id,
        req.user.role,
        { email, password, role, full_name }
      );

      // Return created user (excluding password_hash)
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/users/profile
 * Update own profile (authenticated users)
 * Requirements: 5.4
 * NOTE: This route must come BEFORE /:id to avoid route conflicts
 */
router.put('/profile',
  authenticateJWT,
  async (req, res, next) => {
    try {
      const { full_name, email, password, currentPassword } = req.body;
      
      const updates = {};
      if (full_name !== undefined) updates.full_name = full_name;
      if (email !== undefined) updates.email = email;
      if (password !== undefined) updates.password = password;

      // Call userService.updateOwnProfile
      const result = await userService.updateOwnProfile(
        req.user.id,
        updates,
        currentPassword
      );

      // Return updated profile
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/users/:id
 * Update an existing user (admin only)
 * Requirements: 4.1
 */
router.put('/:id',
  authenticateJWT,
  requireRole('admin'),
  preventSelfRoleModification,
  async (req, res, next) => {
    try {
      const targetUserId = req.params.id;
      const updates = req.body;

      // Call userService.updateUser
      const result = await userService.updateUser(
        req.user.id,
        req.user.role,
        targetUserId,
        updates
      );

      // Return updated user
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/users
 * Get list of all users (admin only)
 * Requirements: 4.1
 */
router.get('/',
  authenticateJWT,
  requireRole('admin'),
  async (req, res, next) => {
    try {
      // Return list of all users (excluding password_hash)
      const users = await User.findAll();
      
      res.status(200).json({
        success: true,
        users
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
