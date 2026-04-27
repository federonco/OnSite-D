ALTER TABLE drainer_pipe_records
  ADD COLUMN IF NOT EXISTS welded_steps jsonb DEFAULT NULL;
