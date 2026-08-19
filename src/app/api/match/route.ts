// src/app/api/match/route.ts
//
// POST /api/match
// AI Symptom → Specialty Matching — Pipeline stages 1-3 (Task 3.2)
//
// Pipeline (per PRD 8.1):
//   Symptoms → [AI: stages 1-3 in one call] → specialty + sub-specialty + reason
//                                            → OR clarifying question
//
// Stages NOT implemented here: 4 (HMO verification), 5 (doctor ranking), 6 (booking)
//
// SECURITY NOTE (Assumption 9): This route is unauthenticated. The patient is
// already auth-gated by RequireRole on the client. Adding server-side session
// validation requires @supabase/ssr cookie handling which is not yet wired up.
// TODO: harden with session check before production / public demo.
//
// ENV VARS REQUIRED (add to .env.local + any deployment env):
//   GEMINI_API_KEY             — Google AI Studio API key (server-only)
//   SUPABASE_SERVICE_ROLE_KEY  — Supabase service-role key (server-only, bypasses RLS)
//   NEXT_PUBLIC_SUPABASE_URL   — already present in .env.local

import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import type { MatchResult, ClarifyResult, EmergencyResult, MatchApiResult } from '@/lib/matchApi';
import { checkEmergencySymptoms } from '@/lib/safetyGate';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RequestBody {
  symptomText: string;
  name?: string;
  age?: number;
  sex?: string;
  location?: string;
  isForFamilyMember?: boolean;
  conversationHistory?: Array<{ role: 'user' | 'model'; text: string }>;
}

// ─── Response parser ─────────────────────────────────────────────────────────

function parseAIResponse(raw: string): MatchApiResult | null {
  // Strip markdown code fences if the model wraps its output (Assumption 8)
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(stripped) as Record<string, unknown>;

    if (
      parsed.type === 'match' &&
      typeof parsed.specialty === 'string' &&
      typeof parsed.reason === 'string'
    ) {
      const result: MatchResult = {
        type: 'match',
        specialty: parsed.specialty,
        // sub_specialty may legitimately be null (General Practice)
        sub_specialty:
          typeof parsed.sub_specialty === 'string' ? parsed.sub_specialty : null,
        reason: parsed.reason,
      };
      return result;
    }

    if (parsed.type === 'clarify' && typeof parsed.question === 'string') {
      const result: ClarifyResult = { type: 'clarify', question: parsed.question };
      return result;
    }

    // Valid JSON but unexpected shape
    return null;
  } catch {
    // Not JSON at all
    return null;
  }
}

// ─── Graceful fallback used when the AI response can't be parsed ──────────────

