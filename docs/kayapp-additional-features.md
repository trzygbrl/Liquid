# KayApp — Additional Features (Post-PRD)

> Companion doc to `docs/liquid-prd.md`. This file tracks feature requests and
> tweaks that came up *after* the original PRD was written. Once a feature here
> is scoped and scheduled, fold its summary back into the PRD and mark it
> `[x]` below.
>
> Note: the product was originally named "Liquid" in the early docs
> (`liquid-prd.md`, `liquid-roadmap.md`); the app is now called **KayApp**.
> Existing file names are left as-is for history, but new docs use the
> `kayapp-` prefix going forward.

## Status legend
- `[ ]` Not started
- `[~]` In progress
- `[x]` Shipped / merged into PRD

---

## 1. Feature list

### [ ] 1.1 Speech-to-text for symptom input
**Where:** `src/components/IntakeFlow.tsx` (symptom description step), likely
`src/app/patient/intake/page.tsx`.

**Why:** Typing out symptoms while anxious, in pain, or on a phone is a real
barrier. Voice input lowers the effort to describe what's wrong, and lets
patients speak more naturally/completely than they'd bother typing — which
should also improve match quality downstream.

**What it does:**
- Adds a mic button next to (or inside) the symptom textarea.
- Uses the Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)
  for a first pass — no extra backend cost, works in Chrome/Edge/Safari.
- Live-transcribes into the textarea as the user speaks, so they can see and
  edit the text before submitting (never auto-submit from voice alone).
- Graceful fallback: if the browser doesn't support speech recognition, hide
  the mic icon and say nothing — typing still works as today.
- Accessibility: proper `aria-label`s, a visible "listening…" state, and a
  way to stop recording without losing what was captured.

**Open questions to resolve before building:**
- Do we need multi-language support (e.g., Filipino/Taglish) given the target
  market, or is English-only fine for v1?
- Should we log raw audio anywhere, or strictly transcript-only (privacy)?

---

### [ ] 1.2 Gentle nonsense/off-topic detection in the AI matching prompt
**Where:** `src/app/api/match/route.ts`, `src/lib/safetyGate.ts`, and
whatever prompt template feeds the matching model.

**Why:** Right now if a user types gibberish or something totally unrelated
to a symptom (e.g., random keyboard mashing, "what's the weather", spam),
the matcher likely still tries to force a specialty match. That produces a
bad, confusing result and erodes trust in the tool.

**What it does:**
- Before/inside the matching prompt, add an explicit check: "is this input a
  plausible health symptom description?"
- If not, don't force a specialist match. Instead return a soft, non-judgmental
  message asking the user to describe what they're feeling physically (e.g.,
  pain, symptoms, duration), with 1-2 examples of good input.
- Keep the tone gentle — never scold or imply the user did something wrong.
  This should read like a helpful nudge, not an error.
- This is a *matching-quality* fix, not a medical/crisis safety fix — it
  should sit alongside `safetyGate.ts`'s existing checks (e.g. emergency /
  self-harm detection) but be a distinct, lower-stakes code path.
