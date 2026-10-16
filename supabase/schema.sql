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

-- See migrations/20260101000000_attachments_bucket.sql (kept in sync, apply after the schema)
\i migrations/20260101000000_attachments_bucket.sql
