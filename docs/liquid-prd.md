# Team Liquid — AI-Powered Healthcare Navigation Platform
## "The Right Doctor. The First Time."

**Hackathon:** CanYouHackIt (Clark) — Team Liquid
**Track:** Civic Access — Bringing opportunities and services to the people
**Status:** v4 — repositioned per mentor feedback, build-ready spec

---

## Change Log

Track every scope decision or major edit here — newest on top. This is separate from `/docs/BUILD_LOG.md`, which tracks actual code changes made during building. This log tracks *decisions*: what changed in the plan and why.

| Date | Change | Reason |
|---|---|---|
| _(today)_ | Major repositioning per mentor review: reframed as an AI healthcare navigation platform (not a directory), added explicit problem statement, objection-handling section, multi-stage AI pipeline, HMO intelligence layer, doctor ranking, financial framing, tagline | Mentor flagged that the pitch read as "a directory with AI-assisted search" — needed sharper positioning and proactive answers to likely judge challenges |
| _(earlier)_ | Added Change Log + linked BUILD_LOG.md process | Wanted a clear, non-technical-friendly way to track scope changes and build progress |
| _(earlier)_ | Scoped Tagalog-only free-text (dropped Taglish/multi-language) | Reduce NLP risk for 2-week build |
| _(earlier)_ | Reframed safety gate to trigger on symptom *combinations*, not tone/intensity | Avoid false-triggering on anxious/exaggerated phrasing |
| _(earlier)_ | Added Judging Criteria Alignment section | Map every feature to the rubric weights |

**When you make a scope change:** add a row here first, before telling any agent to build it. If the change touches Data Models (Section 6) or Feature Logic Specs (Section 8), update those sections too in the same edit — don't leave the Change Log saying one thing and the spec saying another.

---

## 1. Problem Statement

Patients are forced to self-diagnose before they can even seek care. They search symptoms they don't understand, book the wrong specialist, discover too late that their HMO isn't accepted, and repeat the process — leading to delayed treatment, unnecessary expenses, and poor patient outcomes. This is worse in the Philippines than in many markets: HMO accreditation varies clinic-by-clinic, "specialist" search tools rarely go deep enough to separate a general ophthalmologist from a retina specialist, and existing tools optimize for hospital/proximity rather than clinical fit.

## 2. Positioning

**Elevator pitch (use this verbatim in the pitch deck and when asked "what do you do"):**

> "Team Liquid is building an AI-powered healthcare navigation platform that helps Filipinos find the right specialist the first time. By translating patient symptoms into specialty and sub-specialty recommendations, verifying HMO compatibility, and enabling instant booking, the platform reduces wasted consultations, speeds access to care, and simplifies healthcare discovery for both patients and providers."

**Tagline:** *"The Right Doctor. The First Time."*

**What we are NOT:** a doctor directory with a search bar. A directory answers "who's nearby." We answer "who's actually right for what you're feeling, and can you actually afford/use them" — that's a navigation problem, not a lookup problem, and it's why the AI pipeline (Section 8.1) has five distinct stages, not one search filter.

---

## 3. Why We're Different (objection-handling — judges will ask these)

Prepare to answer these directly and early in the pitch, not defensively if asked.

**"How is this different from NowServing, MyDoktor.ph, doktor.ph, KonsultaMD, or Doctor Anywhere?"**
- **NowServing / MyDoktor.ph / doktor.ph** are appointment directories: you search by specialty, hospital, or doctor name, then book. MyDoktor.ph has a basic symptom-to-specialist quiz, but it stops at the *specialty* level (e.g. "ophthalmologist"), not sub-specialty (e.g. "retina specialist"), and none of them verify HMO fit before showing you results.
- **KonsultaMD and Doctor Anywhere** are telehealth-first: they connect you to *a* doctor from a pool for a video/chat consult, on-demand or scheduled. They're built for fast access to *any* available doctor, not for helping you find and book a specific in-person specialist matched to your exact condition and HMO.
- **Google** returns links, not a decision. It doesn't know your HMO, doesn't disambiguate sub-specialties, and doesn't rank results by clinical fit.
- **Our wedge:** we're the only one running symptoms through a full navigation pipeline — specialty → sub-specialty → HMO verification → ranked doctor list — before a human ever has to guess.

