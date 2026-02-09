create table if not exists public.cases (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.parties (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_cases_updated_at on public.cases;
create trigger trg_cases_updated_at
before update on public.cases
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_parties_updated_at on public.parties;
create trigger trg_parties_updated_at
before update on public.parties
for each row
execute function public.touch_updated_at();

alter table public.cases enable row level security;
alter table public.parties enable row level security;

drop policy if exists "allow all anon cases" on public.cases;
create policy "allow all anon cases"
on public.cases
for all
using (true)
with check (true);

drop policy if exists "allow all anon parties" on public.parties;
create policy "allow all anon parties"
on public.parties
for all
using (true)
with check (true);
