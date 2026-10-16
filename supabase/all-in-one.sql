-- ============================================================================
-- TrackTask - ALL-IN-ONE single-run database
-- Supabase Dashboard -> SQL Editor -> New query -> paste THIS ENTIRE FILE -> Run
-- No prerequisites. Creates: extensions, tables, indexes, triggers, RPC,
-- RLS policies, realtime, 10 auth users (password Tracktask@2026),
-- 10 profiles, 5 demo documents + welcome notifications.
-- Idempotent: safe to re-run.
-- ============================================================================

-- ============================================================================
-- TrackTask — schema.sql
-- Document tracking with QR codes, sequential approval routing, realtime.
-- Stack: Supabase (Postgres + Auth + Realtime)
--
-- Run this FIRST in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- Then run auth-users.sql (link profiles) and seed-demo.sql (demo docs),
-- or just run all-in-one.sql which contains everything.
--
-- Idempotent: safe to re-run (uses IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ============================================================================

-- Required extensions
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- Staff accounts. id MUST equal auth.users.id (set by trigger/seed, see below).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  full_name text not null,
  role text not null check (role in (
    'Mayor',
    'City Administrator',
    'City ENRO',
    'SWM Secretary',
    'Division',
    'HR'
  )),
  division text null,
  created_at timestamptz not null default now(),
  constraint division_required_for_division_role
    check (role <> 'Division' or division is not null)
);

-- Core document registry. One row per tracked document.
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  tracking_id text unique not null,
  title text not null,
  doc_type text not null,
  origin text not null,
  submitted_by text not null,
  notes text null,
  urgency text not null default 'Normal'
    check (urgency in ('Low', 'Normal', 'High', 'Critical')),
  deadline date null,
  attachment text null,
  created_by uuid null references public.profiles (id) on delete set null,
  status text not null default 'processing'
    check (status in ('processing', 'returning', 'done', 'rejected')),
  phase text not null default 'forward'
    check (phase in ('forward', 'reverse')),
  current_step integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sequential approval route. step 0 is always the Mayor (creator/origin).
create table if not exists public.document_steps (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  step_order integer not null,
  handler_role text not null,
  handler_division text null,
  status text not null default 'waiting'
    check (status in ('pending', 'waiting', 'approved', 'rejected', 'received')),
  comment text null,
  acted_by uuid null references public.profiles (id) on delete set null,
  acted_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint document_steps_unique_order unique (document_id, step_order)
);

-- Per-user inbox. App inserts rows for other users (fan-out), users read own.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  document_id uuid null references public.documents (id) on delete cascade,
  message text not null,
  dot text null default '#2563eb',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Audit trail: immutable log of every document action (approve, reject, receive, done)
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  action text not null check (action in ('approve', 'reject', 'receive', 'done')),
  acted_by uuid not null references public.profiles (id) on delete cascade,
  acted_at timestamptz not null default now(),
  step_order integer not null,
  handler_role text not null,
  handler_division text null,
  comment text null
);

create index if not exists audit_logs_document_id_idx on public.audit_logs (document_id, acted_at);
create index if not exists audit_logs_acted_by_idx on public.audit_logs (acted_by);

-- ============================================================================
-- 2. INDEXES (dashboard + realtime queries)
-- ============================================================================

create index if not exists documents_created_at_idx on public.documents (created_at desc);
create index if not exists documents_status_idx on public.documents (status);
create index if not exists documents_tracking_id_idx on public.documents (tracking_id);
create index if not exists document_steps_document_id_idx on public.document_steps (document_id);
create index if not exists document_steps_document_order_idx on public.document_steps (document_id, step_order);
create index if not exists notifications_user_id_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_document_id_idx on public.notifications (document_id);
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_role_division_idx on public.profiles (role, division);

-- ============================================================================
-- 3. AUTO-UPDATED updated_at on documents
-- ============================================================================

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at
  before update on public.documents
  for each row execute function public.handle_updated_at();

-- ============================================================================
-- 4. PUBLIC TRACK RPC (used by /track-documents — NO login required)
-- Returns minimal status data for ONE document per call.
-- ============================================================================

