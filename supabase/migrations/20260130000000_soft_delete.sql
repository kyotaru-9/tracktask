-- ============================================================================
-- Soft Delete Migration
-- Adds is_deleted and deleted_at columns to documents table
-- Allows IT department to access deleted files while hiding them from others
-- ============================================================================

-- Add soft delete columns to documents table
alter table public.documents
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz null,
  add column if not exists deleted_by uuid null references public.profiles (id) on delete set null;

-- Create index for filtering deleted documents
create index if not exists documents_is_deleted_idx on public.documents (is_deleted);

-- Create index for IT to query deleted documents efficiently
create index if not exists documents_deleted_at_idx on public.documents (deleted_at desc);
