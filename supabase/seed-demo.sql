-- ============================================================================
-- TrackTask — seed-demo.sql
-- Demo documents covering every workflow state. Run AFTER schema.sql +
-- auth-users.sql (it looks up staff UUIDs from public.profiles by email).
--
-- Demo set (all created_by the Mayor):
--   DOC-2026-100001  processing  forward  step 1  Normal    Budget Report
--   DOC-2026-100002  processing  forward  step 2  High      Special Waste Permit
--   DOC-2026-100003  returning   reverse  step 1  Critical  River Cleanup Memo
--   DOC-2026-100004  done        reverse  step 0  Normal    Tree Planting Resolution
--   DOC-2026-100005  rejected    forward  step 1  Low       Old Procurement Request
--
-- Idempotent: deletes these 5 tracking IDs first, then re-inserts.
-- ============================================================================

do $$
declare
  v_mayor      uuid;
  v_admin      uuid;
  v_enro       uuid;
  v_swm        uuid;
  v_div_admin  uuid;
  v_div_green  uuid;
  v_doc        uuid;
begin
  -- Resolve staff IDs (fail loudly if auth-users.sql was not run yet).
  select id into v_mayor     from public.profiles where email = 'citymayor@gmail.com';
  select id into v_admin     from public.profiles where email = 'cityadministrator@gmail.com';
  select id into v_enro      from public.profiles where email = 'cityenro@gmail.com';
  select id into v_swm       from public.profiles where email = 'swmsecretary@gmail.com';
  select id into v_div_admin from public.profiles where email = 'enro.adminpermitting@gmail.com';
  select id into v_div_green from public.profiles where email = 'enro.greening@gmail.com';

  if v_mayor is null or v_admin is null or v_enro is null then
    raise exception 'Staff profiles missing. Run auth-users.sql (after creating auth users) first.';
  end if;

  -- Idempotency: remove previous demo runs.
  delete from public.documents
  where tracking_id in (
    'DOC-2026-100001','DOC-2026-100002','DOC-2026-100003',
    'DOC-2026-100004','DOC-2026-100005'
  );

  -- ── 1. processing / forward / awaiting City Administrator ──────────────
  insert into public.documents
    (tracking_id, title, doc_type, origin, submitted_by, notes, urgency, deadline,
     created_by, status, phase, current_step, created_at)
  values
    ('DOC-2026-100001', 'Q2 Budget Utilization Report', 'Report',
     'Office of the Mayor', 'Juan Dela Cruz',
     'Quarterly budget report routed for sequential approval.',
     'Normal', CURRENT_DATE + 14,
     v_mayor, 'processing', 'forward', 1, now() - interval '3 days')
  returning id into v_doc;

  insert into public.document_steps (document_id, step_order, handler_role, handler_division, status, acted_by, acted_at, comment) values
    (v_doc, 0, 'Mayor', null, 'approved', v_mayor, now() - interval '3 days', 'Submitted for approval.'),
    (v_doc, 1, 'City Administrator', null, 'pending', null, null, null),
    (v_doc, 2, 'City ENRO', null, 'waiting', null, null, null),
    (v_doc, 3, 'Division', 'Administrative and Permitting Division', 'waiting', null, null, null);

  -- ── 2. processing / forward / awaiting City ENRO (High urgency) ────────
  insert into public.documents
    (tracking_id, title, doc_type, origin, submitted_by, notes, urgency, deadline,
     created_by, status, phase, current_step, created_at)
  values
    ('DOC-2026-100002', 'Special Waste Hauling Permit', 'Permit',
     'Office of the Mayor', 'Maria Santos',
     'Urgent hauling permit for coastal barangays.',
     'High', CURRENT_DATE + 3,
     v_mayor, 'processing', 'forward', 2, now() - interval '2 days')
  returning id into v_doc;

  insert into public.document_steps (document_id, step_order, handler_role, handler_division, status, acted_by, acted_at, comment) values
    (v_doc, 0, 'Mayor', null, 'approved', v_mayor, now() - interval '2 days', 'Submitted for approval.'),
    (v_doc, 1, 'City Administrator', null, 'approved', v_admin, now() - interval '1 day', 'Reviewed. Forwarding to ENRO.'),
    (v_doc, 2, 'City ENRO', null, 'pending', null, null, null),
    (v_doc, 3, 'Division', 'Pollution Control and Management Division', 'waiting', null, null, null);

  -- ── 3. returning / reverse / being returned (Critical) ─────────────────
  insert into public.documents
    (tracking_id, title, doc_type, origin, submitted_by, notes, urgency, deadline,
     created_by, status, phase, current_step, created_at)
  values
    ('DOC-2026-100003', 'River Cleanup Drive Memo', 'Memo',
     'Office of the Mayor', 'Jose Rizal',
     'Completed by the division, now routing back in reverse order.',
     'Critical', CURRENT_DATE + 1,
     v_mayor, 'returning', 'reverse', 1, now() - interval '6 days')
  returning id into v_doc;

  insert into public.document_steps (document_id, step_order, handler_role, handler_division, status, acted_by, acted_at, comment) values
    (v_doc, 0, 'Mayor', null, 'pending', null, null, null),
    (v_doc, 1, 'City Administrator', null, 'pending', null, null, null),
    (v_doc, 2, 'City ENRO', null, 'received', v_enro, now() - interval '1 hour', 'Received return. Sending back to Admin.'),
    (v_doc, 3, 'Division', 'City Greening and Forestry Management Division', 'approved', v_div_green, now() - interval '2 hours', 'Cleanup completed. Marking complete.');

  -- ── 4. done / fully returned and closed by the Mayor ───────────────────
  insert into public.documents
    (tracking_id, title, doc_type, origin, submitted_by, notes, urgency, deadline,
     created_by, status, phase, current_step, created_at)
  values
    ('DOC-2026-100004', 'Citywide Tree Planting Resolution', 'Resolution',
     'Office of the Mayor', 'Ana Reyes',
     'Completed full forward + reverse routing. All handlers notified.',
     'Normal', CURRENT_DATE - 1,
     v_mayor, 'done', 'reverse', 0, now() - interval '10 days')
  returning id into v_doc;

  insert into public.document_steps (document_id, step_order, handler_role, handler_division, status, acted_by, acted_at, comment) values
    (v_doc, 0, 'Mayor', null, 'received', v_mayor, now() - interval '1 day', 'Marked as DONE. Thank you all.'),
    (v_doc, 1, 'City Administrator', null, 'received', v_admin, now() - interval '2 days', 'Received and returned.'),
    (v_doc, 2, 'City ENRO', null, 'received', v_enro, now() - interval '3 days', 'Received and returned.'),
    (v_doc, 3, 'Division', 'Administrative and Permitting Division', 'approved', v_div_admin, now() - interval '4 days', 'Approved. Work completed.');

  -- ── 5. rejected at City Administrator ──────────────────────────────────
  insert into public.documents
    (tracking_id, title, doc_type, origin, submitted_by, notes, urgency, deadline,
     created_by, status, phase, current_step, created_at)
  values
    ('DOC-2026-100005', 'Old Procurement Request (Sample Rejected)', 'Budget',
     'Office of the Mayor', 'Pedro Gomez',
     'Sample of a rejected document. Rejection notifies the creator.',
     'Low', CURRENT_DATE + 30,
     v_mayor, 'rejected', 'forward', 1, now() - interval '5 days')
  returning id into v_doc;

  insert into public.document_steps (document_id, step_order, handler_role, handler_division, status, acted_by, acted_at, comment) values
    (v_doc, 0, 'Mayor', null, 'approved', v_mayor, now() - interval '5 days', 'Submitted for approval.'),
    (v_doc, 1, 'City Administrator', null, 'rejected', v_admin, now() - interval '4 days', 'Missing supporting attachments.'),
    (v_doc, 2, 'City ENRO', null, 'waiting', null, null, null);

  raise notice 'Seeded 5 demo documents (DOC-2026-100001 … DOC-2026-100005).';
end
$$;

-- Seed one notification per staff member pointing at the first demo doc,
-- so the Notifications bell is demonstrably working after a fresh install.
-- (Skipped silently if profiles are missing.)
insert into public.notifications (user_id, document_id, message, dot)
select p.id, d.id,
  'Welcome to TrackTask! Document ' || d.tracking_id || ' "' || d.title || '" is in the pipeline.',
  '#2563eb'
from public.profiles p
cross join (select id, tracking_id, title from public.documents where tracking_id = 'DOC-2026-100001') d
where not exists (
  select 1 from public.notifications n
  where n.user_id = p.id and n.document_id = d.id
);
