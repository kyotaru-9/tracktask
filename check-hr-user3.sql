-- Check auth.users for HR
select id, email, email_confirmed_at, encrypted_password, raw_app_meta_data
from auth.users
where lower(email) = lower('hr@city.gov.ph');