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

### 2026-08-19 — Emergency safety gate logic
**Task:** 3.3
**Owner:** Coding agent
**What changed:** Implemented the calibrated emergency safety gate per PRD Section 8.2. A deterministic rule engine in `src/lib/safetyGate.ts` screens patient symptom text in English and Tagalog against 6 objective clinical emergency criteria (chest pain + dyspnea, chest pain + radiating arm/jaw pain, severe respiratory distress, unilateral stroke symptoms, loss of consciousness/fainting, and severe uncontrolled bleeding). The safety gate runs as a zero-latency pre-check inside `POST /api/match` and short-circuits immediately before any DB taxonomy fetch or Gemini LLM call. Also added `EmergencyResult` to `src/lib/matchApi.ts` types.
**Files touched:**
- `src/lib/safetyGate.ts` [NEW] — deterministic rule engine with bilingual (English & Tagalog) regex patterns for 6 calibrated emergency criteria; strictly avoids triggering on panic tone, punctuation, or all-caps intensity words alone.
- `src/lib/matchApi.ts` [MODIFIED] — added `EmergencyResult = { type: 'emergency'; message: string; matchedCriteria?: string }` to the `MatchApiResult` union.
- `src/app/api/match/route.ts` [MODIFIED] — integrated `checkEmergencySymptoms(symptomText)` right after input validation to short-circuit with a 200 OK `{ type: 'emergency', ... }` response.
**Notes/trade-offs:**
- **Zero latency & 100% deterministic (Assumption 1).** The safety gate does not rely on LLM prompts or network calls, avoiding hallucination, quota latency, and AI outages for critical safety triage.
- **Calibrated against anxiety/panic false positives (Assumption 2).** Purely emotional phrasing like `"I feel like I'm DYING"`, `"worst pain ever"`, or all-caps shouting does not trigger the gate unless an objective combination (e.g. chest pain + shortness of breath) is explicitly present. Anxious patients are safely passed through to regular specialty triage.
- **Calm, non-alarming tone (Assumption 5).** Message is phrased calmly: *"These symptoms can sometimes be serious. Please consider seeking urgent or emergency care."* Task 3.4 will render this interstitial without red flashing alarm UI.
- **Task 3.4 integration seam:** `callMatchApi` now returns `EmergencyResult` alongside `MatchResult` and `ClarifyResult`. The UI in Task 3.4 will branch on `result.type === 'emergency'` to display the emergency interstitial.

### 2026-08-19 — AI symptom → specialty matching API route
**Task:** 3.2
**Owner:** Coding agent
**What changed:** Built `POST /api/match` — the AI pipeline stages 1–3 in a single Gemini API call. The route accepts a patient's free-text symptom description (plus optional demographics and multi-turn conversation history), fetches the live specialty taxonomy from Supabase, builds a constrained system prompt, calls Gemini `gemini-2.0-flash`, and returns one of two response shapes: `{ type: 'match', specialty, sub_specialty, reason }` or `{ type: 'clarify', question }`. Also built `src/lib/matchApi.ts` as the typed client-side helper so Task 3.4 and any future UI component can call the route without knowing its internals.
**Files touched:**
- `src/app/api/match/route.ts` [NEW] — POST Route Handler: validates request body, creates a Supabase service-role client, fetches `specialty_taxonomy` + `specialties` rows to embed in the system prompt, calls Gemini, parses the response, returns structured JSON.
- `src/lib/matchApi.ts` [NEW] — `callMatchApi()` fetch helper + exported types `MatchResult`, `ClarifyResult`, `MatchApiResult`, `MatchApiRequest`.
**Notes/trade-offs:**
- **New package installed: `@google/genai` v2.17.1.** Added to `package.json` + `node_modules`. SDK API verified against `node_modules/@google/genai/dist/genai.d.ts` before writing — `ai.models.generateContent({ model, contents, config: { systemInstruction, temperature } })` with `response.text` is the correct form for this version.
- **Route is unauthenticated (Assumption 9 — known gap, must harden).** The client is already auth-gated by `RequireRole`, but the route itself has no server-side session check. Adding one requires `@supabase/ssr` cookie handling that is not yet wired up. Flag for hardening before public demo — anyone with the URL can call this route. Noted in two places: this entry and the code comment at the top of `route.ts`.
- **Taxonomy fetched at request time from Supabase (Assumption 3).** Service-role key bypasses RLS for this read. Adding a new specialty/sub-specialty to the DB propagates to the AI prompt automatically without a code redeploy. Trade-off: one extra DB round-trip per call (~20–50ms). Negligible at hackathon demo scale.
- **Multi-turn clarification built in (Assumption 7).** Pass `conversationHistory` on follow-up calls. Turn cap at `history.length >= 4` (2 Q&A pairs) — the route injects a "force match" system note so the model can't keep asking questions forever. Frontend multi-turn UX (showing the clarifying question and sending the answer) is Task 3.4's responsibility.
- **Malformed AI response is a graceful fallback, not an error (Assumption 8).** `parseAIResponse()` strips markdown fences then tries `JSON.parse`. If that still fails, the route returns `{ type: 'clarify', question: "We couldn't quite understand..." }` as a 200 (not a 500). Raw AI text is logged server-side for debugging.
- **Temperature set to 0.1.** Low temperature produces more deterministic JSON output. Higher values risk the model adding prose around the JSON, breaking the parser.
- **`onComplete` in `IntakeFlow` is still unwired — Task 3.4 is responsible.** The pattern is documented in `src/lib/matchApi.ts` comments: render `<IntakeFlow onComplete={async (data) => { const result = await callMatchApi({...}); ... }} />`.
- **`conversationHistory` multi-turn UX also belongs to Task 3.4.** The API route handles multi-turn state; the UI for showing a clarifying question and collecting the patient's answer is not built yet.
**ENV VARS — teammates must add before testing:**
```
GEMINI_API_KEY=<from Google AI Studio>
SUPABASE_SERVICE_ROLE_KEY=<from Supabase Dashboard → Project Settings → API>
```
Both are server-only (no `NEXT_PUBLIC_` prefix). `NEXT_PUBLIC_SUPABASE_URL` is already present.


