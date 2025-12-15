const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// Import configuration
const loadAndValidateEnv = require('./src/config/env');
const env = loadAndValidateEnv(); // Execute function to get config
const pool = require('./src/config/database');

// Import middleware
const { errorHandler } = require('./src/middleware/errorHandler');

// Import controllers
const authController = require('./src/controllers/authController');
const userController = require('./src/controllers/userController');
const roomController = require('./src/controllers/roomController');
const bookingController = require('./src/controllers/bookingController');
const operationsController = require('./src/controllers/operationsController');
const adminController = require('./src/controllers/adminController');
const { initializeSocketController } = require('./src/controllers/socketController');

// Import services
const cronService = require('./src/services/cronService');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Middleware chain
app.use(cors());
// Increase body size limit to 10MB for image uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static('public'));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', database: 'disconnected', error: error.message });
  }
});

// Register HTTP route controllers
app.use('/api/auth', authController);
app.use('/api/users', userController);
app.use('/api/rooms', roomController);
app.use('/api/bookings', bookingController);
app.use('/api/operations', operationsController);
app.use('/api/admin', adminController);

// Global error handler (must be last)
app.use(errorHandler);

// Initialize Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Initialize Socket.IO controller
initializeSocketController(io);

// Start server
const PORT = env.PORT;

server.listen(PORT, () => {
  console.log(`🏨 H-Socket Distributed Manager running on port ${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
  
  // Initialize cron service for automated maintenance tasks
  console.log('⏰ Initializing cron service...');
  cronService.startCleanupJob();
  console.log('✅ Cron service initialized successfully');
});
