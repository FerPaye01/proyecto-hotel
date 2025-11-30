/**
 * Role-Based Access Control (RBAC) middleware factory
 * Creates middleware that checks if authenticated user has required role
 */
function requireRole(requiredRole) {
  return (req, res, next) => {
    // Check if user is authenticated (should be set by authenticateJWT middleware)
    if (!req.user) {
      return res.status(401).json({
        error: 'AUTHENTICATION_ERROR',
        message: 'Authentication required'
      });
    }

    // Check if user has required role
    if (req.user.role !== requiredRole) {
      return res.status(403).json({
        error: 'AUTHORIZATION_ERROR',
        message: 'Insufficient permissions'
      });
    }

    next();
  };
}

/**
 * Middleware that allows multiple roles
 */
function requireAnyRole(...allowedRoles) {
  return (req, res, next) => {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        error: 'AUTHENTICATION_ERROR',
        message: 'Authentication required'
      });
    }

    // Check if user has any of the allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'AUTHORIZATION_ERROR',
        message: 'Insufficient permissions'
      });
    }

    next();
  };
}

module.exports = { requireRole, requireAnyRole };
