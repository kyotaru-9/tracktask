-- Check auth.users for HR
select id, email, email_confirmed_at, encrypted_password, raw_app_meta_data
from auth.users
where lower(email) = lower('hr@city.gov.ph');

-- Check profile
select * from public.profiles where email = 'hr@city.gov.ph';