-- Create the private bucket used by src/services/documentService.js
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

-- Policies (dropped first so this file is re-runnable)
drop policy if exists "attachments_select_authenticated" on storage.objects;
drop policy if exists "attachments_insert_authenticated" on storage.objects;
drop policy if exists "attachments_update_own" on storage.objects;
drop policy if exists "attachments_delete_own" on storage.objects;

-- Every signed-in user must be able to read attachments of any document
create policy "attachments_select_authenticated"
  on storage.objects for select to authenticated
  using (bucket_id = 'attachments');

-- Uploads are restricted to the caller's own folder: <auth.uid()>/<file>
create policy "attachments_insert_authenticated"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "attachments_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "attachments_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );