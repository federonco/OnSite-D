-- Run this in Supabase Dashboard > SQL Editor if migrations weren't applied.
-- Creates the 3 validation tables for Data Analysis (Validate buttons).
-- Prerequisites: drainer_sections and drainer_pipe_records must exist.

-- 1. drainer_validated_inconsistencies (gaps/overlaps)
create table if not exists drainer_validated_inconsistencies (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references drainer_sections(id) on delete cascade,
  record_from_id uuid not null,
  record_to_id uuid not null,
  issue_type text not null check (issue_type in ('gap', 'overlap')),
  validated_by text,
  validated_at timestamptz default now(),
  unique (section_id, record_from_id, record_to_id)
);
create index if not exists drainer_validated_inconsistencies_section_idx on drainer_validated_inconsistencies (section_id);
alter table drainer_validated_inconsistencies enable row level security;
drop policy if exists "Allow authenticated read" on drainer_validated_inconsistencies;
create policy "Allow authenticated read" on drainer_validated_inconsistencies for select using (auth.role() = 'authenticated');
drop policy if exists "Allow authenticated insert" on drainer_validated_inconsistencies;
create policy "Allow authenticated insert" on drainer_validated_inconsistencies for insert with check (auth.role() = 'authenticated');
drop policy if exists "Allow authenticated delete" on drainer_validated_inconsistencies;
create policy "Allow authenticated delete" on drainer_validated_inconsistencies for delete using (auth.role() = 'authenticated');

-- 2. drainer_validated_near_tolerance
create table if not exists drainer_validated_near_tolerance (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references drainer_pipe_records(id) on delete cascade unique,
  validated_by text,
  validated_at timestamptz default now()
);
create index if not exists drainer_validated_near_tolerance_record_idx on drainer_validated_near_tolerance (record_id);
alter table drainer_validated_near_tolerance enable row level security;
drop policy if exists "Allow authenticated read" on drainer_validated_near_tolerance;
create policy "Allow authenticated read" on drainer_validated_near_tolerance for select using (auth.role() = 'authenticated');
drop policy if exists "Allow authenticated insert" on drainer_validated_near_tolerance;
create policy "Allow authenticated insert" on drainer_validated_near_tolerance for insert with check (auth.role() = 'authenticated');
drop policy if exists "Allow authenticated delete" on drainer_validated_near_tolerance;
create policy "Allow authenticated delete" on drainer_validated_near_tolerance for delete using (auth.role() = 'authenticated');

-- 3. drainer_validated_fittings
create table if not exists drainer_validated_fittings (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references drainer_pipe_records(id) on delete cascade unique,
  validated_by text,
  validated_at timestamptz default now()
);
create index if not exists drainer_validated_fittings_record_idx on drainer_validated_fittings (record_id);
alter table drainer_validated_fittings enable row level security;
drop policy if exists "Allow authenticated read" on drainer_validated_fittings;
create policy "Allow authenticated read" on drainer_validated_fittings for select using (auth.role() = 'authenticated');
drop policy if exists "Allow authenticated insert" on drainer_validated_fittings;
create policy "Allow authenticated insert" on drainer_validated_fittings for insert with check (auth.role() = 'authenticated');
drop policy if exists "Allow authenticated delete" on drainer_validated_fittings;
create policy "Allow authenticated delete" on drainer_validated_fittings for delete using (auth.role() = 'authenticated');

-- Refresh PostgREST schema cache so new tables are recognized
notify pgrst, 'reload schema';
