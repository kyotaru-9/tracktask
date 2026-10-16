-- Check grants
select grantee, table_name, privilege_type 
from information_schema.table_privileges 
where table_schema = 'public' 
  and table_name in ('documents', 'document_steps', 'notifications', 'audit_logs')
  and privilege_type = 'DELETE'
order by table_name, grantee;

-- Grant DELETE to authenticated role (base permission)
grant delete on public.documents to authenticated;
grant delete on public.document_steps to authenticated;
grant delete on public.notifications to authenticated;
grant delete on public.audit_logs to authenticated;

-- Also verify SELECT grants
select grantee, table_name, privilege_type 
from information_schema.table_privileges 
where table_schema = 'public' 
  and table_name in ('documents', 'document_steps', 'notifications', 'audit_logs')
order by table_name, grantee;