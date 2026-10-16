-- Check current policies
select policyname, cmd, qual, with_check
from pg_policies
where tablename in ('documents', 'document_steps', 'notifications', 'audit_logs')
order by tablename, cmd;

-- Check current user's profile
select * from public.profiles where email = 'citymayor@gmail.com';

-- Grant DELETE to service_role (used by edge functions if any)
grant delete on public.documents to service_role;
grant delete on public.document_steps to service_role;
grant delete on public.notifications to service_role;
grant delete on public.audit_logs to service_role;

-- Fix DELETE policies
drop policy if exists "documents_delete_mayor_admin" on public.documents;
create policy "documents_delete_mayor_admin"
  on public.documents for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() 
      and p.role in ('Mayor', 'City Administrator')
    )
  );

drop policy if exists "document_steps_delete_mayor_admin" on public.document_steps;
create policy "document_steps_delete_mayor_admin"
  on public.document_steps for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() 
      and p.role in ('Mayor', 'City Administrator')
    )
  );

drop policy if exists "notifications_delete_mayor_admin" on public.notifications;
create policy "notifications_delete_mayor_admin"
  on public.notifications for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() 
      and p.role in ('Mayor', 'City Administrator')
    )
  );

drop policy if exists "audit_logs_delete_mayor_admin" on public.audit_logs;
create policy "audit_logs_delete_mayor_admin"
  on public.audit_logs for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() 
      and p.role in ('Mayor', 'City Administrator')
    )
  );

-- Ensure SELECT policies exist
drop policy if exists "documents_select_staff" on public.documents;
create policy "documents_select_staff"
  on public.documents for select
  to authenticated
  using (true);

drop policy if exists "document_steps_select_staff" on public.document_steps;
create policy "document_steps_select_staff"
  on public.document_steps for select
  to authenticated
  using (true);

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "audit_logs_select_staff" on public.audit_logs;
create policy "audit_logs_select_staff"
  on public.audit_logs for select
  to authenticated
  using (true);