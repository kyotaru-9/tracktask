-- Allow all authenticated users to create documents (not just Mayor)
drop policy if exists "documents_insert_mayor" on public.documents;
create policy "documents_insert_staff"
  on public.documents for insert
  to authenticated
  with check (true);

-- Also ensure document_steps insert policy allows all staff
drop policy if exists "document_steps_insert_mayor" on public.document_steps;
create policy "document_steps_insert_staff"
  on public.document_steps for insert
  to authenticated
  with check (true);