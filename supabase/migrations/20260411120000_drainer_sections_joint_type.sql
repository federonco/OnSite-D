-- Default joint type for a section (admin Edit Section); optional.
ALTER TABLE drainer_sections
  ADD COLUMN IF NOT EXISTS joint_type text;
