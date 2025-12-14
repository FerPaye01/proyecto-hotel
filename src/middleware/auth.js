const { verifyToken } = require('../utils/jwt');

/**
 * Authentication middleware that verifies JWT tokens
 * Extracts token from Authorization header, verifies it, and attaches user to request
 * Validates: Requirements 7.1, 9.1
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

    // Verify token (includes expiration validation - tokens expire after 24 hours)
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        error: 'AUTHENTICATION_ERROR',
        message: 'Invalid or expired token'
      });
    }

    // Verify expiration timestamp is not older than 24 hours
    // This is already handled by jwt.verify() but we add explicit validation
    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < currentTime) {
      return res.status(401).json({
        error: 'AUTHENTICATION_ERROR',
        message: 'Token has expired'
      });
    }

    // Attach user information to request
    req.user = {
      id: decoded.userId,
      role: decoded.role
    };

    next();
  } catch (error) {
    // Handle JWT-specific errors
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'AUTHENTICATION_ERROR',
        message: 'Token has expired'
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'AUTHENTICATION_ERROR',
        message: 'Invalid token'
      });
    }
    return res.status(401).json({
      error: 'AUTHENTICATION_ERROR',
      message: 'Invalid or expired token'
    });
  }
}

/**
 * WebSocket authentication middleware
 * Extracts and verifies JWT from socket handshake, attaches user to socket
 * Validates: Requirements 9.2
 * @param {Socket} socket - Socket.IO socket instance
 * @returns {Promise<boolean>} True if authenticated, false otherwise
 */
async function authenticateSocket(socket) {
  try {
    // Extract token from socket handshake auth or query parameters
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    
    if (!token) {
      socket.emit('error', {
        error: 'AUTHENTICATION_ERROR',
        message: 'Missing authentication token'
      });
      socket.disconnect(true);
      return false;
    }

    // Verify token (includes expiration validation)
    const decoded = verifyToken(token);
    
    if (!decoded) {
      socket.emit('error', {
        error: 'AUTHENTICATION_ERROR',
        message: 'Invalid or expired token'
      });
      socket.disconnect(true);
      return false;
    }

    // Verify expiration timestamp
    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < currentTime) {
      socket.emit('error', {
        error: 'AUTHENTICATION_ERROR',
        message: 'Token has expired'
      });
      socket.disconnect(true);
      return false;
    }

    // Attach user information to socket instance
    socket.user = {
      id: decoded.userId,
      role: decoded.role
    };

    return true;
  } catch (error) {
    // Handle JWT-specific errors
    let message = 'Invalid or expired token';
    if (error.name === 'TokenExpiredError') {
      message = 'Token has expired';
    } else if (error.name === 'JsonWebTokenError') {
      message = 'Invalid token';
    }
    
    socket.emit('error', {
      error: 'AUTHENTICATION_ERROR',
      message
    });
    socket.disconnect(true);
    return false;
  }
}

module.exports = { authenticateJWT, authenticateSocket };
