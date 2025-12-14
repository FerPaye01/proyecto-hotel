/**
 * Admin Controller
 * HTTP endpoints for administrative operations
 * Requirements: 4.1, 4.3, 4.4
 */

const express = require('express');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Booking = require('../models/Booking');
const { authenticateJWT } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { hashPassword } = require('../utils/password');
const { validateEmail } = require('../utils/validators');

const router = express.Router();

/**
 * GET /api/admin/audit-logs
 * Get audit logs with optional filtering (admin only)
 */
router.get('/audit-logs', authenticateJWT, requireRole('admin'), async (req, res, next) => {
  try {
    const { limit = 100, offset = 0, startDate, endDate } = req.query;

    // Parse pagination parameters
    const parsedLimit = parseInt(limit);
    const parsedOffset = parseInt(offset);

    if (isNaN(parsedLimit) || isNaN(parsedOffset)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid pagination parameters'
      });
    }

    // Get audit logs with optional date filtering
    const logs = await AuditLog.findAll({
      limit: parsedLimit,
      offset: parsedOffset,
      startDate,
      endDate
    });

    // Get total count for pagination
    const total = await AuditLog.count();

    res.status(200).json({
      logs,
      pagination: {
        total,
        limit: parsedLimit,
        offset: parsedOffset,
        hasMore: parsedOffset + parsedLimit < total
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/reports/financial
 * Get financial reports with revenue and occupancy metrics (admin only)
 * Requirements: 1.4
 */
router.get('/reports/financial', authenticateJWT, requireRole('admin'), async (req, res, next) => {
  try {
    const pool = require('../config/database');

    // Get total rooms count
    const totalRoomsQuery = 'SELECT COUNT(*) as total FROM rooms';
    const totalRoomsResult = await pool.query(totalRoomsQuery);
    const totalRooms = parseInt(totalRoomsResult.rows[0].total);

    // Get rooms by status
    const roomsByStatusQuery = `
      SELECT status, COUNT(*) as count
      FROM rooms
      GROUP BY status
    `;
    const roomsByStatusResult = await pool.query(roomsByStatusQuery);
    const roomsByStatus = {};
    roomsByStatusResult.rows.forEach(row => {
      roomsByStatus[row.status] = parseInt(row.count);
    });

    // Calculate occupancy rate
    const occupiedCount = roomsByStatus['OCCUPIED'] || 0;
    const occupancyRate = totalRooms > 0 ? (occupiedCount / totalRooms) * 100 : 0;

    // Get total bookings count
    const totalBookingsQuery = 'SELECT COUNT(*) as total FROM bookings';
    const totalBookingsResult = await pool.query(totalBookingsQuery);
    const totalBookings = parseInt(totalBookingsResult.rows[0].total);

    // Get bookings by status
    const bookingsByStatusQuery = `
      SELECT status, COUNT(*) as count
      FROM bookings
      GROUP BY status
    `;
    const bookingsByStatusResult = await pool.query(bookingsByStatusQuery);
    const bookingsByStatus = {};
    bookingsByStatusResult.rows.forEach(row => {
      bookingsByStatus[row.status] = parseInt(row.count);
    });

    // Get total revenue (sum of all booking costs)
    const revenueQuery = `
      SELECT SUM(total_cost) as total_revenue
      FROM bookings
      WHERE status IN ('CHECKED_OUT', 'CHECKED_IN')
    `;
    const revenueResult = await pool.query(revenueQuery);
    const totalRevenue = parseFloat(revenueResult.rows[0].total_revenue || 0);

    // Get revenue by month (last 12 months)
    const monthlyRevenueQuery = `
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        SUM(total_cost) as revenue,
        COUNT(*) as booking_count
      FROM bookings
      WHERE status IN ('CHECKED_OUT', 'CHECKED_IN')
        AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC
    `;
    const monthlyRevenueResult = await pool.query(monthlyRevenueQuery);

    // Get transaction history summary
    const transactionQuery = `
      SELECT 
        COUNT(*) as total_transactions,
        SUM(total_cost) as total_amount
      FROM bookings
      WHERE status IN ('CHECKED_OUT', 'CHECKED_IN', 'CONFIRMED')
    `;
    const transactionResult = await pool.query(transactionQuery);
    const transactionData = transactionResult.rows[0];

    res.status(200).json({
      revenue: {
        totalRevenue: totalRevenue.toFixed(2),
        monthlyRevenue: monthlyRevenueResult.rows.map(row => ({
          month: row.month,
          revenue: parseFloat(row.revenue || 0).toFixed(2),
          bookingCount: parseInt(row.booking_count)
        }))
      },
      occupancy: {
        totalRooms,
        occupiedRooms: occupiedCount,
        occupancyRate: parseFloat(occupancyRate.toFixed(2)),
        roomsByStatus
      },
      bookings: {
        totalBookings,
        bookingsByStatus
      },
      transactions: {
        totalTransactions: parseInt(transactionData.total_transactions || 0),
        totalAmount: parseFloat(transactionData.total_amount || 0).toFixed(2)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/users
 * Get all users with role information (admin only)
 * Requirements: 4.1
 */
router.get('/users', authenticateJWT, requireRole('admin'), async (req, res, next) => {
  try {
    // Get all users from database
    const users = await User.findAll();

    // Return users (password_hash is already excluded in User.findAll())
    res.status(200).json({
      users,
      total: users.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/users
 * Create a new user (admin only)
 */
router.post('/users', authenticateJWT, requireRole('admin'), async (req, res, next) => {
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

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'CONFLICT_ERROR',
        message: 'Email already registered'
      });
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Create user
    const newUser = await User.create({
      email,
      password_hash,
      role,
      full_name
    });

    // Return user info (excluding password hash)
    res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        full_name: newUser.full_name,
        created_at: newUser.created_at
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
