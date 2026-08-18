# Build Log — Civic Access (Team Liquid)

This file tracks what's actually been built, in plain language, so any teammate can scroll through and understand progress without needing to read code or git commit history. Newest entries go on top.

**This is different from the PRD's Change Log:** the PRD Change Log tracks *decisions* (what we decided to change and why). This file tracks *what was actually built* as a result.

---

## How entries get added

Every build prompt given to a coding agent should end with an instruction like:

> "After completing this, append an entry to `/docs/BUILD_LOG.md` following the format below — what was built, which files were touched, and any decisions or trade-offs made."

The agent adds the entry itself, at the top of the "Entries" section below, following this format:

```
### [Date] — [Short title of what was built]
**Task:** [roadmap task number, e.g. 3.2]
**Owner:** [role or name]
**What changed:** [1-3 sentences, plain language, no jargon — written for someone who didn't watch it get built]
**Files touched:** [list of files/folders]
**Notes/trade-offs:** [anything worth flagging — a shortcut taken, something left for later, a decision made on the fly]
```

If you're building manually (not through an agent), add the same entry yourself when you finish a task.

---

## Entries

### 2026-08-15 — PRD schema rework for multi-clinic support
**Task:** 1.2 (Rework Proposal)
**Owner:** Coding agent
**What changed:** Reworked the database schema to better fit the Philippine medical system. Extracted location and pricing data from the Doctor table into a new `Clinic / Practice Location` table to support multiple hospital affiliations. Updated the Schedule Slot table to link directly to a clinic and replaced the simple boolean booking toggle with a status enum (`available` / `booked` / `doctor_on_leave`) to handle emergency leaves. Added two triggers to keep the new structure consistent: one that syncs a slot's status with its appointment's status (booked/freed automatically on insert, status change, or delete), and one that rejects a slot whose `clinic_id` doesn't belong to its own `doctor_id`.
**Files touched:**
- `supabase/migrations/0001_initial_schema.sql` (reworked: added `clinics` table, added `clinic_id` + `slot_status` enum to `schedule_slots`, removed `rate`/`location` from `doctors`, added clinic RLS policies)
- `supabase/migrations/0002_slot_appointment_triggers.sql` (new: `sync_slot_status` and `check_slot_clinic_doctor_match` triggers)
- `/docs/liquid-prd.md` (schema section updated to match)
**Notes/trade-offs:**
- This normalizes the database and reflects real-world human behavior in the PH, but it means the frontend booking flow will need to expand from two steps to three (Select Doctor ➔ Select Clinic ➔ Select Time Slot).
- The `doctor_on_leave` enum value lets secretaries block out times without deleting slots outright.
- Slot/appointment sync and slot/clinic/doctor consistency are now enforced at the DB level via triggers rather than relying on the app layer to keep them in sync — this closes a gap flagged in the original schema draft.
- Open item: no DB-level guard yet preventing a doctor from double-booking across overlapping time ranges within the same clinic (only exact slot reuse is blocked); worth a follow-up if that turns out to matter for the demo.

