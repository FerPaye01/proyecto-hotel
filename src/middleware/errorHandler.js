/**
 * Global error handler middleware
 * Categorizes errors and returns consistent error responses
 */
function errorHandler(err, req, res, next) {
  // Log full error details server-side
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Determine error type and response
  let statusCode = 500;
  let errorResponse = {
    error: 'SERVER_ERROR',
    message: 'Internal server error'
  };

  // Validation errors
  if (err.name === 'ValidationError' || err.type === 'validation') {
    statusCode = 400;
    errorResponse = {
      error: 'VALIDATION_ERROR',
      message: err.message || 'Invalid input data',
      ...(err.field && { field: err.field })
    };
  }
  // Authentication errors
  else if (err.name === 'AuthenticationError' || err.type === 'authentication') {
    statusCode = 401;
    errorResponse = {
      error: 'AUTHENTICATION_ERROR',
      message: err.message || 'Invalid credentials'
    };
  }
  // Authorization errors
  else if (err.name === 'AuthorizationError' || err.type === 'authorization') {
    statusCode = 403;
    errorResponse = {
      error: 'AUTHORIZATION_ERROR',
      message: err.message || 'Insufficient permissions'
    };
  }
  // Conflict errors (e.g., booking conflicts, duplicate entries)
  else if (err.name === 'ConflictError' || err.type === 'conflict' || err.code === '23505') {
    statusCode = 409;
    errorResponse = {
      error: 'CONFLICT_ERROR',
      message: err.message || 'Resource conflict',
      ...(err.details && { details: err.details })
    };
  }
  // Database errors
  else if (err.code && err.code.startsWith('23')) {
    // PostgreSQL constraint violations
    statusCode = 400;
    errorResponse = {
      error: 'VALIDATION_ERROR',
      message: 'Database constraint violation',
      details: err.detail || err.message
    };
  }
  // JWT errors
  else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorResponse = {
      error: 'AUTHENTICATION_ERROR',
      message: 'Invalid or expired token'
    };
  }
  // Server errors (default)
  else {
    statusCode = err.statusCode || 500;
    errorResponse = {
      error: 'SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message
    };
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * Custom error classes for better error handling
 */
class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.type = 'validation';
    this.field = field;
  }
}

class AuthenticationError extends Error {
  constructor(message = 'Invalid credentials') {
    super(message);
    this.name = 'AuthenticationError';
    this.type = 'authentication';
  }
}

class AuthorizationError extends Error {
  constructor(message = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
    this.type = 'authorization';
  }
}

class ConflictError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ConflictError';
    this.type = 'conflict';
    this.details = details;
  }
}

module.exports = {
  errorHandler,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ConflictError
};
