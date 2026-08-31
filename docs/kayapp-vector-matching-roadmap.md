# KayApp — Vector-Based AI Matching: Roadmap & Coding Agent Prompts

> **Document type:** Feature roadmap + coding agent prompt library
> **Companion docs:** `docs/liquid-prd.md`, `docs/kayapp-additional-features.md`
> **Owner:** AI/Integration Lead (Role D) + Backend Lead (Role A)
> **Status:** Draft — ready for team review before execution

---

## 0. Why This Document Exists

KayApp's current AI matching pipeline (PRD Section 8.1) works like this:

```
Patient symptom text
  → [Safety Gate: deterministic regex, safetyGate.ts]
  → [Plausibility Gate: keyword heuristics, symptomValidation.ts]
  → [LLM call: Gemini with full taxonomy in system prompt, api/match/route.ts]
  → specialty + sub_specialty string (exact taxonomy name)
  → [DB filter: WHERE specialty = '...', patient/doctors page]
  → rankDoctors() [4-tier sort: sub-specialty exact match → HMO → rating → soonest slot]
```

This works. But it has a **structural weakness**: the bridge between the AI output
and the doctor list is a **string equality check**. Either the LLM returns
`"Cardiology"` and you see cardiologists, or it doesn't and you don't. There is no
gradient. A patient describing atypical angina might get routed to `"Internal
Medicine"` and never see the `"Cardiology: Electrophysiology"` sub-specialty doctor
who is a far better fit — because the ranking never had a chance to consider
clinical proximity.

**Vector-based matching** replaces that brittle string bridge with a **semantic
similarity layer**. Instead of asking "does the doctor's specialty string exactly
match what the AI returned?", we ask "how semantically close is this doctor's full
clinical profile to what the patient described?". This produces:

1. **Graceful degradation**: patients with ambiguous or cross-specialty symptoms get
   a ranked list of _relevant_ doctors, not a narrow filtered list or an empty state.
2. **Sub-specialty precision**: sub-specialties not named explicitly in the patient's
   description can still surface if their embedding is close to the symptom embedding.
3. **Continuous improvement**: match quality improves as you add more doctor profile
   text — credentials, clinic notes, self-described expertise — without changing the
   matching logic.
4. **Richer ranking signal**: the cosine similarity score becomes a new Tier 0
   ranking criterion that sits _above_ the existing 4-tier sort, making the doctor
   ranking genuinely reflect clinical fit, not just taxonomy string matching.

---

## 1. Current Architecture Audit

Before building anything, understand the exact integration points that will change.

### 1.1 Files touched by this feature

| File | Current role | What changes |
|---|---|---|
| `src/app/api/match/route.ts` | LLM call + taxonomy lookup | Gains embedding call + parallel doctor shortlist fetch |
| `src/lib/matchApi.ts` | Client-side types | `MatchResult` gains optional `rankedDoctors` and `vectorSearchApplied` fields |
| `src/lib/doctorRanking.ts` | 4-tier sort | Gains Tier 0: vector similarity score |
| `src/lib/doctorFilters.ts` | Filter + sort options | New `SortKey` value: `'semantic'` |
| `supabase/migrations/` | Schema | New migration: `pgvector` extension + `embedding` column on `doctors` |
| `scripts/embed_doctors.mjs` | (new file) | Batch-embeds all seeded doctor profiles |
| `src/app/api/embed/route.ts` | (new file) | Admin-only route: re-embed a single doctor on demand |
| `src/lib/vectorMatch.ts` | (new file) | Supabase RPC wrapper + embedding helper functions |

### 1.2 What does NOT change

- `src/lib/safetyGate.ts` — safety gate is pre-AI and must stay deterministic.
- `src/lib/symptomValidation.ts` — plausibility gate is pre-AI and must stay fast.
- The LLM call itself (`gemini-flash-lite-latest` with taxonomy system prompt) — it
  still produces `specialty + sub_specialty + reason`. Vector matching is a layer on
  top, not a replacement.
- Auth, booking flow, doctor/secretary dashboard — not in scope.

---

## 2. Technical Design

### 2.1 What gets embedded

Each doctor gets a single embedding vector generated from a **structured profile
string**:

```
"[name] is a [specialty] specialist[, sub-specialty: sub_specialty if not null].
Credentials: [credentials or 'Not specified'].
Clinic(s): [comma-joined list of 'clinic.name in clinic.location'].
Medical focus: [plain-language specialty description from specialtyHelpers.ts]."
```

This is richer than just the specialty name, but structured enough to be
reproducible. It is regenerated whenever the doctor's profile changes.

Each patient symptom submission also gets an **on-the-fly embedding** at query time
— a single embedding call on the symptom text (after safety + plausibility gates
pass).

