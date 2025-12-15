-- Migration: Add image columns to rooms table
-- Description: Add support for room images (1 for simple/doble, 3 for suite)
-- Date: 2025-12-15

-- Add image columns to rooms table
-- We'll store images as base64 encoded strings or URLs
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS image_1 TEXT,
ADD COLUMN IF NOT EXISTS image_2 TEXT,
ADD COLUMN IF NOT EXISTS image_3 TEXT;

-- Add comment to explain the columns
COMMENT ON COLUMN rooms.image_1 IS 'Primary image for all room types (base64 or URL)';
COMMENT ON COLUMN rooms.image_2 IS 'Second image for suite rooms only (base64 or URL)';
COMMENT ON COLUMN rooms.image_3 IS 'Third image for suite rooms only (base64 or URL)';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_rooms_with_images ON rooms(id) WHERE image_1 IS NOT NULL;
