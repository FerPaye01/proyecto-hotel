-- Migration: Create bookings table
-- Requirements: 12.5, 12.7

-- Create bookings table with UUID primary key and foreign keys
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  total_cost DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT check_dates CHECK (check_out_date > check_in_date)
);

-- Create indexes for optimized queries
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_room_id ON bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- Add comments for documentation
COMMENT ON TABLE bookings IS 'Stores hotel room bookings with date ranges and status tracking';
COMMENT ON COLUMN bookings.status IS 'Booking status: CONFIRMED, CHECKED_IN, CHECKED_OUT, or CANCELLED';
COMMENT ON CONSTRAINT check_dates ON bookings IS 'Ensures check-out date is after check-in date';