const PARSE_FALLBACK: ClarifyResult = {
  type: 'clarify',
  question:
    "We couldn't quite understand — could you describe what you're feeling in a bit more detail?",
};

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  // ── 1. Validate env vars ──────────────────────────────────────────────────
  const geminiKey = process.env.GEMINI_API_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!geminiKey || !serviceRoleKey || !supabaseUrl) {
    console.error('[match] Missing required env vars:', {
      geminiKey: !!geminiKey,
      serviceRoleKey: !!serviceRoleKey,
      supabaseUrl: !!supabaseUrl,
    });
    return Response.json(
      { error: 'Server configuration error. Contact the team.' },
      { status: 500 }
    );
  }

  // ── 2. Parse + validate request body ─────────────────────────────────────
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const {
    symptomText,
    name,
    age,
    sex,
    location,
    conversationHistory = [],
  } = body;

  // symptomText is required (Assumption 6)
  if (!symptomText || typeof symptomText !== 'string' || symptomText.trim().length < 1) {
    return Response.json({ error: 'symptomText is required.' }, { status: 400 });
  }

  // ── 2.5 Emergency Safety Gate (PRD Section 8.2 / Task 3.3) ────────────────
  // Runs BEFORE any AI/specialty mapping call. Deterministic rule check on
  // calibrated objective symptom combinations. Short-circuits immediately if
  // an emergency condition is detected.
  const safetyCheck = checkEmergencySymptoms(symptomText);
  if (safetyCheck.isEmergency) {
    const emergencyResponse: EmergencyResult = {
      type: 'emergency',
      message:
        safetyCheck.message ??
        'These symptoms can sometimes be serious. Please consider seeking urgent or emergency care.',
      matchedCriteria: safetyCheck.matchedCriteria,
    };
    return Response.json(emergencyResponse);
  }

  // ── 3. Fetch taxonomy from Supabase (Assumption 3) ───────────────────────
  // Use the service-role client so this bypasses RLS — no patient session
  // needed for a table read that only touches public lookup data.
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: taxonomyRows, error: taxonomyError } = await serviceClient
    .from('specialty_taxonomy')
    .select('specialty, sub_specialty')
    .order('specialty')
    .order('sub_specialty');

  if (taxonomyError) {
    console.error('[match] Failed to fetch specialty_taxonomy:', taxonomyError.message);
    return Response.json(
      { error: 'Could not load specialty data. Try again.' },
      { status: 500 }
    );
  }

  // ── 4. Fetch no-sub-specialty specialties (e.g. General Practice) ─────────
  // These appear in the specialties table but have no rows in specialty_taxonomy.
  // The model must return sub_specialty: null for these.
  const allTaxonomySpecialties = new Set(
    (taxonomyRows ?? []).map((r) => r.specialty)
  );

  const { data: allSpecialtyRows } = await serviceClient
    .from('specialties')
    .select('specialty')
    .order('specialty');

  const noSubSpecialtyList: string[] = (allSpecialtyRows ?? [])
    .map((r: { specialty: string }) => r.specialty)
    .filter((s: string) => !allTaxonomySpecialties.has(s));

  // ── 5. Build the system prompt ────────────────────────────────────────────
  const taxonomyLines = (taxonomyRows ?? [])
    .map((r: { specialty: string; sub_specialty: string }) => `${r.specialty} → ${r.sub_specialty}`)
    .join('\n');

  const noSubLines =
    noSubSpecialtyList.length > 0 ? noSubSpecialtyList.join('\n') : '(none)';

  const systemPrompt = `You are a non-diagnostic clinical triage assistant for CivicAccess, a Philippine healthcare navigation platform.

Your job is to read a patient's symptom description and demographic details, then identify the ONE most appropriate medical specialty and sub-specialty from the fixed taxonomy list below.

RULES:
- Do NOT diagnose any condition.
- Do NOT suggest any medication or prescription.
- Do NOT recommend any specialty or sub-specialty outside the fixed list below. If symptoms don't fit any entry, pick the closest match.
- Return ONLY valid JSON — no markdown fences, no extra commentary outside the JSON value.
- If confident in the match, return:
  {"type":"match","specialty":"...","sub_specialty":"..." or null,"reason":"one sentence in plain language"}
- If the symptoms are too ambiguous or vague, return:
  {"type":"clarify","question":"one plain-language follow-up question"}
- If the patient has already answered a clarifying question (you will see it in the conversation history), you MUST now return a {"type":"match",...} response. Do not ask another question if the history already contains a patient answer.

ACCESSIBILITY, PLAIN-LANGUAGE & NURSE-TONE RULES (PRD 8.7 - CRITICAL):
1. The "reason" field MUST sound like a warm, caring clinic nurse explaining to a worried relative — NOT a medical textbook.
2. ELIMINATE all dense clinical jargon (e.g. do NOT say "etiology", "pathology", "bilateral presentation", "manifests", "symptomatology").
   - Instead of: "Symptoms manifest classic retinal detachment etiology."
   - Say: "These dark spots and flashes of light often involve the back of the eye, so an eye specialist should examine it promptly."
   - In Tagalog: "Ang ganitong panlalabo at mga kislap sa paningin ay mahalagang masuri agad ng espesyalista sa mata upang maagapan."
3. LANGUAGE MIRRORING:
   - Detect whether the patient's symptom description is in English or Tagalog.
   - ENGLISH INPUT -> Write "reason" and "question" strictly in ENGLISH.
   - TAGALOG INPUT -> Write "reason" and "question" strictly in natural, conversational TAGALOG.
4. The "specialty" and "sub_specialty" fields MUST ALWAYS be returned in their exact English taxonomy names from the list below, regardless of the patient's input language.
5. The "reason" must be concise and reassuring. Maximum 25 words.
6. The "question" field (if asking a follow-up) must be a single short question in the patient's language. No numbered lists, no bullet points.

VALID SPECIALTY / SUB-SPECIALTY PAIRS (specialty → sub-specialty):
${taxonomyLines}

SPECIALTIES WITH NO SUB-SPECIALTY (use sub_specialty: null for these):
${noSubLines}`;

  // ── 6. Build the user turn content ───────────────────────────────────────
  // Demographic preamble for the model's context
  const demoParts: string[] = [];
  if (name) demoParts.push(`Patient: ${name}${body.isForFamilyMember ? ' (Family Member)' : ''}`);
  if (age) demoParts.push(`Age: ${age}`);
  if (sex) demoParts.push(`Sex: ${sex}`);
  if (location) demoParts.push(`Location: ${location}`);

  const demoContext =
    demoParts.length > 0 ? `${demoParts.join(' | ')}\n\n` : '';

  // Assumption 7: if conversation is at the turn cap, force a best-effort match
  const forceMatchNote =
    conversationHistory.length >= 4
      ? '\n\n[SYSTEM NOTE: This is your final attempt. You must return a best-effort {"type":"match",...} response even if uncertain. Do not ask another question.]'
      : '';

  const currentUserText =
    `${demoContext}Symptoms: ${symptomText.trim()}${forceMatchNote}`;

  // Build the full contents array — history turns first, then the current user turn
  const contents = [
    ...conversationHistory.map((turn) => ({
      role: turn.role as 'user' | 'model',
      parts: [{ text: turn.text }],
    })),
    {
      role: 'user' as const,
      parts: [{ text: currentUserText }],
    },
  ];

  // ── 7. Call the Gemini API with automatic model fallback ──────────────────
  const modelsToTry = [
    'gemini-flash-lite-latest',
    'gemini-2.5-flash',
    'gemini-flash-latest',
  ];

  let rawText = '';
  let lastError: unknown = null;
  const ai = new GoogleGenAI({ apiKey: geminiKey });

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: systemPrompt,
          // Low temperature for deterministic JSON output
          temperature: 0.1,
        },
      });

      if (response.text) {
        rawText = response.text;
        break;
      }
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[match] Model "${model}" failed: ${msg.substring(0, 100)}... trying fallback model.`);
    }
  }

  if (!rawText) {
    console.error('[match] All Gemini models failed:', lastError);
    return Response.json(
      { error: 'AI service unavailable. Please try again in a few moments.' },
      { status: 502 }
    );
  }

  // ── 8. Parse the response ─────────────────────────────────────────────────
  const parsed = parseAIResponse(rawText);

  if (!parsed) {
    // Log for hackathon debugging — this is the most common failure mode
    console.error('[match] Failed to parse AI response. Raw text:', rawText);
    // Graceful fallback — never return a 500 for an AI parse failure (Assumption 8)
    return Response.json(PARSE_FALLBACK);
  }

  // ── 9. Return ─────────────────────────────────────────────────────────────
  return Response.json(parsed);
}
