-- Checkpoint history for archived/expired checkpoints
CREATE TABLE checkpoint_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkpoint_id uuid REFERENCES checkpoints(id) ON DELETE SET NULL,
  section_id uuid REFERENCES drainer_sections(id) ON DELETE CASCADE,
  name text NOT NULL,
  ch numeric NOT NULL,
  type text NOT NULL,
  alert_email text,
  notified_at timestamptz NOT NULL,
  expired_at timestamptz NOT NULL DEFAULT now(),
  reason text DEFAULT 'auto-expired after 14 days'
);

CREATE INDEX IF NOT EXISTS checkpoint_history_section_id_idx ON checkpoint_history (section_id);
CREATE INDEX IF NOT EXISTS checkpoint_history_expired_at_idx ON checkpoint_history (expired_at DESC);
