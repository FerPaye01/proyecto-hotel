/**
 * Shared Socket.IO Client Module
 * Handles WebSocket connection with authentication and reconnection logic
 * 
 * Dependencies:
 * - Socket.IO client library (from CDN)
 * - auth.js module (must be loaded before this module)
 */

// Socket instance (will be initialized)
let socket = null;

// Reconnection configuration
const RECONNECTION_CONFIG = {
    initialDelay: 1000,      // 1 second
    maxDelay: 30000,         // 30 seconds
    multiplier: 1.5,         // Exponential backoff multiplier
    maxAttempts: 10          // Maximum reconnection attempts
};

let reconnectionAttempts = 0;
let reconnectionDelay = RECONNECTION_CONFIG.initialDelay;

/**
 * Initialize Socket.IO connection with JWT authentication
 * @param {function} onConnect - Callback function when connected
 * @param {function} onDisconnect - Callback function when disconnected
 * @returns {object} The socket instance
 */
function initializeSocket(onConnect, onDisconnect) {
    // Get token from auth module
    const token = getToken();
    
    if (!token) {
        console.error('No authentication token found');
        return null;
    }

    // Initialize Socket.IO with authentication
    socket = io({
        auth: {
            token: token
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: RECONNECTION_CONFIG.initialDelay,
        reconnectionDelayMax: RECONNECTION_CONFIG.maxDelay,
        reconnectionAttempts: RECONNECTION_CONFIG.maxAttempts
    });

    // Connection event handlers
    socket.on('connect', () => {
        console.log('✅ Connected to WebSocket server');
        reconnectionAttempts = 0;
        reconnectionDelay = RECONNECTION_CONFIG.initialDelay;
        
        if (onConnect) {
            onConnect(socket);
        }
    });

    socket.on('disconnect', (reason) => {
        console.log('❌ Disconnected from WebSocket server:', reason);
        
        if (onDisconnect) {
            onDisconnect(reason);
        }

        // Handle reconnection with exponential backoff
        if (reason === 'io server disconnect') {
            // Server disconnected the client, try to reconnect manually
            handleReconnection();
        }
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error.message);
        
        // If authentication fails, redirect to login
        if (error.message.includes('Authentication') || error.message.includes('Unauthorized')) {
            console.error('Authentication failed, redirecting to login');
            logout();
        }
    });

    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });

    return socket;
}

/**
 * Handle reconnection with exponential backoff
 */
function handleReconnection() {
    if (reconnectionAttempts >= RECONNECTION_CONFIG.maxAttempts) {
        console.error('Max reconnection attempts reached');
        return;
    }

    reconnectionAttempts++;
    
    console.log(`Attempting to reconnect (${reconnectionAttempts}/${RECONNECTION_CONFIG.maxAttempts}) in ${reconnectionDelay}ms...`);
    
    setTimeout(() => {
        if (socket && !socket.connected) {
            socket.connect();
        }
    }, reconnectionDelay);

    // Exponential backoff
    reconnectionDelay = Math.min(
        reconnectionDelay * RECONNECTION_CONFIG.multiplier,
        RECONNECTION_CONFIG.maxDelay
    );
}

/**
 * Get the current socket instance
 * @returns {object|null} The socket instance or null if not initialized
 */
function getSocket() {
    return socket;
}

/**
 * Disconnect the socket
 */
function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

/**
 * Check if socket is connected
 * @returns {boolean} True if connected, false otherwise
 */
function isConnected() {
    return socket && socket.connected;
}

/**
 * Emit an event to the server
 * @param {string} event - Event name
 * @param {*} data - Data to send
 * @param {function} callback - Optional callback function
 */
function emit(event, data, callback) {
    if (!socket) {
        console.error('Socket not initialized');
        return;
    }
    
    if (!socket.connected) {
        console.warn('Socket not connected, queuing event:', event);
    }
    
    if (callback) {
        socket.emit(event, data, callback);
    } else {
        socket.emit(event, data);
    }
}

/**
 * Listen for an event from the server
 * @param {string} event - Event name
 * @param {function} callback - Callback function
 */
function on(event, callback) {
    if (!socket) {
        console.error('Socket not initialized');
        return;
    }
    
    socket.on(event, callback);
}

/**
 * Remove event listener
 * @param {string} event - Event name
 * @param {function} callback - Optional specific callback to remove
 */
function off(event, callback) {
    if (!socket) {
        console.error('Socket not initialized');
        return;
    }
    
    if (callback) {
        socket.off(event, callback);
    } else {
        socket.off(event);
    }
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeSocket,
        getSocket,
        disconnectSocket,
        isConnected,
        emit,
        on,
        off
    };
}
