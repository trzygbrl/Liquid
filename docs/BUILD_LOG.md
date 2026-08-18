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

### 2026-08-18 — Doctor schedule management
**Task:** 2.2
**Owner:** Coding agent
**What changed:** Built the doctor schedule management UI. Doctors can now add available time slots (clinic, date, start/end time), see all upcoming slots grouped by date with status badges, and delete available slots. The dashboard's "Routing & auth stub" placeholder was replaced with the real `ScheduleManager` component.
**Files touched:**
- `src/components/ScheduleManager.tsx` [NEW] — self-contained component: loads the doctor's clinics and upcoming slots on mount, add-slot form with client-side validation, delete button (available slots only), grouped-by-date slot list with status badges, and a Supabase Realtime subscription
- `src/app/doctor/dashboard/page.tsx` [MODIFIED] — imported `ScheduleManager`, replaced the stub placeholder card with `<ScheduleManager />`. Header, sign-out, `RequireRole` wrapper, and `checkingProfile` logic were left untouched.
**Notes/trade-offs:**
- **`clinic_id` is required on every slot insert.** The DB trigger `trg_check_slot_clinic_doctor_match` rejects any slot where `clinic_id.doctor_id ≠ slot.doctor_id`. The form always populates `clinic_id` from the doctor's own clinic list, so this can't misfire through the UI — but the constraint matters if the table is ever written to directly.
- **Booked slots are deliberately non-deletable.** A slot with `is_booked = 'booked'` has a patient attached (via an appointment). The Delete button is hidden on those rows and an informational note is shown instead ("A patient has booked this slot"). Cancellation of booked appointments (which would free the slot back to `available` via the DB trigger) is out of scope here — that's Task 2.3/4.2.
- **Real-time sync uses Supabase Realtime** on `public.schedule_slots` filtered by `doctor_id=eq.<uid>`. INSERT/UPDATE/DELETE events update the local slot state directly without a re-fetch. The channel is cleaned up in the `useEffect` return to prevent leaks on unmount.
- **No slot overlap validation client-side** — intentional. A doctor can legitimately offer overlapping slots at different clinics (different `clinic_id`). The DB has no unique constraint on time ranges.
- **Optimistic local append on insert** — after a successful slot insert, the new row is appended to local state and re-sorted rather than re-fetching the whole list. This keeps the UI snappy.

### 2026-08-18 — Specialty taxonomy seed (re-seed after DB wipe)
**Task:** 1.4
**Owner:** Coding agent
**What changed:** Seeded `public.specialty_taxonomy` and `public.specialties` with the Ophthalmology specialty and its four sub-specialties (Retina, Cataract, Glaucoma, Pediatric Ophthalmology). Also added `General Practice` to `public.specialties`. The database was wiped during a schema rework (adding the `clinics` table and changing `doctors` to drop `rate`/`location`), which cleared the taxonomy rows that had been seeded previously — this is a re-seed, not a first-time seed.
**Files touched:**
- `supabase/seeds/seed_taxonomy_only.sql` [NEW] — standalone re-runnable script that seeds only `specialty_taxonomy` and `specialties`; does not touch `auth.users`, `doctors`, `clinics`, or `schedule_slots`. Safe to paste into the Supabase SQL Editor at any time.
- `supabase/seeds/seed_ophthalmology.sql` — unchanged; still contains the full 8-doctor demo seed (auth users + doctors + clinics + slots) for the Pampanga Ophthalmology demo. Run separately when the full demo accounts are needed.
**Notes/trade-offs:**
- Taxonomy seeding is a manual SQL Editor step (service-role only — the taxonomy tables have no INSERT policy for authenticated users). The `seed_taxonomy_only.sql` script exists specifically so future re-seeds don't require pulling the full doctor seed or remembering the exact SQL.
- `General Practice` is not in `specialty_taxonomy` (by design — it has no sub-specialty rows). It lives only in `specialties`, which is the table the profile-setup form reads for the specialty dropdown's complete list.

