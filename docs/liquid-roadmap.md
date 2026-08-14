# Team Liquid — Build Roadmap
## Civic Access: Doctor Discovery & Booking Platform (CanYouHackIt, Clark)

**Team size:** 5
**Duration:** 14 days
**Companion doc:** liquid-prd.md (this roadmap breaks that PRD into daily, assignable tasks)

---

## 0. How to use this roadmap

Every task below follows the same two-step pattern for vibe coding:

1. **Meta-prompt** — a prompt you give to a reasoning AI (Claude, ChatGPT, etc.) to have IT draft the actual, detailed build prompt for you. Copy it, fill in the `[bracket]` if any, and paste it in.
2. **Build prompt output** — what step 1 gives you back is what you paste into your coding agent (Claude Code, Cursor, Windsurf, etc.) to actually generate code.

Don't skip step 1. A generic "build me a booking form" prompt straight to a coding agent produces generic, disconnected code. Routing it through a meta-prompt first forces the AI to pull in your actual data models, your actual screen list, and your actual feature logic from the PRD — which is what keeps 5 people's AI-generated code compatible with each other.

**The PRD lives in the repo.** Task 1.0 below has everyone commit `liquid-prd.md` into the repo (as `/docs/liquid-prd.md`) before any feature work starts. This changes how you reference it in prompts:

- **If your coding agent can read the repo directly** (Claude Code, Cursor, Windsurf, or any agent pointed at your project folder) — instead of pasting PRD sections into every prompt, just say: *"Refer to `/docs/liquid-prd.md` in this repo for the full data models, feature specs, and screen list before doing this task."* The agent reads it itself. This is the preferred approach once the file exists in-repo.
- **If you're using a chat-only AI with no repo access** (e.g. a plain ChatGPT/Claude web tab for the meta-prompt step) — you still need to paste the relevant PRD section(s) in manually, since it can't read your files.

Every meta-prompt below still shows `[paste PRD Section X]` as the fallback for chat-only tools — swap that for *"see `/docs/liquid-prd.md` in the repo"* whenever your agent has repo access.

**Golden rule for a 5-person AI-assisted team:** every task's prompt needs the PRD as grounding, one way or the other. Context is what makes vibe coding produce compatible code instead of five disconnected mini-apps.

**Every build prompt should also update the build log.** There's a `/docs/BUILD_LOG.md` file (see the companion file — commit it in Task 1.0 alongside the PRD) that tracks what's been built, in plain language, so teammates who aren't comfortable digging through git history can just read one file to see what changed and why. From now on, add this line to the end of every build prompt you give an agent:

> "After completing this, append an entry to `/docs/BUILD_LOG.md` following the existing format in that file — what was built, which files were touched, and any decisions or trade-offs made."

This only works if it's habitual — if even one task skips it, the log has a gap. Make it part of your task-completion checklist, not optional.

### If you need to make a major scope change mid-hackathon

1. **Add a row to the PRD's Change Log** (top of `liquid-prd.md`) describing the change and why.
2. **Update the actual PRD sections it touches** — usually Section 4 (Data Models) and/or Section 6 (Feature Logic Specs). Don't leave the Change Log and the spec disagreeing.
3. **Check this roadmap for any task whose meta-prompt references the section you just changed** — those meta-prompts are now stale. You don't need to rewrite the whole roadmap; just flag it verbally at standup ("Section 4 changed, anyone using the Doctor model prompt should re-check it").
4. **Timing check:** a change in Phase 1-2 is nearly free. The same change in Phase 4-5, after screens are already built against the old schema, means real rework — if you're deep into Phase 4+, weigh whether the change is worth it before committing to it.

---

## 1. Team Roles (5 people)

| Role | Person | Owns |
|---|---|---|
| **A — Backend & Data Lead** | ___ | Database schema, auth, API routes, seed data pipeline |
| **B — Patient Experience Lead** | ___ | Patient-side screens: intake, AI match result, doctor list/booking |
| **C — Doctor/Secretary Experience Lead** | ___ | Doctor-side screens: sign-up, profile, schedule, appointments dashboard |
| **D — AI/Integration Lead** | ___ | LLM symptom matching, safety gate logic, prompt engineering, Tagalog handling |
| **E — Design, Content & Pitch Lead** | ___ | UI/UX consistency, specialty taxonomy content, accessibility copy, demo script, pitch deck |

