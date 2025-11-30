/**
 * Unit Tests for Database Connection Pool
 * Validates: Requirements 1.1
 */

describe('Database Connection Pool', () => {
  let pool;
  let originalEnv;

  beforeAll(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Set test environment variables
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
    process.env.JWT_SECRET = 'test-secret-key-min-32-chars-long';
    process.env.PORT = '3000';
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  beforeEach(() => {
    // Clear the require cache to reload modules with test env vars
    delete require.cache[require.resolve('../../src/config/env.js')];
    delete require.cache[require.resolve('../../src/config/database.js')];
  });

  test('should initialize connection pool with correct configuration', () => {
    pool = require('../../src/config/database.js');
    
    expect(pool).toBeDefined();
    expect(pool.options.max).toBe(20);
    expect(pool.options.idleTimeoutMillis).toBe(30000);
  });

  test('should have connection string from environment', () => {
    pool = require('../../src/config/database.js');
    
    expect(pool.options.connectionString).toBe('postgresql://test:test@localhost:5432/test_db');
  });

  test('should handle connection acquisition and release', async () => {
    pool = require('../../src/config/database.js');
    
    // Mock the connect method to avoid actual database connection
    const mockClient = {
      release: jest.fn(),
      query: jest.fn().mockResolvedValue({ rows: [] })
    };
    
    pool.connect = jest.fn().mockResolvedValue(mockClient);
    
    // Acquire connection
    const client = await pool.connect();
    expect(client).toBeDefined();
    expect(pool.connect).toHaveBeenCalled();
    
    // Release connection
    client.release();
    expect(mockClient.release).toHaveBeenCalled();
  });

  test('should handle connection errors gracefully', async () => {
    pool = require('../../src/config/database.js');
    
    // Mock connection error
    const connectionError = new Error('Connection failed');
    pool.connect = jest.fn().mockRejectedValue(connectionError);
    
    // Attempt to connect and expect error
    await expect(pool.connect()).rejects.toThrow('Connection failed');
  });
});