- Needs a few test cases: gibberish, off-topic-but-coherent text (e.g. "book
  me a flight"), very short input ("idk"), and legitimate-but-vague symptoms
  ("I don't feel good") — the last one should still be accepted, just maybe
  prompted for more detail rather than rejected as nonsense.

---

### [ ] 1.3 Explain *why* this specialist was matched
**Where:** `src/components/MatchResultView.tsx`, `src/lib/doctorRanking.ts`,
`src/app/api/match/route.ts`.

**Why:** Currently the match result likely just states the recommended
specialty/doctor. Patients are more likely to trust and act on a
recommendation if they understand the reasoning — it also helps them
double-check the AI got their symptoms right.

**What it does:**
- The matching response includes a short (1-3 sentence) plain-language
  rationale alongside the specialist recommendation — e.g., "Based on the
  persistent joint pain and swelling you described, a Rheumatologist
  specializes in diagnosing and treating conditions affecting joints and the
  immune system."
- Rationale should reference the *specific symptoms/keywords the user gave*,
  not a generic blurb about the specialty — this is what makes it feel
  matched to them, not templated.
- Displayed clearly in `MatchResultView.tsx`, visually distinct from the
  specialist card itself (e.g., a "Why this specialist?" section/expandable).
- Keep it patient-friendly, not clinical jargon — no diagnosis language,
  just reasoning for the referral.

---

## 2. Roadmap

Suggested build order: **1.2 → 1.3 → 1.1**. Fixing the matching prompt's
handling of bad input first makes the "why this specialist" explanation
trustworthy from day one (no point explaining a match that came from garbage
input). Speech-to-text is additive UI and can land independently, so it's
last / can be parallelized.

### Phase 1 — Matching prompt hardening (1.2)
**Goal:** Nonsensical or off-topic input never produces a false specialist match.

**Prompt to use (Claude Code):**
```
Update the AI matching flow in src/app/api/match/route.ts so that before
generating a specialist match, it evaluates whether the patient's input in
the intake form is a plausible description of a physical symptom.

- If the input is nonsensical, off-topic, or too vague to reason about
  (e.g. gibberish, unrelated requests, single words with no context),
  do NOT force a specialty match. Instead return a response the frontend
  can render as a gentle prompt asking the user to describe what they're
  feeling, with 1-2 short examples of good input. Tone must be warm and
  non-judgmental, never scolding.
- Vague-but-genuine symptom descriptions (e.g. "I don't feel good") should
  still be accepted, optionally with a follow-up prompt for more detail,
  not treated as nonsense.
- This check should be a distinct, clearly named code path from the
  existing emergency/self-harm checks in src/lib/safetyGate.ts — don't
  merge the logic, they serve different purposes.
- Add a few inline test cases or a small test file covering: gibberish,
  coherent-but-off-topic text, very short input, and vague-but-real
  symptoms, to confirm each is handled as expected.
- Update MatchResultView.tsx (or wherever the match result renders) to
  handle and display this new "please clarify" response state.
```

### Phase 2 — "Why this specialist" explanation (1.3)
**Goal:** Every successful match includes a short, symptom-specific rationale.

**Prompt to use (Claude Code):**
```
Extend the specialist matching logic (src/app/api/match/route.ts and
src/lib/doctorRanking.ts as needed) so that a successful match returns a
short (1-3 sentence) plain-language explanation of why that specialty was
recommended, referencing the specific symptoms/keywords the patient
described rather than a generic description of the specialty.

- Add this "reason" field to the match API response.
- Update src/components/MatchResultView.tsx to display it clearly, in a
  "Why this specialist?" section visually separate from the doctor/
  specialty card itself.
- Keep the language patient-friendly and non-diagnostic — it explains the
  referral, it does not diagnose.
- Make sure this only renders for genuine matches, not for the "please
  clarify" state added in Phase 1.
```

### Phase 3 — Speech-to-text symptom input (1.1)
**Goal:** Patients can dictate their symptom description as an alternative to typing.

**Prompt to use (Claude Code):**
```
Add speech-to-text input to the symptom description step in
src/components/IntakeFlow.tsx (used from src/app/patient/intake/page.tsx).

- Add a mic button near the symptom textarea using the Web Speech API
  (SpeechRecognition / webkitSpeechRecognition).
- Transcribe live into the existing textarea so the user can review/edit
  before submitting — never auto-submit from voice input alone.
- Show a clear "listening…" state and a way to stop recording.
- Feature-detect browser support; if unsupported, don't render the mic
  button at all (silent fallback to typing, no error shown).
- Add proper aria-labels and keyboard accessibility for the mic control.
- Do not persist or upload raw audio anywhere — only the transcribed text
  should be stored, matching how typed input is currently handled.
```

---

## 3. Tracking

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1.1 | Speech-to-text symptom input | `[ ]` | Web Speech API, English-first |
| 1.2 | Gentle nonsense detection in matching prompt | `[x]` | Built & verified with unit tests |
| 1.3 | "Why this specialist" explanation | `[ ]` | Depends on 1.2 |
