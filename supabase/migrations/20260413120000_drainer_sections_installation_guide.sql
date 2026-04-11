ALTER TABLE drainer_sections
  ADD COLUMN IF NOT EXISTS guide_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS guide_xml jsonb;
