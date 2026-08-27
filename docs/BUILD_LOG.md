# Build Log: Civic Access (Team Liquid)

This file tracks what's actually been built, in plain language, so any teammate can scroll through and understand progress without needing to read code or git commit history. Newest entries go on top.

**This is different from the PRD's Change Log:** the PRD Change Log tracks *decisions* (what we decided to change and why). This file tracks *what was actually built* as a result.

---

## How entries get added

Every build prompt given to a coding agent should end with an instruction like:

> "After completing this, append an entry to `/docs/BUILD_LOG.md` following the format below. What was built, which files were touched, and any decisions or trade-offs made."

The agent adds the entry itself, at the top of the "Entries" section below, following this format:

```
### [Date]: [Short title of what was built]
**Task:** [roadmap task number, e.g. 3.2]
**Owner:** [role or name]
**What changed:** [1-3 sentences, plain language, no jargon, written for someone who didn't watch it get built]
**Files touched:** [list of files/folders]
**Notes/trade-offs:** [anything worth flagging, a shortcut taken, something left for later, a decision made on the fly]
```

If you're building manually (not through an agent), add the same entry yourself when you finish a task.

---

## Entries

### 2026-08-26: Doctor-in-the-Loop (HITL) Specialty Verification & Patient Re-referral System
**Task:** Human-in-the-Loop (HITL) Clinical Safeguard & Specialist Re-referral
**Owner:** Coding agent
**What changed:** Implemented a Doctor-in-the-Loop (HITL) clinical verification system to ensure patient referrals are validated by licensed physicians before confirmation, providing a vital human safeguard over AI triage recommendations:
1. **AI Recommendation & Intake Context Persistence:** When a patient completes intake and books a doctor, `ai_recommended_specialty` and `ai_recommended_sub_specialty` are persisted directly into `public.appointments` alongside the patient's symptoms.
2. **Comprehensive Doctor Review Card (`AppointmentsDashboard.tsx`):** In the doctor's pending consultation request queue, doctors now review the patient's full demographic profile (Age, Sex, Location, HMO Provider), reported symptoms in full, and a badge highlighting the AI's triage recommendation.
3. **General Decline Flow with Optional Re-referral:** Replaced specific re-referral action buttons with a clean universal "Decline" button. Inside the decline panel, a clear explanation is always strictly mandatory regardless of reason. If the decline is due to a specialty mismatch, the doctor checks "Re-refer patient to another specialist (Doctor-in-the-Loop)", which then requires selecting the recommended medical specialty from the taxonomy.
4. **Patient Notification & 1-Click Re-routing (`/patient/dashboard`):** Patients with reassigned appointments are greeted with a prominent Doctor Review card displaying the reviewing physician's name, clinical explanation note, and recommended specialty, accompanied by a 1-click CTA button (`Find [Recommended Specialty] Doctors`) that pre-filters matching specialists while preserving symptoms.
5. **Outline Clipart Replacement for Emojis & UI Streamlining:** Replaced platform emojis across pending requests and patient reassignment cards with cohesive monochrome SVG outline icons. Streamlined patient demographic chips by keeping the HMO provider pill as text-only and removing the redundant "Pending Review" pill (as all items in this section are pending review).
**Files touched:**
- `supabase/migrations/0009_doctor_in_the_loop_specialty_reassignment.sql` [NEW] — added `ai_recommended_specialty`, `ai_recommended_sub_specialty`, `doctor_recommended_specialty`, `doctor_recommended_sub_specialty`, and `reassigned_by_doctor` columns with index.
- `src/components/Icons.tsx` [MODIFIED] — added outline icons `IconMapPin`, `IconSparkles`, `IconFileText`, `IconClock`, `IconUser`.
- `src/components/MatchResultView.tsx` [MODIFIED] — forwarded patient symptoms in `findDoctorsUrl`.
- `src/app/patient/doctors/page.tsx` [MODIFIED] — forwarded `specialty`, `sub_specialty`, and `symptoms` into doctor booking profile links.
- `src/app/patient/doctors/[id]/page.tsx` [MODIFIED] — pre-filled `symptomSummary` and persisted `ai_recommended_specialty` and `ai_recommended_sub_specialty` with defensive fallback.
- `src/components/AppointmentsDashboard.tsx` [MODIFIED] — loaded patient profile and AI triage recommendation, implemented Doctor-in-the-Loop re-referral panel with 33 specialties taxonomy select, clinical rationale validation, and replaced emojis with outline cliparts.
- `src/app/patient/dashboard/page.tsx` [MODIFIED] — rendered Doctor-in-the-Loop specialty reassignment card with physician explanation, 1-click re-booking CTA, and outline clipart icon.
- `docs/BUILD_LOG.md` [MODIFIED] — documented implementation details.
**Notes/trade-offs:**
- **Double safety net for database backwards-compatibility:** All reads and writes to `appointments` include automatic schema fallback handling (`Postgres 42703 / undefined_column`) so that the application functions seamlessly even before migration 0009 is applied on a remote database.
- **Mandatory physician guidance prevents patient drop-off:** Rather than simply rejecting patients, doctors actively guide misdirected patients to the right medical specialist with clinical rationale.
### 2026-08-26: Mobile responsiveness pass across the patient portal
**Task:** none (iterative UI polish per direct instruction, not a numbered roadmap task)
**Owner:** Coding agent
**What changed:** Reworked the patient-facing screens for phones and tablets, replacing the old collapsed-link header with a fixed bottom icon nav, and rebuilding doctor-card lists (dashboard, directory, doctor profile) into a consistent avatar/name/status/specialty/date-time/location layout tuned across breakpoints through direct back-and-forth feedback rather than a fixed spec.
- **Bottom icon navigation (`src/components/BottomNavBar.tsx`, `src/components/Navbar.tsx`, `src/app/page.tsx`, `src/app/patient/layout.tsx`, `src/app/doctor/layout.tsx`):** New fixed bottom tab bar (icon + label) replaces the old horizontally-scrolling link strip on phones/tablets, switching to the desktop header nav at the `lg` breakpoint (1024px, not the usual `md`) so it stays visible through tablet widths. Layouts gained `pb-14 lg:pb-0` so page content clears the fixed bar. Added `IconHome` to `src/components/Icons.tsx` for the Dashboard tab.
- **Home page (`src/app/page.tsx`):** Bottom nav wired in for signed-out visitors; header padding/logo/CTA sizing tightened for phones; "Browse the directory" / "Create an account" buttons now share the row instead of wrapping.
- **Doctor-card list format (`src/app/patient/dashboard/page.tsx`, `src/app/patient/doctors/page.tsx`, `src/app/patient/doctors/[id]/page.tsx`):** Standardized doctor cards to avatar (2x text size) + name/status stacked, with specialty, date/time, and clinic/hospital name as their own lines below (no longer indented under the avatar). Directory's clinic/hospital box is now tap-anywhere to expand/collapse other locations (chevron indicator) instead of requiring a separate button tap. Doctor profile's "Verified Medical License" badge shortened to "Verified". Dashboard's "At a glance" card was reordered ahead of the consultations list on mobile; a font-size hierarchy was set across the consultations title / doctor-card content / "At a glance" and "Quick actions" titles / their body content, each with its own mobile-to-desktop scale. Both list pages ultimately needed real 3-step responsive type scales (phone / `md` / `lg`) rather than the dashboard's flatter sizing, after the flat version tested too big on phones and too small on desktop.
- **Intake flow (`src/app/patient/intake/page.tsx`, `src/components/IntakeFlow.tsx`):** Dropped the "Dashboard - AI Clinical Triage" breadcrumb. Text inputs/textarea got tighter mobile padding and font size, restored at `sm:`. The HMO option grid now puts "None or Cash" on its own full-width row below a 2-per-row (widening to 4 at `sm:`) grid of the named HMOs.
- **Directory search/filter bar (`src/components/DoctorFilterPanel.tsx`):** The "Filters" button and "Sort" control now stretch to fill their row edge-to-edge on mobile (matching the search bar's full width above them) instead of sitting compact and left-aligned.
- **Booking confirmation page (`src/app/patient/appointments/[id]/confirmation/page.tsx`):** Compacted padding/typography so the success card fits one mobile screen. Made the page unscrollable on mobile by locking `document.body` overflow for the page's lifetime (its own `<main>` height alone wasn't sufficient, since the route sits under the shared patient layout's sticky Navbar and fixed BottomNavBar, whose combined height is what was actually pushing the document past the viewport).
**Files touched:**
- `src/components/BottomNavBar.tsx` [NEW]: fixed bottom icon tab bar.
- `src/components/Icons.tsx` [MODIFIED]: added `IconHome`.
- `src/components/Navbar.tsx` [MODIFIED]: wired in `BottomNavBar`, moved the desktop-nav breakpoint from `md` to `lg`.
- `src/app/page.tsx` [MODIFIED]: bottom nav for signed-out visitors, compact mobile header, one-line CTA row.
- `src/app/patient/layout.tsx`, `src/app/doctor/layout.tsx` [MODIFIED]: `pb-14 lg:pb-0` to clear the fixed bottom bar.
- `src/app/patient/dashboard/page.tsx` [MODIFIED]: rebuilt appointment card format, "At a glance"/"Quick actions" ordering, tab row layout, font-size hierarchy.
- `src/app/patient/doctors/page.tsx` [MODIFIED]: rebuilt doctor card format, tap-anywhere hospital-list expand/collapse, removed breadcrumb, responsive type scale.
- `src/app/patient/doctors/[id]/page.tsx` [MODIFIED]: rebuilt hero card format, "Verified" label, responsive type scale.
- `src/app/patient/intake/page.tsx` [MODIFIED]: removed breadcrumb, responsive body text sizing.
- `src/components/IntakeFlow.tsx` [MODIFIED]: compact input sizing, pill-shaped nav buttons, HMO grid with full-width "None or Cash" row.
- `src/components/DoctorFilterPanel.tsx` [MODIFIED]: mobile Filters/Sort row stretches full-width.
- `src/app/patient/appointments/[id]/confirmation/page.tsx` [MODIFIED]: compact mobile spacing/typography, body-scroll lock.
**Notes/trade-offs:**
- **No fixed design spec** — breakpoint choices and exact sizes were tuned live against direct feedback across the session (e.g. the bottom nav's `md`→`lg` switch, and the directory/profile type scale needing three responsive steps instead of the dashboard's flatter one), so the values here reflect what tested well rather than a predetermined system.
- **Confirmation page's scroll lock is a `document.body.style.overflow` toggle in a mount/unmount effect**, not a CSS-only fix, because the route is nested under the shared patient layout and its own `<main>` doesn't control the layout's Navbar/BottomNavBar height.

### 2026-08-26: Inline symptom guardrail warning, 2-strike out-of-scope screen & dedicated follow-up container
**Task:** AI Guardrail Hardening, Token Protection & Clinical Follow-up Flow
**Owner:** Coding agent
**What changed:** Upgraded the patient intake symptom guardrail and clinical follow-up flow with clear separation between non-symptom rejection and symptom clarification:
1. **Unrelated / Non-symptom Inputs (e.g. "take me home", "i am rich", gibberish):** Caught directly on the Step 3 symptoms container using positive symptom and anatomy verification (`CONTAINS_SYMPTOM_PATTERN`, `ANATOMY_PATTERN`). On Strike 1, an inline warning banner renders on Step 3 prompting the user to retry with genuine symptoms without navigating away or calling the API. On Strike 2 (repeated non-symptom input), transitions to the dedicated "This app is not what you are looking for" screen to prevent token waste and API misuse.
2. **Genuine Symptom Follow-up Questions:** When the user enters genuine symptoms but the AI needs more clinical detail to identify the right specialty (`type: 'clarify'`), rather than rendering an error banner above the intake form, the flow cleanly transitions to a dedicated Follow-up Question Container in `MatchResultView`. This container displays the nurse/AI triage question, provides an answer textarea, and submits the clarification to finalize specialist matching.
**Files touched:**
- `src/components/IntakeFlow.tsx` [MODIFIED] — added 2-strike state tracking, client-side plausibility gate, Strike 1 inline warning banner, and Strike 2 out-of-scope termination screen.
- `src/components/MatchResultView.tsx` [MODIFIED] — added dedicated Clinical Follow-up Question container for symptom-related clarifications.
- `src/app/api/match/route.ts` [MODIFIED] — updated Stage 2.6 and system prompt to return `OffTopicResult` for non-plausible inputs while preserving `clarify` for genuine clinical follow-ups.
- `src/lib/matchApi.ts` [MODIFIED] — added `OffTopicResult` type to `MatchApiResult` union.
- `src/app/patient/intake/page.tsx` [MODIFIED] — routed `clarify` responses to the dedicated follow-up container in `MatchResultView` with `onClarifySubmit`.
- `src/lib/symptomValidation.ts` [MODIFIED] — added positive symptom and anatomy verification engine (`CONTAINS_SYMPTOM_PATTERN`, `ANATOMY_PATTERN`).
- `src/lib/symptomValidation.test.ts` [MODIFIED] — added tests for "take me home", "i am rich", "i have a lot of money", and 2-strike scenarios.
- `docs/BUILD_LOG.md` [MODIFIED] — documented implementation details.
**Notes/trade-offs:**
- **Zero token waste on invalid submissions:** Pre-submission plausibility checks completely prevent unnecessary calls to `POST /api/match` and Gemini LLM for junk text or off-topic prompts.
- **Dedicated follow-up container for clinical conversations:** Ensures clinical follow-up questions from AI feel like a natural conversation in their own clean screen rather than an intrusive warning banner above the original intake form.
- **Preservation of genuine vague symptoms:** Expressions like "I don't feel good" or "masama pakiramdam ko" remain strictly categorized as plausible symptoms (`vague_genuine`) and are never blocked by this guardrail.

### 2026-08-25: Speech-to-text symptom input via Web Speech API
**Task:** 1.1 (`docs/kayapp-additional-features.md` Phase 3 — Speech-to-text for symptom input)
**Owner:** Coding agent
**What changed:** Added live voice dictation (speech-to-text) to Step 3 (symptom description) of the patient intake flow using the native browser Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`), enabling users in pain or on mobile devices to speak their symptoms naturally.
- **Web Speech Integration (`src/components/IntakeFlow.tsx`):** Added client-side feature detection for Web Speech API on mount. Built a continuous, interim-result listening engine that streams transcribed words live into the existing symptom textarea. Dictated words append cleanly to previously typed notes without duplication or loss of manual edits.
- **Accessible Mic Controls & Visual Listening Feedback (`src/components/IntakeFlow.tsx` & `src/components/Icons.tsx`):** Added `IconMic` and `IconMicOff` icons. Positioned an accessible button beside the "Describe symptoms" label with full `aria-pressed`, `aria-label`, and keyboard focus support. Displays a glowing, pulsing rose listening state (`"Listening… (Click to stop)"`) and real-time guidance banner.
- **Silent Fallback:** If the browser or environment does not support speech recognition, the mic button is silently omitted, gracefully falling back to typing without any error messages.
- **Zero Audio Persistence & No Auto-Submit:** Raw audio is processed locally by the browser engine and is never uploaded, recorded, or stored on servers. Dictation populates the `symptomText` React state for user review and editing before they choose to submit; submission is never triggered automatically from voice input alone.
**Files touched:**
- `src/components/Icons.tsx` [MODIFIED] — added `IconMic` and `IconMicOff` SVG icons.
- `src/components/IntakeFlow.tsx` [MODIFIED] — added Web Speech API detection, speech recognition lifecycle, live transcription into textarea, and pulsing listening UI.
- `docs/kayapp-additional-features.md` [MODIFIED] — marked Feature 1.1 as shipped `[x]`.
**Notes/trade-offs:**
- **Zero backend infrastructure/cost:** Running Web Speech API directly in the browser incurs zero LLM or transcription API costs while providing instant streaming feedback.
- **Editable before submit:** Keeps the patient in full control of their symptom narrative before initiating the clinical matching pipeline.

### 2026-08-25: Symptom-specific specialist matching rationale & fluid side-by-side result view
**Task:** 1.3 (`docs/kayapp-additional-features.md` Phase 2 — "Why this specialist" explanation)
**Owner:** Coding agent
**What changed:** Every specialist recommendation now delivers a tailored, 1–3 sentence non-diagnostic explanation that explains why that specialist is uniquely suited for the symptoms rather than merely enumerating them, displayed in a dedicated card that smoothly slides out beside the main recommendation container on the right side.
- **Deep Clinical Suitability Rationale (`src/app/api/match/route.ts`):** Upgraded Gemini system prompt instructions with strict suitability rationale rules. The model is instructed not just to restate symptoms or give empty generic statements ("this doctor will evaluate you"), but to explain in simple, accessible everyday vocabulary *why this specialist's specific medical domain and diagnostic focus are needed* for the reported discomfort (connecting the symptom -> to what the specialist specifically investigates and treats -> and how it helps the patient). Full language mirroring in English and Tagalog is maintained.
- **Fluid Side-by-Side Result View (`src/components/MatchResultView.tsx`, `src/app/patient/intake/page.tsx`, `src/app/globals.css`):** Redesigned the match payoff layout into a responsive 2-column grid (`lg:grid-cols-12`). Added smooth keyframe animations (`animate-slide-in-left` and `animate-slide-in-right` with fluid cubic-bezier easing) so the "Why this specialist was recommended" card fluidly slides out on the right side alongside the main specialist card. The intake page expands to `max-w-4xl` for match results to provide a balanced desktop presentation.
- **Isolation to Genuine Matches:** The "Why this specialist?" explanation strictly renders for successful match results (`type === 'match'`), and is omitted during clarification turns (`type === 'clarify'`) and emergency advisories (`type === 'emergency'`).
**Files touched:**
- `src/app/api/match/route.ts` [MODIFIED] — updated Gemini prompt instructions for deep, lay-friendly specialist suitability rationale.
- `src/components/MatchResultView.tsx` [MODIFIED] — side-by-side 2-column layout with fluid slide-in animation classes.
- `src/app/globals.css` [MODIFIED] — added `slide-in-right` and `slide-in-left` fluid keyframes.
- `src/app/patient/intake/page.tsx` [MODIFIED] — dynamic container max-width (`max-w-4xl` for match outcomes).
- `docs/kayapp-additional-features.md` [MODIFIED] — marked Feature 1.3 as shipped `[x]`.
**Notes/trade-offs:**
- **Strictly non-diagnostic:** Rationale explains why the referral/specialty is suited for the problem, without diagnosing diseases or prescribing treatments.
- **Fluid desktop slide-out:** The right-hand explanation slides in smoothly with a gentle ease-out curve on desktop, while gracefully stacking on mobile screens.

### 2026-08-25: Symptom plausibility gate & gentle nonsense/off-topic clarification
**Task:** 1.2 (`docs/kayapp-additional-features.md` Phase 1 — Matching prompt hardening)
**Owner:** Coding agent
**What changed:** Added a pre-matching plausibility check so the AI symptom-to-specialist matcher never forces a medical specialty recommendation on gibberish, off-topic prompts, or contextless single words, while still accepting vague-but-genuine health complaints.
- **Symptom Plausibility Engine (`src/lib/symptomValidation.ts`):** Created a dedicated, deterministic rule engine distinct from the emergency safety gate (`src/lib/safetyGate.ts`). It filters out keyboard mashing (`asdfghjkl`, consonant clusters without vowels, repeated characters), short non-symptom words (`idk`, `hi`, `test`, `wala`, `ewan`, etc.), and obvious off-topic queries (travel booking, weather, food orders, coding/math, trivia). Recognizes vague-but-genuine symptoms (`"I don't feel good"`, `"masama ang pakiramdam ko"`, `"body hurts"`) and valid single-word symptoms (`"fever"`, `"lagnat"`), allowing them to proceed. Features bilingual English/Tagalog language detection and returns warm, non-judgmental guidance with 1–2 practical symptom examples.
- **Matching Route & Model Prompt (`src/app/api/match/route.ts` & `src/lib/matchApi.ts`):** Added Stage 2.6 (Symptom Plausibility Gate) inside `POST /api/match` after the emergency safety gate to short-circuit nonsense/off-topic queries before making database or Gemini LLM calls. Hardened the Gemini system instruction with explicit rules to never force a specialty on off-topic requests and return gentle clarification prompts instead. Extended `ClarifyResult` to include optional `examples` and `isGentlePrompt` fields.
- **Clarification Result View (`src/components/MatchResultView.tsx`):** Redesigned the clarification view with empathetic nurse guidance styling. Displays interactive example cards/chips with good symptom descriptions (e.g. clicking an example pre-fills the answer textarea) alongside "Edit original text", "Start over", and "Continue with this detail" actions.
- **Automated Tests (`src/lib/symptomValidation.test.ts`):** Added 47 automated test cases covering gibberish, off-topic queries, very short input, vague-but-genuine symptoms, specific symptoms, and language detection. Added `npm test` and `npm run test:validation` scripts to `package.json`.
**Files touched:**
- `src/lib/symptomValidation.ts` [NEW] — symptom plausibility heuristic rule engine, language detection, and warm clarification prompts.
- `src/lib/symptomValidation.test.ts` [NEW] — 47 automated test cases for symptom plausibility.
- `src/lib/matchApi.ts` [MODIFIED] — extended `ClarifyResult` with `isGentlePrompt` and `examples`.
- `src/app/api/match/route.ts` [MODIFIED] — added Step 2.6 plausibility check, updated Gemini system instructions, and enhanced response parser.
- `src/components/MatchResultView.tsx` [MODIFIED] — enhanced clarify state with warm nurse guidance and interactive symptom example chips.
- `package.json` [MODIFIED] — added `test` and `test:validation` scripts.
- `tsconfig.json` [MODIFIED] — enabled `allowImportingTsExtensions: true` for clean Node test runner execution.
- `docs/kayapp-additional-features.md` [MODIFIED] — marked Feature 1.2 as shipped `[x]`.
**Notes/trade-offs:**
- **Zero latency & zero LLM cost on obvious nonsense:** Catching keyboard mashing and single-word filler locally before the Gemini API call saves latency, token usage, and prevents hallucinations.
- **Vague-but-genuine symptoms are strictly preserved:** Symptoms like "I don't feel good" or "masama pakiramdam" are deliberately NOT rejected; they pass through to either prompt for specific clinical details or map to General Medicine / Pediatrics.
- **Plausibility check is separated from emergency safety:** Plausibility validation lives in `src/lib/symptomValidation.ts`, while acute clinical emergency detection (chest pain + dyspnea, stroke, loss of consciousness, uncontrolled bleeding) remains in `src/lib/safetyGate.ts` to keep concerns clean and isolated.

### 2026-08-25: HITL doctor verification, self-service taxonomy, and 2-step booking flow
**Task:** 7.1–7.4 (personal Phase 7 pivot roadmap — see `.claude/roadmap.md`; not merged into the shared `docs/liquid-roadmap.md`, per team decision to keep it as an assigned personal task list rather than the whole team's roadmap)
**Owner:** Coding agent
**What changed:** Doctor verification stopped being decorative and became a real gate, doctors can add a specialty the seeded taxonomy doesn't have, and booking asks which clinic before which time slot.
- **Task 7.1 — Schema:** New migration `0008` replaces `doctors.verified` (an always-`true`, never-set boolean) with `verification_status` (`pending`/`verified`/`rejected`) plus `verification_notes`/`reviewed_by`/`reviewed_at`, backfilling every existing doctor to `verified`. A trigger locks those columns to service-role-only writes so a doctor can't self-verify from the browser console. A new RLS policy lets an authenticated doctor insert a new `specialty_taxonomy` row (checked via the `user_metadata.role` JWT claim, not an existing `doctors` row, so it works mid-onboarding).
- **Task 7.2 — HITL PRC verification:** `profile-setup/page.tsx`'s `credentials` field changed from a file-upload-filename stub to a real required text input prompting for the PRC license number. Doctor dashboard shows a status banner (amber for pending, red with notes + a "Resubmit for Review" button for rejected, wired to new `POST /api/doctor/resubmit-verification`). Patient-facing doctor search/profile pages now filter on `verification_status = 'verified'`. Built a passcode-gated internal admin tool (env var `ADMIN_VERIFY_PASSCODE`) for a human reviewer to approve/reject after manually checking https://verification.prc.gov.ph/ (no PRC API exists).
- **Task 7.3 — Self-service taxonomy:** New `src/lib/taxonomySelfService.ts` (`findOrCreateTaxonomyEntry`) backs a "+ Other (please specify)" option on both the specialty and sub-specialty pickers in `profile-setup/page.tsx` and `ProfileEditor.tsx`, case-insensitively deduped against existing rows. Also fixed two live bugs found while touching this area: `api/match/route.ts` was silently querying a `specialties` table that was never applied to the live DB (from the dead `0003` migration design) — removed, deriving the no-sub-specialty list from the `specialty_taxonomy` fetch already happening; and the hardcoded `'General Practice'` specialty-list entry in both picker files matched nothing in the real taxonomy (`'General Medicine'`) — removed.
- **Task 7.4 — Booking flow:** Redesigned `patient/doctors/[id]/page.tsx`'s booking section from a flat "pick any slot from any clinic" grid into a 2-step flow — pick a clinic first (skipped automatically when a doctor has only one), then that clinic's time slots. Both pickers use `role="radiogroup"`/`role="radio"` + `aria-checked` instead of color-only toggle feedback; the whole slot grid is disabled during submission, not just Confirm/Cancel; Cancel now clears the symptom note and any booking error, not just the selected slot. Also removed the now-redundant "Practice Locations & Rates" block from the profile hero card, since Step 1 of the booking flow already shows each clinic's name/location/fee.
- **Admin UI iteration:** Original draft was two separate pages (`/admin/verify-doctors`, `/admin/manage-taxonomy`) with ad-hoc slate/emerald styling. Per feedback, consolidated into one page (`/admin/verify-doctors`, tabbed) sharing a passcode gate, restyled to match the app's actual design tokens (`.card`, `bg-blue-600`, `field-label`, `fluid-hover` — not the stale violet/obsidian scheme from an older BUILD_LOG entry), and given the real `Logo` (KayApp) header. Added `/admin` as a landing page linking into it.
**Files touched:**
- `supabase/migrations/0008_doctor_verification_and_taxonomy_rls.sql` [NEW] — verification columns/trigger, taxonomy insert RLS policy.
- `src/lib/taxonomySelfService.ts` [NEW] — case-insensitive find-or-create for `specialty_taxonomy`.
- `src/lib/adminAuth.ts` [NEW] — shared passcode check for admin API routes.
- `src/components/AdminGate.tsx` [NEW] — shared passcode-gate UI, verifies against a real API call rather than trusting cached input.
- `src/components/admin/DoctorVerificationQueue.tsx`, `src/components/admin/TaxonomyManager.tsx` [NEW] — the two admin tool tabs' content.
- `src/app/admin/page.tsx`, `src/app/admin/verify-doctors/page.tsx` [NEW] — admin landing page and the combined tabbed tools page.
- `src/app/api/admin/doctors/route.ts`, `src/app/api/admin/doctors/[id]/route.ts` [NEW] — list/approve/reject doctors.
- `src/app/api/admin/taxonomy/route.ts`, `src/app/api/admin/taxonomy/[id]/route.ts` [NEW] — list (with doctor-usage counts) / delete taxonomy entries.
- `src/app/api/doctor/resubmit-verification/route.ts` [NEW] — lets a rejected doctor return to `pending`.
- `src/app/doctor/profile-setup/page.tsx`, `src/components/ProfileEditor.tsx` [MODIFIED] — real credentials text input, "+ Other" specialty/sub-specialty, removed hardcoded `'General Practice'`.
- `src/app/doctor/dashboard/page.tsx` [MODIFIED] — verification status banner + resubmit action.
- `src/app/patient/doctors/page.tsx`, `src/app/patient/doctors/[id]/page.tsx` [MODIFIED] — `verification_status` filter/type rename; `[id]/page.tsx` additionally gets the 2-step booking redesign and drops the Practice Locations & Rates block.
- `src/lib/doctorRanking.ts` [MODIFIED] — `DoctorRecord.verified` → `verification_status`.
- `src/app/api/match/route.ts` [MODIFIED] — removed the dead `specialties` table query.
- `.env.local` [MODIFIED, not committed] — added `ADMIN_VERIFY_PASSCODE`.
**Notes/trade-offs:**
- **No new `license_number` column.** The PRC license number deliberately lives in the existing `credentials` text field, per direct product decision — the seed data already formats it as `"PRC Lic. No. 123456 | MD, FPAFP"`.
- **HMO accreditation stays doctor-level, unchanged.** A Doctor×Clinic×HMO junction/bridge table was scoped in an early draft of this pivot and explicitly dropped mid-plan: if a doctor doesn't take a patient's HMO at one clinic, the patient can simply be booked at a different clinic of that same doctor.
- **The admin passcode is a disclosed speed bump, not real authentication** — deliberately not wired into `RequireRole`/the patient-doctor auth system, same spirit as the PRD's existing "no live HMO verification, disclosed as a known gap" framing.
- **Migration `0008` was applied to the live DB by the user directly**, not through this agent — `DATABASE_URL` is never passed through the agent, consistent with established project practice (see the 2026-08-19 "Seed apply instructions" entry).
- **Deleting a `specialty_taxonomy` row is schema-safe against existing doctors** (migration `0005` replaced the old FK with an insert/update-only trigger, so nothing cascades), but the admin tool surfaces a live doctor-usage count per entry so it's an informed choice, not a silent trap for a doctor who later re-saves their profile unchanged.

### 2026-08-20: Multi-clinic doctor profiles, in-app profile editing, and required decline/cancel reasons
**Task:** Doctor Portal follow-ups (no single roadmap number, post-5.4 polish pass)
**Owner:** Coding agent
**What changed:** Doctors are no longer locked into what they entered at onboarding, and both sides of an appointment cancellation now have to explain themselves.
- **Doctor profile editing (`ProfileEditor.tsx`):** New collapsible "Edit Profile" panel on the doctor dashboard letting doctors update name, credentials, specialty/sub-specialty, and HMO accreditations after onboarding, via `update` against the existing `doctors` row (mirrors `profile-setup/page.tsx`'s field set and taxonomy pattern).
- **Multiple clinic locations:**
  - `profile-setup/page.tsx` now collects a repeatable list of clinics at onboarding instead of exactly one.
  - New `ClinicManager.tsx` on the doctor dashboard lets doctors add/edit/delete clinic locations afterward, with a realtime subscription on `clinics` filtered by `doctor_id`.
  - `doctorRanking.ts`: `primaryClinic` is now derived as whichever clinic hosts the soonest slot (falling back to the first clinic when there's no posted availability) instead of always `clinics[0]`, and a new `otherClinics` field lists the doctor's remaining locations. `/patient/doctors` renders these behind a "+N more locations" expandable per doctor card.
- **Required reason for declining/cancelling appointments:**
  - New migration `0007_appointment_status_reason.sql` adds `appointments.status_reason` and a check constraint rejecting any transition into `'declined'` or `'cancelled'` without one (with a backfill for pre-existing rows).
  - `AppointmentsDashboard.tsx` (doctor side): Decline now opens an inline reason textarea (min length enforced client-side) before confirming, instead of firing immediately.
  - Patient dashboard: added a matching Cancel action (for `pending`/`confirmed` appointments) with its own inline reason panel, and now surfaces `status_reason` on declined/cancelled cards so the patient can see why.
  - Declined/cancelled appointments older than 14 days (`DROPPED_APPT_RETENTION_DAYS` in the new `src/lib/dateUtils.ts`) drop off the patient dashboard's active list. The row itself is untouched, this is a display filter only.
- **Edit-in-place symptom editing:** ", from Edit symptoms" on the AI match result screen now returns to Step 3 of the intake form with prior answers intact (`IntakeFlow`'s new `initialData`/`initialStep` props), instead of a full reset to a blank Step 1. Full restart is still available separately.
- **HMO "show all" toggle removed from `/patient/doctors`:** Simplified the ranking call back down to always respecting HMO coverage in tier 2 sorting; the checkbox and its associated state were removed as unused complexity.
- **Housekeeping:** Added `.claude/settings.json` permitting `npx tsc` and `git checkout` without prompting; added the "no AI co-authorship in commits" rule to `CLAUDE.md`.
**Files touched:**
- `src/components/ProfileEditor.tsx` [NEW]: doctor profile editing panel.
- `src/components/ClinicManager.tsx` [NEW]: add/edit/delete clinic locations with realtime sync.
- `src/lib/dateUtils.ts` [NEW]: `daysSince()` helper.
- `supabase/migrations/0007_appointment_status_reason.sql` [NEW]: `status_reason` column + check constraint, with backfill.
- `src/app/doctor/dashboard/page.tsx` [MODIFIED]: mounted `ProfileEditor` and `ClinicManager`.
- `src/app/doctor/profile-setup/page.tsx` [MODIFIED]: repeatable clinic rows at onboarding.
- `src/lib/doctorRanking.ts` [MODIFIED]: `primaryClinic`/`otherClinics` derivation; removed `showAllHmo` parameter.
- `src/app/patient/doctors/page.tsx` [MODIFIED]: expandable "other locations" per card; removed HMO show-all toggle.
- `src/app/patient/doctors/[id]/page.tsx` [MODIFIED]: minor header layout fix.
- `src/components/AppointmentsDashboard.tsx` [MODIFIED]: inline required-reason panel for declines.
- `src/app/patient/dashboard/page.tsx` [MODIFIED]: cancel action with required reason, status_reason display, 14-day retention filter for dropped appointments.
- `src/app/patient/intake/page.tsx`, `src/components/IntakeFlow.tsx`, `src/components/MatchResultView.tsx` [MODIFIED]: edit-in-place return to Step 3 (`onEditSymptoms`) distinct from full restart (`onRestart`).
- `.claude/settings.json` [NEW]: permission allowlist for `npx tsc` and `git checkout`.
- `CLAUDE.md` [MODIFIED]: added no-AI-co-authorship commit rule.
**Notes/trade-offs:**
- **Retention window is a display filter, not a data purge (Assumption).** There's no background job in this app to actually delete old declined/cancelled rows. They stay in the DB for audit history; `daysSince()` just hides them from the patient's active list after 14 days.
- **Decline/cancel reason enforced at the DB layer, not just the UI.** The check constraint on `appointments` means any future code path that tries to decline/cancel without a reason fails at the database, not just in this component.
- **Commit message on the underlying commit was accidentally left as "null":** this log entry reconstructs the change set from the diff since it wasn't otherwise documented.

### 2026-08-19: Visual & design consistency pass (Task 5.4)
**Task:** 5.4
**Owner:** Coding agent
**What changed:** Unified the application under a single, ultra-premium healthcare design system directly inspired by modern wellness UI aesthetics.
- **Global Design System Foundation (`src/app/globals.css`):**
  - Configured custom CSS variables and utility tokens:
    - **Canvas:** Soft warm-tinted neutral background (`#F8F7FA` / `#FAF8FD`).
    - **Surfaces & Cards:** Crisp elevated white cards (`bg-white`), ultra-smooth rounded corners (`rounded-3xl` / 24px to 28px), subtle feather drop-shadows (`shadow-[0_8px_30px_rgb(0,0,0,0.03)]`), and delicate borders (`border border-slate-100`).
    - **Midnight Obsidian Actions:** Deep dark purple-black CTA buttons and active state chips (`bg-[#2A2338]` / `hover:bg-[#1E192C]`, white text, `min-h-[48px]`, `rounded-2xl`).
    - **Royal Violet Accents:** Hero card gradients (`bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700`), badges, and brand highlights (`bg-violet-50 text-violet-700`).
    - **Form Inputs:** Smooth `rounded-2xl` inputs with soft background (`bg-slate-50/60`), clear focus rings, and high contrast typography.
- **Patient Portal Overhaul:**
  - `src/app/page.tsx`: Transformed starter page into an ultra-clean gateway portal landing page with hero gradient, feature cards, and quick navigation.
  - `src/app/patient/auth/page.tsx` & `src/components/AuthForm.tsx`: Restyled patient login & registration with pure white cards, rounded inputs, and `#2A2338` action buttons.
  - `src/app/patient/dashboard/page.tsx`: Violet gradient AI symptom checker hero card, high-contrast appointment list, and clean stat cards.
  - `src/components/IntakeFlow.tsx` & `src/app/patient/intake/page.tsx`: Violet step indicators, midnight obsidian "Who is this for?" toggle, clean 2-step inputs, and light container.
  - `src/components/MatchResultView.tsx`: Modern lay recommendation payoff card, soft violet nurse reasoning box (`bg-violet-50/80 border-l-4 border-violet-600`), and warm amber emergency advisory card.
  - `src/app/patient/doctors/page.tsx`: Elevated doctor directory cards, clean filter pills, HMO badges, and direct booking triggers.
  - `src/app/patient/doctors/[id]/page.tsx`: Hero doctor profile, modern calendar time slot chips (inspo active `#2A2338` and available light chips), and verified reviews breakdown.
  - `src/app/patient/appointments/[id]/confirmation/page.tsx`: High-polish booking confirmation payoff card with violet checkmark.
  - `src/app/patient/appointments/[id]/review/page.tsx`: Light verified review submission page with golden interactive star buttons and clean feedback cards.
- **Doctor Portal Overhaul:**
  - `src/app/doctor/auth/page.tsx`: Unified light authentication card.
  - `src/app/doctor/profile-setup/page.tsx`: Clean multi-section onboarding form with violet accents and `#2A2338` submit buttons.
  - `src/app/doctor/dashboard/page.tsx`: Clean light header with portal badge and structured layout.
  - `src/components/AppointmentsDashboard.tsx`: Pure white cards for pending requests and upcoming confirmed consultations with `#2A2338` accept buttons.
  - `src/components/ScheduleManager.tsx`: Elevated schedule slot creator and categorized upcoming slots list.
**Files touched:**
- `src/app/globals.css` [MODIFIED]: added CSS design tokens for canvas, obsidian actions, and violet accents.
- `src/app/page.tsx` [MODIFIED]: built portal gateway landing page.
- `src/components/AuthForm.tsx` [MODIFIED]: styled form inputs and action buttons.
- `src/app/patient/auth/page.tsx` [MODIFIED]: light canvas and white card.
- `src/app/doctor/auth/page.tsx` [MODIFIED]: light canvas and white card.
- `src/app/patient/dashboard/page.tsx` [MODIFIED]: hero gradient and light card layout.
- `src/components/IntakeFlow.tsx` [MODIFIED]: light intake steps, toggle, inputs, and buttons.
- `src/app/patient/intake/page.tsx` [MODIFIED]: light canvas and layout.
- `src/components/MatchResultView.tsx` [MODIFIED]: light recommendation payoff and nurse box.
- `src/app/patient/doctors/page.tsx` [MODIFIED]: light directory cards and filters.
- `src/app/patient/doctors/[id]/page.tsx` [MODIFIED]: hero card, schedule slot chips, reviews.
- `src/app/patient/appointments/[id]/confirmation/page.tsx` [MODIFIED]: confirmation card.
- `src/app/patient/appointments/[id]/review/page.tsx` [MODIFIED]: review submission card.
- `src/app/doctor/dashboard/page.tsx` [MODIFIED]: doctor dashboard container.
- `src/components/AppointmentsDashboard.tsx` [MODIFIED]: pending and confirmed appointment cards.
- `src/components/ScheduleManager.tsx` [MODIFIED]: slot creation form and upcoming slots grid.
- `src/app/doctor/profile-setup/page.tsx` [MODIFIED]: doctor profile setup form.
- `docs/BUILD_LOG.md` [MODIFIED]: logged build entry.

### 2026-08-19: Accessibility & plain-language review pass (Task 5.3)
**Task:** 5.3
**Owner:** Coding agent
**What changed:** Conducted a comprehensive accessibility, low-literacy, and plain-language review pass across patient and doctor screens per PRD Section 8.7.
- **AI "Nurse-Tone" Guidance (`/api/match`):**
  - Updated Gemini system prompt with strict rules enforcing a warm, caring nurse explanation tone for the `reason` field rather than dense medical textbook prose.
  - Mandated elimination of academic clinical jargon ("etiology", "pathology", "bilateral presentation", etc.) with natural English and conversational Tagalog mirroring.
- **Plain-Language Specialty Taxonomy (`src/lib/specialtyHelpers.ts`):**
  - Created a comprehensive plain-language dictionary covering all 33 medical specialties with friendly descriptions and Tagalog titles (e.g. Ophthalmology maps to "Eye Specialist & Eye Surgeon" / "Espesyalista sa Mata", Otolaryngology maps to "Ear, Nose & Throat (ENT) Specialist" / "Espesyalista sa Tainga, Ilong at Lalamunan").
  - Integrated plain-language subtitles across doctor directory cards (`/patient/doctors`), recommendation screens (`MatchResultView`), and doctor profile headers (`/patient/doctors/[id]`).
- **Typography & Readability Pass:**
  - Upgraded unreadable micro-text (`text-[10px]`, `text-[11px]`) to legible `text-xs` (12px) and `text-sm` (14px).
  - Enhanced text contrast across dark backgrounds: replaced faded `text-slate-500` with high-contrast `text-slate-300` and `text-slate-200`.
- **Touch Target & Mobile Accessibility Pass:**
  - Standardized all primary action buttons, segmented selectors, and form submission buttons to generous touch targets (min `h-12` / `py-4`).
  - Upgraded 5-star review buttons in `review/page.tsx` to large `min-h-[48px] min-w-[48px]` touch targets with `text-4xl sm:text-5xl` icons.
  - Upgraded consultation slot selection cards to `p-3.5 min-h-[56px]` with distinct active focus outlines.
**Files touched:**
- `src/lib/specialtyHelpers.ts` [NEW]: plain-language dictionary and Tagalog translations for 33 medical specialties.
- `src/app/api/match/route.ts` [MODIFIED]: updated system prompt to enforce nurse-tone explanations without medical jargon.
- `src/components/MatchResultView.tsx` [MODIFIED]: added plain-language specialty subtitles and accessible typography.
- `src/app/patient/doctors/page.tsx` [MODIFIED]: added plain-language specialty subtitles and upgraded micro-text / contrast.
- `src/app/patient/doctors/[id]/page.tsx` [MODIFIED]: added plain-language subtitles, improved slot button heights, and increased contrast.
- `src/app/patient/appointments/[id]/confirmation/page.tsx` [MODIFIED]: upgraded font sizes and button tap targets.
- `src/app/patient/appointments/[id]/review/page.tsx` [MODIFIED]: upgraded star buttons to large mobile tap targets and enhanced typography.
- `src/components/AppointmentsDashboard.tsx` [MODIFIED]: upgraded accept/decline button heights and text contrast.
- `src/components/ScheduleManager.tsx` [MODIFIED]: upgraded slot creation button touch targets.
- `docs/BUILD_LOG.md` [MODIFIED]: logged build entry.

### 2026-08-19: "Booking for a family member" toggle in intake flow (Task 5.2)
**Task:** 5.2
**Owner:** Coding agent
**What changed:** Implemented the "Booking for a family member" intake toggle in Step 1 of `IntakeFlow.tsx` per PRD Section 8.7 & 10.
- **"Who is this for?" Toggle:** Added segmented large-tap selector with "Myself" (default) and "A family member" options.
- **Dynamic Field & Label Adaptation:**
  - In "Myself" mode: pre-fills the logged-in user's profile from `public.patients` with personalized labels ("Your full name", "Your age", "Your sex", "Your HMO").
  - In "A family member" mode: switches to dedicated family member input fields with helper banner and contextual labels ("Family member's full name", "Family member's age", "Family member's sex", "Family member's HMO coverage").
  - Switching back and forth restores the user's personal profile without data loss.
- **Database Safety:** When booking for a family member, the patient's persistent profile row in `public.patients` is protected and NOT overwritten, while the complete demographic payload is passed into the session and matching pipeline.
- **Clinical AI Triage Integration:** Updated `IntakeCompleteData`, `MatchApiRequest`, `callMatchApi`, `MatchResultView`, and `/api/match` to pass the consulted family member's actual age, sex, and name directly into the Gemini prompt (enabling accurate age-specific pediatric vs adult vs geriatric specialist recommendations).
**Files touched:**
- `src/components/IntakeFlow.tsx` [MODIFIED]: added consultation target toggle, dynamic field labeling, independent state caching, and family member validation messages.
- `src/lib/matchApi.ts` [MODIFIED]: added `isForFamilyMember` to `MatchApiRequest`.
- `src/app/patient/intake/page.tsx` [MODIFIED]: forwarded `isForFamilyMember` in match and clarify submissions.
- `src/app/api/match/route.ts` [MODIFIED]: included `isForFamilyMember` in Gemini demographic context.
- `src/components/MatchResultView.tsx` [MODIFIED]: rendered `Family Member` tag in patient recap bar.
- `docs/BUILD_LOG.md` [MODIFIED]: logged build entry.

### 2026-08-19: Verified patient reviews & rating display (Task 5.1)
**Task:** 5.1
**Owner:** Coding agent
**What changed:** Built the verified-visit-only patient review submission and doctor rating display system per PRD Section 8.6.
- **Review Submission Route (`/patient/appointments/[id]/review`):**
  - Gated route with `<RequireRole role="patient">` and Suspense boundary.
  - Enforces the verified-visit eligibility rule: verifies `appointment.patient_id === session.user.id` and `appointment.status === 'completed'`. Uncompleted/pending/cancelled visits render a clear blocked notice explaining that reviews are only accessible after consultation completion.
  - Interactive 5-star rating selector with hover preview and qualitative labels (1 - Poor to 5 - Excellent).
  - Optional feedback textarea (up to 1,000 chars) with character counter.
  - Duplicate check: detects if a review was already submitted for this appointment (and handles Postgres constraint `23505`), rendering a read-only submitted state rather than throwing an error.
- **Doctor Profile Review Section (`/patient/doctors/[id]`):**
  - Added a dedicated "Patient Reviews & Ratings" section with a 100% Verified Consultations trust badge.
  - Displays overall average score (`4.8 / 5.0`) and total review count.
  - Computes and renders star distribution breakdown bars (percentage and count for 5 stars down to 1 star).
  - Lists individual verified patient reviews sorted by newest first with star rating badges, formatted review dates, verified patient tags, and comments.
  - Clean placeholder empty state for doctors without reviews.
- **Patient Dashboard Integration (`/patient/dashboard`):**
  - Added "My Consultations & Appointments" overview section. Completed visits without a review present a direct "Write a Review" action button linking to `/patient/appointments/[id]/review`.
**Files touched:**
- `src/app/patient/appointments/[id]/review/page.tsx` [NEW]: review submission page with verified visit eligibility gate, interactive 5-star selector, and submitted review state.
- `src/app/patient/doctors/[id]/page.tsx` [MODIFIED]: added Patient Reviews & Ratings section with average rating score, star distribution bars, and verified review list.
- `src/app/patient/dashboard/page.tsx` [MODIFIED]: added consultations list with status pills and a "Write a Review" button for completed appointments.
- `docs/BUILD_LOG.md` [MODIFIED]: logged build entry.
**Notes/trade-offs:**
- **Database integrity:** Leveraged existing `public.reviews` schema with `unique (appointment_id)` constraint and RLS policy `reviews_insert_patient` (`auth.uid() = patient_id`) without requiring any schema migrations.
- **Doctor Ranking:** `src/lib/doctorRanking.ts` automatically consumes the new reviews to calculate average ratings and rank doctors in search results.

### 2026-08-19: Doctor dashboard real-time booking sync audit & fix (Task 4.4)
**Task:** 4.4
**Owner:** Coding agent
**What changed:** Conducted end-to-end audit and fix for real-time synchronization between the patient booking flow and the doctor dashboard.
- **Phase 1 Audit Findings & Root Cause:**
  1. *Patient Write*: Task 4.2 (`/patient/doctors/[id]`) correctly writes an insert into `public.appointments` with `status: 'pending'`, while PostgreSQL trigger `trg_sync_slot_status` flips `schedule_slots.is_booked` to `'booked'`.
  2. *Doctor Read & Subscriptions*: `AppointmentsDashboard.tsx` and `ScheduleManager.tsx` already had Client Component `postgres_changes` listener logic for `appointments` and `schedule_slots` filtered by `doctor_id=eq.${uid}`.
  3. *Root Cause Identified*: Neither `public.appointments` nor `public.schedule_slots` were added to PostgreSQL's `supabase_realtime` publication in database migrations, so Supabase Realtime never broadcast CDC events to subscribed browser clients. Additionally, `REPLICA IDENTITY FULL` was missing on both tables, which is required for Postgres to include non-PK columns (like `doctor_id`) in update/delete replication streams so client-side row filters work.
  4. *RLS & Auth*: Confirmed that `appointments_select_own` (`auth.uid() = patient_id or auth.uid() = doctor_id`) and `patients_select_by_doctor` allow authenticated doctors to select their appointments and patient details without permission errors.
- **Phase 2 Fix:**
  - Created migration `supabase/migrations/0006_enable_realtime.sql` to add `appointments` and `schedule_slots` to `supabase_realtime` and enable `REPLICA IDENTITY FULL` on both tables.
  - Verified channels in `AppointmentsDashboard.tsx` and `ScheduleManager.tsx` properly clean up via `supabase.removeChannel(channel)` on unmount.
**Files touched:**
- `supabase/migrations/0006_enable_realtime.sql` [NEW]: enables `supabase_realtime` publication and full replica identity for `appointments` and `schedule_slots`.
- `docs/BUILD_LOG.md` [MODIFIED]: logged audit findings and resolution.
**Notes/trade-offs:**
- **Manual Apply Step:** `0006_enable_realtime.sql` should be executed in the Supabase SQL Editor against the shared database project to activate Postgres CDC broadcasting.
- **Out of Scope Follow-up:** Real-time sync for the patient's appointments dashboard is not yet implemented (patient dashboard currently only has intake/browse entry points; Task 5 will add the dedicated patient appointments view).

### 2026-08-19: Booking confirmation screen (Task 4.3)
**Task:** 4.3
**Owner:** Coding agent
**What changed:** Built `/patient/appointments/[id]/confirmation`. A dedicated, refresh-safe booking confirmation route that serves as the reassuring payoff moment of the patient flow. Updated Task 4.2's booking submission handler in `/patient/doctors/[id]` to redirect directly to this route with the created appointment ID (`router.replace`) rather than rendering an inline temporary state. The confirmation page fetches appointment details via joined Supabase tables (`appointments` to `schedule_slots` to `clinics`, and `appointments` to `doctors`), formats date and time in `Asia/Manila` local time (12-hour AM/PM), provides defense-in-depth authorization checking against the session user's ID, and links to the patient dashboard (`/patient/dashboard`).
**Files touched:**
- `src/app/patient/appointments/[id]/confirmation/page.tsx` [NEW]: dedicated confirmation page with loading state, not-found/unauthorized fallback, doctor details, formatted date/time, clinic location, and "View my appointments" action.
- `src/app/patient/doctors/[id]/page.tsx` [MODIFIED]: updated `handleConfirmBooking` to redirect to `/patient/appointments/${apptData.id}/confirmation` on insert success; cleaned up redundant in-memory confirmation state.
- `docs/BUILD_LOG.md` [MODIFIED]: logged build entry.
**Notes/trade-offs:**
- **Confirmed schema & field names:**
  - `appointments`: `id`, `patient_id`, `doctor_id`, `slot_id`, `status` (`'pending' | 'confirmed' | 'declined' | 'completed' | 'cancelled'`), `symptom_summary`, `created_at`
  - `schedule_slots`: `id`, `doctor_id`, `clinic_id`, `date`, `start_time`, `end_time`, `is_booked` (`'available' | 'booked' | 'doctor_on_leave'`)
  - `clinics`: `id`, `doctor_id`, `name`, `room_details`, `location`, `consultation_fee`
  - `doctors`: `id`, `name`, `credentials`, `specialty`, `sub_specialty`, `hmo_accreditations`, `verified`
- **Destination of "View my appointments":** `AppointmentsDashboard` is currently only mounted on the doctor dashboard (`/doctor/dashboard`). Per current route structure, the patient "View my appointments" link routes to `/patient/dashboard`.
- **Client-side auth pattern:** Consistent with all existing patient routes (`RequireRole`, `supabaseClient` anon key) as `@supabase/ssr` is not yet configured.

### 2026-08-19: Dynamic slug collision resolved & 200 mock doctors seeded
**Task:** Bugfix / Seed Execution
**Owner:** Coding agent
**What changed:** Resolved the Next.js Turbopack startup failure `You cannot use different slug names for the same dynamic path ('doctorId' !== 'id')` by removing the redundant `src/app/patient/doctors/[doctorId]` folder, keeping the full-featured `src/app/patient/doctors/[id]` booking route. Seeded all 202 doctors across 33 medical specialties, 425 clinics, 5,584 schedule slots, and 103 taxonomy pairs into the Supabase database using the GoTrue admin client. The active schema's nullable `sub_specialty` architecture (`0003_nullable_subspecialty.sql`) properly validates both general practitioners (null sub-specialty) and sub-specialists.
**Files touched:**
- `src/app/patient/doctors/[doctorId]` [DELETED]: removed duplicate dynamic route folder colliding with `[id]`.
- `scripts/seed_200_doctors.mjs` [NEW]: script utilizing Supabase Admin client to seed the 202 doctors, clinics, slots, and taxonomy.
- `docs/BUILD_LOG.md` [MODIFIED]: logged resolution and seed verification.
**Notes/trade-offs:**
- Total database counts now verified live: 211 Doctors (including 8 demo doctors + Jal Tuazon), 434 Clinics, 5,612 Schedule Slots, 103 Taxonomy pairs across 33 Specialties.
- Cleared stale `.next` build cache to ensure clean compilation.

### 2026-08-19: Seed apply instructions embedded in file headers
**Task:** 1.4 (follow-up)
**Owner:** Coding agent
**What changed:** The regenerated `seeds.sql` (~1.5MB to 202 doctors, 425 clinics, 5,584 slots as one embedded JSON literal) is too large to paste into the Supabase Dashboard's SQL Editor, which rejects it with "Query is too large to be run via the SQL Editor." Added a small Node script that runs a `.sql` file directly against the database over a real Postgres connection instead, and embedded the exact apply steps directly in `seeds.sql`'s and `gen_seed.mjs`'s header comments so the workflow survives future regenerations instead of only living in chat history.
**Files touched:**
- `scripts/run_seed.mjs` [NEW]: reads `DATABASE_URL` from the environment and executes a given `.sql` file (defaults to `seeds.sql`) via the `postgres` package.
- `package.json` / `package-lock.json` [MODIFIED]: added `postgres` as a dev dependency.
- `supabase/migrations/seeds.sql`, `scripts/gen_seed.mjs` [MODIFIED]: header comment block now documents which migrations must run first (and which one to skip, see the branch-integration entry below), how to get the direct connection string, and the exact `run_seed.mjs` commands.
**Notes/trade-offs:**
- **Direct connection (port 5432), not the pgbouncer pooler:** the seed runs as one large transaction inside a single `DO $$` block, and pooled connections aren't guaranteed to hold a transaction open reliably across a statement this size.
- **`DATABASE_URL` stays in the user's shell only.** It's set per-session in PowerShell and never written to a file, committed, or passed through me. The password never leaves the user's terminal.
- **Re-running `seeds.sql` is safe.** Every insert is `ON CONFLICT DO NOTHING` with deterministic IDs, so there's no harm in re-running it if a teammate is unsure whether it already applied.

### 2026-08-19: Branch integration: merged main into feat/doctor-mock-database
**Task:** Integration (no roadmap number, reconciling parallel work, not new scope)
**Owner:** Coding agent
**What changed:** Pulled 15 commits of parallel work from `main` (AI symptom-intake flow, safety gate, doctor ranking/matching, appointments dashboard, schedule manager, doctor profile setup) into a branch that had independently built. But not yet committed. A large deterministic mock-data seed generator (202 doctors / 425 clinics / 5,584 schedule slots), a nullable-`sub_specialty` migration, and a doctor detail/booking page. Two real conflicts came up and were resolved per team direction: (1) `patient/dashboard/page.tsx` had been rebuilt two different ways in parallel. Kept main's AI-intake entry card and added a second "Browse all doctors" entry card instead of dropping either; (2) two independent migrations solved the same nullable-`sub_specialty` problem under colliding numbers. Renumbered this branch's copy to remove the filename collision, but left the actual design conflict unresolved for the team (see trade-offs below).
**Files touched:**
- `src/app/patient/dashboard/page.tsx` [MODIFIED]: kept main's "Check my symptoms" entry card; added a second card linking to `/patient/doctors` (browse-all mode).
- `src/app/patient/doctors/page.tsx` [MODIFIED]: added a "browse all doctors" mode (active when no `specialty` query param is present): free-text search + specialty dropdown, reusing this branch's original directory UI. The existing specialty-driven ranked-match mode (reached from the intake flow via `?specialty=...`) is unchanged.
- `src/app/patient/doctors/[doctorId]/page.tsx` [NEW, from this branch]: doctor detail/booking page. No wiring changes needed: main's "View Profile & Book" button already links to `/patient/doctors/${doctor.id}`, in both modes.
- `supabase/migrations/0002_slot_appointment_triggers.sql` [RENAMED from `002_slot_appointment_triggers.sql`]. Numbering cleanup only, content unchanged (confirmed via diff).
- `supabase/migrations/0004_json_build_object.sql`, `supabase/migrations/0005_nullable_sub_specialty.sql` [RENAMED from this branch's `0003_...` / `0004_...`]. Renumbered to avoid colliding with main's `0003_nullable_subspecialty.sql`. In-file comment references updated in `seeds.sql` and `scripts/gen_seed.mjs`.
- `scripts/run_seed.mjs` [NEW, from this branch]: runs a `.sql` file directly against the database over a Postgres connection string, for the ~1.5MB `seeds.sql` that exceeds the Supabase SQL Editor's paste size limit.
- `package.json` / `package-lock.json` [MODIFIED]: merged both branches' dependency additions (`@google/genai` from main, `postgres` devDependency from this branch); lockfile regenerated with `npm install` rather than hand-merged.
- `.gitignore` [MODIFIED]: added `/supabase/.temp/` (Supabase CLI local cache).
- `openapi.json` [DELETED, was untracked]: accidental debug output (a bare API error message), no real content.
**Notes/trade-offs:**
- **Unresolved for the team: two competing `sub_specialty`-nullability designs.** This branch's live Supabase project (`pkafruzeiakqmareywnn.supabase.co`) already has `0005_nullable_sub_specialty.sql`'s trigger-based design applied and seeded (202 doctors, verified live). Main's `0003_nullable_subspecialty.sql` (a `specialties` lookup table + second FK, per its own comment "applied by Zin manually") was checked directly against that same project via the anon-key REST API. `Public.specialties` does not exist there, so it was never actually applied to this shared database, only committed to git. **Do not run `0003` against the live project** until the team picks one design; running both would leave inconsistent/duplicate schema logic.
- **Dashboard kept as two entry points, not merged into one.** Main's intake-first flow and this branch's direct-browse flow are genuinely different UX paths (patient has symptoms to describe vs. patient already knows who/what they're looking for). Decided with the user rather than silently picking one.
- **Browse-all mode reuses `rankDoctors()`** for slot/rating decoration even without a meaningful specialty target. The function doesn't filter or require one internally, it only decorates and sorts, so this was a safe reuse rather than forking the ranking logic.

### 2026-08-19: Deterministic mock doctor/clinic/schedule seed generator (full specialty roster)
**Task:** 1.4 (rework, expands the 2026-08-18 Ophthalmology-only re-seed entry further down to the full specialty roster; that entry's `seed_taxonomy_only.sql` script is still valid for a from-scratch taxonomy-only re-seed)
**Owner:** Coding agent
**What changed:** Built a deterministic mock-data generator producing 202 doctors across 33 specialties, 425 clinics, and 5,584 schedule slots. Enough breadth to actually exercise the ranking (8.4) and HMO-mismatch (8.3) logic across many specialties instead of just one. Consultation fees and credential depth scale with each specialty's real-world complexity: niche fields (e.g. Neurosurgery, Interventional Cardiology) carry an added fellowship credential and a higher fee band than a standard specialty like General Medicine. Every doctor gets 3-4 distinct available days, each a contiguous 30-minute-interval morning or afternoon block, and every clinic a doctor is affiliated with is guaranteed at least one such block.
**Files touched:**
- `scripts/gen_seed.mjs` [NEW]: mulberry32-seeded deterministic PRNG (seed `20260818`) driving name/specialty/credential/fee/schedule generation, plus a deterministic UUIDv4 generator so re-running the script with no source changes reproduces byte-identical output; emits `supabase/migrations/seeds.sql`.
- `supabase/migrations/seeds.sql` [NEW/GENERATED]: single PL/pgSQL `DO $$` block seeding `auth.users`, `specialty_taxonomy`, `doctors`, `clinics`, and `schedule_slots` from an embedded JSON literal, all `ON CONFLICT DO NOTHING`.
**Notes/trade-offs:**
- **Deterministic generation, not random.** Re-running the generator with no code changes reproduces identical IDs. Regenerating after a small roster tweak doesn't churn unrelated doctors' IDs or scheduling, keeping re-seeds true no-ops (`ON CONFLICT DO NOTHING`).
- **Fee/credential complexity is hand-curated, not derived.** A `SPECIALTY_META` table (fee band + primary board credential + niche flag per specialty) drives generation, rather than an algorithmic complexity score. A deliberate step so the demo data reads as clinically plausible rather than arbitrarily assigned.
- **Per-clinic schedule coverage is guaranteed, not left to chance.** Any "extra" available days beyond a doctor's clinic count are explicitly assigned to a random already-covered clinic, so every clinic a doctor is affiliated with always has at least one bookable block.
- **Requires migration `0005_nullable_sub_specialty.sql`** (trigger-based nullable `sub_specialty` design). See the "Branch integration" entry above for the still-unresolved conflict with main's alternate `0003_nullable_subspecialty.sql` design.
### 2026-08-19: Demo doctor auth provisioning & GoTrue identity repair
**Task:** 1.4 / Auth Repair
**Owner:** Coding agent
**What changed:** Provisioned all 8 demo doctor accounts through the official Supabase GoTrue Admin API (`scripts/seed_doctors.js`). Resolved the `500 Database error querying schema` root cause caused by raw SQL seed insertion having mismatched `provider_id` / missing identity relations. Verified that all 8 demo accounts authenticate successfully via `signInWithPassword` and receive valid JWT sessions.
**Files touched:**
- `scripts/seed_doctors.js` [NEW]: automated seed script using GoTrue Admin API.
- `supabase/seeds/fix_auth_identities.sql` [NEW]: repair script.
- `supabase/seeds/seed_ophthalmology.sql` [MODIFIED]: updated schema definitions for auth identities and users.
**Notes/trade-offs:**
- **Full Auth Verification:** 100% of all 8 doctor accounts now log in with 200 OK.

### 2026-08-19: Doctor profile detail & slot booking page
**Task:** 4.2
**Owner:** Coding agent
**What changed:** Built `/patient/doctors/[id]`. The doctor profile detail and interactive appointment booking page. The dynamic route fetches full credentials, verified license status, practice locations, consultation fees, HMO accreditations, and open schedule slots. Available slots (`is_booked === 'available'` and `date >= today`) are grouped chronologically by calendar date with 12-hour AM/PM formatting. Patients can select a slot, input an optional consultation note, and submit an appointment request (`status: 'pending'`). Leveraged the PostgreSQL database trigger `trg_sync_slot_status` to automatically transition the slot to `'booked'` upon appointment creation with concurrency protection.
**Files touched:**
- `src/app/patient/doctors/[id]/page.tsx` [NEW]: dynamic doctor profile and slot booking route with Suspense wrapper, credentials display, interactive slot calendar grouped by date, booking confirmation modal, and success panel.
**Notes/trade-offs:**
- **Automated slot sync (Assumption 1).** The database trigger `trg_sync_slot_status` handles updating `schedule_slots.is_booked = 'booked'` as a single atomic transaction during `appointments` insertion.
- **Double-booking concurrency protection (Assumption 2).** Database partial unique index `idx_appointments_active_slot` on `appointments(slot_id)` prevents race conditions; catch error code `23505` to surface a clear notification if two users pick the same slot simultaneously.
- **End-to-end booking flow active:** Patients can now navigate from intake, then AI match, then doctor ranking, then profile view, then appointment booking.

### 2026-08-19: Doctor list screen: HMO verification + multi-factor ranking
**Task:** 4.1
**Owner:** Coding agent
**What changed:** Built `/patient/doctors`. The doctor list screen implementing the PRD Section 8.4 multi-factor ranking algorithm and Section 8.3 HMO matching intelligence layer. The page retrieves doctors with associated clinics, schedule slots, and reviews from Supabase. It ranks doctors across 4 deterministic tiers: (1) exact sub-specialty match strength, (2) HMO coverage, (3) review rating, and (4) soonest available schedule slot. Matching doctors display an explicit `Covered by [HMO]` badge; when no sub-specialty doctor accepts the patient's HMO, an advisory banner surfaces the mismatch with estimated cash consultation rates instead of silently hiding doctors. Each doctor card shows verified badge, credentials, clinic location, fee, accredited HMO tags, earliest open slot, and a CTA linking to `/patient/doctors/[id]`.
**Files touched:**
- `src/lib/doctorRanking.ts` [NEW]: ranking engine calculating sub-specialty alignment, HMO coverage, rating average, earliest available slot date/time, and HMO mismatch detection.
- `src/app/patient/doctors/page.tsx` [NEW]: patient doctor directory page with Suspense wrapper, active search recap pills, HMO mismatch intelligence callout, sub-specialty filter pills, HMO toggle, and responsive doctor cards.
**Notes/trade-offs:**
- **Ranking over filtering (Assumption 1).** Rather than a simple binary filter, all relevant doctors are surfaced in prioritized order so patients can evaluate trade-offs between HMO coverage, sub-specialty fit, and scheduling urgency.
- **HMO mismatch intelligence (Assumption 2).** Directly addresses the pitch requirement: non-covered doctors are prominently displayed with cash rates when no in-network doctor matches the recommended sub-specialty.
- **Downstream contract for Task 4.2 (Assumption 6).** "View Profile & Book" buttons link directly to `/patient/doctors/${doctor.id}?hmo=${hmo}` for the upcoming booking screen.

### 2026-08-19: Tagalog free-text handling in AI symptom matching
**Task:** 3.5
**Owner:** Coding agent
**What changed:** Enhanced the AI clinical triage prompt in `src/app/api/match/route.ts` to support seamless Tagalog free-text symptom descriptions alongside English. The system prompt now applies dynamic language mirroring: when a patient describes symptoms in Tagalog, the plain-language clinical `reason` (and `question` if clarifying) is returned in natural, polite Tagalog; when given English symptoms, it responds in English. Canonical `specialty` and `sub_specialty` taxonomy identifiers are strictly maintained in English, preserving downstream database querying and Task 4.1 routing compatibility.
**Files touched:**
- `src/app/api/match/route.ts` [MODIFIED]: refined system prompt with explicit language mirroring and localization rules while retaining English taxonomy constraints.
**Notes/trade-offs:**
- **Language Mirroring on Explanations, English on Taxonomy (Assumption 1).** Patients read natural Tagalog reasoning tailored to their dialect, while the application layer continues using standard database taxonomy values (`"Ophthalmology"`, `"Retina"`, etc.) without requiring mapping dictionaries.
- **Zero latency overhead (Assumption 3).** Language detection and output localization occur within the single Gemini 2.5 Flash call.
- **End of Phase 3 Checkpoint achieved:** Patients can now enter symptoms in Tagalog or English, undergo emergency safety screening, receive AI specialty matching with mirrored explanations, and transition into doctor search.

### 2026-08-19: AI match result screen & emergency interstitial
**Task:** 3.4
**Owner:** Coding agent
**What changed:** Built the end-to-end patient symptom match outcome interface. Created `MatchResultView` supporting three distinct states: (1) Match Card with pipeline reasoning badges, specialty/sub-specialty tags, plain-language reason explanation, patient demographic recap, and a primary "Find Doctors" button linking to `/patient/doctors`; (2) Emergency Interstitial with calm advisory messaging, national emergency hotline links (911 & Philippine Red Cross 143), and strict omission of any booking actions; (3) Clarifying Question Turn allowing the patient to submit follow-up details in English or Tagalog with multi-turn history. Refactored `/patient/intake` to manage the full state machine (`'intake' | 'matching' | 'result'`) and wire `IntakeFlow`'s `onComplete` prop to `callMatchApi`.
**Files touched:**
- `src/components/MatchResultView.tsx` [NEW]: client component rendering the AI match card with pipeline step badges, the calm emergency advisory, or the inline clarification input turn.
- `src/app/patient/intake/page.tsx` [MODIFIED]: orchestrated full intake lifecycle: intake form submission, then animated loading state, then match result view, with multi-turn clarification state and retry capabilities.
**Notes/trade-offs:**
- **Unified in-page flow (Assumption 1).** Managing the intake form, loading state, and result screen within `/patient/intake` keeps patient context and `conversationHistory` in memory without requiring session storage or URL serialization.
- **Downstream contract for Task 4.1 (Assumption 4).** The "Find Doctors" button links to `/patient/doctors?specialty=${encodeURIComponent(specialty)}&sub_specialty=${encodeURIComponent(sub_specialty)}&hmo=${encodeURIComponent(hmo)}`, providing the exact query parameters needed by the upcoming doctor ranking & list screen.
- **Calm emergency interstitial (Assumption 2).** Adheres strictly to PRD 8.2 with an amber/slate palette and no booking button.

### 2026-08-19: Emergency safety gate logic
**Task:** 3.3
**Owner:** Coding agent
**What changed:** Implemented the calibrated emergency safety gate per PRD Section 8.2. A deterministic rule engine in `src/lib/safetyGate.ts` screens patient symptom text in English and Tagalog against 6 objective clinical emergency criteria (chest pain + dyspnea, chest pain + radiating arm/jaw pain, severe respiratory distress, unilateral stroke symptoms, loss of consciousness/fainting, and severe uncontrolled bleeding). The safety gate runs as a zero-latency pre-check inside `POST /api/match` and short-circuits immediately before any DB taxonomy fetch or Gemini LLM call. Also added `EmergencyResult` to `src/lib/matchApi.ts` types.
**Files touched:**
- `src/lib/safetyGate.ts` [NEW]: deterministic rule engine with bilingual (English & Tagalog) regex patterns for 6 calibrated emergency criteria; strictly avoids triggering on panic tone, punctuation, or all-caps intensity words alone.
- `src/lib/matchApi.ts` [MODIFIED]: added `EmergencyResult = { type: 'emergency'; message: string; matchedCriteria?: string }` to the `MatchApiResult` union.
- `src/app/api/match/route.ts` [MODIFIED]: integrated `checkEmergencySymptoms(symptomText)` right after input validation to short-circuit with a 200 OK `{ type: 'emergency', ... }` response.
**Notes/trade-offs:**
- **Zero latency & 100% deterministic (Assumption 1).** The safety gate does not rely on LLM prompts or network calls, avoiding hallucination, quota latency, and AI outages for critical safety triage.
- **Calibrated against anxiety/panic false positives (Assumption 2).** Purely emotional phrasing like `"I feel like I'm DYING"`, `"worst pain ever"`, or all-caps shouting does not trigger the gate unless an objective combination (e.g. chest pain + shortness of breath) is explicitly present. Anxious patients are safely passed through to regular specialty triage.
- **Calm, non-alarming tone (Assumption 5).** Message is phrased calmly: *"These symptoms can sometimes be serious. Please consider seeking urgent or emergency care."* Task 3.4 will render this interstitial without red flashing alarm UI.
- **Task 3.4 integration seam:** `callMatchApi` now returns `EmergencyResult` alongside `MatchResult` and `ClarifyResult`. The UI in Task 3.4 will branch on `result.type === 'emergency'` to display the emergency interstitial.

### 2026-08-19: AI symptom to specialty matching API route
**Task:** 3.2
**Owner:** Coding agent
**What changed:** Built `POST /api/match`. The AI pipeline stages 1 to 3 in a single Gemini API call. The route accepts a patient's free-text symptom description (plus optional demographics and multi-turn conversation history), fetches the live specialty taxonomy from Supabase, builds a constrained system prompt, calls Gemini `gemini-2.5-flash`, and returns one of two response shapes: `{ type: 'match', specialty, sub_specialty, reason }` or `{ type: 'clarify', question }`. Also built `src/lib/matchApi.ts` as the typed client-side helper so Task 3.4 and any future UI component can call the route without knowing its internals.
**Files touched:**
- `src/app/api/match/route.ts` [NEW]: POST Route Handler: validates request body, creates a Supabase service-role client, fetches `specialty_taxonomy` + `specialties` rows to embed in the system prompt, calls Gemini, parses the response, returns structured JSON.
- `src/lib/matchApi.ts` [NEW]: `callMatchApi()` fetch helper + exported types `MatchResult`, `ClarifyResult`, `MatchApiResult`, `MatchApiRequest`.
**Notes/trade-offs:**
- **Model used: `gemini-2.5-flash` via `@google/genai` v2.17.1.** Verified against the Gemini API.
- **Route is unauthenticated (Assumption 9, known gap, must harden).** The client is already auth-gated by `RequireRole`, but the route itself has no server-side session check. Adding one requires `@supabase/ssr` cookie handling that is not yet wired up. Flag for hardening before public demo. Anyone with the URL can call this route. Noted in two places: this entry and the code comment at the top of `route.ts`.
- **Taxonomy fetched at request time from Supabase (Assumption 3).** Service-role key bypasses RLS for this read. Adding a new specialty/sub-specialty to the DB propagates to the AI prompt automatically without a code redeploy. Trade-off: one extra DB round-trip per call (~20 to 50ms). Negligible at hackathon demo scale.
- **Multi-turn clarification built in (Assumption 7).** Pass `conversationHistory` on follow-up calls. Turn cap at `history.length >= 4` (2 Q&A pairs). The route injects a "force match" system note so the model can't keep asking questions forever. Frontend multi-turn UX (showing the clarifying question and sending the answer) is Task 3.4's responsibility.
- **Malformed AI response is a graceful fallback, not an error (Assumption 8).** `parseAIResponse()` strips markdown fences then tries `JSON.parse`. If that still fails, the route returns `{ type: 'clarify', question: "We couldn't quite understand..." }` as a 200 (not a 500). Raw AI text is logged server-side for debugging.
- **Temperature set to 0.1.** Low temperature produces more deterministic JSON output. Higher values risk the model adding prose around the JSON, breaking the parser.
- **`onComplete` in `IntakeFlow` is still unwired. Task 3.4 is responsible.** The pattern is documented in `src/lib/matchApi.ts` comments: render `<IntakeFlow onComplete={async (data) => { const result = await callMatchApi({...}); ... }} />`.
- **`conversationHistory` multi-turn UX also belongs to Task 3.4.** The API route handles multi-turn state; the UI for showing a clarifying question and collecting the patient's answer is not built yet.
**ENV VARS that teammates must add before testing:**
```
GEMINI_API_KEY=<from Google AI Studio>
SUPABASE_SERVICE_ROLE_KEY=<from Supabase Dashboard, then Project Settings, then API>
```
Both are server-only (no `NEXT_PUBLIC_` prefix). `NEXT_PUBLIC_SUPABASE_URL` is already present.


### 2026-08-19: Patient intake flow (3-step form)
**Task:** 3.1
**Owner:** Coding agent

**What changed:** Built the patient symptom-intake flow at `/patient/intake`. A 3-step form collects patient demographics (name, age, sex, location), HMO selection, and a free-text symptom description, then upserts a `patients` row and hands off the symptom text to a caller-provided `onComplete` hook. The patient dashboard stub card was replaced with a real "Check my symptoms" entry card linking to `/patient/intake`.
**Files touched:**
- `src/components/IntakeFlow.tsx` [NEW]: self-contained `'use client'` component with step state, per-step inline validation, prefill from existing `patients` row on mount, `patients` upsert on submit, optional `onComplete(data)` prop, and a fallback "coming soon" confirmation panel when no prop is passed.
- `src/app/patient/intake/page.tsx` [NEW]: route page; wraps `IntakeFlow` in `RequireRole role="patient"`, matching the doctor profile-setup pattern.
- `src/app/patient/dashboard/page.tsx` [MODIFIED]: replaced the placeholder stub card with a real "Check my symptoms" entry card (`<a href="/patient/intake">`). Header, sign-out button, and `RequireRole` wrapper left untouched.
**Notes/trade-offs:**
- **`onComplete` is currently unused by any caller (Assumption 5, explicit follow-on needed).** The prop exists so Tasks 3.2 (AI matching API route) and 3.4 (result screen) can wire into this component without touching it again. Until those tasks are built, every submit falls through to the built-in "coming soon" confirmation panel. Task owners for 3.2 and 3.4 **must remember to pass `onComplete` when embedding `IntakeFlow`**. This note is the reminder.
- **"None/Cash" writes `null` to `hmo_provider`, not the string (Assumption 4).** The HMO button group has `value: null` for "None or Cash." The upsert sends `hmo_provider: null`. Task 4.1 (HMO matching) should check for `null` hmo_provider as the "skip HMO matching" signal.
- **Prefill on return visits (Assumption 3).** Steps 1 to 2 are prefilled from the `patients` row on mount. Step 3 (symptom text) always starts blank. It's visit-specific.
- **Sex and HMO use button groups, not `<select>` (Assumption 6).** Large-tap `<button>` grid with clear selected-state highlight. Easier on touchscreen and less cognitively demanding for less tech-savvy users (PRD 8.7).
- **`patients` RLS verified from migration `0001_initial_schema.sql`.** `patients_insert_own`, `patients_update_own`, and `patients_select_own` are already in place. No new migration needed for this task.
- **No redirect gate on `/patient/dashboard` (Assumption 1).** Intake is not enforced as a pre-condition for viewing the dashboard (unlike the doctor profile gate). The dashboard just surfaces the entry card. This is intentional: a patient returning to check appointment status shouldn't be forced through intake again.
- **No "Booking for a family member" toggle built (Assumption 9, out of scope).** PRD 8.7 mentions this; Task 5.2 adds it. The flow is self-contained enough that it can be prepended to the front of `IntakeFlow` later without restructuring.


### 2026-08-19: Doctor appointments dashboard
**Task:** 2.3

**Owner:** Coding agent
**What changed:** Built `AppointmentsDashboard`, the doctor-facing view for managing appointment requests. The component renders above `ScheduleManager` on the doctor dashboard so pending decisions are always the first thing a doctor sees. It has two sections: (1) "Pending appointments". All pending appointments for the doctor in FIFO order (oldest `created_at` first), each showing patient name/age/sex, symptom summary, and the requested slot date/time/clinic, with Accept and Decline buttons; (2) "Upcoming confirmed appointments". Confirmed appointments with a slot date today-or-later, sorted soonest first, read-only. Realtime subscription on `appointments` filtered by `doctor_id` keeps both lists live without a page refresh.
**Files touched:**
- `src/components/AppointmentsDashboard.tsx` [NEW]: self-contained client component: parallel-fetches pending and confirmed appointments on mount (with joins to `patients` and `schedule_slots, then clinics`), optimistic removal on accept/decline, update-guarded write (`.eq('status','pending')`), Supabase Realtime subscription on `postgres_changes` for `appointments` filtered by `doctor_id=eq.<uid>`, loading/error states, and empty states. All matching `ScheduleManager.tsx` in pattern.
- `src/app/doctor/dashboard/page.tsx` [MODIFIED]: imported `AppointmentsDashboard` and rendered it above `<ScheduleManager />` inside the existing `checkingProfile` gate.
**Notes/trade-offs:**
- **Only `appointments.status` is written on accept/decline.** The `trg_sync_slot_status` trigger (from `002_slot_appointment_triggers.sql`) flips `schedule_slots.is_booked` to `'booked'` on confirm and back to `'available'` on decline automatically. Writing to the slot directly from this component would race the trigger and is deliberately avoided (Assumption 3).
- **Update guard against double-click / second-tab race (Assumption 4).** The update is scoped with `.eq('status', 'pending')` so a second action on an already-actioned appointment affects zero rows. Zero rows, then treated as "already actioned by someone else", then re-fetch reconciles, no hard error surfaced.
- **Client-side filter for confirmed-upcoming list (Assumption 5).** Supabase embedded-resource filters (filtering on a nested `schedule_slots.date`) filter the nested object *per row*, not which parent rows come back. All confirmed appointments are fetched and filtered/sorted in JS. Acceptable at hackathon demo volume.
- **Realtime uses a full re-fetch on any event (INSERT/UPDATE/DELETE).** The raw `postgres_changes` payload does not include nested join data (`patients`, `schedule_slots`, `clinics`). A per-event partial state merge would require manually reconstructing the join data, which is error-prone. Re-fetching the full appointment list (two parallel queries) on each event is simpler, correct, and negligible at demo scale.
- **Patient context kept minimal per Assumption 6.** Shows `name`, `age`, `sex`, and `symptom_summary` only. `location` and `hmo_provider` are available in the `patients` table and could be a quick follow-on if richer doctor context is wanted.
- **Realtime subscription is a deliberate pull-forward of Task 4.4** (requirement: "new booking correctly and immediately appears in the doctor's pending appointments dashboard"). Flagged here explicitly per Assumption 8.
- **Precondition (Assumption 9):** Migrations `0001_initial_schema.sql` (clinics table, slot_status enum) and `002_slot_appointment_triggers.sql` (trg_sync_slot_status, trg_check_slot_clinic_doctor_match) must be applied to the live Supabase project before testing. The trigger is what makes accept/decline automatically flip the slot status. Without it, the appointment status updates but the slot stays in its old state.
- **RLS-tightening TODO still outstanding (Assumption 7 / Tasks 4.2 and 2.3).** `appointments_update_involved` in `0001_initial_schema.sql` allows either the patient or the doctor on the appointment to update the row, with a `TODO` comment to tighten this (patients should only cancel; doctors should only accept/decline/complete). This task now supplies the doctor-side update shape (`status, then 'confirmed' | 'declined'`). The tightened policy should be implemented in a follow-up task (originally flagged in the Task 2.1 entry as 4.2, now also touched here as 2.3 scope). **This TODO has now been noted in two build log entries without being resolved. It should be a prioritised item in the next session.**


### 2026-08-18: Doctor schedule management
**Task:** 2.2
**Owner:** Coding agent
**What changed:** Built the doctor schedule management UI. Doctors can now add available time slots (clinic, date, start/end time), see all upcoming slots grouped by date with status badges, and delete available slots. The dashboard's "Routing & auth stub" placeholder was replaced with the real `ScheduleManager` component.
**Files touched:**
- `src/components/ScheduleManager.tsx` [NEW]: self-contained component: loads the doctor's clinics and upcoming slots on mount, add-slot form with client-side validation, delete button (available slots only), grouped-by-date slot list with status badges, and a Supabase Realtime subscription
- `src/app/doctor/dashboard/page.tsx` [MODIFIED]: imported `ScheduleManager`, replaced the stub placeholder card with `<ScheduleManager />`. Header, sign-out, `RequireRole` wrapper, and `checkingProfile` logic were left untouched.
**Notes/trade-offs:**
- **`clinic_id` is required on every slot insert.** The DB trigger `trg_check_slot_clinic_doctor_match` rejects any slot where `clinic_id.doctor_id ≠ slot.doctor_id`. The form always populates `clinic_id` from the doctor's own clinic list, so this can't misfire through the UI. But the constraint matters if the table is ever written to directly.
- **Booked slots are deliberately non-deletable.** A slot with `is_booked = 'booked'` has a patient attached (via an appointment). The Delete button is hidden on those rows and an informational note is shown instead ("A patient has booked this slot"). Cancellation of booked appointments (which would free the slot back to `available` via the DB trigger) is out of scope here. That's Task 2.3/4.2.
- **Real-time sync uses Supabase Realtime** on `public.schedule_slots` filtered by `doctor_id=eq.<uid>`. INSERT/UPDATE/DELETE events update the local slot state directly without a re-fetch. The channel is cleaned up in the `useEffect` return to prevent leaks on unmount.
- **No slot overlap validation client-side:** intentional. A doctor can legitimately offer overlapping slots at different clinics (different `clinic_id`). The DB has no unique constraint on time ranges.
- **Optimistic local append on insert:** after a successful slot insert, the new row is appended to local state and re-sorted rather than re-fetching the whole list. This keeps the UI snappy.

### 2026-08-18: Specialty taxonomy seed (re-seed after DB wipe)
**Task:** 1.4
**Owner:** Coding agent
**What changed:** Seeded `public.specialty_taxonomy` and `public.specialties` with the Ophthalmology specialty and its four sub-specialties (Retina, Cataract, Glaucoma, Pediatric Ophthalmology). Also added `General Practice` to `public.specialties`. The database was wiped during a schema rework (adding the `clinics` table and changing `doctors` to drop `rate`/`location`), which cleared the taxonomy rows that had been seeded previously. This is a re-seed, not a first-time seed.
**Files touched:**
- `supabase/seeds/seed_taxonomy_only.sql` [NEW]: standalone re-runnable script that seeds only `specialty_taxonomy` and `specialties`; does not touch `auth.users`, `doctors`, `clinics`, or `schedule_slots`. Safe to paste into the Supabase SQL Editor at any time.
- `supabase/seeds/seed_ophthalmology.sql`. Unchanged; still contains the full 8-doctor demo seed (auth users + doctors + clinics + slots) for the Pampanga Ophthalmology demo. Run separately when the full demo accounts are needed.
**Notes/trade-offs:**
- Taxonomy seeding is a manual SQL Editor step (service-role only, the taxonomy tables have no INSERT policy for authenticated users). The `seed_taxonomy_only.sql` script exists specifically so future re-seeds don't require pulling the full doctor seed or remembering the exact SQL.
- `General Practice` is not in `specialty_taxonomy` (by design, it has no sub-specialty rows). It lives only in `specialties`, which is the table the profile-setup form reads for the specialty dropdown's complete list.

### 2026-08-18: Make `doctors.sub_specialty` nullable (general practitioners)
**Task:** 2.1 (follow-up)
**Owner:** Coding agent
**What changed:** `doctors.sub_specialty` was NOT NULL, which prevented general practitioners (who have no sub-specialty) from creating a profile. This change drops the NOT NULL constraint, adds a `public.specialties` lookup table to preserve specialty-level validation, and updates the Task 2.1 profile-setup form so the sub-specialty field is hidden when the selected specialty has no taxonomy entries (e.g. "General Practice") and `sub_specialty = NULL` is submitted to the database.
**Files touched:**
- `supabase/migrations/0003_nullable_subspecialty.sql` [NEW]: drops NOT NULL on `sub_specialty`; creates `public.specialties` table (backfilled from `specialty_taxonomy` + `'General Practice'` row); adds `doctors_specialty_fk` FK from `doctors.specialty` to `specialties.specialty`; RLS policy on `specialties`
- `docs/liquid-prd.md` [MODIFIED]: Change Log row added; Section 6 Doctor model updated to mark `sub_specialty` as nullable with explanation; Section 8.5 general-practice note added
- `src/app/doctor/profile-setup/page.tsx` [MODIFIED]: `'General Practice'` prepended to specialty list; `isGeneralPractice` derived from whether taxonomy has sub-entries for the selected specialty; sub-specialty field conditionally rendered (hidden when `isGeneralPractice`); form validation updated to not require sub-specialty for general practitioners; upsert sends `sub_specialty: subSpecialty || null` (never an empty string)
- `docs/BUILD_LOG.md` [MODIFIED]: this entry
**Notes/trade-offs:**
- **Design decision, `public.specialties` table (not a trigger):** The existing composite FK `doctors(specialty, sub_specialty)` referencing `specialty_taxonomy` uses Postgres MATCH SIMPLE: it skips validation entirely when `sub_specialty` is NULL. Simply dropping NOT NULL would have left `specialty` unvalidated for general-practice doctors. Two options were considered: (a) a `BEFORE INSERT/UPDATE` trigger that checks `specialty` against `specialty_taxonomy` when `sub_specialty IS NULL`, or (b) a small `public.specialties` lookup table with a second FK. Option (b) was chosen because it's fully declarative. No trigger code to maintain. And incurs negligible overhead. The team should be aware of this and can revisit (switch to a trigger approach) if the separate `specialties` table feels like extra schema weight post-hackathon.
- **`'General Practice'` hardcoded in `specialties`:** The label is inserted explicitly in the migration (not derived from taxonomy). If the team later changes the label (e.g. to "Family Medicine"), both the migration and the `specialties` list in `page.tsx` need updating.
- **`isGeneralPractice` is taxonomy-driven, not string-matched:** The form hides sub-specialty whenever the selected specialty has zero taxonomy entries. So any future specialty added to `public.specialties` but not to `specialty_taxonomy` will automatically behave like "General Practice" without code changes.
- **Seed data TODO:** Any future seed rework should include at least one general-practice doctor with `sub_specialty = NULL` to exercise this path in the demo.
- **Migration not applied automatically:** Per the build brief, Zin will apply `0003_nullable_subspecialty.sql` manually via the Supabase SQL Editor. Do not run `supabase db push` against the live project.

### 2026-08-18: Task 2.1 rework: doctor profile setup updated for multi-clinic schema
**Task:** 2.1 (Rework, supersedes the 2026-08-15 entry below)
**Owner:** Coding agent
**What changed:** The original Task 2.1 build (2026-08-15) wrote `rate` and `location` directly into the `doctors` table. Those columns no longer exist after the 2026-08-15 schema rework that extracted them into the new `clinics` table. This rework rewrites both frontend files against the updated schema. The profile setup form now collects two logical entities: doctor details (name, credentials, specialty, sub_specialty) and first-clinic details (clinic name, room details, location, consultation_fee). These are written as two sequential Supabase calls. An `upsert` into `doctors` followed by an `insert` into `clinics`. The dashboard gate was also updated so that "profile complete" now means a `doctors` row *and* at least one `clinics` row both exist; a doctor with only a `doctors` row (partial-failure state) is redirected back to the setup page, which pre-fills their already-saved doctor data so they don't have to retype it.
**Files touched:**
- `src/app/doctor/profile-setup/page.tsx` [MODIFIED]: removed `rate`/`location` fields; added `clinicName`, `roomDetails`, `clinicLocation`, `consultationFee` fields; changed insert to a `doctors` upsert + `clinics` insert; added partial-failure pre-fill logic on load
- `src/app/doctor/dashboard/page.tsx` [MODIFIED]: `checkProfile` now also queries `clinics` for at least one row; redirects to setup if either the `doctors` row or any `clinics` row is missing
**Notes/trade-offs:**
- **`upsert` on `doctors`, not `insert`**: If a prior submission saved the doctor row but the clinic insert failed (no cross-table transaction in the Supabase JS client), resubmitting would have thrown a duplicate-key error with a plain `insert`. `upsert` keyed on `id` makes re-submission safe.
- **Two-step write, no transaction**: If the `doctors` upsert succeeds but the `clinics` insert fails, the user is shown an error message telling them their profile was saved but the clinic wasn't, and asking them to submit again. On re-submit the upsert silently overwrites the `doctors` row and the `clinics` insert is retried. This is the agreed recovery path per the design doc (design decision #2).
- **One clinic at setup only**: The multi-clinic schema supports many clinics per doctor, but collecting a *second* clinic post-onboarding is explicitly out of scope for this task and has no assigned roadmap task yet. Flagged for the team to pick up.
- **HMO accreditations still not collected here**: unchanged from original Task 2.1 scope; still seeded via Task 1.4.

### 2026-08-15: PRD schema rework for multi-clinic support
**Task:** 1.2 (Rework Proposal)
**Owner:** Coding agent
**What changed:** Reworked the database schema to better fit the Philippine medical system. Extracted location and pricing data from the Doctor table into a new `Clinic / Practice Location` table to support multiple hospital affiliations. Updated the Schedule Slot table to link directly to a clinic and replaced the simple boolean booking toggle with a status enum (`available` / `booked` / `doctor_on_leave`) to handle emergency leaves. Added two triggers to keep the new structure consistent: one that syncs a slot's status with its appointment's status (booked/freed automatically on insert, status change, or delete), and one that rejects a slot whose `clinic_id` doesn't belong to its own `doctor_id`.
**Files touched:**
- `supabase/migrations/0001_initial_schema.sql` (reworked: added `clinics` table, added `clinic_id` + `slot_status` enum to `schedule_slots`, removed `rate`/`location` from `doctors`, added clinic RLS policies)
- `supabase/migrations/0002_slot_appointment_triggers.sql` (new: `sync_slot_status` and `check_slot_clinic_doctor_match` triggers)
- `/docs/liquid-prd.md` (schema section updated to match)
**Notes/trade-offs:**
- This normalizes the database and reflects real-world human behavior in the PH, but it means the frontend booking flow will need to expand from two steps to three (Select Doctor, then Select Clinic, then Select Time Slot).
- The `doctor_on_leave` enum value lets secretaries block out times without deleting slots outright.
- Slot/appointment sync and slot/clinic/doctor consistency are now enforced at the DB level via triggers rather than relying on the app layer to keep them in sync. This closes a gap flagged in the original schema draft.
- Open item: no DB-level guard yet preventing a doctor from double-booking across overlapping time ranges within the same clinic (only exact slot reuse is blocked); worth a follow-up if that turns out to matter for the demo.

### 2026-08-15: Doctor profile setup form
**Task:** 2.1
**Owner:** Coding agent
**What changed:** Built the doctor profile-setup page at `/doctor/profile-setup`. The form collects full name, credential filename (placeholder only, no file storage), specialty, sub-specialty (filtered by selected specialty from `specialty_taxonomy`), consultation rate in PHP, and clinic location. On submit it inserts a row into `public.doctors` with `id = auth.uid()` (required by the `doctors_insert_own` RLS policy) and redirects to `/doctor/dashboard`. Updated `/doctor/dashboard` to check for an existing `doctors` row on mount and redirect to profile setup if none exists, closing the gap where a newly-signed-up doctor would land on the dashboard with no profile row yet.
**Files touched:**
- `src/app/doctor/profile-setup/page.tsx` [NEW]: full profile setup form; guarded by `RequireRole`, skips itself if a profile already exists, validates specialty/sub-specialty pairing against `specialty_taxonomy` rows fetched from DB
- `src/app/doctor/dashboard/page.tsx` [MODIFIED]: added `checkProfile` effect that redirects to `/doctor/profile-setup` when no `doctors` row exists; dashboard content only renders after that check passes; spinner shown during the async check
**Notes/trade-offs:**
- **Create-only, not an edit screen.** If a `doctors` row already exists when the page loads, it redirects immediately to the dashboard. Editing an existing profile is out of scope for this task.
- **`id` set explicitly from session.** `doctors.id` has no default and RLS requires `auth.uid() = id`. The insert explicitly sets `id: session.user.id`. If the session expired between page load and submit, the error is caught and surfaced to the user.
- **HMO accreditations not collected here.** The form doesn't include an HMO field. The `hmo_accreditations text[]` column defaults to `{}`. Per the task brief, accreditations are populated via the seed process (Task 1.4) for MVP. A doctor signing up live gets an empty array until that data is seeded separately.
- **Credential field is filename-only.** No actual file upload wiring. The UI makes this explicit with a disclaimer line under the file picker.
- **Taxonomy must be seeded** for the specialty dropdowns to have any options. If `specialty_taxonomy` is empty, the page shows an amber warning and the form can't be meaningfully submitted.

### 2026-08-15: Sign-up / login for patient and doctor roles
**Task:** 1.3
**Owner:** Coding agent
**What changed:** Added Supabase Auth sign-up and login for two roles (`patient` and `doctor`). Each role gets a combined auth page (`/doctor/auth`, `/patient/auth`) with a login/signup toggle rather than two separate routes. After auth succeeds, users are redirected to their own dashboard stub (`/doctor/dashboard`, `/patient/dashboard`). Dashboard pages are protected by a client-side `RequireRole` guard that checks the session and bounces unauthenticated or wrong-role visitors immediately.
**Files touched:**
- `src/lib/auth.ts` [NEW]: `signUpWithRole`, `signIn`, `getRoleFromUser`, `dashboardRouteForRole`, `authRouteForRole` helper functions
- `src/components/AuthForm.tsx` [NEW]: shared email/password form; parent passes `mode` and `role`
- `src/components/RequireRole.tsx` [NEW]: client-side route guard; renders a spinner while checking session, then redirects or renders children
- `src/app/doctor/auth/page.tsx` [NEW]: doctor/secretary auth page (login + signup toggle, indigo accent)
- `src/app/patient/auth/page.tsx` [NEW]: patient auth page (login + signup toggle, teal accent)
- `src/app/doctor/dashboard/page.tsx` [NEW]: doctor dashboard stub, guarded by RequireRole
- `src/app/patient/dashboard/page.tsx` [NEW]: patient dashboard stub, guarded by RequireRole
**Notes/trade-offs:**
- **Role stored in `user_metadata`, not a table column.** `signUp()` sets `options: { data: { role } }` so the role is readable immediately from the session without any DB query. This was necessary because `doctors` rows aren't created until profile setup (Task 2.1) and `patients` rows until the intake flow (Task 3.1). So right after signup there's no row in either table to infer the role from.
- **No `patients`/`doctors` rows written at signup.** This task only creates the `auth.users` row. Profile rows are created in Tasks 2.1 (doctor) and 3.1 (patient). The dashboard stubs render fine before those rows exist.
- **Route guarding is client-side only.** `RequireRole` calls `supabase.auth.getSession()` in a `useEffect`. This means an unauthenticated user could briefly see the dashboard before the redirect fires (mitigated by rendering a spinner instead of content while the check is in flight). A hardened server-side guard would need `@supabase/ssr` + cookie-based session handling and a `middleware.ts` file. Flagged as a "harden later" item if this ever goes to a public URL longer than a demo.
- **One email = one role.** Supabase ties one email/password pair to one `auth.users` row, so the same email can't hold both roles. Testers needing both roles should use two email addresses.
- **Email confirmation is OFF:** must be disabled in Supabase Dashboard, then Authentication, then Providers, then Email. Without this, `signUp()` won't return an active session and the immediate redirect after signup will fail.

### 2026-08-14: Supabase schema, RLS, and client setup
**Task:** 1.2
**Owner:** Coding agent
**What changed:** Created all six database tables from PRD Section 6 (`specialty_taxonomy`, `patients`, `doctors`, `schedule_slots`, `appointments`, `reviews`) with correct column types, foreign keys, check constraints, and indexes. Enabled Row-Level Security on every table and added a starter policy set. Created the Supabase JS client helper at `src/lib/supabaseClient.ts` (the correct location for the `@/*` alias). Deleted the empty root-level `lib/supabaseClient.ts` placeholder that was there before.
**Files touched:**
- `supabase/migrations/0001_initial_schema.sql` [NEW]: full schema + RLS SQL; paste into Supabase SQL Editor or apply via `supabase db push`
- `src/lib/supabaseClient.ts` [NEW]: Supabase anon-key client, importable as `@/lib/supabaseClient`
- `lib/supabaseClient.ts` + `lib/` directory [DELETED]: replaced by `src/lib/`
**Notes/trade-offs:**
- **`patients`/`doctors` to `auth.users` FK design**: Both tables use `auth.users(id)` as their own primary key (no separate `auth_user_id` column). Role is determined by which table a row exists in. If Task 1.3 creates bare `doctors` rows at signup, `name`/`specialty`/`rate` constraints will need to relax to nullable. That's a PRD Change Log entry.
- **Composite FK `doctors(specialty, sub_specialty)` to `specialty_taxonomy`**: Enforces the taxonomy constraint at the DB level (PRD Section 8.1 assumed it; this makes it explicit). Doctors can't be created with a specialty/sub_specialty pair that isn't in the seeded taxonomy table.
- **`lib/` to `src/lib/` relocation**: `tsconfig.json` maps `@/*` to `./src/*` only. Anything importing `@/lib/supabaseClient` would have silently failed at runtime with the old root-level `lib/`. File is now at `src/lib/supabaseClient.ts`.
- **`appointments_update_involved` RLS policy is intentionally broad:** tighten it in Task 4.2/2.3 once the exact per-role update shapes are known.
- **Review "completed appointment" gate is app-level only:** check `appointment.status === 'completed'` before showing the review form. A DB trigger can enforce this server-side if needed (Task 5.1).
- **No `@supabase/ssr` yet:** the current client is the anon-key browser client. Cookie-based session handling for Server Components / Route Handlers is a Task 1.3 decision.

### [Fill in Day 1]: Repo, PRD, and roadmap committed
**Task:** 1.0
**Owner:** A
**What changed:** Created the GitHub repo, added the PRD, roadmap, and this build log to `/docs`.
**Files touched:** `/docs/liquid-prd.md`, `/docs/liquid-roadmap.md`, `/docs/BUILD_LOG.md`
**Notes/trade-offs:** None.

<!-- New entries go above this line, newest on top -->
