# Civic Access — Doctor Discovery & Booking Platform
## Build Spec (for AI-assisted / "vibe" coding)

**Hackathon:** CanYouHackIt (Clark) — Team Liquid
**Track:** Civic Access — Bringing opportunities and services to the people
**Status:** v3 — build-ready spec, aligned to judging rubric

---

## Change Log

Track every scope decision or major edit here — newest on top. This is separate from `/docs/BUILD_LOG.md`, which tracks actual code changes made during building. This log tracks *decisions*: what changed in the plan and why.

| Date | Change | Reason |
|---|---|---|
| _(today)_ | Added Change Log + linked BUILD_LOG.md process | Wanted a clear, non-technical-friendly way to track scope changes and build progress |
| _(earlier)_ | Scoped Tagalog-only free-text (dropped Taglish/multi-language) | Reduce NLP risk for 2-week build |
| _(earlier)_ | Reframed safety gate to trigger on symptom *combinations*, not tone/intensity | Avoid false-triggering on anxious/exaggerated phrasing |
| _(earlier)_ | Added Judging Criteria Alignment section | Map every feature to the rubric weights |

**When you make a scope change:** add a row here first, before telling any agent to build it. If the change touches Data Models (Section 4) or Feature Logic Specs (Section 6), update those sections too in the same edit — don't leave the Change Log saying one thing and the spec saying another.

---

## 1. One-Paragraph Summary (paste this into any AI coding session for context)

Build a web app with two sides: a **patient side** where users answer a guided intake (demographics + free-text symptoms), get matched by AI to a medical **specialty AND sub-specialty** (e.g. "Ophthalmologist — Retina"), filter by their HMO, then browse and book a doctor's available time slot; and a **doctor/secretary side** where doctors sign up, upload credentials, set their specialty + sub-specialty + rates + schedule, and accept/decline incoming bookings. The key differentiator vs. existing PH platforms (NowServing, MyDoktor.ph) is sub-specialty-level matching, a calibrated emergency-symptom safety gate, and a design built around users who aren't tech-savvy or don't have reliable data — not just "another booking app." No real payments, no real HMO API, no video consults — this is a prototype demo, not a production system.

---

## 2. Judging Criteria Alignment

Use this to sanity-check every feature decision — if something doesn't map to a criterion below, question whether it belongs in the 2-week scope.

| Criterion | Weight | How this PRD addresses it |
|---|---|---|
| **Innovation & Creativity** | 20% | Sub-specialty-level AI matching (not just specialty-level, which competitors already do); calibrated safety gate that avoids false-triggering on anxious phrasing; low-data-friendly design (Section 9) as a genuinely different approach to "access" vs. app-only competitors |
| **Use of AI/Technology** | 20% | LLM-based symptom-to-sub-specialty matching with constrained output (Section 6.1); AI-assisted emergency detection using symptom-combination logic, not keyword panic-matching (Section 6.2) |
| **User Experience & Design** | 15% | Guided step-by-step intake (not overwhelming forms); plain-language AI explanations; accessibility considerations for elderly/low-literacy users (Section 6.6); minimal steps from symptom to booking |
| **Local Relevance** | 15% | Solves a specifically Philippine problem (HMO confusion, sub-specialty ambiguity); Tagalog input support; designed with awareness of unequal smartphone/data access outside Metro Manila (Section 9) |
| **Impact & Scalability** | 10% | Clear expansion path by specialty and region (Section 9); potential public-sector angle (LGU/barangay health center partnerships, PhilHealth alignment) articulated as roadmap, not overpromised as built |
| **Working Prototype** | 10% | Scoped MVP (Section 7) is deliberately narrow and demoable end-to-end within 2 weeks, rather than broad and half-working |
| **Presentation** | 10% | Demo script (Section 10) is structured to hit each rubric criterion explicitly during the pitch, not just show features |

---

## 3. Tech Stack (approved — this is what we're building with)

- **Frontend:** React (Next.js — routing + API routes in one place)
- **Backend:** Next.js API routes (no separate server to run)
- **Database:** Supabase (Postgres) — hosted, no server management
- **AI matching:** LLM API call (e.g. Claude or GPT) with a structured prompt (Section 6.1)
- **Auth:** Supabase Auth
- **Hosting:** Vercel

---

## 4. Data Models

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

## 5. Screens / Pages

