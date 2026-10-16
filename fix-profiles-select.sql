-- Verify current profiles and policies
select * from public.profiles order by email;

-- Check if the auth user exists
select id, email, email_confirmed_at from auth.users where email = 'citymayor@gmail.com';

-- Check current policies on profiles
select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where tablename = 'profiles';

-- Recreate the SELECT policy (allows all authenticated users to read all profiles)
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- Also ensure INSERT policy exists for profile creation
drop policy if exists "profiles_insert_authenticated" on public.profiles;
create policy "profiles_insert_authenticated"
  on public.profiles for insert
  to authenticated
  with check (true);

-- Verify the Mayor profile exists
select * from public.profiles where email = 'citymayor@gmail.com';