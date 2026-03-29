-- App embeds: projects!project_id(name, number). Column was historically `code`; align name with PostgREST select.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'code'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'number'
  ) THEN
    ALTER TABLE public.projects RENAME COLUMN code TO number;
  END IF;
END $$;
