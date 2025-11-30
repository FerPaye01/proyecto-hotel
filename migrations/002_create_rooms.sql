-- Migration: Create rooms table
-- Requirements: 12.4

-- Create rooms table with SERIAL primary key
CREATE TABLE IF NOT EXISTS rooms (
  id SERIAL PRIMARY KEY,
  number VARCHAR(10) UNIQUE NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('simple', 'doble', 'suite')),
  price_per_night DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'CLEANING')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for optimized queries
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_number ON rooms(number);

-- Add comments for documentation
COMMENT ON TABLE rooms IS 'Stores hotel room inventory with status tracking';
COMMENT ON COLUMN rooms.type IS 'Room type: simple, doble, or suite';
COMMENT ON COLUMN rooms.status IS 'Room status: AVAILABLE, OCCUPIED, MAINTENANCE, or CLEANING';
