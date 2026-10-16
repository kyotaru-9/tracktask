-- Add account hold/disable support for HR administration.
alter table public.profiles
  add column if not exists status text not null default 'active'
    check (status in ('active', 'held')),
  add column if not exists held_at timestamptz null,
  add column if not exists held_by uuid null references public.profiles (id) on delete set null,
  add column if not exists hold_reason text null;

create index if not exists profiles_status_idx on public.profiles (status);
