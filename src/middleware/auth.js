const { verifyToken } = require('../utils/jwt');

/**
 * Authentication middleware that verifies JWT tokens
 * Extracts token from Authorization header, verifies it, and attaches user to request
 */
async function authenticateJWT(req, res, next) {
  try {
    // Extract token from Authorization header (format: "Bearer <token>")
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        error: 'AUTHENTICATION_ERROR',
        message: 'Missing authorization header'
      });
    }

    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        error: 'AUTHENTICATION_ERROR',
        message: 'Invalid authorization header format'
      });
    }

    const token = parts[1];

    // Verify token
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        error: 'AUTHENTICATION_ERROR',
        message: 'Invalid or expired token'
      });
    }

    // Attach user information to request
    req.user = {
      id: decoded.userId,
      role: decoded.role
    };

    next();
  } catch (error) {
    return res.status(401).json({
      error: 'AUTHENTICATION_ERROR',
      message: 'Invalid or expired token'
    });
  }
}

module.exports = { authenticateJWT };
