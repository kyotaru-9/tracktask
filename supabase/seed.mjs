// ============================================================================
// TrackTask — supabase/seed.mjs
// Working seeder that uses ONLY the public anon key (no service_role needed).
//
// What it does:
//   1. signUp (or signIn if already registered) all 10 staff accounts
//   2. Upserts public.profiles rows linked to the real auth.users UUIDs
//   3. Inserts 5 demo documents + steps + welcome notifications as the Mayor
//
// Usage:
//   npm install
//   node supabase/seed.mjs
//
// Requires .env with VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.
// IMPORTANT: in Supabase Dashboard → Authentication → Sign In / Sign Ups,
//   turn OFF "Confirm email" (or enable Auto Confirm) so signUp returns a
//   session immediately. Otherwise create users manually in the Dashboard and
//   run supabase/auth-users.sql + supabase/seed-demo.sql instead.
// ============================================================================
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// --- Load .env (minimal parser, no dependency) ---
function loadDotEnv(path = '.env') {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, k, v] = m;
    if (!(k in process.env)) process.env[k] = v.replace(/^["']|["']$/g, '');
  }
}
loadDotEnv();

const URL = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
if (!URL || !ANON) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const PASSWORD = 'Tracktask@2026';

const STAFF = [
  { email: 'citymayor@gmail.com',            full_name: 'Hon. City Mayor',                   role: 'Mayor',              division: null },
  { email: 'cityadministrator@gmail.com',    full_name: 'City Administrator',                role: 'City Administrator', division: null },
  { email: 'cityenro@gmail.com',             full_name: 'City ENRO Officer',                 role: 'City ENRO',          division: null },
  { email: 'swmsecretary@gmail.com',         full_name: 'SWM Secretary',                     role: 'SWM Secretary',      division: null },
  { email: 'enro.adminpermitting@gmail.com', full_name: 'Admin & Permitting Division Chief', role: 'Division',           division: 'Administrative and Permitting Division' },
  { email: 'enro.envinfo@gmail.com',         full_name: 'Env Info R&D Division Chief',       role: 'Division',           division: 'Environmental Information, Research and Development Division' },
  { email: 'enro.greening@gmail.com',        full_name: 'Greening & Forestry Division Chief',role: 'Division',           division: 'City Greening and Forestry Management Division' },
  { email: 'enro.natres@gmail.com',          full_name: 'NatRes & Safety Division Chief',    role: 'Division',           division: 'Natural Resources Management and Safety Division' },
  { email: 'enro.pollution@gmail.com',       full_name: 'Pollution Control Division Chief',  role: 'Division',           division: 'Pollution Control and Management Division' },
  { email: 'enro.septage@gmail.com',         full_name: 'Septage Treatment Division Chief',  role: 'Division',           division: 'Septage Treatment and Management Division' },
];

const anon = createClient(URL, ANON);

// Sign up, falling back to sign-in when the address is already registered.
async function ensureUser(email) {
  const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
  if (!error && data.user) return data.user;

  const msg = (error?.message || '').toLowerCase();
  if (msg.includes('already registered') || msg.includes('already exists')) {
    const { data: s, error: e2 } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
    if (e2) throw new Error(`${email}: sign-in failed: ${e2.message}`);
    return s.user;
  }
  // Email-confirmation ON: signUp succeeds but returns no session. Try sign-in.
  if (!data.session) {
    const { data: s, error: e2 } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
    if (!e2 && s.user) return s.user;
  }
  if (error) throw new Error(`${email}: ${error.message}`);
  if (!data.user) throw new Error(`${email}: no user returned (is "Confirm email" ON? Turn it OFF or pre-create users in the Dashboard.)`);
  return data.user;
}

const ids = {}; // email -> uuid
console.log('1/3  Creating / signing in 10 staff accounts…');
for (const s of STAFF) {
  const u = await ensureUser(s.email);
  ids[s.email] = u.id;
  console.log(`  ✓ ${s.email}  (${u.id.slice(0, 8)}…)`);
}

// Authenticated client as the Mayor (only Mayor can INSERT documents per RLS).
const mayor = createClient(URL, ANON);
{
  const { error } = await mayor.auth.signInWithPassword({
    email: 'citymayor@gmail.com', password: PASSWORD,
  });
  if (error) throw new Error('Mayor sign-in failed: ' + error.message);
}

console.log('2/3  Upserting profiles…');
for (const s of STAFF) {
  const { error } = await mayor.from('profiles').upsert(
    { id: ids[s.email], email: s.email, full_name: s.full_name, role: s.role, division: s.division },
    { onConflict: 'id' },
  );
  if (error) throw new Error(`profile ${s.email}: ${error.message}`);
}
console.log('  ✓ 10 profiles linked to auth.users');

