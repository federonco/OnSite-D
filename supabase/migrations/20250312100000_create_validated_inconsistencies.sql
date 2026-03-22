-- Stores inconsistencies (gap/overlap) that admin has validated as acceptable
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
create policy "Allow authenticated read" on drainer_validated_inconsistencies for select using (auth.role() = 'authenticated');
create policy "Allow authenticated insert" on drainer_validated_inconsistencies for insert with check (auth.role() = 'authenticated');
create policy "Allow authenticated delete" on drainer_validated_inconsistencies for delete using (auth.role() = 'authenticated');
