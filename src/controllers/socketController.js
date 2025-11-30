/**
 * Socket Controller
 * Manages WebSocket connections and real-time event handling
 * Requirements: 2.1, 2.2, 2.5
 */

const { verifyToken } = require('../utils/jwt');
const Room = require('../models/Room');

/**
 * Initialize Socket.IO with authentication and event handlers
 * @param {Server} io - Socket.IO server instance
 */
function initializeSocketController(io) {
  // Middleware for socket authentication
  io.use(async (socket, next) => {
    try {
      // Extract token from handshake auth or query
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const decoded = verifyToken(token);
      
      // Attach user info to socket
      socket.user = {
        userId: decoded.userId,
        role: decoded.role
      };

      next();
    } catch (error) {
      next(new Error('Authentication failed: ' + error.message));
    }
  });

  // Handle new connections
  io.on('connection', async (socket) => {
    console.log(`Client connected: ${socket.id} (User: ${socket.user.userId}, Role: ${socket.user.role})`);

    try {
      // Send initial state on connection - all rooms with current status
      const rooms = await Room.findAll();
      socket.emit('initial_state', {
        rooms: rooms,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error sending initial state:', error);
      socket.emit('error', {
        message: 'Failed to load initial state',
        error: error.message
      });
    }

    // Handle client disconnection
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  });

  return io;
}

/**
 * Broadcast helper function to emit events to all connected clients
 * @param {Server} io - Socket.IO server instance
 * @param {string} event - Event name
 * @param {object} data - Data to broadcast
 */
function broadcast(io, event, data) {
  io.emit(event, {
    ...data,
    timestamp: new Date().toISOString()
  });
}

/**
 * Broadcast room update to all connected clients
 * @param {Server} io - Socket.IO server instance
 * @param {object} room - Updated room object
 * @param {string} action - Action type (created, updated, deleted)
 */
function broadcastRoomUpdate(io, room, action) {
  broadcast(io, 'room_update', {
    action,
    room
  });
}

/**
 * Broadcast booking update to all connected clients
 * @param {Server} io - Socket.IO server instance
 * @param {object} booking - Updated booking object
 * @param {object} room - Associated room object (if applicable)
 * @param {string} action - Action type (created, updated, cancelled)
 */
function broadcastBookingUpdate(io, booking, room, action) {
  broadcast(io, 'booking_update', {
    action,
    booking,
    room
  });
}

/**
 * Broadcast operation update (check-in/check-out) to all connected clients
 * @param {Server} io - Socket.IO server instance
 * @param {object} data - Operation data containing booking and room
 * @param {string} action - Action type (check_in, check_out)
 */
function broadcastOperationUpdate(io, data, action) {
  broadcast(io, 'operation_update', {
    action,
    booking: data.booking,
    room: data.room,
    late_penalty: data.late_penalty
  });
}

module.exports = {
  initializeSocketController,
  broadcast,
  broadcastRoomUpdate,
  broadcastBookingUpdate,
  broadcastOperationUpdate
};
