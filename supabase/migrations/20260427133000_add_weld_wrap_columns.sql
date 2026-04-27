ALTER TABLE drainer_pipe_records
  ADD COLUMN IF NOT EXISTS welded_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS wrapped_at timestamptz DEFAULT NULL;
