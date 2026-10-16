-- Check if HR user exists in auth
select id, email, email_confirmed_at, encrypted_password
from auth.users
where lower(email) = lower('hr@city.gov.ph');

-- Check if HR profile exists
select * from public.profiles where email = 'hr@city.gov.ph';

-- Check auth.identities for HR
select * from auth.identities where user_id in (
  select id from auth.users where lower(email) = lower('hr@city.gov.ph')
);