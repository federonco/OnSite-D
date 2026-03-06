-- Migration per prompt spec (run in Supabase SQL Editor if needed)
-- Checkpoints table - CREATE IF NOT EXISTS for idempotency

CREATE TABLE IF NOT EXISTS checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  ch numeric NOT NULL,
  type text NOT NULL CHECK (type IN ('Fitting', 'Structural', 'Warning', 'Info')),
  active boolean NOT NULL DEFAULT true,
  notified boolean NOT NULL DEFAULT false,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add columns if they don't exist (for existing checkpoints table)
ALTER TABLE checkpoints ADD COLUMN IF NOT EXISTS alert_email text;

CREATE INDEX IF NOT EXISTS checkpoints_ch_idx ON checkpoints (ch);

ALTER TABLE checkpoints ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they conflict (optional - comment out if you prefer to keep existing)
-- DROP POLICY IF EXISTS "Allow authenticated read" ON checkpoints;
-- DROP POLICY IF EXISTS "Allow authenticated insert" ON checkpoints;
-- DROP POLICY IF EXISTS "Allow authenticated update" ON checkpoints;
-- DROP POLICY IF EXISTS "Allow authenticated delete" ON checkpoints;

-- Create permissive policies per prompt
DROP POLICY IF EXISTS "Allow read checkpoints" ON checkpoints;
CREATE POLICY "Allow read checkpoints" ON checkpoints FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow write checkpoints" ON checkpoints;
CREATE POLICY "Allow write checkpoints" ON checkpoints FOR ALL USING (true);