create or replace function public.track_document(p_tracking_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.documents%rowtype;
  v_steps jsonb;
begin
  if p_tracking_id is null or btrim(p_tracking_id) = '' then
    return null;
  end if;

  select * into v_doc
  from public.documents
  where upper(tracking_id) = upper(btrim(p_tracking_id))
  limit 1;

  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'step_order', s.step_order,
      'handler_role', s.handler_role,
      'handler_division', s.handler_division,
      'status', s.status,
      'comment', s.comment,
      'acted_at', s.acted_at
    ) order by s.step_order
  ), '[]'::jsonb)
  into v_steps
  from public.document_steps s
  where s.document_id = v_doc.id;

  return jsonb_build_object(
    'id', v_doc.id,
    'tracking_id', v_doc.tracking_id,
    'title', v_doc.title,
    'doc_type', v_doc.doc_type,
    'origin', v_doc.origin,
    'urgency', v_doc.urgency,
    'status', v_doc.status,
    'phase', v_doc.phase,
    'current_step', v_doc.current_step,
    'created_at', v_doc.created_at,
    'deadline', v_doc.deadline,
    'steps', v_steps
  );
end;
$$;

-- Allow anon + authenticated to execute the RPC (it exposes only one doc).
grant execute on function public.track_document(text) to anon, authenticated;

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- Design constraint from the app layer:
--  - notifyOffice() inserts notifications FOR OTHER USERS, so authenticated
--    users need INSERT on notifications (not just own rows).
--  - fetchDocuments() reads every document for any logged-in staff.
--  - Turn-taking (who may approve) is enforced in src/services/documentService.js
--    via matchOffice()/isMyTurn(). For hardened production, move actOnDocument
--    into a SECURITY DEFINER function.
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.document_steps enable row level security;
alter table public.notifications enable row level security;

-- ---- profiles ----
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_insert_authenticated" on public.profiles;
create policy "profiles_insert_authenticated"
  on public.profiles for insert
  to authenticated
  with check (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- HR can manage all profiles (create, update, delete)
drop policy if exists "profiles_hr_manage" on public.profiles;
create policy "profiles_hr_manage"
  on public.profiles for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'HR')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'HR')
  );

-- ---- documents ----
-- Staff-only read: any logged-in user can list documents (dashboard).
drop policy if exists "documents_select_staff" on public.documents;
create policy "documents_select_staff"
  on public.documents for select
  to authenticated
  using (true);

-- Only Mayor-role accounts can create (matches README + Dashboard UI gate).
drop policy if exists "documents_insert_mayor" on public.documents;
create policy "documents_insert_mayor"
  on public.documents for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'Mayor'
    )
  );

-- Any staff member in the route can advance their own step.
drop policy if exists "documents_update_staff" on public.documents;
create policy "documents_update_staff"
  on public.documents for update
  to authenticated
  using (true)
  with check (true);

-- ---- document_steps ----
drop policy if exists "document_steps_select_staff" on public.document_steps;
create policy "document_steps_select_staff"
  on public.document_steps for select
  to authenticated
  using (true);

drop policy if exists "document_steps_insert_mayor" on public.document_steps;
create policy "document_steps_insert_mayor"
  on public.document_steps for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'Mayor'
    )
  );

drop policy if exists "document_steps_update_staff" on public.document_steps;
create policy "document_steps_update_staff"
  on public.document_steps for update
  to authenticated
  using (true)
  with check (true);

-- ---- notifications (private per user, with fan-out inserts) ----
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "notifications_insert_staff" on public.notifications;
create policy "notifications_insert_staff"
  on public.notifications for insert
  to authenticated
  with check (true);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---- audit_logs (readable by all staff, inserted by system) ----
drop policy if exists "audit_logs_select_staff" on public.audit_logs;
create policy "audit_logs_select_staff"
  on public.audit_logs for select
  to authenticated
  using (true);

drop policy if exists "audit_logs_insert_system" on public.audit_logs;
create policy "audit_logs_insert_system"
  on public.audit_logs for insert
  to authenticated
  with check (true);

-- ============================================================================
-- 6. REALTIME (dashboard subscribes to documents + document_steps + own
--    notifications via supabase.channel in useDashboardData.js)
-- ============================================================================