Assign names now — every task below is tagged with the role responsible, not a name, so you can plug people in.

---

## 2. Phase Overview

| Phase | Days | Focus |
|---|---|---|
| Phase 1 | 1-2 | Foundation: repo, schema, auth, seed data skeleton |
| Phase 2 | 3-5 | Doctor/secretary side built first (simpler, unblocks real data) |
| Phase 3 | 6-9 | Patient intake + AI matching + safety gate (riskiest piece) |
| Phase 4 | 10-11 | Doctor list, filtering, booking flow — connect both sides |
| Phase 5 | 12-13 | Should-have features + accessibility + polish |
| Phase 6 | 14 | Rehearsal, backup demo, pitch |

---

## 3. Git Branching Workflow

This is how all 5 of you work in parallel without anyone's push breaking the live app. Set this up as part of Task 1.0, before any feature work starts.

### The workflow

1. **Protect the main branch.** On GitHub: Settings → Branches → Add branch protection rule for `main`. Enable "Require a pull request before merging" and "Require at least 1 approval." This makes it physically impossible for anyone to push broken code straight to main, even by accident.
2. **Create one feature branch per task.** Nobody works directly on main. Before starting any roadmap task, branch off main: `git checkout -b feature/1.2-database-schema` — name it after the roadmap task number (e.g. `feature/3.2-ai-matching`) so it's traceable back to the roadmap and build log.
3. **Commit and push to your own branch.** Work normally, commit as you go, push to your branch: `git push -u origin feature/1.2-database-schema`. This is invisible to everyone else and never touches the live main app.
4. **Open a Pull Request when the task is done.** Open a PR from your branch into main. Vercel automatically builds a preview deployment for that PR with its own unique URL, so anyone can click around the actual working feature before it touches main.
5. **Get one teammate to review before merging.** Since branch protection requires an approval, have one other person (ideally whoever owns a related task) glance over the diff and click the preview URL. Catches breakage before it reaches main, not after.
6. **Merge, then delete the branch.** Once approved, merge the PR into main. Vercel auto-deploys main to your real production URL. Delete the feature branch afterward — GitHub offers a one-click button right after merging.
7. **Pull main before starting your next branch.** Before creating your next feature branch, run `git checkout main` then `git pull` to get everyone else's merged work first. Branching off a stale main is the #1 cause of painful merge conflicts later.

### Where conflicts actually happen

Most of your work won't overlap in the same files, since roles are split by screen/feature (Patient side, Doctor side, AI logic). The real risk is **shared files** — `/lib/supabaseClient.ts` and the Data Models from PRD Section 4 in particular. If two people need to touch the Doctor table schema on the same day, that's when conflicts happen. Cheap fix: say so at standup ("I'm touching the Doctor table today") so nobody else branches off a stale version of it mid-edit.

### Tie this to the build log habit

Treat "task done" as one sequence: commit → push → append the `BUILD_LOG.md` entry → open the PR. Doing all four together means nothing gets forgotten, and Vercel's preview URL gives even non-technical teammates a way to verify a PR actually works — they can click the link instead of needing to read the code.

---

## PHASE 1 — Days 1-2: Foundation

### Task 1.0 — Create the repo and commit the PRD — *Owner: A, first thing, before anyone else starts*
Do this before any other setup so every subsequent task and prompt can point back to it.

1. Create a new GitHub repository (e.g. `civic-access` or your final app name). Add a `.gitignore` for Node (GitHub gives you a template at creation, or use `npx gitignore node`).
2. Clone it locally: `git clone <repo-url>`
3. Inside the repo, create a `/docs` folder and place your PRD there as `/docs/liquid-prd.md` (copy the full content of `liquid-prd.md` into it).
4. Also create `/docs/liquid-roadmap.md` (this roadmap) and `/docs/BUILD_LOG.md` (copy the starter template provided) — the build log is what keeps non-technical teammates in the loop on what's actually been built, without needing to read code or git history.
5. Commit and push:
   ```
   git add .
   git commit -m "Add PRD, roadmap, and build log docs"
   git push
   ```
6. Add all 5 team members as collaborators on the GitHub repo (Settings → Collaborators, or make it an org repo if you have a GitHub org for the team).
7. Set up branch protection on `main` per Section 3 (Git Branching Workflow) below — do this now, before anyone starts feature work, so nobody accidentally pushes straight to main later.

