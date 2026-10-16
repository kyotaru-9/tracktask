-- Fix ALL token columns for HR user
update auth.users
set confirmation_token = '',
    email_change = '',
    email_change_token_new = '',
    recovery_token = '',
    encrypted_password = crypt('Tracktask@2026', gen_salt('bf')),
    updated_at = now()
where email = 'hr@city.gov.ph';

-- Verify
select id, email, 
       email_confirmed_at,
       confirmation_token,
       email_change,
       email_change_token_new,
       recovery_token
from auth.users
where lower(email) = lower('hr@city.gov.ph');