> **Why not embed the full conversation history?** Too noisy. Embed only the final,
> confirmed `symptomText` field — the same text the LLM sees.

### 2.2 Similarity function

Use **cosine similarity** via Supabase's `pgvector` extension. The Supabase RPC
function returns doctors sorted by distance ascending (nearest first).

Target: return the **top 20 closest doctors** by vector distance, then apply the
existing `rankDoctors()` sort within that shortlist.

### 2.3 Two-track retrieval strategy

The pipeline uses **both** the LLM taxonomy output AND the vector similarity score:

```
Patient input
  ↓
LLM → { specialty: "Cardiology", sub_specialty: "Electrophysiology", reason: "..." }
  ↓
Two parallel DB queries:
  Track A: WHERE specialty = 'Cardiology'   [exact match, up to 50 results]
  Track B: vector_search(symptom_embedding, top_k=20)  [semantic shortlist]
  ↓
Merge: union of Track A + Track B, deduplicated by doctor ID
  ↓
rankDoctors() with Tier 0 = vector similarity score
  ↓
Ranked list shown to patient
```

- Track A ensures that exact taxonomy matches are never missed.
- Track B surfaces cross-specialty or adjacent-specialty doctors.
- Tier 0 puts the most semantically similar doctors at the top regardless of track.

### 2.4 Embedding model

Use **Gemini `gemini-embedding-001`** (with fallback support) via the `@google/genai` SDK already in the
project. Same `GEMINI_API_KEY`. No new vendor.

```ts
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const result = await ai.models.embedContent({
  model: 'gemini-embedding-001',
  contents: profileString,
  config: {
    taskType: 'RETRIEVAL_DOCUMENT', // for doctor profiles; use 'RETRIEVAL_QUERY' for patient symptom queries
    outputDimensionality: 768,      // produces 768-dim float array matching vector(768)
  },
});
const vector = result.embeddings[0].values; // float32[], length 768
```

### 2.5 Database changes

```sql
-- Enable pgvector (Supabase has it pre-installed)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column (nullable — doctors without embeddings are still valid)
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS embedding vector(768);

-- IVFFlat index for fast ANN cosine search (~200-500 records → lists = 100)
CREATE INDEX IF NOT EXISTS doctors_embedding_idx
  ON doctors USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

The `vector(768)` dimension matches `text-embedding-004`'s output.

---

## 3. Phases and Milestones

| Phase | What ships | Effort estimate |
|---|---|---|
| **Phase 1** | DB schema + pgvector migration | ~1 hour |
| **Phase 2** | Doctor profile embedding script | ~2 hours |
| **Phase 3** | `/api/embed` admin route | ~1 hour |
| **Phase 4** | `vectorMatch.ts` Supabase RPC helper | ~1 hour |
| **Phase 5** | Integrate vector retrieval into `/api/match` | ~3 hours |
| **Phase 6** | Update `rankDoctors()` with Tier 0 vector score | ~1 hour |
| **Phase 7** | `matchApi.ts` type updates + frontend surfacing | ~1 hour |
| **Phase 8** | End-to-end testing + seeded-data smoke test | ~2 hours |

Total: ~12 focused hours. Can be split across Roles A and D in parallel after Phase 1.

---

## 4. Coding Agent Prompts

The prompts below are ready to paste into Antigravity, Claude Code, Cursor, or any
repo-aware coding agent. Each prompt is self-contained and references files by path.
**Always read the referenced files before writing any code.**
Read `docs/liquid-prd.md` for overall context.

---

### PROMPT 1 — Database Migration: pgvector + embedding column

```
You are working on KayApp, a Next.js 16 + Supabase healthcare navigation app.
Read docs/liquid-prd.md and supabase/migrations/ before writing anything.

Task: Create a new Supabase migration file that does ALL of the following:

1. Enables the pgvector extension (Supabase has it pre-installed):
   CREATE EXTENSION IF NOT EXISTS vector;

2. Adds an `embedding` column to the `doctors` table:
   ALTER TABLE doctors ADD COLUMN IF NOT EXISTS embedding vector(768);
   Dimension 768 matches Google text-embedding-004 output. The column is nullable —
   doctors without a generated embedding are still valid records; they simply won't
   appear in vector search results until embedded.

3. Creates an IVFFlat approximate nearest-neighbour index for cosine distance:
   CREATE INDEX IF NOT EXISTS doctors_embedding_idx
     ON doctors USING ivfflat (embedding vector_cosine_ops)
     WITH (lists = 100);
   lists = 100 is appropriate for 200-500 doctor records.

