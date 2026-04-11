-- Multiple joint types per section (allowed types on site). Replaces single joint_type.
ALTER TABLE drainer_sections
  ADD COLUMN IF NOT EXISTS joint_types text[];

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'drainer_sections'
      AND column_name = 'joint_type'
  ) THEN
    UPDATE drainer_sections
    SET joint_types = ARRAY[joint_type]::text[]
    WHERE joint_type IS NOT NULL
      AND joint_types IS NULL;
    ALTER TABLE drainer_sections DROP COLUMN joint_type;
  END IF;
END $$;