### 2026-08-18 — Make `doctors.sub_specialty` nullable (general practitioners)
**Task:** 2.1 (follow-up)
**Owner:** Coding agent
**What changed:** `doctors.sub_specialty` was NOT NULL, which prevented general practitioners (who have no sub-specialty) from creating a profile. This change drops the NOT NULL constraint, adds a `public.specialties` lookup table to preserve specialty-level validation, and updates the Task 2.1 profile-setup form so the sub-specialty field is hidden when the selected specialty has no taxonomy entries (e.g. "General Practice") and `sub_specialty = NULL` is submitted to the database.
**Files touched:**
- `supabase/migrations/0003_nullable_subspecialty.sql` [NEW] — drops NOT NULL on `sub_specialty`; creates `public.specialties` table (backfilled from `specialty_taxonomy` + `'General Practice'` row); adds `doctors_specialty_fk` FK from `doctors.specialty` to `specialties.specialty`; RLS policy on `specialties`
- `docs/liquid-prd.md` [MODIFIED] — Change Log row added; Section 6 Doctor model updated to mark `sub_specialty` as nullable with explanation; Section 8.5 general-practice note added
- `src/app/doctor/profile-setup/page.tsx` [MODIFIED] — `'General Practice'` prepended to specialty list; `isGeneralPractice` derived from whether taxonomy has sub-entries for the selected specialty; sub-specialty field conditionally rendered (hidden when `isGeneralPractice`); form validation updated to not require sub-specialty for general practitioners; upsert sends `sub_specialty: subSpecialty || null` (never an empty string)
- `docs/BUILD_LOG.md` [MODIFIED] — this entry
**Notes/trade-offs:**
- **Design decision — `public.specialties` table (not a trigger):** The existing composite FK `doctors(specialty, sub_specialty) → specialty_taxonomy` uses Postgres MATCH SIMPLE: it skips validation entirely when `sub_specialty` is NULL. Simply dropping NOT NULL would have left `specialty` unvalidated for general-practice doctors. Two options were considered: (a) a `BEFORE INSERT/UPDATE` trigger that checks `specialty` against `specialty_taxonomy` when `sub_specialty IS NULL`, or (b) a small `public.specialties` lookup table with a second FK. Option (b) was chosen because it's fully declarative — no trigger code to maintain — and incurs negligible overhead. The team should be aware of this and can revisit (switch to a trigger approach) if the separate `specialties` table feels like extra schema weight post-hackathon.
- **`'General Practice'` hardcoded in `specialties`:** The label is inserted explicitly in the migration (not derived from taxonomy). If the team later changes the label (e.g. to "Family Medicine"), both the migration and the `specialties` list in `page.tsx` need updating.
- **`isGeneralPractice` is taxonomy-driven, not string-matched:** The form hides sub-specialty whenever the selected specialty has zero taxonomy entries — so any future specialty added to `public.specialties` but not to `specialty_taxonomy` will automatically behave like "General Practice" without code changes.
- **Seed data TODO:** Any future seed rework should include at least one general-practice doctor with `sub_specialty = NULL` to exercise this path in the demo.
- **Migration not applied automatically:** Per the build brief, Zin will apply `0003_nullable_subspecialty.sql` manually via the Supabase SQL Editor. Do not run `supabase db push` against the live project.