### 2026-08-19 — Patient intake flow (3-step form)
**Task:** 3.1
**Owner:** Coding agent

**What changed:** Built the patient symptom-intake flow at `/patient/intake`. A 3-step form collects patient demographics (name, age, sex, location), HMO selection, and a free-text symptom description, then upserts a `patients` row and hands off the symptom text to a caller-provided `onComplete` hook. The patient dashboard stub card was replaced with a real "Check my symptoms" entry card linking to `/patient/intake`.
**Files touched:**
- `src/components/IntakeFlow.tsx` [NEW] — self-contained `'use client'` component with step state, per-step inline validation, prefill from existing `patients` row on mount, `patients` upsert on submit, optional `onComplete(data)` prop, and a fallback "coming soon" confirmation panel when no prop is passed.
- `src/app/patient/intake/page.tsx` [NEW] — route page; wraps `IntakeFlow` in `RequireRole role="patient"`, matching the doctor profile-setup pattern.
- `src/app/patient/dashboard/page.tsx` [MODIFIED] — replaced the placeholder stub card with a real "Check my symptoms" entry card (`<a href="/patient/intake">`). Header, sign-out button, and `RequireRole` wrapper left untouched.
**Notes/trade-offs:**
- **`onComplete` is currently unused by any caller (Assumption 5 — explicit follow-on needed).** The prop exists so Tasks 3.2 (AI matching API route) and 3.4 (result screen) can wire into this component without touching it again. Until those tasks are built, every submit falls through to the built-in "coming soon" confirmation panel. Task owners for 3.2 and 3.4 **must remember to pass `onComplete` when embedding `IntakeFlow`** — this note is the reminder.
- **"None/Cash" writes `null` to `hmo_provider`, not the string (Assumption 4).** The HMO button group has `value: null` for "None or Cash." The upsert sends `hmo_provider: null`. Task 4.1 (HMO matching) should check for `null` hmo_provider as the "skip HMO matching" signal.
- **Prefill on return visits (Assumption 3).** Steps 1–2 are prefilled from the `patients` row on mount. Step 3 (symptom text) always starts blank — it's visit-specific.
- **Sex and HMO use button groups, not `<select>` (Assumption 6).** Large-tap `<button>` grid with clear selected-state highlight. Easier on touchscreen and less cognitively demanding for less tech-savvy users (PRD 8.7).
- **`patients` RLS verified from migration `0001_initial_schema.sql`.** `patients_insert_own`, `patients_update_own`, and `patients_select_own` are already in place — no new migration needed for this task.
- **No redirect gate on `/patient/dashboard` (Assumption 1).** Intake is not enforced as a pre-condition for viewing the dashboard (unlike the doctor profile gate). The dashboard just surfaces the entry card. This is intentional: a patient returning to check appointment status shouldn't be forced through intake again.
- **No "Booking for a family member" toggle built (Assumption 9 — out of scope).** PRD 8.7 mentions this; Task 5.2 adds it. The flow is self-contained enough that it can be prepended to the front of `IntakeFlow` later without restructuring.


