-- ============================================================================
-- TrackTask — auth-create.sql (used by all-in-one.sql single-run)
-- Creates the 10 login accounts directly in auth.users + auth.identities.
--
-- Dev password for all: Tracktask@2026
-- Idempotent: safe to re-run (skips existing emails, repairs missing
-- identities, resets password to the dev password so logins always work).
--
-- If your project blocks writes to the auth schema, this raises a NOTICE
-- instead of failing — create the users in Dashboard → Authentication →
-- Users (Auto Confirm ON) and re-run supabase/auth-users.sql.
-- ============================================================================

create extension if not exists "pgcrypto";

do $$
declare
  v_instance uuid := '00000000-0000-0000-0000-000000000000';
  v_tmp uuid;
  v_pw text := 'Tracktask@2026';
  r record;
  v_user_id uuid;
  v_has_id boolean := false;
  v_has_provider_id boolean := false;
  v_has_email_col boolean := false;
begin
  -- Prefer the project's real instance id when available.
  begin
    select id into v_tmp from auth.instances limit 1;
    if v_tmp is not null then v_instance := v_tmp; end if;
  exception when undefined_table then
    -- keep all-zero fallback
  end;

  -- Detect auth.identities shape (column set changed across GoTrue versions).
  begin
    select exists(
      select 1 from information_schema.columns
      where table_schema = 'auth' and table_name = 'identities' and column_name = 'id'
    ) into v_has_id;
    select exists(
      select 1 from information_schema.columns
      where table_schema = 'auth' and table_name = 'identities' and column_name = 'provider_id'
    ) into v_has_provider_id;
    select exists(
      select 1 from information_schema.columns
      where table_schema = 'auth' and table_name = 'identities' and column_name = 'email'
    ) into v_has_email_col;
  exception when others then
    raise notice 'Could not inspect auth.identities: %', SQLERRM;
  end;

  for r in
    select * from (values
      ('citymayor@gmail.com',            'Hon. City Mayor'),
      ('cityadministrator@gmail.com',    'City Administrator'),
      ('cityenro@gmail.com',             'City ENRO Officer'),
      ('swmsecretary@gmail.com',         'SWM Secretary'),
      ('enro.adminpermitting@gmail.com', 'Admin & Permitting Division Chief'),
      ('enro.envinfo@gmail.com',         'Env Info R&D Division Chief'),
      ('enro.greening@gmail.com',        'Greening & Forestry Division Chief'),
      ('enro.natres@gmail.com',          'NatRes & Safety Division Chief'),
      ('enro.pollution@gmail.com',       'Pollution Control Division Chief'),
      ('enro.septage@gmail.com',         'Septage Treatment Division Chief')
    ) as s(email, full_name)
  loop
    -- 1. auth.users row (create or repair password/confirmation).
    begin
      select id into v_user_id from auth.users where lower(email) = lower(r.email);
      if v_user_id is null then
        v_user_id := gen_random_uuid();
        insert into auth.users (
          instance_id, id, aud, role, email,
          encrypted_password, email_confirmed_at,
          confirmation_token, email_change, email_change_token_new, recovery_token,
          raw_app_meta_data, raw_user_meta_data,
          created_at, updated_at
        ) values (
          v_instance, v_user_id, 'authenticated', 'authenticated', r.email,
          crypt(v_pw, gen_salt('bf')), now(),
          '', '', '', '',
          '{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object('full_name', r.full_name),
          now(), now()
        );
      else
        update auth.users set
          encrypted_password = crypt(v_pw, gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
          updated_at = now()
        where id = v_user_id;
      end if;
    exception when others then
      raise notice 'Could not create auth user %: %. Create it in Authentication → Users instead.', r.email, SQLERRM;
      continue;
    end;

    -- 2. Companion auth.identities row (required for email/password sign-in).
    begin
      if not exists (
        select 1 from auth.identities where user_id = v_user_id and provider = 'email'
      ) then
        if v_has_id and v_has_provider_id and v_has_email_col then
          execute
            'insert into auth.identities (id, user_id, provider, provider_id, identity_data, email, last_sign_in_at, created_at, updated_at)
             values (gen_random_uuid(), $1, ''email'', $2, $3, $4, now(), now(), now()) on conflict do nothing'
            using v_user_id, v_user_id::text,
                  jsonb_build_object('sub', v_user_id::text, 'email', r.email),
                  r.email;
        elsif v_has_id and v_has_provider_id then
          execute
            'insert into auth.identities (id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at)
             values (gen_random_uuid(), $1, ''email'', $2, $3, now(), now(), now()) on conflict do nothing'
            using v_user_id, v_user_id::text,
                  jsonb_build_object('sub', v_user_id::text, 'email', r.email);
        elsif v_has_provider_id then
          execute
            'insert into auth.identities (user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at)
             values ($1, ''email'', $2, $3, now(), now(), now()) on conflict do nothing'
            using v_user_id, v_user_id::text,
                  jsonb_build_object('sub', v_user_id::text, 'email', r.email);
        else
          -- Legacy GoTrue shape (pre-Nov-2023): no provider_id column.
          execute
            'insert into auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
             values ($1, $1, $2, ''email'', now(), now(), now()) on conflict do nothing'
            using v_user_id,
                  format('{"sub":"%s","email":"%s"}', v_user_id::text, r.email)::jsonb;
        end if;
      end if;
    exception when others then
      raise notice 'Could not create auth identity for %: %', r.email, SQLERRM;
    end;
  end loop;

  raise notice 'Auth users ensured (10 staff). Password for all: Tracktask@2026';
end
$$;
