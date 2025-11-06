-- Migration: Add is_checkpoint column to paradas table
-- Date: 2025-11-05
-- Description: Adds boolean flag to distinguish between real delivery stops and base checkpoints
--              This allows accurate counting of deliveries while maintaining full route tracking

-- Step 1: Add the is_checkpoint column with default TRUE (real deliveries)
ALTER TABLE paradas
ADD COLUMN is_checkpoint BOOLEAN DEFAULT true;

-- Step 2: Update existing base paradas (departure and arrival points) to is_checkpoint = FALSE
-- These are identified by their observacoes field
UPDATE paradas
SET is_checkpoint = false
WHERE observacoes IN ('Ponto de partida', 'Ponto de chegada');

-- Step 3: Create index for better query performance
-- This index will optimize queries that filter by is_checkpoint = true
CREATE INDEX IF NOT EXISTS idx_paradas_is_checkpoint
ON paradas(is_checkpoint);

-- Step 4: Add comment to column for documentation
COMMENT ON COLUMN paradas.is_checkpoint IS
'Flag to distinguish real delivery/pickup stops (true) from base departure/arrival points (false). Used for accurate delivery counting and progress tracking.';

-- Verification Query (run this to verify the migration worked correctly):
-- SELECT
--   is_checkpoint,
--   COUNT(*) as total,
--   COUNT(CASE WHEN observacoes IN ('Ponto de partida', 'Ponto de chegada') THEN 1 END) as base_points
-- FROM paradas
-- GROUP BY is_checkpoint;
--
-- Expected result:
-- is_checkpoint | total | base_points
-- --------------+-------+------------
-- false         |   X   |     X       (should match)
-- true          |   Y   |     0       (should have no base points)