**Why this matters for vibe coding:** once `/docs/liquid-prd.md` exists in the repo, any coding agent that can read your project folder (Claude Code, Cursor, Windsurf) can be told "check `/docs/liquid-prd.md` for context" and it will actually read your real data models and specs instead of you re-pasting them every time.

### Task 1.1 — Project scaffold, Supabase, and Vercel hosting — *Owner: A*
Get a "hello world" version of the full pipeline (frontend → backend → database) live on a real URL before building any real feature. This surfaces integration pain on day 1, not day 10.

**Steps (using our approved stack: Next.js + Supabase):**

1. **Scaffold the Next.js app inside the repo:**
   ```
   npx create-next-app@latest .
   ```
   (Run this inside the repo folder you cloned in Task 1.0 — the `.` installs into the current directory. Choose TypeScript, App Router, and Tailwind CSS when prompted, since Tailwind is assumed in later design tasks.)

2. **Commit the scaffold:**
   ```
   git add .
   git commit -m "Scaffold Next.js app"
   git push
   ```

3. **Create a Supabase project:**
   - Go to supabase.com, sign in, click "New Project."
   - Name it, set a database password (save it somewhere the team can access), pick a region close to your users (Singapore is usually closest for PH).
   - Once created, go to Project Settings → API and copy the **Project URL** and **anon public key** — you'll need both.

4. **Install the Supabase client in your app:**
   ```
   npm install @supabase/supabase-js
   ```

5. **Add environment variables:** create a `.env.local` file in the repo root (this file should be in `.gitignore` already — never commit real keys):
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

6. **Create a Supabase client helper**, e.g. `/lib/supabaseClient.ts`, that reads those env vars and exports a configured client — every screen/task later will import this.

7. **Connect the repo to Vercel:**
   - Go to vercel.com, sign in with GitHub, click "Add New Project," select your repo.
   - Vercel auto-detects Next.js — before deploying, add the same two environment variables from step 5 in Vercel's project settings (Environment Variables section), so the live deployment can also talk to Supabase.
   - Click Deploy. You should get a live `.vercel.app` URL within a minute or two.

8. **Verify the full loop works:** build one throwaway page that fetches a single row from a test Supabase table and displays it, confirm it works both locally (`npm run dev`) and on the live Vercel URL. Delete the test table once confirmed.

9. **Share the Vercel URL and Supabase project access with the whole team** — everyone should be able to see the live deploy update as they push code.

**Meta-prompt (if you want an agent to do steps 4-8 for you instead of doing them by hand):**
> "I have a Next.js app in a git repo with a Supabase project already created (I have the URL and anon key). Refer to `/docs/liquid-prd.md` in this repo for full context on what I'm building. Write a build prompt for a coding agent to: install the Supabase client, create a `/lib/supabaseClient.ts` helper reading from environment variables, and create one simple test page that reads and displays a row from Supabase, so I can confirm the connection works before building real features."

### Task 1.2 — Database schema — *Owner: A*
Implement the data models exactly as defined in PRD Section 4 (User, Doctor, Schedule Slot, Appointment, Review, Specialty Taxonomy).

**Meta-prompt:**
> "Refer to `/docs/liquid-prd.md` in this repo (Section 4, Data Models) for the full schema. Write a detailed build prompt for a coding agent to create these as Supabase Postgres tables, including foreign key relationships, appropriate types, and any needed indexes. Also ask it to generate the Supabase client setup code for a Next.js app."
>
> *(No repo access? Paste PRD Section 4 in full instead of the file reference.)*

### Task 1.3 — Auth setup (patient + doctor login) — *Owner: A*
Two user types (patient, doctor/secretary) need separate sign-up flows but can share the same auth backend.

**Meta-prompt:**
> "Using Supabase Auth in a Next.js app, write a build prompt for a coding agent to implement sign-up/login for two user roles: 'patient' and 'doctor'. After login, redirect each role to a different dashboard route. Keep it simple — no email verification flows needed for a hackathon demo."

### Task 1.4 — Specialty taxonomy seed data — *Owner: E (with A)*
Pick ONE specialty to seed deeply (PRD Section 6.4 recommends Ophthalmology with 4 sub-specialties). Write the actual seed data: 4 sub-specialties, 6-10 realistic doctor profiles across them, with credentials, rates, HMO tags, and schedule slots.

