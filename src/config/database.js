/**
 * Database Connection Pool Configuration
 * Validates: Requirements 1.1
 */

const { Pool } = require('pg');
const loadAndValidateEnv = require('./env');

// Load configuration
const config = loadAndValidateEnv();

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 20,                    // Maximum number of connections in the pool
  idleTimeoutMillis: 30000,   // Close idle connections after 30 seconds
  connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection cannot be established
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('[DATABASE] Unexpected error on idle client', err);
});

// Export pool instance for use in models
module.exports = pool;
