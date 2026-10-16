-- Fix HR policy recursion: use a SECURITY DEFINER function instead of querying profiles directly
create or replace function public.is_hr_user()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.profiles p 
    where p.id = auth.uid() and p.role = 'HR'
  );
end;
$$;

-- Drop the recursive policy
drop policy if exists "profiles_hr_manage" on public.profiles;

-- Recreate with function call (no recursion)
create policy "profiles_hr_manage"
  on public.profiles for all
  to authenticated
  using (public.is_hr_user())
  with check (public.is_hr_user());

grant execute on function public.is_hr_user() to authenticated;