**Patient side**
1. Landing / entry point ("Describe how you're feeling")
2. Intake flow (multi-step): demographics → HMO selection → symptom free-text → follow-up branching questions
3. Emergency interstitial (only shown if safety gate triggers — Section 6.2)
4. AI match result screen: recommended specialty + sub-specialty, with a short plain-language reason
5. Doctor list (filtered by sub-specialty + HMO), each card showing name, sub-specialty, rate, HMO accreditation, next available slot
6. Doctor profile detail page: full credentials, rate, schedule calendar, reviews
7. Booking confirmation screen
8. (Should-have) Post-appointment review submission screen

**Doctor/secretary side**
1. Sign-up / login
2. Profile setup: credentials upload, specialty + sub-specialty picker, rate, clinic location
3. Schedule management: add/edit available time slots
4. Appointments dashboard: list of pending/confirmed bookings with accept/decline actions

---

## 6. Feature Logic Specs

### 6.1 AI Symptom → Sub-Specialty Matching (Use of AI/Technology)
- Input: demographics + free-text symptom description (Tagalog or English) + any follow-up answers
- Single LLM call with a structured system prompt, e.g.:
  > "You are a non-diagnostic triage assistant for a Philippine healthcare app. Given a patient's symptoms, recommend ONE medical specialty and ONE sub-specialty from this fixed list: [insert your seeded taxonomy]. Do not diagnose. Do not suggest medication. Return JSON: {specialty, sub_specialty, reason (1 sentence, plain language)}. If the input is ambiguous, ask ONE clarifying follow-up question instead of guessing."
- Constrain the model to your **seeded taxonomy only** — pass the valid specialty/sub-specialty pairs in the prompt so it can't recommend something you have no doctors for.
- Cap follow-up questions at 1-2 max for demo reliability.

### 6.2 Emergency Safety Gate (calibrated — must avoid false-triggering on anxious/exaggerated phrasing)
- **Do not** trigger based on tone, punctuation, or intensity words ("dying," "worst pain ever," all-caps).
- **Do** trigger based on a small, specific list of objective symptom *combinations*, e.g.:
  - chest pain + shortness of breath
  - chest pain + radiating arm/jaw pain
  - severe difficulty breathing (standalone)
  - sudden numbness/weakness on one side of body
  - loss of consciousness / fainting (reported)
  - severe uncontrolled bleeding
- Messaging tone: calm, not alarming — "These symptoms can sometimes be serious. Please consider seeking urgent or emergency care." No red flashing banner.

### 6.3 HMO Filtering (Local Relevance)
- Static/mocked field on each seeded doctor record (array of HMO names). No live verification.
- Patient selects HMO early in intake; doctor list filters to matches, with an option to "show all doctors" for cash-basis options.
- Small disclaimer text noting HMO data is for demo purposes — flagged as a known gap, not hidden.

### 6.4 Sub-Specialty Taxonomy (Innovation & Creativity)
Example if you pick Ophthalmology as your seed specialty:
- Ophthalmologist → Retina
- Ophthalmologist → Cataract
- Ophthalmologist → Glaucoma
- Ophthalmologist → Pediatric Ophthalmology

Pick ONE specialty to seed deeply and convincingly rather than spreading thin.

### 6.5 Reviews (Should-Have)
- Only allow a review if there's a matching Appointment with status = "completed" for that patient + doctor pair (verified-visit-only, reduces fake/malicious reviews).

### 6.6 Accessibility & Low-Literacy Design (User Experience & Design)
- Keep intake language simple, short sentences, avoid medical jargon in AI-facing explanations ("reason" field in 6.1 should read like a nurse explaining to a worried relative, not a textbook).
- Large tap targets and readable font sizes by default — many real users of this kind of app skew older or less tech-fluent.
- Allow a "family/proxy" framing in the intake copy (e.g., "Who is this for?") since in practice a lot of PH households have one tech-savvy member booking for elderly parents — this is a small copy/UX change, not a new system, but worth noting in the pitch as user-research-informed.

---

## 7. Build Scope — MoSCoW

