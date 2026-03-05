-- Checkpoints table for proximity alerts along the pipeline trajectory
create table if not exists checkpoints (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ch numeric not null,
  type text check (type in ('Fitting', 'Structural', 'Warning', 'Info')) default 'Info',
  active boolean default true,
  notified boolean default false,
  notified_at timestamptz,
  alert_email text,
  created_at timestamptz default now()
);

-- Index on ch for proximity queries
create index if not exists checkpoints_ch_idx on checkpoints (ch);

-- RLS: enable and allow authenticated read/write
alter table checkpoints enable row level security;
create policy "Allow authenticated read" on checkpoints for select using (auth.role() = 'authenticated');
create policy "Allow authenticated insert" on checkpoints for insert with check (auth.role() = 'authenticated');
create policy "Allow authenticated update" on checkpoints for update using (auth.role() = 'authenticated');
create policy "Allow authenticated delete" on checkpoints for delete using (auth.role() = 'authenticated');
