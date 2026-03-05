-- Add alert_email column to checkpoints (per-checkpoint recipient override)
ALTER TABLE checkpoints ADD COLUMN IF NOT EXISTS alert_email text;