console.log('3/3  Seeding demo documents…');
const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const DEMOS = [
  {
    tracking_id: 'DOC-2026-100001', title: 'Q2 Budget Utilization Report', doc_type: 'Report',
    origin: 'Office of the Mayor', submitted_by: 'Juan Dela Cruz',
    notes: 'Quarterly budget report routed for sequential approval.',
    urgency: 'Normal', deadline: daysFromNow(14), status: 'processing', phase: 'forward', current_step: 1,
    steps: [
      { o: 0, role: 'Mayor', div: null, st: 'approved', by: 'citymayor@gmail.com', c: 'Submitted for approval.' },
      { o: 1, role: 'City Administrator', div: null, st: 'pending' },
      { o: 2, role: 'City ENRO', div: null, st: 'waiting' },
      { o: 3, role: 'Division', div: 'Administrative and Permitting Division', st: 'waiting' },
    ],
  },
  {
    tracking_id: 'DOC-2026-100002', title: 'Special Waste Hauling Permit', doc_type: 'Permit',
    origin: 'Office of the Mayor', submitted_by: 'Maria Santos',
    notes: 'Urgent hauling permit for coastal barangays.',
    urgency: 'High', deadline: daysFromNow(3), status: 'processing', phase: 'forward', current_step: 2,
    steps: [
      { o: 0, role: 'Mayor', div: null, st: 'approved', by: 'citymayor@gmail.com', c: 'Submitted for approval.' },
      { o: 1, role: 'City Administrator', div: null, st: 'approved', by: 'cityadministrator@gmail.com', c: 'Reviewed. Forwarding to ENRO.' },
      { o: 2, role: 'City ENRO', div: null, st: 'pending' },
      { o: 3, role: 'Division', div: 'Pollution Control and Management Division', st: 'waiting' },
    ],
  },
  {
    tracking_id: 'DOC-2026-100003', title: 'River Cleanup Drive Memo', doc_type: 'Memo',
    origin: 'Office of the Mayor', submitted_by: 'Jose Rizal',
    notes: 'Completed by the division, now routing back in reverse order.',
    urgency: 'Critical', deadline: daysFromNow(1), status: 'returning', phase: 'reverse', current_step: 1,
    steps: [
      { o: 0, role: 'Mayor', div: null, st: 'pending' },
      { o: 1, role: 'City Administrator', div: null, st: 'pending' },
      { o: 2, role: 'City ENRO', div: null, st: 'received', by: 'cityenro@gmail.com', c: 'Received return. Sending back to Admin.' },
      { o: 3, role: 'Division', div: 'City Greening and Forestry Management Division', st: 'approved', by: 'enro.greening@gmail.com', c: 'Cleanup completed. Marking complete.' },
    ],
  },
  {
    tracking_id: 'DOC-2026-100004', title: 'Citywide Tree Planting Resolution', doc_type: 'Resolution',
    origin: 'Office of the Mayor', submitted_by: 'Ana Reyes',
    notes: 'Completed full forward + reverse routing. All handlers notified.',
    urgency: 'Normal', deadline: daysFromNow(-1), status: 'done', phase: 'reverse', current_step: 0,
    steps: [
      { o: 0, role: 'Mayor', div: null, st: 'received', by: 'citymayor@gmail.com', c: 'Marked as DONE. Thank you all.' },
      { o: 1, role: 'City Administrator', div: null, st: 'received', by: 'cityadministrator@gmail.com', c: 'Received and returned.' },
      { o: 2, role: 'City ENRO', div: null, st: 'received', by: 'cityenro@gmail.com', c: 'Received and returned.' },
      { o: 3, role: 'Division', div: 'Administrative and Permitting Division', st: 'approved', by: 'enro.adminpermitting@gmail.com', c: 'Approved. Work completed.' },
    ],
  },
  {
    tracking_id: 'DOC-2026-100005', title: 'Old Procurement Request (Sample Rejected)', doc_type: 'Budget',
    origin: 'Office of the Mayor', submitted_by: 'Pedro Gomez',
    notes: 'Sample of a rejected document. Rejection notifies the creator.',
    urgency: 'Low', deadline: daysFromNow(30), status: 'rejected', phase: 'forward', current_step: 1,
    steps: [
      { o: 0, role: 'Mayor', div: null, st: 'approved', by: 'citymayor@gmail.com', c: 'Submitted for approval.' },
      { o: 1, role: 'City Administrator', div: null, st: 'rejected', by: 'cityadministrator@gmail.com', c: 'Missing supporting attachments.' },
      { o: 2, role: 'City ENRO', div: null, st: 'waiting' },
    ],
  },
];

for (const d of DEMOS) {
  const { data: existing } = await mayor.from('documents').select('id').eq('tracking_id', d.tracking_id).maybeSingle();
  let docId = existing?.id;
  if (!docId) {
    const { data, error } = await mayor.from('documents').insert({
      tracking_id: d.tracking_id, title: d.title, doc_type: d.doc_type,
      origin: d.origin, submitted_by: d.submitted_by, notes: d.notes,
      urgency: d.urgency, deadline: d.deadline, created_by: ids['citymayor@gmail.com'],
      status: d.status, phase: d.phase, current_step: d.current_step,
    }).select('id').single();
    if (error) throw new Error(`${d.tracking_id}: ${error.message}`);
    docId = data.id;
    const payload = d.steps.map((s) => ({
      document_id: docId, step_order: s.o,
      handler_role: s.role, handler_division: s.div || null, status: s.st,
      comment: s.c || null,
      acted_by: s.by ? ids[s.by] : null,
      acted_at: s.by ? new Date().toISOString() : null,
    }));
    const { error: e2 } = await mayor.from('document_steps').insert(payload);
    if (e2) throw new Error(`${d.tracking_id} steps: ${e2.message}`);
    console.log(`  + ${d.tracking_id}  ${d.title}`);
  } else {
    console.log(`  = ${d.tracking_id} already exists, skipped`);
  }

  // Welcome notification for every staff member (once per doc).
  const { data: profs } = await mayor.from('profiles').select('id');
  const rows = (profs || [])
    .filter((p) => p.id !== ids['citymayor@gmail.com']);
  for (const p of rows) {
    const { data: n } = await mayor.from('notifications')
      .select('id').eq('user_id', p.id).eq('document_id', docId).limit(1);
    if (!n?.length) {
      await mayor.from('notifications').insert({
        user_id: p.id, document_id: docId,
        message: `Document ${d.tracking_id} "${d.title}" is in the pipeline.`,
        dot: '#2563eb',
      });
    }
  }
}

console.log('\nDone. Log in with any staff email + password Tracktask@2026');
console.log('Public tracking: /track-documents?id=DOC-2026-100001');