4. Creates a Supabase RPC function named match_doctors_by_embedding:
   - Input:  query_embedding vector(768), match_count int DEFAULT 20
   - Output: TABLE(id uuid, similarity float)
   - Uses cosine distance operator; rows ordered by distance ascending
     (nearest = most similar first)
   - Filters out rows where embedding IS NULL
   - Does NOT apply any specialty filter (done in application code)

   CREATE OR REPLACE FUNCTION match_doctors_by_embedding(
     query_embedding vector(768),
     match_count int DEFAULT 20
   )
   RETURNS TABLE(id uuid, similarity float)
   LANGUAGE sql STABLE
   AS $$
     SELECT id, 1 - (embedding <=> query_embedding) AS similarity
     FROM doctors
     WHERE embedding IS NOT NULL
     ORDER BY embedding <=> query_embedding
     LIMIT match_count;
   $$;

5. Name the file following the existing numbering in supabase/migrations/ —
   check the highest number and increment by 1.
   Naming pattern: NNNN_pgvector_doctor_embeddings.sql

6. Do NOT modify any existing migrations. Do NOT touch seeds.sql.

After completing this, append an entry to docs/BUILD_LOG.md following the existing
format: what was built, which files were touched, and any decisions made.
```

---

### PROMPT 2 — Doctor Profile Embedding Script

```
You are working on KayApp, a Next.js 16 + Supabase healthcare navigation app.
Read docs/liquid-prd.md, src/lib/specialtyHelpers.ts, and scripts/seed_doctors.js
before writing anything. Also inspect the existing scripts/ directory for naming
and code conventions.

Task: Create a new Node.js script at scripts/embed_doctors.mjs that:

1. Loads environment variables from .env.local using a manual parse
   (read the file, split on '=' per line). No new npm packages.
   Needed vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY.

2. Creates a Supabase service-role client (same pattern as match/route.ts).

3. Fetches ALL doctors from the doctors table with their clinics:
   .from('doctors').select('id, name, credentials, specialty, sub_specialty, clinics(name, location)')

4. For each doctor builds a structured profile string:
   "[name] is a [specialty] specialist[, sub-specialty: sub_specialty if not null].
   Credentials: [credentials or 'Not specified'].
   Clinic(s): [comma-joined 'clinic.name in clinic.location'].
   Medical focus: [description from SPECIALTY_PLAIN_MAP in src/lib/specialtyHelpers.ts,
   or fall back to the specialty name if not found]."

   Try to import SPECIALTY_PLAIN_MAP from src/lib/specialtyHelpers.ts via dynamic
   import. If that fails (ESM/TS mismatch), copy the lookup map inline.

5. Calls text-embedding-004 for each profile string:
   - import { GoogleGenAI } from '@google/genai' (already in package.json)
   - taskType: 'RETRIEVAL_DOCUMENT'
   - Result is a float32 array of length 768.

6. Upserts the embedding to the doctors table:
   .from('doctors').update({ embedding: vectorArray }).eq('id', doctorId)
   Supabase JS handles the vector type as a plain number array.

7. Processes doctors in batches of 10 with a 500ms delay between batches.

8. Logs: "Embedding doctor X of Y: [name]" per doctor, "Done. Embedded N doctors."
   on completion.

9. On individual doctor failure: log the error (with doctor ID + name) and continue.
   Never abort the whole run for a single failure.

10. Supports a --dry-run flag: if present, build and log profile strings but skip
    the embedding API call and all database writes.

After writing the script, add a new npm script to package.json:
  "embed": "node scripts/embed_doctors.mjs"

After completing this, append an entry to docs/BUILD_LOG.md following the existing format.
```

---

### PROMPT 3 — Admin Re-embedding API Route

```
You are working on KayApp, a Next.js 16 + Supabase healthcare navigation app.
Read docs/liquid-prd.md, src/app/api/match/route.ts, and src/app/api/admin/ before
writing anything.

Task: Create a new Next.js API route at src/app/api/embed/route.ts that:

1. Accepts POST requests with JSON body: { doctorId: string }
   Purpose: admin-triggered re-embedding of a single doctor profile (e.g. after
   the doctor updates their credentials or specialty).

2. Auth: check for SUPABASE_SERVICE_ROLE_KEY in the Authorization Bearer header.
   Return 401 if missing or wrong. Keep this consistent with the pattern used in
   src/app/api/admin/.

3. Fetches the doctor's profile from Supabase using the service role client:
   SELECT id, name, credentials, specialty, sub_specialty, clinics(name, location)
   WHERE id = doctorId

4. Builds the structured profile string (same format as the embed script in Prompt 2).
   Once src/lib/vectorMatch.ts exists (Prompt 4), import buildDoctorProfileString
   from there instead of duplicating the logic.

5. Calls text-embedding-004 with taskType 'RETRIEVAL_DOCUMENT' → 768-dim vector.

