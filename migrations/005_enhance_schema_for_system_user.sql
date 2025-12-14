-- Migration: Enhance database schema for system user and audit log immutability
-- Requirements: 8.1, 8.4

-- Step 1: Add 'system' role to users table role constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('admin', 'staff', 'client', 'system'));

-- Step 2: Add updated_at column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create trigger function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 3: Insert system user record with locked password
INSERT INTO users (email, password_hash, role, full_name)
VALUES ('system@internal', 'LOCKED', 'system', 'System Automated Actor')
ON CONFLICT (email) DO NOTHING;

-- Step 4: Add database rules to prevent audit_logs modifications
-- Prevent UPDATE operations on audit_logs (immutability)
DROP RULE IF EXISTS audit_logs_no_update ON audit_logs;
CREATE RULE audit_logs_no_update AS 
  ON UPDATE TO audit_logs 
  DO INSTEAD NOTHING;

-- Prevent DELETE operations on audit_logs (immutability)
DROP RULE IF EXISTS audit_logs_no_delete ON audit_logs;
CREATE RULE audit_logs_no_delete AS 
  ON DELETE TO audit_logs 
  DO INSTEAD NOTHING;

-- Add comments for documentation
COMMENT ON COLUMN users.role IS 'User role: admin, staff, client, or system (for automated processes)';
COMMENT ON COLUMN users.updated_at IS 'Timestamp of last update to user record';
COMMENT ON CONSTRAINT users_role_check ON users IS 'Enforces valid role values including system actor';

