-- Check all token columns for HR user
select id, email, 
       email_confirmed_at,
       confirmation_token,
       email_change,
       email_change_token_new,
       recovery_token,
       encrypted_password
from auth.users
where lower(email) = lower('hr@city.gov.ph');

-- Also check other users to see the pattern
select email, 
       confirmation_token,
       email_change,
       email_change_token_new,
       recovery_token
from auth.users
where email like '%@city.gov.ph' or email like '%@gmail.com'
limit 5;