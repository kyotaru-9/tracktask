-- Just create the bucket (policies already exist)
insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- Verify bucket exists
select * from storage.buckets where id = 'attachments';