**Meta-prompt:**
> "I need realistic-sounding seed data for a Philippine healthcare app demo. Generate 8 doctor profiles for [Ophthalmology], split across these sub-specialties: Retina, Cataract, Glaucoma, Pediatric Ophthalmology. For each doctor include: name, credentials (PRC license style, med school, years of experience), rate in PHP, 2-3 HMO accreditations from this list [Maxicare, Intellicare, Medicard, PhilCare], clinic location in [your target city], and 3-4 open schedule slots over the next 2 weeks. Format as JSON matching this schema: [paste Doctor + Schedule Slot models from PRD Section 4]."

**End of Phase 1 checkpoint:** everyone can log in as patient or doctor, database is live, seed data exists.

---

## PHASE 2 — Days 3-5: Doctor/Secretary Side

### Task 2.1 — Doctor profile setup screen — *Owner: C*
Build the sign-up-time profile form: credentials upload, specialty + sub-specialty picker (constrained to your seeded taxonomy), rate, clinic location.

**Meta-prompt:**
> "Here's my Doctor data model: [paste from PRD Section 4]. Here's my specialty taxonomy: [paste PRD Section 6.4]. Write a build prompt for a coding agent to create a doctor profile setup form in Next.js/React that lets a doctor enter their name, upload a credential file (can just store a filename/URL for demo purposes), pick specialty then sub-specialty from a constrained dropdown, set rate, and set clinic location. On submit, save to Supabase."

### Task 2.2 — Schedule management screen — *Owner: C*
Doctor/secretary adds and edits available time slots.

**Meta-prompt:**
> "Here's my Schedule Slot model: [paste from PRD Section 4]. Write a build prompt for a coding agent to build a simple calendar/list UI where a logged-in doctor can add new available slots (date, start time, end time) and see/delete their existing upcoming slots. Should update Supabase in real time."

### Task 2.3 — Appointments dashboard (accept/decline) — *Owner: C (with A on backend logic)*
The core doctor-side workflow screen.

**Meta-prompt:**
> "Here's my Appointment model: [paste from PRD Section 4]. Write a build prompt for a coding agent to build a dashboard for a logged-in doctor showing all appointments with status 'pending', with Accept/Decline buttons that update the appointment status in Supabase. Also show a separate list of already-confirmed upcoming appointments."

**End of Phase 2 checkpoint:** a fake doctor account can fully set up a profile, add slots, and would be able to manage bookings once they exist.

---

## PHASE 3 — Days 6-9: Patient Intake + AI Matching + Safety Gate (highest risk — start early)

### Task 3.1 — Guided intake flow UI (multi-step form) — *Owner: B*
Demographics → HMO selection → free-text symptoms → up to 2 branching follow-ups.

**Meta-prompt:**
> "Write a build prompt for a coding agent to build a multi-step intake form in React: step 1 asks name/age/sex/location, step 2 asks the user to pick their HMO from [Maxicare, Intellicare, Medicard, PhilCare, None/Cash], step 3 is a free-text box asking 'What symptoms are you feeling?' with a placeholder encouraging natural language, including Tagalog. Keep the UI simple, large tap targets, plain language — this app may be used by elderly or less tech-savvy users."

### Task 3.2 — AI symptom → sub-specialty matching integration — *Owner: D*
This is the core differentiator. Build the LLM call exactly per PRD Section 6.1.

**Meta-prompt:**
> "Here is my exact AI matching spec: [paste PRD Section 6.1 in full, including the taxonomy from 6.4]. Write a detailed build prompt for a coding agent to implement this as a Next.js API route that calls an LLM API, constrains its output to my seeded taxonomy, returns structured JSON, and handles the case where the model asks a clarifying follow-up question instead of giving a final answer. Include error handling for malformed AI responses."

### Task 3.3 — Emergency safety gate logic — *Owner: D*
This must be built exactly per the calibrated logic in PRD Section 6.2 — NOT tone-based.

**Meta-prompt:**
> "Here is my exact safety gate spec: [paste PRD Section 6.2 in full]. Write a build prompt for a coding agent to implement this as a check that runs on the patient's parsed symptom text BEFORE the specialty-matching call in Task 3.2. It must only trigger on the specific symptom combinations listed, never on tone, punctuation, or intensity language, since we've specifically decided that will cause false positives on anxious users. If triggered, return a flag that the frontend uses to show the calm interstitial message instead of proceeding to AI matching."