6. Upserts the embedding: .from('doctors').update({ embedding: vector }).eq('id', id)

7. Returns { success: true, doctorId } or a 500 with an error message.

8. Log every call: console.log('[embed] Re-embedded doctor:', doctorId)

After completing this, append an entry to docs/BUILD_LOG.md.
```

---

### PROMPT 4 — vectorMatch.ts Helper Library

```
You are working on KayApp, a Next.js 16 + Supabase healthcare navigation app.
Read docs/liquid-prd.md, src/lib/matchApi.ts, src/lib/doctorRanking.ts, and
src/lib/specialtyHelpers.ts before writing anything.

Task: Create src/lib/vectorMatch.ts with the following exports:

EXPORT 1 — Interface ProfileInput
  { name: string; specialty: string; sub_specialty: string | null;
    credentials: string | null; clinics: { name: string; location: string }[] }

EXPORT 2 — buildDoctorProfileString(doctor: ProfileInput): string
  Produces the embedding profile string:
    "[name] is a [specialty] specialist[, sub-specialty: sub_specialty if set].
     Credentials: [credentials or 'Not specified'].
     Clinic(s): [comma-joined 'clinic.name in clinic.location'].
     Medical focus: [SPECIALTY_PLAIN_MAP description, fallback to specialty name]."
  Import SPECIALTY_PLAIN_MAP from './specialtyHelpers'.
  This is the single canonical source for the profile string format — both the embed
  script (Prompt 2) and the admin route (Prompt 3) should import this function.