do $$
begin
  -- Publication exists on every Supabase project; add tables if missing.
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'documents'
  ) then
    alter publication supabase_realtime add table public.documents;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'document_steps'
  ) then
    alter publication supabase_realtime add table public.document_steps;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'audit_logs'
  ) then
    alter publication supabase_realtime add table public.audit_logs;
  end if;
exception when duplicate_object then
  null;
end
$$;

-- REPLICA IDENTITY FULL makes UPDATE/DELETE payloads complete for realtime.
alter table public.documents replica identity full;
alter table public.document_steps replica identity full;
alter table public.notifications replica identity full;
alter table public.audit_logs replica identity full;

-- ============================================================================
-- 7. STORAGE BUCKET for document attachments
-- ============================================================================

-- Create bucket for document attachments (run in Storage section of Dashboard or via SQL)
-- Note: Storage buckets are typically created via Dashboard UI, but here's the SQL equivalent:
-- insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false)
-- on conflict (id) do nothing;

-- Storage policies for attachments bucket (allow authenticated users to upload/read their own)
-- These should be created in Dashboard → Storage → Policies, or via SQL:
-- create policy "attachments_select_authenticated" on storage.objects for select to authenticated using (bucket_id = 'attachments');
-- create policy "attachments_insert_authenticated" on storage.objects for insert to authenticated with check (bucket_id = 'attachments' and auth.uid()::text = (storage.foldername(name))[1]);
-- create policy "attachments_update_own" on storage.objects for update to authenticated using (bucket_id = 'attachments' and auth.uid()::text = (storage.foldername(name))[1]);
-- create policy "attachments_delete_own" on storage.objects for delete to authenticated using (bucket_id = 'attachments' and auth.uid()::text = (storage.foldername(name))[1]);
-- ============================================================================
-- TrackTask — auth-create.sql (used by all-in-one.sql single-run)
-- Creates the 10 login accounts directly in auth.users + auth.identities.
--
-- Dev password for all: Tracktask@2026
-- Idempotent: safe to re-run (skips existing emails, repairs missing
-- identities, resets password to the dev password so logins always work).
--
-- If your project blocks writes to the auth schema, this raises a NOTICE
-- instead of failing — create the users in Dashboard → Authentication →
-- Users (Auto Confirm ON) and re-run supabase/auth-users.sql.
-- ============================================================================

create extension if not exists "pgcrypto";

do $$
declare
  v_instance uuid := '00000000-0000-0000-0000-000000000000';
  v_tmp uuid;
  v_pw text := 'Tracktask@2026';
  r record;
  v_user_id uuid;
  v_has_id boolean := false;
  v_has_provider_id boolean := false;
  v_has_email_col boolean := false;
