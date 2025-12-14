/**
 * Socket Controller
 * Manages WebSocket connections and real-time event handling
 * Requirements: 2.1, 2.2, 2.5, 9.2, 11.1, 5.2
 */

const { authenticateSocket } = require('../middleware/auth');
const Room = require('../models/Room');
const roomService = require('../services/roomService');
const BookingService = require('../services/bookingService');

/**
 * Helper function to authorize socket based on allowed roles
 * Requirements: 9.2
 * @param {Socket} socket - Socket.IO socket instance
 * @param {Array<string>} allowedRoles - Array of allowed roles
 * @returns {boolean} True if authorized, false otherwise
 */
function authorizeSocket(socket, allowedRoles) {
  // Check if socket has user object (should be attached by authenticateSocket)
  if (!socket.user || !socket.user.role) {
    socket.emit('error', {
      error: 'AUTHORIZATION_ERROR',
      message: 'User not authenticated'
    });
    return false;
  }

  // Check if user role is in allowed roles
  if (!allowedRoles.includes(socket.user.role)) {
    socket.emit('error', {
      error: 'AUTHORIZATION_ERROR',
      message: `Insufficient permissions. Required roles: ${allowedRoles.join(', ')}`
    });
    return false;
  }

  return true;
}

/**
 * Initialize Socket.IO with authentication and event handlers
 * @param {Server} io - Socket.IO server instance
 */
function initializeSocketController(io) {
  // Middleware for socket authentication
  io.use(async (socket, next) => {
    try {
      // Use authenticateSocket from auth middleware
      const authenticated = await authenticateSocket(socket);
      
      if (authenticated) {
        next();
      } else {
        // authenticateSocket already handled error emission and disconnect
        return;
      }
    } catch (error) {
      next(new Error('Authentication failed: ' + error.message));
    }
  });

  // Handle new connections
  io.on('connection', async (socket) => {
    console.log(`Client connected: ${socket.id} (User: ${socket.user.id}, Role: ${socket.user.role})`);

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

    // Handle room status update event
    // Requirements: 11.1
    socket.on('room:status:update', async (data) => {
      try {
        // Authorize socket - only staff and admin can update room status
        if (!authorizeSocket(socket, ['staff', 'admin'])) {
          return;
        }

        const { roomId, status } = data;

        if (!roomId || !status) {
          socket.emit('error', {
            error: 'VALIDATION_ERROR',
            message: 'Room ID and status are required'
          });
          return;
        }

        // Call roomService.updateRoomStatus
        const updatedRoom = await roomService.updateRoomStatus(
          socket.user.id,
          socket.user.role,
          roomId,
          status
        );

        // Broadcast result to all clients (already done in service, but confirm with direct emit)
        io.emit('room_update', {
          action: 'status_updated',
          room: updatedRoom,
          timestamp: new Date().toISOString()
        });

        // Send success confirmation to requesting client
        socket.emit('room:status:update:success', {
          room: updatedRoom,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error updating room status:', error);
        socket.emit('error', {
          error: error.code || 'UPDATE_ERROR',
          message: error.message
        });
      }
    });

    // Handle booking creation event
    // Requirements: 5.2
    socket.on('booking:create', async (data) => {
      try {
        // Authorize socket - client, staff, and admin can create bookings
        if (!authorizeSocket(socket, ['client', 'staff', 'admin'])) {
          return;
        }

        const { user_id, room_id, check_in_date, check_out_date } = data;

        if (!user_id || !room_id || !check_in_date || !check_out_date) {
          socket.emit('error', {
            error: 'VALIDATION_ERROR',
            message: 'User ID, room ID, check-in date, and check-out date are required'
          });
          return;
        }

        // Call bookingService.createBooking
        const booking = await BookingService.createBooking(
          socket.user.id,
          socket.user.role,
          {
            user_id,
            room_id,
            check_in_date,
            check_out_date
          }
        );

        // Broadcast result to all clients (already done in service, but confirm with direct emit)
        const room = await Room.findById(room_id);
        io.emit('booking_update', {
          action: 'created',
          booking: booking,
          room: room,
          timestamp: new Date().toISOString()
        });

        // Send success confirmation to requesting client
        socket.emit('booking:create:success', {
          booking: booking,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error creating booking:', error);
        socket.emit('error', {
          error: error.code || 'BOOKING_ERROR',
          message: error.message
        });
      }
    });

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