### Task 3.4 — AI match result screen — *Owner: B*
Displays the specialty + sub-specialty + plain-language reason, or the emergency interstitial if the safety gate triggered.

**Meta-prompt:**
> "Write a build prompt for a coding agent to build a result screen in React that either (a) shows the AI-recommended specialty and sub-specialty with a short plain-language explanation and a 'Find Doctors' button, or (b) if the emergency flag from Task 3.3 is true, shows a calm, non-alarming message: 'These symptoms can sometimes be serious. Please consider seeking urgent or emergency care.' with no booking button — just an option to go back to the intake."

### Task 3.5 — Tagalog free-text handling — *Owner: D*
Should-have, scoped to Tagalog only per team decision.

**Meta-prompt:**
> "Building on the AI matching from Task 3.2: [paste PRD Section 6.1], write a build prompt for a coding agent to make sure the symptom-matching prompt correctly handles Tagalog free-text input alongside English, and returns its plain-language 'reason' field in the same language the user typed in. Scope this to Tagalog only, not other languages or Taglish code-switching."

**End of Phase 3 checkpoint:** a patient can type real symptoms (English or Tagalog) and either get routed to a sub-specialty or see the emergency message — this is your riskiest and most important demo moment, test it heavily.

---

## PHASE 4 — Days 10-11: Doctor List, Filtering, Booking (connect both sides)

### Task 4.1 — Doctor list screen with HMO + sub-specialty filtering — *Owner: B*

**Meta-prompt:**
> "Here's my Doctor model: [paste from PRD Section 4]. Here's my HMO filtering spec: [paste PRD Section 6.3]. Write a build prompt for a coding agent to build a doctor list screen that queries Supabase for doctors matching the AI-recommended sub-specialty from Task 3.4 AND the patient's selected HMO from Task 3.1, with a toggle to 'show all doctors' including non-matching HMO. Each card shows name, sub-specialty, rate, HMO tags, and next available slot. Include a small disclaimer that HMO data is for demo purposes."

### Task 4.2 — Doctor profile detail + booking screen — *Owner: B*

**Meta-prompt:**
> "Here's my Schedule Slot and Appointment models: [paste from PRD Section 4]. Write a build prompt for a coding agent to build a doctor profile detail page showing full credentials, rate, and a calendar/list of open slots. When the patient selects a slot and confirms, create a new Appointment record with status 'pending' and mark that slot as booked."

### Task 4.3 — Booking confirmation screen — *Owner: B*

**Meta-prompt:**
> "Write a build prompt for a coding agent to build a simple confirmation screen shown after Task 4.2's booking action, showing the doctor name, date/time, and a 'View my appointments' link. Keep it clean and reassuring — this is the payoff moment of the whole patient flow."

### Task 4.4 — End-to-end connection test — *Owner: A + E*
Not a build task — a testing task. Walk through the full patient flow into the full doctor flow using real seeded data, fix any breaks between the two sides.

**Meta-prompt:**
> "I have a Next.js + Supabase app with a patient booking flow and a doctor dashboard that should reflect new bookings in real time or on refresh. Write a build prompt for a coding agent to review [paste relevant file paths / describe both flows] and fix any state sync issues so a booking made on the patient side correctly and immediately appears in the doctor's pending appointments dashboard."

**End of Phase 4 checkpoint:** the full loop works — symptom → match → doctor list → booking → doctor sees it in their dashboard.

---

## PHASE 5 — Days 12-13: Should-Haves + Accessibility + Polish

### Task 5.1 — Review/rating system (verified-visit-only) — *Owner: C*

**Meta-prompt:**
> "Here's my Review model and the rule for who can review: [paste PRD Section 6.5]. Write a build prompt for a coding agent to build a review submission form only accessible for appointments with status 'completed', and a display of average rating + reviews on the doctor profile page."

### Task 5.2 — "Booking for a family member" toggle — *Owner: B + E*

**Meta-prompt:**
> "Write a build prompt for a coding agent to add a simple 'Who is this for?' toggle at the start of the intake flow (Task 3.1) — options: 'Myself' or 'A family member' — and if the latter, ask for that person's name/age/sex instead of the logged-in user's. This should be a light UI addition, not a new backend system."