### MUST HAVE
- [ ] Guided intake: fixed branching question set + one free-text symptom field
- [ ] AI specialty + sub-specialty matching (Section 6.1)
- [ ] Calibrated emergency safety gate (Section 6.2)
- [ ] HMO selection + filtering (mocked data, Section 6.3)
- [ ] Doctor list + profile view (specialty, sub-specialty, credentials, rate, HMO tags, schedule)
- [ ] Booking against a posted schedule slot
- [ ] Doctor/secretary sign-up + profile setup with specialty/sub-specialty tagging
- [ ] Doctor/secretary schedule management
- [ ] Doctor/secretary appointment accept/decline dashboard
- [ ] Seed data: one fully fleshed-out specialty (e.g. ophthalmology) with 4 sub-specialties and enough doctor profiles to make the demo feel real
- [ ] Simple, plain-language UI copy and readable design defaults (Section 6.6) — low-cost, high-impact for the UX criterion

### SHOULD HAVE
- [ ] Review/rating system (verified-visit-only)
- [ ] Tagalog free-text handling (Tagalog only, not full Taglish/multi-language, for this hackathon)
- [ ] Reschedule/cancel flow
- [ ] Mock booking confirmation notification (email/SMS-style UI, doesn't need to actually send)
- [ ] "Booking for a family member" toggle in intake (small UX addition, strong local-relevance story)

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
- SMS/USSD fallback for users without smartphones/data (see Section 9 — real access gap, too large to build in 2 weeks, but strong for the Impact & Scalability pitch)

---

## 8. Local Relevance & Scalability Vision (for the pitch — not MVP build items)

This section exists to give you material for the **Local Relevance (15%)** and **Impact & Scalability (10%)** criteria without expanding your actual build scope. Present these as an explicit "beyond the hackathon" roadmap slide, clearly separated from what you've actually built:

- **Geographic expansion:** start with one city/region's doctor network, expand specialty-by-specialty and region-by-region rather than trying to be national on day one — mirrors how real PH health-tech platforms actually scaled.
- **Access gap for non-smartphone users:** a large share of the "civic access" problem is people who don't have a smartphone or reliable data, not just people who have Google but find it cluttered. A future SMS/USSD-based intake (text your symptoms, get a text back with a suggested specialist + clinic) would reach that population — name this explicitly as a known limitation of the current prototype and a concrete next step, since judges will likely think of this gap themselves.
- **Public-sector alignment:** potential integration path with barangay health centers or DOH referral programs for patients without any HMO at all — positions the platform as complementary to public health infrastructure, not just a private commercial app.
- **Monetization path (for Impact/Investor framing):** doctor-side premium profile placement, or a small booking-facilitation fee, rather than charging patients directly — keeps the "patient-centric" positioning intact while still being a viable business.

---

## 9. Build Order (2 weeks)

1. **Days 1-2:** Set up repo, hosting, database schema (Section 4), auth. Seed the specialty taxonomy + a handful of doctor profiles by hand.
2. **Days 3-5:** Build doctor/secretary side first (profile setup, schedule, dashboard) — simpler, and unblocks having real data to book against.
3. **Days 6-9:** Build patient intake flow + AI matching call + safety gate logic. Riskiest piece — start early, not last.
4. **Days 10-11:** Build doctor list/filtering + booking flow end-to-end.
5. **Days 12-13:** Should-have features if time allows (reviews, Tagalog handling, family-booking toggle), then polish + accessibility pass (Section 6.6).
6. **Day 14:** Rehearse the demo script, prepare backup (screen recording) in case live demo fails.

---

## 10. Demo Script Checklist (mapped to judging criteria)

- [ ] Patient types a realistic symptom description → routed to a specific sub-specialty, not just a general specialty *(Innovation, AI)*
- [ ] A separate demo input triggers the emergency safety gate → shows the calm interstitial instead of a booking flow *(AI, UX)*
- [ ] Patient filters by HMO and books an available slot with a seeded doctor *(Working Prototype)*
- [ ] Doctor/secretary dashboard shows and accepts that same booking *(Working Prototype)*
- [ ] Walk through the plain-language, low-friction intake copy and mention the accessibility/family-booking design choices *(UX & Design)*
- [ ] Explicitly name NowServing/MyDoktor.ph as existing players and state the sub-specialty + safety-gate + access-gap wedge as the differentiator *(Local Relevance, Innovation)*
- [ ] Close with the Section 8 roadmap slide (geographic expansion, SMS/USSD access gap, public-sector alignment) *(Impact & Scalability)*
- [ ] Keep the pitch structured: problem → live demo → differentiation → roadmap, so it maps cleanly to how judges are scoring *(Presentation)*
