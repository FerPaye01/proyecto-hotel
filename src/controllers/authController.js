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
 * Public registration endpoint - only allows client role
 * Admin and staff accounts must be created by administrators
 */
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, full_name } = req.body;

    // Validate request body
    if (!email || !password || !full_name) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Email, password, and full_name are required'
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

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Password must be at least 6 characters long',
        field: 'password'
      });
    }

    // Validate full_name length
    if (full_name.trim().length < 2) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Full name must be at least 2 characters long',
        field: 'full_name'
      });
    }

    // Force role to 'client' for public registration
    // Admin and staff accounts must be created by administrators
    const result = await authService.register({
      email,
      password,
      role: 'client',
      full_name
    });

    // Return token, user info, and redirect URL
    res.status(201).json({
      token: result.token,
      user: result.user,
      redirectUrl: '/client/booking.html'
    });
  } catch (error) {
    // Pass error to global error handler
    next(error);
  }
});

module.exports = router;