### Task 5.3 — Accessibility & plain-language pass — *Owner: E*
Not a single build task — a review pass across every screen against PRD Section 6.6.

**Meta-prompt:**
> "Here is my accessibility/UX spec: [paste PRD Section 6.6]. Write a build prompt for a coding agent to review [list your key screen files] and adjust font sizes, tap target sizes, and any jargon-heavy copy (especially the AI 'reason' explanation and any medical terminology) to be simpler and friendlier, suitable for elderly or less tech-savvy users."

### Task 5.4 — Visual/design consistency pass — *Owner: E*
Make sure all 5 people's AI-generated screens look like one app, not five.

**Meta-prompt:**
> "I have a React app built across multiple screens by different people using AI coding tools, so styling is inconsistent. Write a build prompt for a coding agent to establish a single shared design system — colors, fonts, spacing, button styles — as a Tailwind config or shared CSS variables, then apply it consistently across [list your screens]."

**End of Phase 5 checkpoint:** should-have features are in (or consciously dropped if time-constrained), and the whole app looks and reads like one coherent product.

---

## PHASE 6 — Day 14: Rehearsal & Pitch

### Task 6.1 — Record a backup demo video — *Owner: E*
In case live demo fails on stage. Screen-record the full happy path plus the emergency-gate path.

### Task 6.2 — Build the pitch deck — *Owner: E (whole team reviews)*
Structure per PRD Section 10: problem → live demo → differentiation (name NowServing/MyDoktor.ph explicitly) → roadmap slide (PRD Section 8) → close.

**Meta-prompt (for slide content, not code):**
> "Here's my PRD: [paste full PRD]. Write me a slide-by-slide outline for a 5-minute hackathon pitch that covers: the problem, a live demo walkthrough script, our differentiation vs named competitors, and a brief roadmap/scalability vision slide. Keep each slide to 3-4 bullet points max."

### Task 6.3 — Full team rehearsal — *All*
Run the entire demo script from PRD Section 10 at least twice, timed. Assign who talks during which part (e.g., one person narrates the problem, another drives the live demo, another closes with roadmap/impact).

---

## 4. Daily Standup Structure (recommended)

Keep it to 10 minutes, every day:
1. What did you finish yesterday?
2. What are you building today (which task number from this roadmap)?
3. Any blocker — especially anything where your screen depends on someone else's API route or component not being ready yet?

Since 5 people will all be vibe-coding in parallel, the most common failure mode is two people's AI-generated code assuming different shapes for the same data. When in doubt, check back against PRD Section 4 (Data Models) as the single source of truth — nobody should improvise a new field or table without updating that section first and telling the team.

---

## 5. Task Summary Table (quick reference)

| # | Task | Owner | Phase |
|---|---|---|---|
| 1.0 | Create repo + commit PRD/roadmap to `/docs` | A | 1 |
| 1.1 | Project scaffold, Supabase, Vercel hosting | A | 1 |
| 1.2 | Database schema | A | 1 |
| 1.3 | Auth setup | A | 1 |
| 1.4 | Specialty taxonomy + seed data | E, A | 1 |
| 2.1 | Doctor profile setup screen | C | 2 |
| 2.2 | Schedule management screen | C | 2 |
| 2.3 | Appointments dashboard | C, A | 2 |
| 3.1 | Guided intake flow UI | B | 3 |
| 3.2 | AI symptom matching integration | D | 3 |
| 3.3 | Emergency safety gate logic | D | 3 |
| 3.4 | AI match result screen | B | 3 |
| 3.5 | Tagalog handling | D | 3 |
| 4.1 | Doctor list + filtering | B | 4 |
| 4.2 | Doctor profile + booking | B | 4 |
| 4.3 | Booking confirmation | B | 4 |
| 4.4 | End-to-end connection test | A, E | 4 |
| 5.1 | Review/rating system | C | 5 |
| 5.2 | Family-member booking toggle | B, E | 5 |
| 5.3 | Accessibility pass | E | 5 |
| 5.4 | Design consistency pass | E | 5 |
| 6.1 | Backup demo video | E | 6 |
| 6.2 | Pitch deck | E, All | 6 |
| 6.3 | Full rehearsal | All | 6 |
