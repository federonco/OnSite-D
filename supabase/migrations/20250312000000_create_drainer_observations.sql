-- Observations table for field notes that require approval
create table if not exists drainer_observations (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null,
  chainage numeric not null,
  pipe_fitting_id text,
  description text,
  submitted_by text not null,
  created_at timestamptz default now(),
  status text check (status in ('pending', 'approved')) default 'pending',
  approval_comment text,
  approved_by text,
  approved_at timestamptz
);

create index if not exists drainer_observations_status_idx on drainer_observations (status);
create index if not exists drainer_observations_section_id_idx on drainer_observations (section_id);

alter table drainer_observations enable row level security;
create policy "Allow authenticated read" on drainer_observations for select using (auth.role() = 'authenticated');
create policy "Allow authenticated insert" on drainer_observations for insert with check (auth.role() = 'authenticated');
create policy "Allow authenticated update" on drainer_observations for update using (auth.role() = 'authenticated');