### 2026-08-15 — Sign-up / login for patient and doctor roles
**Task:** 1.3
**Owner:** Coding agent
**What changed:** Added Supabase Auth sign-up and login for two roles (`patient` and `doctor`). Each role gets a combined auth page (`/doctor/auth`, `/patient/auth`) with a login/signup toggle rather than two separate routes. After auth succeeds, users are redirected to their own dashboard stub (`/doctor/dashboard`, `/patient/dashboard`). Dashboard pages are protected by a client-side `RequireRole` guard that checks the session and bounces unauthenticated or wrong-role visitors immediately.
**Files touched:**
- `src/lib/auth.ts` [NEW] — `signUpWithRole`, `signIn`, `getRoleFromUser`, `dashboardRouteForRole`, `authRouteForRole` helper functions
- `src/components/AuthForm.tsx` [NEW] — shared email/password form; parent passes `mode` and `role`
- `src/components/RequireRole.tsx` [NEW] — client-side route guard; renders a spinner while checking session, then redirects or renders children
- `src/app/doctor/auth/page.tsx` [NEW] — doctor/secretary auth page (login + signup toggle, indigo accent)
- `src/app/patient/auth/page.tsx` [NEW] — patient auth page (login + signup toggle, teal accent)
- `src/app/doctor/dashboard/page.tsx` [NEW] — doctor dashboard stub, guarded by RequireRole
- `src/app/patient/dashboard/page.tsx` [NEW] — patient dashboard stub, guarded by RequireRole
**Notes/trade-offs:**
- **Role stored in `user_metadata`, not a table column.** `signUp()` sets `options: { data: { role } }` so the role is readable immediately from the session without any DB query. This was necessary because `doctors` rows aren't created until profile setup (Task 2.1) and `patients` rows until the intake flow (Task 3.1) — so right after signup there's no row in either table to infer the role from.
- **No `patients`/`doctors` rows written at signup.** This task only creates the `auth.users` row. Profile rows are created in Tasks 2.1 (doctor) and 3.1 (patient). The dashboard stubs render fine before those rows exist.
- **Route guarding is client-side only.** `RequireRole` calls `supabase.auth.getSession()` in a `useEffect`. This means an unauthenticated user could briefly see the dashboard before the redirect fires (mitigated by rendering a spinner instead of content while the check is in flight). A hardened server-side guard would need `@supabase/ssr` + cookie-based session handling and a `middleware.ts` file — flagged as a "harden later" item if this ever goes to a public URL longer than a demo.
- **One email = one role.** Supabase ties one email/password pair to one `auth.users` row, so the same email can't hold both roles. Testers needing both roles should use two email addresses.
- **Email confirmation is OFF** — must be disabled in Supabase Dashboard → Authentication → Providers → Email. Without this, `signUp()` won't return an active session and the immediate redirect after signup will fail.

### 2026-08-14 — Supabase schema, RLS, and client setup
**Task:** 1.2
**Owner:** Coding agent
**What changed:** Created all six database tables from PRD Section 6 (`specialty_taxonomy`, `patients`, `doctors`, `schedule_slots`, `appointments`, `reviews`) with correct column types, foreign keys, check constraints, and indexes. Enabled Row-Level Security on every table and added a starter policy set. Created the Supabase JS client helper at `src/lib/supabaseClient.ts` (the correct location for the `@/*` alias). Deleted the empty root-level `lib/supabaseClient.ts` placeholder that was there before.
**Files touched:**
- `supabase/migrations/0001_initial_schema.sql` [NEW] — full schema + RLS SQL; paste into Supabase SQL Editor or apply via `supabase db push`
- `src/lib/supabaseClient.ts` [NEW] — Supabase anon-key client, importable as `@/lib/supabaseClient`
- `lib/supabaseClient.ts` + `lib/` directory [DELETED] — replaced by `src/lib/`
**Notes/trade-offs:**
- **`patients`/`doctors` → `auth.users` FK design**: Both tables use `auth.users(id)` as their own primary key (no separate `auth_user_id` column). Role is determined by which table a row exists in. If Task 1.3 creates bare `doctors` rows at signup, `name`/`specialty`/`rate` constraints will need to relax to nullable — that's a PRD Change Log entry.
- **Composite FK `doctors(specialty, sub_specialty)` → `specialty_taxonomy`**: Enforces the taxonomy constraint at the DB level (PRD Section 8.1 assumed it; this makes it explicit). Doctors can't be created with a specialty/sub_specialty pair that isn't in the seeded taxonomy table.
- **`lib/` → `src/lib/` relocation**: `tsconfig.json` maps `@/*` to `./src/*` only. Anything importing `@/lib/supabaseClient` would have silently failed at runtime with the old root-level `lib/`. File is now at `src/lib/supabaseClient.ts`.
- **`appointments_update_involved` RLS policy is intentionally broad** — tighten it in Task 4.2/2.3 once the exact per-role update shapes are known.
- **Review "completed appointment" gate is app-level only** — check `appointment.status === 'completed'` before showing the review form. A DB trigger can enforce this server-side if needed (Task 5.1).
- **No `@supabase/ssr` yet** — the current client is the anon-key browser client. Cookie-based session handling for Server Components / Route Handlers is a Task 1.3 decision.

### [Fill in Day 1] — Repo, PRD, and roadmap committed
**Task:** 1.0
**Owner:** A
**What changed:** Created the GitHub repo, added the PRD, roadmap, and this build log to `/docs`.
**Files touched:** `/docs/liquid-prd.md`, `/docs/liquid-roadmap.md`, `/docs/BUILD_LOG.md`
**Notes/trade-offs:** None.

<!-- New entries go above this line, newest on top -->