**"Can AI safely recommend specialists?"**
- The AI never diagnoses. It maps symptoms to a specialty/sub-specialty *category* using a constrained, fixed taxonomy — it cannot suggest medication or a diagnosis, only a type of doctor to see.
- A calibrated, rule-based safety gate (Section 8.2) runs before AI matching and catches objective emergency symptom combinations, routing straight to an urgent-care message instead of a booking flow.
- This is a genuinely hard question and one we should be upfront about, not defensive on — it's a design constraint we've engineered around explicitly, and worth saying that plainly if asked.

**"Where will doctor/HMO data come from?"**
- For this prototype: manually seeded and verified data for one specialty, clearly disclosed to judges as demo data, not a live feed.
- For a real launch: doctor-side self-onboarding (already in our MVP — Section 10) plus manual verification, similar to how NowServing and MyDoktor.ph built their initial networks before any HMO API existed.

**"How will providers keep profiles updated?"**
- Doctor/secretary dashboard (already in MVP scope) lets them edit schedule, rate, and specialty tags directly — the update burden sits with the person who has the actual information, not with us scraping it.
- Future: reminder prompts if a profile hasn't been touched in N days (roadmap item, not MVP).

**"Is this just a booking platform?"**
- No — booking is the *last* step of a five-stage navigation pipeline (Section 8.1). The differentiated work happens before booking: understanding symptoms, mapping to sub-specialty, and verifying HMO fit. Booking without that pipeline is what our competitors already do.

---

## 4. Judging Criteria Alignment

| Criterion | Weight | How this PRD addresses it |
|---|---|---|
| **Innovation & Creativity** | 20% | Full symptom→sub-specialty→HMO→ranked-doctor pipeline (Section 8.1), not single-step search; HMO intelligence layer (8.3) that suggests alternatives on mismatch, not just filters |
| **Use of AI/Technology** | 20% | LLM-based multi-stage symptom understanding and specialty/sub-specialty mapping with constrained output; rule-based emergency detection layered underneath, not replacing, the AI (8.2) |
| **User Experience & Design** | 15% | Guided step-by-step intake; plain-language AI explanations; accessibility for elderly/low-literacy users (8.7); ranked (not just filtered) doctor list reduces decision fatigue |
| **Local Relevance** | 15% | Philippine-specific HMO confusion and sub-specialty ambiguity; Tagalog input; awareness of unequal smartphone/data access outside Metro Manila (Section 11) |
| **Impact & Scalability** | 10% | Financial framing (Section 9); clear expansion path by specialty and region; public-sector angle (Section 11) |
| **Working Prototype** | 10% | Scoped MVP (Section 10) demoable end-to-end within 2 weeks |
| **Presentation** | 10% | Demo script (Section 13) and objection-handling prep (Section 3) built directly into the pitch structure |

---

## 5. Tech Stack (approved — this is what we're building with)

- **Frontend:** React (Next.js — routing + API routes in one place)
- **Backend:** Next.js API routes (no separate server to run)
- **Database:** Supabase (Postgres) — hosted, no server management
- **AI matching:** LLM API call (e.g. Claude or GPT) with a structured prompt (Section 8.1)
- **Auth:** Supabase Auth
- **Hosting:** Vercel

---

## 6. Data Models

```
User (Patient)
- id
- name
- age
- sex
- location (city/province)
- hmo_provider (nullable)
- created_at

Doctor
- id
- name
- credentials (text or file upload URL)
- specialty (e.g. "Ophthalmologist")
- sub_specialty (e.g. "Retina")
- rate (number, PHP)
- hmo_accreditations (array of HMO names — mocked/static list)
- location (clinic address/city)
- verified (boolean — for demo, can default true on manual seed)
- created_at

Schedule Slot
- id
- doctor_id (FK)
- date
- start_time
- end_time
- is_booked (boolean)

Appointment
- id
- patient_id (FK)
- doctor_id (FK)
- slot_id (FK)
- status (pending / confirmed / declined / completed / cancelled)
- symptom_summary (text — what the patient described)
- created_at

Review
- id
- appointment_id (FK — enforces verified-visit-only)
- patient_id (FK)
- doctor_id (FK)
- rating (1-5)
- comment (text)
- created_at

Specialty Taxonomy (seed/reference table, not user-editable)
- specialty (e.g. "Ophthalmologist")
- sub_specialty (e.g. "Retina", "Cataract", "Glaucoma", "Pediatric Ophthalmology")
```