begin
  -- Prefer the project's real instance id when available.
  begin
    select id into v_tmp from auth.instances limit 1;
    if v_tmp is not null then v_instance := v_tmp; end if;
  exception when undefined_table then
    -- keep all-zero fallback
  end;

  -- Detect auth.identities shape (column set changed across GoTrue versions).
  begin
    select exists(
      select 1 from information_schema.columns
      where table_schema = 'auth' and table_name = 'identities' and column_name = 'id'
    ) into v_has_id;
    select exists(
      select 1 from information_schema.columns
      where table_schema = 'auth' and table_name = 'identities' and column_name = 'provider_id'
    ) into v_has_provider_id;
    select exists(
      select 1 from information_schema.columns
      where table_schema = 'auth' and table_name = 'identities' and column_name = 'email'
    ) into v_has_email_col;
  exception when others then
    raise notice 'Could not inspect auth.identities: %', SQLERRM;
  end;

  for r in
    select * from (values
      ('citymayor@gmail.com',            'Hon. City Mayor'),
      ('cityadministrator@gmail.com',    'City Administrator'),
      ('cityenro@gmail.com',             'City ENRO Officer'),
      ('swmsecretary@gmail.com',         'SWM Secretary'),
      ('enro.adminpermitting@gmail.com', 'Admin & Permitting Division Chief'),
      ('enro.envinfo@gmail.com',         'Env Info R&D Division Chief'),
      ('enro.greening@gmail.com',        'Greening & Forestry Division Chief'),
      ('enro.natres@gmail.com',          'NatRes & Safety Division Chief'),
      ('enro.pollution@gmail.com',       'Pollution Control Division Chief'),
      ('enro.septage@gmail.com',         'Septage Treatment Division Chief')
    ) as s(email, full_name)
  loop
    -- 1. auth.users row (create or repair password/confirmation).
    begin
      select id into v_user_id from auth.users where lower(email) = lower(r.email);
      if v_user_id is null then
        v_user_id := gen_random_uuid();
        insert into auth.users (
          instance_id, id, aud, role, email,
          encrypted_password, email_confirmed_at,
          confirmation_token, email_change, email_change_token_new, recovery_token,
          raw_app_meta_data, raw_user_meta_data,
          created_at, updated_at
        ) values (
          v_instance, v_user_id, 'authenticated', 'authenticated', r.email,
          crypt(v_pw, gen_salt('bf')), now(),
          '', '', '', '',
          '{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object('full_name', r.full_name),
          now(), now()
        );
      else
        update auth.users set
          encrypted_password = crypt(v_pw, gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
          updated_at = now()
        where id = v_user_id;
      end if;
    exception when others then
      raise notice 'Could not create auth user %: %. Create it in Authentication → Users instead.', r.email, SQLERRM;
      continue;
    end;

    -- 2. Companion auth.identities row (required for email/password sign-in).
    begin
      if not exists (
        select 1 from auth.identities where user_id = v_user_id and provider = 'email'
      ) then
        if v_has_id and v_has_provider_id and v_has_email_col then
          execute
            'insert into auth.identities (id, user_id, provider, provider_id, identity_data, email, last_sign_in_at, created_at, updated_at)
             values (gen_random_uuid(), $1, ''email'', $2, $3, $4, now(), now(), now()) on conflict do nothing'
            using v_user_id, v_user_id::text,
                  jsonb_build_object('sub', v_user_id::text, 'email', r.email),
                  r.email;
        elsif v_has_id and v_has_provider_id then
          execute
            'insert into auth.identities (id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at)
             values (gen_random_uuid(), $1, ''email'', $2, $3, now(), now(), now()) on conflict do nothing'
            using v_user_id, v_user_id::text,
                  jsonb_build_object('sub', v_user_id::text, 'email', r.email);
        elsif v_has_provider_id then
          execute
            'insert into auth.identities (user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at)
             values ($1, ''email'', $2, $3, now(), now(), now()) on conflict do nothing'
            using v_user_id, v_user_id::text,
                  jsonb_build_object('sub', v_user_id::text, 'email', r.email);
        else
          -- Legacy GoTrue shape (pre-Nov-2023): no provider_id column.
          execute
            'insert into auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
             values ($1, $1, $2, ''email'', now(), now(), now()) on conflict do nothing'
            using v_user_id,
                  format('{"sub":"%s","email":"%s"}', v_user_id::text, r.email)::jsonb;
        end if;
      end if;
    exception when others then
      raise notice 'Could not create auth identity for %: %', r.email, SQLERRM;
    end;
  end loop;

  raise notice 'Auth users ensured (10 staff). Password for all: Tracktask@2026';
end
$$;
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
--   hr@city.gov.ph                 → Human Resources
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
    ('enro.septage@gmail.com',         'Septage Treatment Division Chief',   'Division',           'Septage Treatment and Management Division'),
    ('hr@city.gov.ph',                 'HR Officer',                         'HR',                 null)
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
    ('enro.septage@gmail.com'),
    ('hr@city.gov.ph')
  ) as s(email)
  where not exists (select 1 from auth.users u where lower(u.email) = lower(s.email));

  if v_missing is not null then
    raise notice 'Missing auth users for: %. Create them in Authentication → Users (or run node supabase/seed.mjs), then re-run this file.', v_missing;
  else
    raise notice 'All 11 staff profiles linked successfully.';
  end if;
end
$$;

