
-- ScriptFlow user workspace database

create table if not exists public.scriptflow_user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  scripts jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{"theme":"light","reminder":false,"lastReminder":""}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.scriptflow_user_data enable row level security;

grant select, insert, update
on public.scriptflow_user_data to authenticated;

create policy "Users can read own ScriptFlow data"
on public.scriptflow_user_data
for select to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own ScriptFlow data"
on public.scriptflow_user_data
for insert to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own ScriptFlow data"
on public.scriptflow_user_data
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
