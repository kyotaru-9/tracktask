-- Document shares table for sharing documents with specific users
create table if not exists public.document_shares (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  shared_with uuid not null references public.profiles (id) on delete cascade,
  shared_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint document_shares_unique unique (document_id, shared_with)
);

create index if not exists document_shares_document_id_idx on public.document_shares (document_id);
create index if not exists document_shares_shared_with_idx on public.document_shares (shared_with);

-- RLS policies
alter table public.document_shares enable row level security;

-- Users can see shares they created or received
drop policy if exists "document_shares_select_own" on public.document_shares;
create policy "document_shares_select_own"
  on public.document_shares for select
  to authenticated
  using (shared_by = auth.uid() or shared_with = auth.uid());

-- Users can create shares for documents they have access to
drop policy if exists "document_shares_insert_creator" on public.document_shares;
create policy "document_shares_insert_creator"
  on public.document_shares for insert
  to authenticated
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_id
      and (
        d.created_by = auth.uid()
        or exists (select 1 from public.document_shares ds where ds.document_id = d.id and ds.shared_with = auth.uid())
      )
    )
  );

-- Users can delete shares they created
drop policy if exists "document_shares_delete_own" on public.document_shares;
create policy "document_shares_delete_own"
  on public.document_shares for delete
  to authenticated
  using (shared_by = auth.uid());

-- Add to realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'document_shares'
  ) then
    alter publication supabase_realtime add table public.document_shares;
  end if;
exception when duplicate_object then
  null;
end
$$;

alter table public.document_shares replica identity full;