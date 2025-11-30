/**
 * Authentication Controller
 * HTTP endpoints for user authentication and registration
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

const express = require('express');
const authService = require('../services/authService');
const { validateEmail } = require('../utils/validators');

const router = express.Router();

/**
 * POST /api/auth/login
 * Authenticate user with email and password
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate request body
    if (!email || !password) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Email and password are required'
      });
    }

    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: emailValidation.error,
        field: 'email'
      });
    }

    // Call auth service
    const result = await authService.login(email, password);

    // Determine role-specific redirect URL
    let redirectUrl;
    switch (result.user.role) {
      case 'admin':
        redirectUrl = '/admin/dashboard.html';
        break;
      case 'staff':
        redirectUrl = '/staff/operations.html';
        break;
      case 'client':
        redirectUrl = '/client/booking.html';
        break;
      default:
        redirectUrl = '/';
    }

    // Return token, user info, and redirect URL
    res.status(200).json({
      token: result.token,
      user: result.user,
      redirectUrl
    });
  } catch (error) {
    // Pass error to global error handler
    next(error);
  }
});

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, role, full_name } = req.body;

    // Validate request body
    if (!email || !password || !role || !full_name) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Email, password, role, and full_name are required'
      });
    }

    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: emailValidation.error,
        field: 'email'
      });
    }

    // Validate role
    const validRoles = ['admin', 'staff', 'client'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Role must be one of: admin, staff, client',
        field: 'role'
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Password must be at least 6 characters long',
        field: 'password'
      });
    }

    // Call auth service
    const result = await authService.register({
      email,
      password,
      role,
      full_name
    });

    // Determine role-specific redirect URL
    let redirectUrl;
    switch (result.user.role) {
      case 'admin':
        redirectUrl = '/admin/dashboard.html';
        break;
      case 'staff':
        redirectUrl = '/staff/operations.html';
        break;
      case 'client':
        redirectUrl = '/client/booking.html';
        break;
      default:
        redirectUrl = '/';
    }

    // Return token, user info, and redirect URL
    res.status(201).json({
      token: result.token,
      user: result.user,
      redirectUrl
    });
  } catch (error) {
    // Pass error to global error handler
    next(error);
  }
});

module.exports = router;
