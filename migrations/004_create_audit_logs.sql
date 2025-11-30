-- Migration: Create audit_logs table
-- Requirements: 12.6, 12.8

-- Create audit_logs table with BIGSERIAL primary key
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  details JSONB NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for optimized queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

-- Add comments for documentation
COMMENT ON TABLE audit_logs IS 'Immutable audit trail for all critical operations';
COMMENT ON COLUMN audit_logs.details IS 'JSONB containing previous_value, new_value, and affected_entity_id';
COMMENT ON COLUMN audit_logs.actor_id IS 'User who performed the action (nullable if user is deleted)';