### 2026-08-18 — Task 2.1 rework: doctor profile setup updated for multi-clinic schema
**Task:** 2.1 (Rework — supersedes the 2026-08-15 entry below)
**Owner:** Coding agent
**What changed:** The original Task 2.1 build (2026-08-15) wrote `rate` and `location` directly into the `doctors` table. Those columns no longer exist after the 2026-08-15 schema rework that extracted them into the new `clinics` table. This rework rewrites both frontend files against the updated schema. The profile setup form now collects two logical entities: doctor details (name, credentials, specialty, sub_specialty) and first-clinic details (clinic name, room details, location, consultation_fee). These are written as two sequential Supabase calls — an `upsert` into `doctors` followed by an `insert` into `clinics`. The dashboard gate was also updated so that "profile complete" now means a `doctors` row *and* at least one `clinics` row both exist; a doctor with only a `doctors` row (partial-failure state) is redirected back to the setup page, which pre-fills their already-saved doctor data so they don't have to retype it.
**Files touched:**
- `src/app/doctor/profile-setup/page.tsx` [MODIFIED] — removed `rate`/`location` fields; added `clinicName`, `roomDetails`, `clinicLocation`, `consultationFee` fields; changed insert to a `doctors` upsert + `clinics` insert; added partial-failure pre-fill logic on load
- `src/app/doctor/dashboard/page.tsx` [MODIFIED] — `checkProfile` now also queries `clinics` for at least one row; redirects to setup if either the `doctors` row or any `clinics` row is missing
**Notes/trade-offs:**
- **`upsert` on `doctors`, not `insert`**: If a prior submission saved the doctor row but the clinic insert failed (no cross-table transaction in the Supabase JS client), resubmitting would have thrown a duplicate-key error with a plain `insert`. `upsert` keyed on `id` makes re-submission safe.
- **Two-step write, no transaction**: If the `doctors` upsert succeeds but the `clinics` insert fails, the user is shown an error message telling them their profile was saved but the clinic wasn't, and asking them to submit again. On re-submit the upsert silently overwrites the `doctors` row and the `clinics` insert is retried. This is the agreed recovery path per the design doc (design decision #2).
- **One clinic at setup only**: The multi-clinic schema supports many clinics per doctor, but collecting a *second* clinic post-onboarding is explicitly out of scope for this task and has no assigned roadmap task yet — flagged for the team to pick up.
- **HMO accreditations still not collected here**: unchanged from original Task 2.1 scope; still seeded via Task 1.4.

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

### 2026-08-15 — Doctor profile setup form
**Task:** 2.1
**Owner:** Coding agent
**What changed:** Built the doctor profile-setup page at `/doctor/profile-setup`. The form collects full name, credential filename (placeholder only — no file storage), specialty, sub-specialty (filtered by selected specialty from `specialty_taxonomy`), consultation rate in PHP, and clinic location. On submit it inserts a row into `public.doctors` with `id = auth.uid()` (required by the `doctors_insert_own` RLS policy) and redirects to `/doctor/dashboard`. Updated `/doctor/dashboard` to check for an existing `doctors` row on mount and redirect to profile setup if none exists, closing the gap where a newly-signed-up doctor would land on the dashboard with no profile row yet.
**Files touched:**
- `src/app/doctor/profile-setup/page.tsx` [NEW] — full profile setup form; guarded by `RequireRole`, skips itself if a profile already exists, validates specialty/sub-specialty pairing against `specialty_taxonomy` rows fetched from DB
- `src/app/doctor/dashboard/page.tsx` [MODIFIED] — added `checkProfile` effect that redirects to `/doctor/profile-setup` when no `doctors` row exists; dashboard content only renders after that check passes; spinner shown during the async check
**Notes/trade-offs:**
- **Create-only, not an edit screen.** If a `doctors` row already exists when the page loads, it redirects immediately to the dashboard. Editing an existing profile is out of scope for this task.
- **`id` set explicitly from session.** `doctors.id` has no default and RLS requires `auth.uid() = id` — the insert explicitly sets `id: session.user.id`. If the session expired between page load and submit, the error is caught and surfaced to the user.
- **HMO accreditations not collected here.** The form doesn't include an HMO field — the `hmo_accreditations text[]` column defaults to `{}`. Per the task brief, accreditations are populated via the seed process (Task 1.4) for MVP. A doctor signing up live gets an empty array until that data is seeded separately.
- **Credential field is filename-only.** No actual file upload wiring. The UI makes this explicit with a disclaimer line under the file picker.
- **Taxonomy must be seeded** for the specialty dropdowns to have any options. If `specialty_taxonomy` is empty, the page shows an amber warning and the form can't be meaningfully submitted.

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
