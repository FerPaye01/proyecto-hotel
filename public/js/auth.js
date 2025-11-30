/**
 * Shared Authentication Module
 * Handles JWT token management and user authentication state
 */

/**
 * Get the JWT token from localStorage
 * @returns {string|null} The JWT token or null if not found
 */
function getToken() {
    return localStorage.getItem('token');
}

/**
 * Set the JWT token in localStorage
 * @param {string} token - The JWT token to store
 */
function setToken(token) {
    localStorage.setItem('token', token);
}

/**
 * Decode JWT token to extract payload
 * @param {string} token - The JWT token to decode
 * @returns {object|null} The decoded payload or null if invalid
 */
function decodeToken(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return null;
        }
        
        const payload = parts[1];
        const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        return JSON.parse(decoded);
    } catch (error) {
        console.error('Error decoding token:', error);
        return null;
    }
}

/**
 * Get the user role from the stored JWT token
 * @returns {string|null} The user role or null if not found
 */
function getUserRole() {
    const token = getToken();
    if (!token) {
        return null;
    }
    
    const payload = decodeToken(token);
    return payload ? payload.role : null;
}

/**
 * Get the user ID from the stored JWT token
 * @returns {string|null} The user ID or null if not found
 */
function getUserId() {
    const token = getToken();
    if (!token) {
        return null;
    }
    
    const payload = decodeToken(token);
    return payload ? payload.userId : null;
}

/**
 * Check if the user is authenticated
 * @returns {boolean} True if authenticated, false otherwise
 */
function isAuthenticated() {
    const token = getToken();
    if (!token) {
        return false;
    }
    
    const payload = decodeToken(token);
    if (!payload) {
        return false;
    }
    
    // Check if token is expired
    if (payload.exp && payload.exp * 1000 < Date.now()) {
        logout();
        return false;
    }
    
    return true;
}

/**
 * Logout the user by clearing the token and redirecting to login
 */
function logout() {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
}

/**
 * Require authentication - redirect to login if not authenticated
 * Call this function at the start of protected pages
 */
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = '/login.html';
    }
}

/**
 * Require specific role - redirect to login if user doesn't have the role
 * @param {string} requiredRole - The role required to access the page
 */
function requireRole(requiredRole) {
    requireAuth();
    
    const userRole = getUserRole();
    if (userRole !== requiredRole) {
        alert('No tienes permisos para acceder a esta página');
        logout();
    }
}

/**
 * Get authorization headers for API requests
 * @returns {object} Headers object with Authorization header
 */
function getAuthHeaders() {
    const token = getToken();
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getToken,
        setToken,
        getUserRole,
        getUserId,
        isAuthenticated,
        logout,
        requireAuth,
        requireRole,
        getAuthHeaders
    };
}
