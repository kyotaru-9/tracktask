-- ============================================================================
-- TrackTask — auth-users.sql
-- Links public.profiles rows to existing Supabase Auth users (by email).
--
-- PREREQUISITE: create the 10 login accounts FIRST. Pick ONE method:
--
--   A) Automatic (recommended, uses only the anon key):
--        npm install            # installs @supabase/supabase-js
--        node supabase/seed.mjs # signs up users + creates profiles + demo docs
--      Then you do NOT need to run this file manually.
--
--   B) Manual in Dashboard:
--      Supabase Dashboard → Authentication → Users → Add user → Create new user
--      for EACH email below (password: Tracktask@2026, Auto Confirm user: ON).
--      Then run THIS file in SQL Editor to create their profiles.
--
-- Accounts (dev password for all: Tracktask@2026):
--   citymayor@gmail.com            → Mayor
--   cityadministrator@gmail.com    → City Administrator
--   cityenro@gmail.com             → City ENRO
--   swmsecretary@gmail.com         → SWM Secretary
--   enro.adminpermitting@gmail.com → Division / Administrative and Permitting Division
--   enro.envinfo@gmail.com         → Division / Environmental Information, Research and Development Division
--   enro.greening@gmail.com        → Division / City Greening and Forestry Management Division
--   enro.natres@gmail.com          → Division / Natural Resources Management and Safety Division
--   enro.pollution@gmail.com       → Division / Pollution Control and Management Division
--   enro.septage@gmail.com         → Division / Septage Treatment and Management Division
--
-- Idempotent: safe to re-run. Warns about emails with no matching auth user.
-- ============================================================================

-- Upsert profiles from auth.users. full_name/division/role are forced to the
-- canonical values below so re-runs repair any drift.
with staff (email, full_name, role, division) as (
  values
    ('citymayor@gmail.com',            'Hon. City Mayor',                    'Mayor',              null),
    ('cityadministrator@gmail.com',    'City Administrator',                 'City Administrator', null),
    ('cityenro@gmail.com',             'City ENRO Officer',                  'City ENRO',          null),
    ('swmsecretary@gmail.com',         'SWM Secretary',                      'SWM Secretary',      null),
    ('enro.adminpermitting@gmail.com', 'Admin & Permitting Division Chief',  'Division',           'Administrative and Permitting Division'),
    ('enro.envinfo@gmail.com',         'Env Info R&D Division Chief',        'Division',           'Environmental Information, Research and Development Division'),
    ('enro.greening@gmail.com',        'Greening & Forestry Division Chief', 'Division',           'City Greening and Forestry Management Division'),
    ('enro.natres@gmail.com',          'NatRes & Safety Division Chief',     'Division',           'Natural Resources Management and Safety Division'),
    ('enro.pollution@gmail.com',       'Pollution Control Division Chief',   'Division',           'Pollution Control and Management Division'),
    ('enro.septage@gmail.com',         'Septage Treatment Division Chief',   'Division',           'Septage Treatment and Management Division')
),
linked as (
  select u.id, s.email, s.full_name, s.role, s.division
  from staff s
  join auth.users u on lower(u.email) = lower(s.email)
)
insert into public.profiles (id, email, full_name, role, division)
select id, email, full_name, role, division from linked
on conflict (id) do update set
  email     = excluded.email,
  full_name = excluded.full_name,
  role      = excluded.role,
  division  = excluded.division;

-- Report any staff email that has NO matching auth.users row (user not created yet).
do $$
declare
  v_missing text;
begin
  select string_agg(s.email, ', ')
  into v_missing
  from (values
    ('citymayor@gmail.com'),
    ('cityadministrator@gmail.com'),
    ('cityenro@gmail.com'),
    ('swmsecretary@gmail.com'),
    ('enro.adminpermitting@gmail.com'),
    ('enro.envinfo@gmail.com'),
    ('enro.greening@gmail.com'),
    ('enro.natres@gmail.com'),
    ('enro.pollution@gmail.com'),
    ('enro.septage@gmail.com')
  ) as s(email)
  where not exists (select 1 from auth.users u where lower(u.email) = lower(s.email));

  if v_missing is not null then
    raise notice 'Missing auth users for: %. Create them in Authentication → Users (or run node supabase/seed.mjs), then re-run this file.', v_missing;
  else
    raise notice 'All 10 staff profiles linked successfully.';
  end if;
end
$$;

-- Quick verification (should return 10 rows):
-- select email, role, division from public.profiles order by role, email;
