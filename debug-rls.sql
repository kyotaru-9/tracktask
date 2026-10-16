-- Test the policy evaluation manually
-- Run as the authenticated user (this simulates what the client does)

-- First, get the current user's auth.uid()
select auth.uid() as current_user_id;

-- Check if the profile query works
select * from public.profiles where id = auth.uid();

-- Test the policy condition directly
select exists (
  select 1 from public.profiles p
  where p.id = auth.uid() 
  and p.role in ('Mayor', 'City Administrator')
) as can_delete;

-- Also check if RLS is enabled
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename in ('documents', 'document_steps', 'notifications', 'audit_logs');