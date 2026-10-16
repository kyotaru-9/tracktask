# TrackTask

Document tracking with QR codes, sequential approval routing, and real-time
notifications — built for local government units (City ENRO / SWM workflow).

React 19 + Vite + Supabase (Auth, Postgres, Realtime).

## Roles

| Role | Account | Responsibility |
|---|---|---|
| Mayor | `citymayor@gmail.com` | Creates documents & defines the route; final **Done** |
| City Administrator | `cityadministrator@gmail.com` | Approver |
| City ENRO | `cityenro@gmail.com` | Approver |
| SWM Secretary | `swmsecretary@gmail.com` | Approver |
| Division (×6) | `enro.<division>@gmail.com` | Approver (see below) |

Divisions: Administrative & Permitting (`adminpermitting`), Environmental
Information R&D (`envinfo`), Greening & Forestry (`greening`), Natural
Resources & Safety (`natres`), Pollution Control (`pollution`), Septage
Treatment (`septage`).

**Dev password for all seeded accounts: `Tracktask@2026`**

## Workflow

1. **Create & forward** — the Mayor creates a document and defines the
   approval route (e.g. Mayor → City Administrator → City ENRO → a Division).
   Each office must approve in sequence before it moves on.
2. **Complete** — the final approver clicks *Approve and Mark Complete*.
   The document then **automatically routes back in reverse order**
   (Division → City ENRO → City Administrator → Mayor); each office clicks
   *Receive and Return*.
3. **Done** — when it reaches the Mayor, they click *Mark as Done*.
   Every user who handled or received the document receives a real-time
   notification.

Every document gets a Track ID (`DOC-2026-XXXXXX`) and a QR code; scanning or
entering the ID on the public **/track-documents** page shows live status and
the routing history — no login required.

## Setup

### 1. Database — single run

Supabase Dashboard → SQL Editor → New query → paste and run **one file**:

- `supabase/all-in-one.sql` — everything in one go, no prerequisites:
  tables + RLS + `track_document` RPC + realtime, 10 auth users
  (password `Tracktask@2026`), 10 profiles, 5 demo documents.
  Safe to re-run.

Alternatives: `npm run seed` (same result via anon key, needs
Confirm email OFF), or individual scripts `schema.sql` →
`auth-create.sql` → `auth-users.sql` → `seed-demo.sql`.

### 2. Environment

`.env` already points at the project:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### 3. Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build
npm run lint
```

## Security notes

- Row Level Security is enabled: notifications are private per user;
  documents are readable by staff only; only Mayor-role accounts can create.
- Turn-taking (who may approve) is enforced by the app layer. For hardened
  production use, move `actOnDocument` transitions into a Postgres function
  (`security definer`) so authorization is enforced server-side.
- The anon key is public by design; the public track page only exposes an
  RPC returning minimal status data for one document per query.

Password for all: Tracktask@2026

supabase token: sbp_fc5adea72ade65d044115eb3073b8ee09ee9df5d