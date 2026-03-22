-- Stores fitting records (non-pipe pipe_fitting_id) that admin has validated as acceptable
create table if not exists drainer_validated_fittings (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references drainer_pipe_records(id) on delete cascade unique,
  validated_by text,
  validated_at timestamptz default now()
);

create index if not exists drainer_validated_fittings_record_idx on drainer_validated_fittings (record_id);

alter table drainer_validated_fittings enable row level security;
create policy "Allow authenticated read" on drainer_validated_fittings for select using (auth.role() = 'authenticated');
create policy "Allow authenticated insert" on drainer_validated_fittings for insert with check (auth.role() = 'authenticated');
create policy "Allow authenticated delete" on drainer_validated_fittings for delete using (auth.role() = 'authenticated');
