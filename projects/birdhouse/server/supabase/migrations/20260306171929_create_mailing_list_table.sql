create table public.mailing_list (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.mailing_list enable row level security;

create policy "Allow anonymous inserts"
  on public.mailing_list
  for insert
  to anon
  with check (true);
