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

/**
 * Middleware to prevent users from modifying their own role
 * Checks if the target user_id matches the authenticated user and if role is being changed
 */
function preventSelfRoleModification(req, res, next) {
  // Check if user is authenticated
  if (!req.user) {
    return res.status(401).json({
      error: 'AUTHENTICATION_ERROR',
      message: 'Authentication required'
    });
  }

  // Get target user_id from route params
  const targetUserId = req.params.id;
  
  // Check if user is trying to modify themselves
  const isSelfModification = targetUserId === req.user.id;
  
  // Check if the update includes a role field
  const isRoleChange = req.body && req.body.role !== undefined;
  
  // Reject if both conditions are true
  if (isSelfModification && isRoleChange) {
    return res.status(403).json({
      error: 'AUTHORIZATION_ERROR',
      message: 'Cannot modify your own role'
    });
  }

  next();
}

/**
 * Middleware to prevent non-admin users from creating admin accounts
 * Checks if actor is not admin but trying to create/assign admin role
 */
function preventNonAdminAdminCreation(req, res, next) {
  // Check if user is authenticated
  if (!req.user) {
    return res.status(401).json({
      error: 'AUTHENTICATION_ERROR',
      message: 'Authentication required'
    });
  }

  // Check if the target role is 'admin'
  const targetRole = req.body && req.body.role;
  const isTargetAdmin = targetRole === 'admin';
  
  // Check if actor is not admin
  const isActorNonAdmin = req.user.role !== 'admin';
  
  // Reject if non-admin trying to create admin
  if (isActorNonAdmin && isTargetAdmin) {
    return res.status(403).json({
      error: 'AUTHORIZATION_ERROR',
      message: 'Only administrators can create admin accounts'
    });
  }

  next();
}

module.exports = { 
  requireRole, 
  requireAnyRole,
  preventSelfRoleModification,
  preventNonAdminAdminCreation
};