EXPORT 3 — embedText(text: string, taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'): Promise<number[]>
  Uses @google/genai, model 'text-embedding-004', API key from process.env.GEMINI_API_KEY.
  Returns float32 array of length 768.
  Throws a descriptive Error if the key is missing or the API call fails.

EXPORT 4 — vectorSearchDoctors(
    supabaseClient: SupabaseClient,
    symptomEmbedding: number[],
    topK?: number   // default 20
  ): Promise<Array<{ id: string; similarity: number }>>
  Calls the 'match_doctors_by_embedding' RPC (created in Prompt 1).
  Returns results sorted by similarity descending (best first).
  CRITICAL: if the RPC errors (e.g. pgvector not yet installed on the project),
  log a warning and return [] — never throw. Graceful degradation is mandatory.

Rules:
- Add JSDoc comments to every export.
- Zero side effects at import time. All API calls are inside functions.

After completing this, append an entry to docs/BUILD_LOG.md.
```

---

### PROMPT 5 — Integrate Vector Retrieval into /api/match

```
You are working on KayApp, a Next.js 16 + Supabase healthcare navigation app.
This is the core integration task. Read ALL of the following before writing a
single line of code:
  - docs/liquid-prd.md (especially Sections 8.1 and 8.4)
  - src/app/api/match/route.ts   (file you are modifying)
  - src/lib/matchApi.ts          (types)
  - src/lib/doctorRanking.ts     (rankDoctors + DoctorRecord)
  - src/lib/vectorMatch.ts       (helper created in Prompt 4)

Current pipeline in match/route.ts:
  1. Validate env vars
  2. Parse + validate request body
  3. Emergency safety gate (safetyGate.ts)       — DO NOT CHANGE
  4. Plausibility gate (symptomValidation.ts)     — DO NOT CHANGE
  5. Fetch specialty_taxonomy from Supabase
  6. Build system prompt (full taxonomy in prompt)
  7. Call Gemini (gemini-flash-lite-latest with fallbacks)
  8. Parse LLM response: { type:'match', specialty, sub_specialty, reason }
  9. Return parsed result

Currently the route stops at step 9. This task adds steps AFTER a successful
{ type:'match' } result only.

NEW STEP A — Embed the patient symptom text:
  Call embedText(symptomText, 'RETRIEVAL_QUERY') from src/lib/vectorMatch.ts.
  On failure: log a warning, set symptomEmbedding = null, continue.
  Never let an embedding failure break the match response.

NEW STEP B — Parallel doctor queries (only run when LLM returned type:'match'):
  Track A (taxonomy exact match):
    serviceClient.from('doctors')
      .select('id, name, credentials, specialty, sub_specialty, hmo_accreditations,
               verification_status, clinics(*), schedule_slots(*), reviews(rating)')
      .eq('specialty', matchedSpecialty)
      .eq('verification_status', 'verified')
      .limit(50)

  Track B (vector semantic search, only if symptomEmbedding is not null):
    ids = await vectorSearchDoctors(serviceClient, symptomEmbedding, 20)
    Then fetch full DoctorRecord data for those ids:
      .from('doctors')
      .select('same fields as Track A')
      .in('id', ids.map(r => r.id))
      .eq('verification_status', 'verified')

  Use Promise.allSettled so one track failure never blocks the other.

NEW STEP C — Merge and deduplicate:
  Union of Track A + Track B records, keyed by doctor ID.
  Build a Map<string, number> (doctorId → similarityScore) from Track B results;
  doctors only in Track A get score 0.

NEW STEP D — Rank:
  Call rankDoctors(mergedDoctors, specialty, sub_specialty, patientHmo, similarityMap)
  patientHmo comes from body.hmo (pass null if not provided).
  The 5th arg (similarityMap) is the new Tier 0 parameter added in Prompt 6.
  Pass undefined if Track B failed entirely.

NEW STEP E — Extend MatchResult type (update src/lib/matchApi.ts):
  Add to MatchResult:
    rankedDoctors?: RankedDoctorSummary[];
    vectorSearchApplied?: boolean;

  Type RankedDoctorSummary:
    { id: string; name: string; specialty: string; sub_specialty: string | null;
      similarityScore: number; isHmoCovered: boolean; averageRating: number | null;
      soonestSlot: { formatted: string } | null;
      primaryClinic: { name: string; location: string;
                       consultation_fee: number } | null }

  Include top 10 ranked doctors as rankedDoctors[].
  Set vectorSearchApplied: true if Track B ran without error.

NEW STEP F — Return extended response:
  Spread the original MatchResult fields + new rankedDoctors + vectorSearchApplied.

CONSTRAINTS (non-negotiable):
- Steps 1-4 (validation, safety gate, plausibility gate): DO NOT TOUCH.
- System prompt and LLM call: DO NOT TOUCH.
- type:'clarify' or type:'off_topic': return immediately as today, skip new steps.
- Wrap all new steps in a single try/catch. On failure: log + return the original
  MatchResult without rankedDoctors. A retrieval failure must never produce a 500.
- Add timing logs: console.log('[match] Vector enrichment took Xms').

After completing this, append an entry to docs/BUILD_LOG.md.
```

---

### PROMPT 6 — Update rankDoctors() with Vector Similarity as Tier 0

```
You are working on KayApp, a Next.js 16 + Supabase healthcare navigation app.
Read docs/liquid-prd.md (Section 8.4) and src/lib/doctorRanking.ts carefully
before writing anything.

Context: existing rankDoctors() sorts by 4 tiers:
  Tier 1: Sub-specialty exact match strength
  Tier 2: HMO coverage
  Tier 3: Average rating (higher first)
  Tier 4: Soonest available slot (earlier first)

Task: Add vector similarity as Tier 0 — highest priority ranking signal —
while preserving the existing 4-tier fallback for doctors with no vector score.

Changes to make in src/lib/doctorRanking.ts:

1. Add to RankedDoctor interface:
   similarityScore: number;  // 0.0–1.0 cosine similarity; 0 if not vector-ranked

2. Add to RankingResult interface:
   vectorSearchApplied: boolean;

3. Update rankDoctors() signature — add optional 5th parameter:
   similarityScores?: Map<string, number>

4. In the .map() that builds RankedDoctor[], add:
   similarityScore: similarityScores?.get(doc.id) ?? 0

5. Prepend Tier 0 in the sort, BEFORE Tier 1:

   // Tier 0: Vector similarity
   // Only fires when both candidates have a non-zero score — avoids penalising
   // Track A-only doctors that never got a vector score.
   if (similarityScores && a.similarityScore > 0 && b.similarityScore > 0) {
     const diff = b.similarityScore - a.similarityScore;
     if (Math.abs(diff) > 0.01) return diff > 0 ? 1 : -1;
     // within 0.01 tolerance → fall through to Tier 1
   }
   // Tier 1, 2, 3, 4 unchanged below...

   The 0.01 tolerance prevents tiny similarity deltas from overriding a clearly
   better HMO or availability match. Tune after observing real score distributions.

6. In the returned RankingResult, set:
   vectorSearchApplied: Boolean(similarityScores && similarityScores.size > 0)

7. When similarityScores is undefined, all existing behaviour is identical
   (backwards-compatible with all current call sites that pass only 4 args).

8. Update the JSDoc comment on rankDoctors() to document the new Tier 0 parameter.

Do NOT change pickSoonestSlot(), deriveFilterOptions(), or any other function.

After completing this, append an entry to docs/BUILD_LOG.md.
```

---

### PROMPT 7 — Frontend: Surface the Semantic Match Score

```
You are working on KayApp, a Next.js 16 + Supabase healthcare navigation app.
Read docs/liquid-prd.md (especially Section 8.7 on accessibility), src/lib/matchApi.ts,
and the files under src/app/patient/ before writing anything.

Context: after Prompts 5 and 6, /api/match optionally returns rankedDoctors[] with
a similarityScore per doctor (0.0–1.0) and a vectorSearchApplied boolean.

Task: Update the patient-facing screens to surface this data:

CHANGE 1 — Pre-populate doctor list from rankedDoctors:
  After a successful AI match, pass the rankedDoctors shortlist from the API
  response to the doctor listing component as the initial displayed set.
  The full Supabase fetch can still run in the background for filter options —
  the shortlist just appears instantly, without waiting for the full fetch.

CHANGE 2 — Match quality badge on doctor cards:
  When a doctor card has a similarityScore from the match result, show a badge:
  - 0.85–1.0:  "Top match"   (teal/green pill)
  - 0.70–0.85: "Good match"  (blue pill)
  - below 0.70: no badge (do not expose weak-match labels)
  Accessibility rules (PRD 8.7): font-size 14px minimum, high contrast.
  Badge is visually secondary (smaller than doctor name and specialty).
  Tagalog equivalents when patient intake language was Tagalog:
    "Top match"  → "Pinakamainam"
    "Good match" → "Magandang tugma"
  Do NOT show the raw numeric score to patients — only human-readable labels.

CHANGE 3 — "Best clinical match" sort option:
  In src/lib/doctorFilters.ts, add: { value: 'semantic', label: 'Best clinical match' }
  to SORT_OPTIONS and update the SortKey type and sortDoctors() accordingly.
  This option only appears in the sort dropdown when vectorSearchApplied === true.
  When selected, sort by similarityScore descending.

CHANGE 4 — Supporting note in "Why this specialist?" section:
  When vectorSearchApplied is true, append a one-line note below the reason text:
  English: "Doctors are ranked by how closely their expertise matches your description."
  Tagalog: "Ang mga doktor ay inayos ayon sa kung gaano kagaling ang pagtutugma sa iyong inilarawan."
  Style: subtle supporting-text size, not a headline.

GRACEFUL DEGRADATION (mandatory):
  Every change must be invisible when vectorSearchApplied is false or missing.
  The existing doctor list, sort controls, and cards must look exactly as today.

Follow existing CSS class naming in src/app/globals.css and component patterns in
src/components/. Do not introduce new CSS frameworks or libraries.

After completing this, append an entry to docs/BUILD_LOG.md.
```

---

### PROMPT 8 — End-to-End Smoke Test

```
You are working on KayApp, a Next.js 16 + Supabase healthcare navigation app.
Read docs/liquid-prd.md, src/lib/vectorMatch.ts, src/app/api/match/route.ts,
and src/lib/doctorRanking.ts before writing anything.

Task: Write automated unit tests + a manual smoke test checklist.

PART A — Unit tests at src/lib/vectorMatch.test.ts
Use Node's built-in test runner (same pattern as src/lib/symptomValidation.test.ts).

Test group 1 — buildDoctorProfileString():
  - Doctor with sub_specialty: output contains both specialty and sub_specialty.
  - Doctor with sub_specialty = null: output does not contain "sub-specialty:".
  - Doctor with empty clinics array: returns a valid string without throwing.
  - Specialty in SPECIALTY_PLAIN_MAP: output contains the plain description.
  - Specialty not in map: falls back gracefully to the specialty name.

Test group 2 — vectorSearchDoctors() with a mocked Supabase client:
  - When the RPC returns an error: function returns [] without throwing.
  - When the RPC returns valid data: function returns { id, similarity }[]
    sorted by similarity descending.

Test group 3 — Tier 0 sort in rankDoctors() (import from src/lib/doctorRanking.ts):
  - Build two minimal DoctorRecord mocks (A and B).
  - Set similarityScores Map so A = 0.92, B = 0.65.
  - Call rankDoctors() with the map; assert A ranks first even if B has a higher
    average rating (Tier 0 overrides Tier 3).
  - Call rankDoctors() without the map; assert the existing Tier 1-4 order is
    unchanged (regression test for backwards compatibility).

PART B — Manual smoke test checklist
Append these items to docs/BUILD_LOG.md after the automated tests pass:

[ ] npm run embed -- --dry-run prints sensible profile strings for 3 sample doctors
[ ] npm run embed completes without errors; console shows "Done. Embedded N doctors."
[ ] Supabase Studio: all 202 seeded doctors have a non-null embedding value
[ ] POST /api/match with "I have sharp chest pain when I breathe":
    - Returns type:'emergency' (safety gate fires) OR type:'match' with rankedDoctors
    - If match: vectorSearchApplied is true (or false with a warning log if API down)
[ ] POST /api/match with "blurry vision in left eye":
    - Returns type:'match', specialty near 'Ophthalmology'
    - rankedDoctors includes Ophthalmology doctors ranked above others
[ ] Doctor cards show "Top match" badge for the highest-similarity doctor
[ ] Sort control shows "Best clinical match" option after a successful match
[ ] Selecting "Best clinical match" sort reorders the list by similarity score
[ ] With GEMINI_API_KEY removed: /api/match returns a valid MatchResult
    (no rankedDoctors), NOT a 500 error

Update package.json test script to include the new test file:
"test": "node --test src/lib/symptomValidation.test.ts src/lib/speechRecognition.test.ts src/lib/vectorMatch.test.ts"

After completing this, append an entry to docs/BUILD_LOG.md.
```

---

## 5. Open Questions

Resolve these before starting PROMPT 5 or later.

| # | Question | Impact | Recommended resolution |
|---|---|---|---|
| **Q1** | Should the vector shortlist replace or supplement the full doctor fetch on `/patient/doctors`? | UX + performance | **Supplement**: return the shortlist in `/api/match` for instant display, keep the background full fetch for filter panel. Avoids breaking existing filter logic. |
| **Q2** | When should embeddings be re-generated? On every doctor profile save, or on-demand? | Data freshness | **On demand** for the hackathon (`/api/embed`). Post-hackathon: trigger via Supabase webhook on doctor profile update. |
| **Q3** | What similarity threshold for the "Top match" badge — 0.85? 0.90? | UX | Start at 0.85. Tune after seeing score distribution from the seeded dataset. |
| **Q4** | Should vector search be locality-aware (same city/province)? | Local relevance | **Yes — implement geo-weighted re-ranking.** The patient's `location` (city/province) is already collected in the intake form and passed to the match API. After the vector search returns the top-20 semantic results, apply a **locality boost multiplier** before the Tier 0 sort: `adjustedScore = similarityScore × localityBoost` where `localityBoost = 1.5` (same city), `1.2` (same province), `1.0` (elsewhere). This keeps the semantic score as the primary signal but surfaces geographically reachable doctors within similarly-scored candidates. Do NOT encode location into the embedding itself — that pollutes the clinical semantic space. See **Locality-Aware Re-ranking** section below. |
| **Q5** | Should the patient's symptom embedding be stored for analytics? | Privacy + AI improvement | **No for the hackathon** (requires a privacy policy update). **Flag this explicitly in the pitch as a continuous AI improvement roadmap item.** See **Post-Hackathon AI Improvement Pitch Note** section below. |
| **Q6** | What if pgvector isn't available on the Supabase project? | Compatibility | `vectorSearchDoctors()` returns `[]` gracefully. App continues with Track A only. Code defensively everywhere. |

---

## 5a. Locality-Aware Re-ranking

> **Context for Q4:** Top-match doctors are often geographically unreachable for the
> patient. This section defines the implementation.

The patient's `location` field (e.g. `"Angeles City, Pampanga"`) is already captured
in the intake form and passed to `/api/match`. The fix is a **post-vector,
pre-Tier-0 locality boost** — never location-in-embedding.

### Why NOT encode location in the embedding?

Embedding `"Angeles City"` into the doctor profile vector means the model is
optimising for geographic proximity at the expense of clinical semantics. A Retina
specialist in Pampanga and a Retina specialist in Quezon City should be equally
similar to a patient describing "flashes in vision" — location should be a
**tiebreaker**, not a component of clinical fit.

### Implementation: geo-weighted adjusted score

After `vectorSearchDoctors()` returns `{ id, similarity }[]`, compute:

```ts
const localityBoost = (doctorCities: string[], patientCity: string, patientProvince: string) => {
  if (doctorCities.some(c => c.toLowerCase().includes(patientCity.toLowerCase()))) return 1.5;
  if (doctorCities.some(c => c.toLowerCase().includes(patientProvince.toLowerCase()))) return 1.2;
  return 1.0;
};

const adjustedScore = similarityScore * localityBoost(doctor.clinicLocations, patientCity, patientProvince);
```

Use `adjustedScore` as the value stored in `similarityScores Map<string, number>` that
is passed to `rankDoctors()`. The Tier 0 sort then automatically surfaces
geographically reachable, semantically close doctors first.

### Parsing the patient location string

The intake form stores location as `"Angeles City, Pampanga"` (city, province).
Parse with a simple split on the last comma:

```ts
const parts = patientLocation.split(',');
const patientProvince = parts.at(-1)?.trim() ?? '';
const patientCity = parts.slice(0, -1).join(',').trim();
```

### Where to add this in the code

In PROMPT 5, STEP C (merge and deduplicate), replace:

```ts
similarityScore: trackBResult?.similarity ?? 0
```

with:

```ts
similarityScore: (trackBResult?.similarity ?? 0) *
  localityBoost(doctor.clinics.map(c => c.location), patientCity, patientProvince)
```

This keeps all locality logic inside the merge step, invisible to `rankDoctors()`.

### Update PROMPT 5 with this requirement

When running PROMPT 5, add this to the prompt:

> "After merging Track A and Track B (STEP C), apply a locality boost to the
> similarity score. Parse the patient's `location` field (from the request body,
> format 'City, Province') into city and province parts. For each doctor, check
> their clinic locations: multiply the raw similarity score by 1.5 if any clinic
> is in the same city, 1.2 if any clinic is in the same province, 1.0 otherwise.
> Use the boosted score in the similarityScores Map passed to rankDoctors().
> Do NOT modify the embedding vectors."

---

## 5b. Post-Hackathon AI Improvement Pitch Note

> **Context for Q5:** Storing symptom embeddings is off-limits during the hackathon
> (privacy policy gap), but it is a compelling **continuous AI improvement** story
> for the pitch.

### What to say in the pitch

Include this on the "Beyond the Hackathon" roadmap slide (PRD Section 11), clearly
labelled as a post-launch item:

> *"With user consent and a proper privacy policy, KayApp can store anonymized
> symptom embedding vectors alongside confirmed appointment outcomes. Over time this
> creates a feedback loop: when a patient booked a Rheumatologist and left a 5-star
> review, that symptom-to-specialty pair becomes a positive training signal. This
> data — unique to KayApp — makes our matching progressively more accurate than any
> general-purpose LLM, and is defensible IP that no competitor can replicate without
> their own patient network."*

### Why judges will respond to this

| Criterion | Why this lands |
|---|---|
| **Innovation & Creativity** (20%) | Feedback-loop AI that improves from actual patient outcomes, not just training data |
| **Impact & Scalability** (10%) | A network effect moat — more patients → better matches → more patients |
| **Use of AI/Technology** (20%) | Positions the LLM as a bootstrapping tool, not the permanent ceiling |

### What NOT to say

- Do not claim it's built or running. It's not.
- Do not quote specific accuracy improvement numbers. None exist yet.
- Frame it as "what our data moat looks like at scale" — an investor/judge framing,
  not a feature claim.

### Implementation notes (for when you're ready post-hackathon)

- Store `{ appointment_id, symptom_embedding: vector(768), specialty_confirmed, sub_specialty_confirmed }` in a new `symptom_outcomes` table after a booking is completed.
- Consent gate: add a checkbox at booking confirmation ("Help improve KayApp's matching — your data is anonymized").
- Use the aggregate to build a **fine-tuned retrieval corpus**: instead of matching against doctor profile embeddings alone, also match against the `symptom_outcomes` table to find "previous patients with similar symptoms booked X sub-specialty and rated it highly".
- This is a retrieval-augmented generation (RAG) layer on top of the existing pipeline, not a replacement.

---

## 6. Performance Budget

Target total `/api/match` route latency: **< 2 seconds** on a cold start.

| Step | Expected latency |
|---|---|
| Existing LLM call (Gemini flash-lite) | 400–800ms |
| **NEW** Symptom embedding (text-embedding-004) | ~100–200ms |
| **NEW** Vector search RPC (Supabase IVFFlat) | ~10–30ms |
| **NEW** Track A + Track B doctor fetches (parallel) | ~50–100ms each |
| **Total new overhead** | ~200–350ms |

If the new overhead exceeds 1.5s, move vector search to a **background enrichment
call**: return the LLM match immediately, then have the client fire a second
`POST /api/similar-doctors` to fetch the ranked shortlist asynchronously.

---

## 7. Rollout Checklist

- [ ] Confirm pgvector is available on the Supabase project plan
- [ ] `.env.local`: no new env vars needed — `GEMINI_API_KEY` covers both LLM and embedding
- [ ] Apply migration (PROMPT 1) before running the embed script
- [ ] Run `npm run embed` after seeding to populate all doctor embeddings
- [ ] Merge in order: PROMPT 1 → PROMPT 4 → PROMPT 6 → PROMPT 2 → PROMPT 3 → PROMPT 5 → PROMPT 7 → PROMPT 8
  - PROMPTS 2, 3 can run in parallel after PROMPT 1 and PROMPT 4 are merged
  - PROMPT 6 must precede PROMPT 5 (route depends on updated `rankDoctors` signature)
  - PROMPTS 7 and 8 are last
- [ ] Run `npm test` after each prompt merge; fix failures before proceeding
- [ ] Smoke test checklist from PROMPT 8 passes end-to-end
- [ ] Update `docs/liquid-prd.md` Change Log to record this feature
- [ ] Update `docs/kayapp-additional-features.md` tracking table with vector matching status

---

*Document created: 2026-08-31. Owner: AI/Integration Lead (Role D). Review before executing PROMPT 5.*