### 2026-08-19 — Doctor appointments dashboard
**Task:** 2.3

**Owner:** Coding agent
**What changed:** Built `AppointmentsDashboard`, the doctor-facing view for managing appointment requests. The component renders above `ScheduleManager` on the doctor dashboard so pending decisions are always the first thing a doctor sees. It has two sections: (1) "Pending appointments" — all pending appointments for the doctor in FIFO order (oldest `created_at` first), each showing patient name/age/sex, symptom summary, and the requested slot date/time/clinic, with Accept and Decline buttons; (2) "Upcoming confirmed appointments" — confirmed appointments with a slot date today-or-later, sorted soonest first, read-only. Realtime subscription on `appointments` filtered by `doctor_id` keeps both lists live without a page refresh.
**Files touched:**
- `src/components/AppointmentsDashboard.tsx` [NEW] — self-contained client component: parallel-fetches pending and confirmed appointments on mount (with joins to `patients` and `schedule_slots → clinics`), optimistic removal on accept/decline, update-guarded write (`.eq('status','pending')`), Supabase Realtime subscription on `postgres_changes` for `appointments` filtered by `doctor_id=eq.<uid>`, loading/error states, and empty states — all matching `ScheduleManager.tsx` in pattern.
- `src/app/doctor/dashboard/page.tsx` [MODIFIED] — imported `AppointmentsDashboard` and rendered it above `<ScheduleManager />` inside the existing `checkingProfile` gate.
**Notes/trade-offs:**
- **Only `appointments.status` is written on accept/decline.** The `trg_sync_slot_status` trigger (from `002_slot_appointment_triggers.sql`) flips `schedule_slots.is_booked` to `'booked'` on confirm and back to `'available'` on decline automatically. Writing to the slot directly from this component would race the trigger and is deliberately avoided (Assumption 3).
- **Update guard against double-click / second-tab race (Assumption 4).** The update is scoped with `.eq('status', 'pending')` so a second action on an already-actioned appointment affects zero rows. Zero rows → treated as "already actioned by someone else" → re-fetch reconciles, no hard error surfaced.
- **Client-side filter for confirmed-upcoming list (Assumption 5).** Supabase embedded-resource filters (filtering on a nested `schedule_slots.date`) filter the nested object *per row*, not which parent rows come back. All confirmed appointments are fetched and filtered/sorted in JS. Acceptable at hackathon demo volume.
- **Realtime uses a full re-fetch on any event (INSERT/UPDATE/DELETE).** The raw `postgres_changes` payload does not include nested join data (`patients`, `schedule_slots`, `clinics`). A per-event partial state merge would require manually reconstructing the join data, which is error-prone. Re-fetching the full appointment list (two parallel queries) on each event is simpler, correct, and negligible at demo scale.
- **Patient context kept minimal per Assumption 6.** Shows `name`, `age`, `sex`, and `symptom_summary` only. `location` and `hmo_provider` are available in the `patients` table and could be a quick follow-on if richer doctor context is wanted.
- **Realtime subscription is a deliberate pull-forward of Task 4.4** (requirement: "new booking correctly and immediately appears in the doctor's pending appointments dashboard"). Flagged here explicitly per Assumption 8.
- **Precondition (Assumption 9):** Migrations `0001_initial_schema.sql` (clinics table, slot_status enum) and `002_slot_appointment_triggers.sql` (trg_sync_slot_status, trg_check_slot_clinic_doctor_match) must be applied to the live Supabase project before testing. The trigger is what makes accept/decline automatically flip the slot status — without it, the appointment status updates but the slot stays in its old state.
- **RLS-tightening TODO still outstanding (Assumption 7 / Tasks 4.2 and 2.3).** `appointments_update_involved` in `0001_initial_schema.sql` allows either the patient or the doctor on the appointment to update the row, with a `TODO` comment to tighten this (patients should only cancel; doctors should only accept/decline/complete). This task now supplies the doctor-side update shape (`status → 'confirmed' | 'declined'`). The tightened policy should be implemented in a follow-up task (originally flagged in the Task 2.1 entry as 4.2, now also touched here as 2.3 scope). **This TODO has now been noted in two build log entries without being resolved — it should be a prioritised item in the next session.**


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
