-- Migration: Create users table
-- Requirements: 12.3

-- Create users table with UUID primary key
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'staff', 'client')),
  full_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for optimized queries
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Add comment for documentation
COMMENT ON TABLE users IS 'Stores user accounts with role-based access control';
COMMENT ON COLUMN users.role IS 'User role: admin, staff, or client';