-- Quick verification (should return 11 rows):
-- select email, role, division from public.profiles order by role, email;
-- ============================================================================
-- TrackTask — seed-demo.sql
-- Demo documents covering every workflow state. Run AFTER schema.sql +
-- auth-users.sql (it looks up staff UUIDs from public.profiles by email).
--
-- Demo set (all created_by the Mayor):
--   DOC-2026-100001  processing  forward  step 1  Normal    Budget Report
--   DOC-2026-100002  processing  forward  step 2  High      Special Waste Permit
--   DOC-2026-100003  returning   reverse  step 1  Critical  River Cleanup Memo
--   DOC-2026-100004  done        reverse  step 0  Normal    Tree Planting Resolution
--   DOC-2026-100005  rejected    forward  step 1  Low       Old Procurement Request
--
-- Idempotent: deletes these 5 tracking IDs first, then re-inserts.
-- ============================================================================

do $$
declare
  v_mayor      uuid;
  v_admin      uuid;
  v_enro       uuid;
  v_swm        uuid;
  v_div_admin  uuid;
  v_div_green  uuid;
  v_doc        uuid;
begin
  -- Resolve staff IDs (fail loudly if auth-users.sql was not run yet).
  select id into v_mayor     from public.profiles where email = 'citymayor@gmail.com';
  select id into v_admin     from public.profiles where email = 'cityadministrator@gmail.com';
  select id into v_enro      from public.profiles where email = 'cityenro@gmail.com';
  select id into v_swm       from public.profiles where email = 'swmsecretary@gmail.com';
  select id into v_div_admin from public.profiles where email = 'enro.adminpermitting@gmail.com';
  select id into v_div_green from public.profiles where email = 'enro.greening@gmail.com';

  if v_mayor is null or v_admin is null or v_enro is null then
    raise exception 'Staff profiles missing. Run auth-users.sql (after creating auth users) first.';
  end if;

  -- Idempotency: remove previous demo runs.
  delete from public.documents
  where tracking_id in (
    'DOC-2026-100001','DOC-2026-100002','DOC-2026-100003',
    'DOC-2026-100004','DOC-2026-100005'
  );

  -- ── 1. processing / forward / awaiting City Administrator ──────────────
  insert into public.documents
    (tracking_id, title, doc_type, origin, submitted_by, notes, urgency, deadline,
     created_by, status, phase, current_step, created_at)
  values
    ('DOC-2026-100001', 'Q2 Budget Utilization Report', 'Report',
     'Office of the Mayor', 'Juan Dela Cruz',
     'Quarterly budget report routed for sequential approval.',
     'Normal', CURRENT_DATE + 14,
     v_mayor, 'processing', 'forward', 1, now() - interval '3 days')
  returning id into v_doc;

  insert into public.document_steps (document_id, step_order, handler_role, handler_division, status, acted_by, acted_at, comment) values
    (v_doc, 0, 'Mayor', null, 'approved', v_mayor, now() - interval '3 days', 'Submitted for approval.'),
    (v_doc, 1, 'City Administrator', null, 'pending', null, null, null),
    (v_doc, 2, 'City ENRO', null, 'waiting', null, null, null),
    (v_doc, 3, 'Division', 'Administrative and Permitting Division', 'waiting', null, null, null);

  -- ── 2. processing / forward / awaiting City ENRO (High urgency) ────────
  insert into public.documents
    (tracking_id, title, doc_type, origin, submitted_by, notes, urgency, deadline,
     created_by, status, phase, current_step, created_at)
  values
    ('DOC-2026-100002', 'Special Waste Hauling Permit', 'Permit',
     'Office of the Mayor', 'Maria Santos',
     'Urgent hauling permit for coastal barangays.',
     'High', CURRENT_DATE + 3,
     v_mayor, 'processing', 'forward', 2, now() - interval '2 days')
  returning id into v_doc;

  insert into public.document_steps (document_id, step_order, handler_role, handler_division, status, acted_by, acted_at, comment) values
    (v_doc, 0, 'Mayor', null, 'approved', v_mayor, now() - interval '2 days', 'Submitted for approval.'),
    (v_doc, 1, 'City Administrator', null, 'approved', v_admin, now() - interval '1 day', 'Reviewed. Forwarding to ENRO.'),
    (v_doc, 2, 'City ENRO', null, 'pending', null, null, null),
    (v_doc, 3, 'Division', 'Pollution Control and Management Division', 'waiting', null, null, null);

  -- ── 3. returning / reverse / being returned (Critical) ─────────────────
  insert into public.documents
    (tracking_id, title, doc_type, origin, submitted_by, notes, urgency, deadline,
     created_by, status, phase, current_step, created_at)
  values
    ('DOC-2026-100003', 'River Cleanup Drive Memo', 'Memo',
     'Office of the Mayor', 'Jose Rizal',
     'Completed by the division, now routing back in reverse order.',
     'Critical', CURRENT_DATE + 1,
     v_mayor, 'returning', 'reverse', 1, now() - interval '6 days')
  returning id into v_doc;

  insert into public.document_steps (document_id, step_order, handler_role, handler_division, status, acted_by, acted_at, comment) values
    (v_doc, 0, 'Mayor', null, 'pending', null, null, null),
    (v_doc, 1, 'City Administrator', null, 'pending', null, null, null),
    (v_doc, 2, 'City ENRO', null, 'received', v_enro, now() - interval '1 hour', 'Received return. Sending back to Admin.'),
    (v_doc, 3, 'Division', 'City Greening and Forestry Management Division', 'approved', v_div_green, now() - interval '2 hours', 'Cleanup completed. Marking complete.');

  -- ── 4. done / fully returned and closed by the Mayor ───────────────────
  insert into public.documents
    (tracking_id, title, doc_type, origin, submitted_by, notes, urgency, deadline,
     created_by, status, phase, current_step, created_at)
  values
    ('DOC-2026-100004', 'Citywide Tree Planting Resolution', 'Resolution',
     'Office of the Mayor', 'Ana Reyes',
     'Completed full forward + reverse routing. All handlers notified.',
     'Normal', CURRENT_DATE - 1,
     v_mayor, 'done', 'reverse', 0, now() - interval '10 days')
  returning id into v_doc;

  insert into public.document_steps (document_id, step_order, handler_role, handler_division, status, acted_by, acted_at, comment) values
    (v_doc, 0, 'Mayor', null, 'received', v_mayor, now() - interval '1 day', 'Marked as DONE. Thank you all.'),
    (v_doc, 1, 'City Administrator', null, 'received', v_admin, now() - interval '2 days', 'Received and returned.'),
    (v_doc, 2, 'City ENRO', null, 'received', v_enro, now() - interval '3 days', 'Received and returned.'),
    (v_doc, 3, 'Division', 'Administrative and Permitting Division', 'approved', v_div_admin, now() - interval '4 days', 'Approved. Work completed.');

  -- ── 5. rejected at City Administrator ──────────────────────────────────
  insert into public.documents
    (tracking_id, title, doc_type, origin, submitted_by, notes, urgency, deadline,
     created_by, status, phase, current_step, created_at)
  values
    ('DOC-2026-100005', 'Old Procurement Request (Sample Rejected)', 'Budget',
     'Office of the Mayor', 'Pedro Gomez',
     'Sample of a rejected document. Rejection notifies the creator.',
     'Low', CURRENT_DATE + 30,
     v_mayor, 'rejected', 'forward', 1, now() - interval '5 days')
  returning id into v_doc;

  insert into public.document_steps (document_id, step_order, handler_role, handler_division, status, acted_by, acted_at, comment) values
    (v_doc, 0, 'Mayor', null, 'approved', v_mayor, now() - interval '5 days', 'Submitted for approval.'),
    (v_doc, 1, 'City Administrator', null, 'rejected', v_admin, now() - interval '4 days', 'Missing supporting attachments.'),
    (v_doc, 2, 'City ENRO', null, 'waiting', null, null, null);

  raise notice 'Seeded 5 demo documents (DOC-2026-100001 … DOC-2026-100005).';
end
$$;

-- Seed one notification per staff member pointing at the first demo doc,
-- so the Notifications bell is demonstrably working after a fresh install.
-- (Skipped silently if profiles are missing.)
insert into public.notifications (user_id, document_id, message, dot)
select p.id, d.id,
  'Welcome to TrackTask! Document ' || d.tracking_id || ' "' || d.title || '" is in the pipeline.',
  '#2563eb'
from public.profiles p
cross join (select id, tracking_id, title from public.documents where tracking_id = 'DOC-2026-100001') d
where not exists (
  select 1 from public.notifications n
  where n.user_id = p.id and n.document_id = d.id
);
