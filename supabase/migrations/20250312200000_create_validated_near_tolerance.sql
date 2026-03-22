-- Stores near-tolerance deflection records that admin has validated as acceptable
create table if not exists drainer_validated_near_tolerance (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references drainer_pipe_records(id) on delete cascade unique,
  validated_by text,
  validated_at timestamptz default now()
);

create index if not exists drainer_validated_near_tolerance_record_idx on drainer_validated_near_tolerance (record_id);

alter table drainer_validated_near_tolerance enable row level security;
create policy "Allow authenticated read" on drainer_validated_near_tolerance for select using (auth.role() = 'authenticated');
create policy "Allow authenticated insert" on drainer_validated_near_tolerance for insert with check (auth.role() = 'authenticated');
create policy "Allow authenticated delete" on drainer_validated_near_tolerance for delete using (auth.role() = 'authenticated');