---

## 7. Screens / Pages

**Patient side**
1. Landing / entry point ("Describe how you're feeling")
2. Intake flow (multi-step): demographics → HMO selection → symptom free-text → follow-up branching questions
3. Emergency interstitial (only shown if safety gate triggers — Section 8.2)
4. AI match result screen: recommended specialty + sub-specialty, with a short plain-language reason (this is the visible output of Section 8.1's pipeline — frame it in the demo as "here's what the AI just reasoned through," not just "here's a result")
5. Doctor list — **ranked**, not just filtered (Section 8.4): by sub-specialty match, HMO compatibility, rating, and next availability
6. Doctor profile detail page: full credentials, rate, schedule calendar, reviews
7. Booking confirmation screen
8. (Should-have) Post-appointment review submission screen

**Doctor/secretary side**
1. Sign-up / login
2. Profile setup: credentials upload, specialty + sub-specialty picker, rate, clinic location
3. Schedule management: add/edit available time slots
4. Appointments dashboard: list of pending/confirmed bookings with accept/decline actions

---

## 8. Feature Logic Specs

### 8.1 The Navigation Pipeline (Use of AI/Technology, Innovation)

This is the core of the pitch — present it as a pipeline, not a single AI call, even though it may be implemented efficiently under the hood:

**Symptoms → AI Symptom Understanding → Clinical Specialty Mapping → Sub-specialty Identification → HMO Verification → Doctor Ranking → Booking**

1. **AI Symptom Understanding:** parse free-text (English or Tagalog) plus demographics into a structured summary.
2. **Clinical Specialty Mapping:** map the structured summary to ONE specialty from the fixed taxonomy.
3. **Sub-specialty Identification:** within that specialty, identify the most likely sub-specialty (e.g. Ophthalmologist → Retina).
4. **HMO Verification:** check the patient's HMO against accredited doctors in that sub-specialty; flag mismatches instead of silently filtering them out (see 8.3).
5. **Doctor Ranking:** rank the resulting doctor list, don't just filter it (see 8.4).
6. **Booking:** patient selects a slot and confirms.

Implementation note: stages 1-3 can be a single structured LLM call for efficiency — the point is the *output and framing* show all five reasoning stages to the user and to judges, not that each stage needs a separate API call.

- System prompt for stages 1-3, e.g.:
  > "You are a non-diagnostic triage assistant for a Philippine healthcare app. Given a patient's symptoms, recommend ONE medical specialty and ONE sub-specialty from this fixed list: [insert your seeded taxonomy]. Do not diagnose. Do not suggest medication. Return JSON: {specialty, sub_specialty, reason (1 sentence, plain language)}. If the input is ambiguous, ask ONE clarifying follow-up question instead of guessing."
- Constrain the model to your **seeded taxonomy only** — pass the valid specialty/sub-specialty pairs in the prompt so it can't recommend something you have no doctors for.
- Cap follow-up questions at 1-2 max for demo reliability.

### 8.2 Emergency Safety Gate (calibrated — must avoid false-triggering on anxious/exaggerated phrasing)
- **Do not** trigger based on tone, punctuation, or intensity words ("dying," "worst pain ever," all-caps).
- **Do** trigger based on a small, specific list of objective symptom *combinations*, e.g.:
  - chest pain + shortness of breath
  - chest pain + radiating arm/jaw pain
  - severe difficulty breathing (standalone)
  - sudden numbness/weakness on one side of body
  - loss of consciousness / fainting (reported)
  - severe uncontrolled bleeding
- Runs BEFORE stage 2 of the pipeline (8.1) — an emergency match short-circuits specialty mapping entirely.
- Messaging tone: calm, not alarming — "These symptoms can sometimes be serious. Please consider seeking urgent or emergency care." No red flashing banner.

### 8.3 HMO Matching Intelligence Layer (Local Relevance)
This is more than a filter — it's a decision-support layer:
- Static/mocked field on each seeded doctor record (array of HMO names from a real set: Maxicare, Intellicare, Medicard, PhilCare, etc.). No live verification for the prototype — clearly disclosed to judges as a known gap.
- When the patient's HMO matches a doctor in the ranked list, show it as an explicit "✓ Covered by [HMO]" badge.
- When NO doctor in the top-ranked results accepts the patient's HMO, don't just hide those doctors — show a message like "No [sub-specialty] doctors in your HMO network match closely. Here are the closest matches, with estimated cash rates." This is the "intelligence" part: surfacing the trade-off instead of silently filtering it away.
- Small disclaimer text noting HMO data is for demo purposes.

### 8.4 Doctor Ranking (Innovation & Creativity, UX)
Once HMO verification (8.3) runs, rank — don't just list — the resulting doctors by:
1. Sub-specialty match strength (exact match ranks above adjacent/general specialty)
2. HMO coverage (covered doctors rank above cash-only, unless patient toggled "show all")
3. Rating (once reviews exist — Section 8.6)
4. Soonest available slot
This turns "here's a list" into "here's our top recommendation and why" — the thing a directory can't do.

### 8.5 Sub-Specialty Taxonomy (Innovation & Creativity)
Example if you pick Ophthalmology as your seed specialty:
- Ophthalmologist → Retina
- Ophthalmologist → Cataract
- Ophthalmologist → Glaucoma
- Ophthalmologist → Pediatric Ophthalmology

Pick ONE specialty to seed deeply and convincingly rather than spreading thin.

### 8.6 Reviews (Should-Have)
- Only allow a review if there's a matching Appointment with status = "completed" for that patient + doctor pair (verified-visit-only, reduces fake/malicious reviews). Feeds into Doctor Ranking (8.4) once populated.

### 8.7 Accessibility & Low-Literacy Design (User Experience & Design)
- Keep intake language simple, short sentences, avoid medical jargon in AI-facing explanations (the "reason" field in 8.1 should read like a nurse explaining to a worried relative, not a textbook).
- Large tap targets and readable font sizes by default.
- "Booking for a family member" toggle in the intake, since many PH households have one tech-savvy member booking for elderly parents.

---

## 9. Financial & Impact Framing

Use this reasoning in the pitch to answer "why does this matter financially," alongside your own researched or estimated figures — don't present placeholder numbers as real data to judges.

- **The core financial argument:** every mismatched specialist visit costs the patient a consultation fee, travel time, and — critically — the delay before they see the *right* doctor, which can worsen outcomes and cost more later. Reducing mismatched first visits reduces wasted spend on both sides: patients avoid paying for a wrong-fit consult, and providers reduce time spent on patients who need a different sub-specialty than the one being consulted.
- **What to fill in before the pitch:** find or estimate (a) an average PH specialist consultation fee for your seed specialty, and (b) a plausible rate of mismatched-specialist visits (even a conservative, clearly-labeled estimate is more credible than an invented precise statistic). Multiply to get a "wasted spend avoided" figure — even a rough, transparently-estimated number is more persuasive to an investor-minded judge than no number at all, as long as you're upfront it's an estimate.
- **Provider-side value:** fewer mismatched inquiries means less time doctors/secretaries spend triaging patients who need a different sub-specialty — a time-savings argument you can make qualitatively even without a hard number.

---

## 10. Build Scope — MoSCoW

### MUST HAVE
- [ ] Guided intake: fixed branching question set + one free-text symptom field
- [ ] AI symptom understanding + specialty + sub-specialty matching (Section 8.1)
- [ ] Calibrated emergency safety gate (Section 8.2)
- [ ] HMO verification with mismatch messaging, not silent filtering (Section 8.3)
- [ ] Doctor list — ranked, not just filtered (Section 8.4)
- [ ] Doctor profile view (specialty, sub-specialty, credentials, rate, HMO tags, schedule)
- [ ] Booking against a posted schedule slot
- [ ] Doctor/secretary sign-up + profile setup with specialty/sub-specialty tagging
- [ ] Doctor/secretary schedule management
- [ ] Doctor/secretary appointment accept/decline dashboard
- [ ] Seed data: one fully fleshed-out specialty (e.g. ophthalmology) with 4 sub-specialties and enough doctor profiles to make the demo feel real
- [ ] Simple, plain-language UI copy and readable design defaults (Section 8.7)

### SHOULD HAVE
- [ ] Review/rating system (verified-visit-only), feeding into Doctor Ranking
- [ ] Tagalog free-text handling (Tagalog only, not full Taglish/multi-language, for this hackathon)
- [ ] Reschedule/cancel flow
- [ ] Mock booking confirmation notification (email/SMS-style UI, doesn't need to actually send)
- [ ] "Booking for a family member" toggle in intake

### COULD HAVE
- [ ] In-app chat between patient and secretary
- [ ] Additional specialties beyond the seed set
- [ ] Doctor-side analytics (appointment volume, rating trend)

### WON'T HAVE (explicitly cut, but worth naming in the pitch as roadmap)
- Video/teleconsultation
- Real payment processing
- Live HMO API integration (static/mocked only)
- ePrescriptions or medical document handling
- Native mobile app (web only)
- SMS/USSD fallback for users without smartphones/data (see Section 11 — real access gap, too large to build in 2 weeks, but strong for the Impact & Scalability pitch)

---

## 11. Local Relevance & Scalability Vision (for the pitch — not MVP build items)

Present these as an explicit "beyond the hackathon" roadmap slide, clearly separated from what you've actually built. Pair this slide with a **before/after visual**:
- **Before:** a cluttered Google search results screenshot/mockup — generic listings, no sub-specialty distinction, no HMO context, patient has to cross-reference manually.
- **After:** your app's AI match result screen showing specialty → sub-specialty → HMO-verified, ranked doctor in a few taps.
This visual contrast does more work in 10 seconds than a slide of bullet points — build it early enough to actually use in rehearsal (Phase 6 of the roadmap).

- **Geographic expansion:** start with one city/region's doctor network, expand specialty-by-specialty and region-by-region rather than trying to be national on day one.
- **Access gap for non-smartphone users:** a future SMS/USSD-based intake (text your symptoms, get a text back with a suggested specialist + clinic) would reach patients without smartphones/data — name this explicitly as a known limitation and a concrete next step.
- **Public-sector alignment:** potential integration path with barangay health centers or DOH referral programs for patients without any HMO at all.
- **Monetization path:** doctor-side premium profile placement, or a small booking-facilitation fee, rather than charging patients directly.

---

## 12. Build Order (2 weeks)

1. **Days 1-2:** Set up repo, hosting, database schema (Section 6), auth. Seed the specialty taxonomy + a handful of doctor profiles by hand.
2. **Days 3-5:** Build doctor/secretary side first (profile setup, schedule, dashboard) — simpler, and unblocks having real data to book against.
3. **Days 6-9:** Build patient intake flow + the full AI pipeline (8.1) + safety gate (8.2). Riskiest piece — start early, not last.
4. **Days 10-11:** Build HMO verification (8.3), doctor ranking (8.4), and booking flow end-to-end.
5. **Days 12-13:** Should-have features if time allows (reviews, Tagalog handling, family-booking toggle), then polish + accessibility pass (8.7) + before/after visual for the pitch.
6. **Day 14:** Rehearse the demo script and objection-handling answers (Section 3), prepare backup (screen recording) in case live demo fails.

---

## 13. Demo Script Checklist (mapped to judging criteria)

- [ ] Open with the Problem Statement (Section 1) in plain language, not feature-first
- [ ] State the positioning line explicitly: "We're not a directory — we're a navigation platform" *(Innovation, Presentation)*
- [ ] Patient types a realistic symptom description → walk through all five pipeline stages out loud as they happen on screen (8.1) *(Innovation, AI)*
- [ ] A separate demo input triggers the emergency safety gate → shows the calm interstitial instead of a booking flow *(AI, UX)*
- [ ] Show the HMO verification step explicitly, including what happens on a mismatch (8.3) *(Local Relevance)*
- [ ] Show the doctor list is ranked, not just filtered, and say why (8.4) *(Innovation, UX)*
- [ ] Complete a booking with a seeded doctor; show it appear in the doctor/secretary dashboard *(Working Prototype)*
- [ ] Name NowServing/MyDoktor.ph/KonsultaMD/Doctor Anywhere explicitly and state the differentiation from Section 3 *(Local Relevance, Innovation)*
- [ ] Show the before/after visual (Section 11) *(Impact & Scalability, Presentation)*
- [ ] State the financial/impact framing (Section 9) *(Impact & Scalability)*
- [ ] Close with the tagline: "The Right Doctor. The First Time." *(Presentation)*
- [ ] Be ready to answer the Section 3 objection questions live if asked in Q&A, not just in the prepared pitch
