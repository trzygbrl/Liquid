// src/app/api/match/route.ts
//
// POST /api/match
// AI Symptom to Specialty Matching. Pipeline stages 1-3 (Task 3.2)
//
// Pipeline (per PRD 8.1):
//   Symptoms go through AI stages 1-3 in one call, producing specialty
//   plus sub-specialty plus reason, or a clarifying question instead.
//
// Stages NOT implemented here: 4 (HMO verification), 5 (doctor ranking), 6 (booking)
//
// SECURITY NOTE (Assumption 9): This route is unauthenticated. The patient is
// already auth-gated by RequireRole on the client. Adding server-side session
// validation requires @supabase/ssr cookie handling which is not yet wired up.
// TODO: harden with session check before production / public demo.
//
// ENV VARS REQUIRED (add to .env.local + any deployment env):
//   GEMINI_API_KEY             Google AI Studio API key (server-only)
//   SUPABASE_SERVICE_ROLE_KEY  Supabase service-role key (server-only, bypasses RLS)
//   NEXT_PUBLIC_SUPABASE_URL   already present in .env.local

import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import type { MatchResult, ClarifyResult, EmergencyResult, OffTopicResult, MatchApiResult } from '@/lib/matchApi';
import { checkEmergencySymptoms } from '@/lib/safetyGate';
import { evaluateSymptomPlausibility } from '@/lib/symptomValidation';

// Types

interface RequestBody {
  symptomText: string;
  name?: string;
  age?: number;
  sex?: string;
  location?: string;
  isForFamilyMember?: boolean;
  conversationHistory?: Array<{ role: 'user' | 'model'; text: string }>;
}

// Response parser

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
      const examples = Array.isArray(parsed.examples)
        ? (parsed.examples.filter((e): e is string => typeof e === 'string') as string[])
        : undefined;
      const result: ClarifyResult = {
        type: 'clarify',
        question: parsed.question,
        ...(examples && examples.length > 0 ? { examples } : {}),
        ...(typeof parsed.isGentlePrompt === 'boolean' ? { isGentlePrompt: parsed.isGentlePrompt } : {}),
      };
      return result;
    }

    if (parsed.type === 'off_topic') {
      const result: OffTopicResult = {
        type: 'off_topic',
        message:
          typeof parsed.message === 'string'
            ? parsed.message
            : 'The words entered do not appear to describe physical symptoms or health concerns.',
      };
      return result;
    }

    // Valid JSON but unexpected shape
    return null;
  } catch {
    // Not JSON at all
    return null;
  }
}

// Graceful fallback used when the AI response can't be parsed

const PARSE_FALLBACK: ClarifyResult = {
  type: 'clarify',
  question:
    "We couldn't quite understand. Could you describe what you're feeling in a bit more detail?",
};

// Route Handler

export async function POST(request: Request): Promise<Response> {
  // 1. Validate env vars
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

  // 2. Parse + validate request body
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

  // 2.5 Emergency Safety Gate (PRD Section 8.2 / Task 3.3)
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

  // 2.6 Symptom Plausibility Gate (Task 1.2)
  // Evaluates whether input is a plausible physical symptom.
  // Short-circuits immediately on gibberish, single non-symptom words, or off-topic queries,
  // returning a warm, non-judgmental prompt with examples.
  // Vague-but-genuine symptoms ("I don't feel good", "masama pakiramdam") pass through.
  // Only runs on the initial turn (when conversationHistory is empty).
  if (conversationHistory.length === 0) {
    const plausibility = evaluateSymptomPlausibility(symptomText);
    if (!plausibility.isPlausible) {
      const offTopicResponse: OffTopicResult = {
        type: 'off_topic',
        message: 'Input does not appear to describe physical symptoms or health concerns.',
        gentlePrompt:
          plausibility.gentlePrompt ??
          "We want to make sure we connect you with the right doctor. Could you describe what you're feeling physically, or where you're experiencing discomfort?",
        examples: plausibility.examples,
      };
      return Response.json(offTopicResponse);
    }
  }

  // 3. Fetch taxonomy from Supabase (Assumption 3)
  // Use the service-role client so this bypasses RLS. No patient session
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

  // 4. Derive no-sub-specialty specialties (e.g. General Medicine) directly
  // from the taxonomy fetch above -- migration 0005 allows a
  // specialty_taxonomy row to have sub_specialty: null (one per specialty,
  // enforced by a partial unique index), which is how these are represented.
  // The model must return sub_specialty: null for these.
  // (Previously queried a separate `specialties` lookup table -- that table
  // was part of a competing, never-applied migration design; the query
  // silently no-op'd against the live DB. Removed as part of Task 7.3.)
  const noSubSpecialtyList: string[] = (taxonomyRows ?? [])
    .filter((r: { specialty: string; sub_specialty: string | null }) => r.sub_specialty === null)
    .map((r: { specialty: string; sub_specialty: string | null }) => r.specialty);

  // 5. Build the system prompt
  const taxonomyLines = (taxonomyRows ?? [])
    .filter((r: { specialty: string; sub_specialty: string | null }) => r.sub_specialty !== null)
    .map((r: { specialty: string; sub_specialty: string | null }) => `${r.specialty}: ${r.sub_specialty}`)
    .join('\n');

  const noSubLines =
    noSubSpecialtyList.length > 0 ? noSubSpecialtyList.join('\n') : '(none)';

  const systemPrompt = `You are a non-diagnostic clinical triage assistant for KayApp, a Philippine healthcare navigation platform.

Your job is to read a patient's symptom description and demographic details, then identify the ONE most appropriate medical specialty and sub-specialty from the fixed taxonomy list below.

RULES:
- Do NOT diagnose any condition.
- Do NOT suggest any medication or prescription.
- Do NOT recommend any specialty or sub-specialty outside the fixed list below. If symptoms don't fit any entry, pick the closest match.
- Return ONLY valid JSON. No markdown fences, no extra commentary outside the JSON value.
- INPUT PLAUSIBILITY & OFF-TOPIC EVALUATION:
  * If the input is completely off-topic (e.g. travel booking, weather inquiries, math, coding, restaurant orders, jokes, general trivia) or nonsensical, do NOT force a specialty match.
  * Instead, return:
    {"type":"off_topic","message":"The words entered do not appear to describe physical symptoms or health concerns."}
  * The tone MUST be warm, empathetic, and non-judgmental. NEVER scold or lecture.
- VAGUE BUT GENUINE HEALTH SYMPTOMS:
  * If the input describes genuine but vague discomfort (e.g. "I don't feel good", "masama ang pakiramdam ko", "feeling sick", "body hurts"), do NOT treat it as nonsense.
  * Either ask a gentle clarifying question to narrow down the symptom (e.g. asking where they feel discomfort or if they have a fever/cough) OR return a match to General Practice / Family Medicine / Pediatrics as appropriate.
- If confident in the match, return:
  {"type":"match","specialty":"...","sub_specialty":"..." or null,"reason":"short 1-3 sentence plain-language explanation referencing the patient's specific symptoms"}
- If the symptoms are too ambiguous or vague, return:
  {"type":"clarify","question":"one plain-language follow-up question"}
- If the patient has already answered a clarifying question (you will see it in the conversation history), you MUST now return a {"type":"match",...} response. Do not ask another question if the history already contains a patient answer.

ACCESSIBILITY, PLAIN-LANGUAGE & NURSE-TONE RULES (PRD 8.7 - CRITICAL):
1. The "reason" field MUST sound like a warm, caring clinic nurse explaining to a worried relative why this specialist is suited, NOT a medical textbook.
2. WHY THIS SPECIALIST IS SUITED (CRITICAL):
   - Do NOT just list or restate the symptoms back to the patient.
   - Do NOT merely state "this specialist will best evaluate you" or give a generic definition of the specialty.
   - You MUST explain in easy, relatable everyday vocabulary WHY this specialist's specific medical domain and diagnostic focus are needed for what the patient is feeling:
     * Connect the patient's reported symptom -> to what that specialist specifically investigates and treats -> and how that helps relieve the patient's issue or protect their health.
     * Example (Good - English): "Because of the persistent knee pain and swelling after sports you described, an Orthopedic specialist focuses on bones, ligaments, and joints, allowing them to pinpoint whether there is cartilage wear or tendon strain and help you move without pain."
     * Example (Bad - Generic): "Based on your knee pain, an Orthopedic doctor evaluates knee problems."
     * Example (Good - Tagalog): "Dahil sa panlalabo at mga kislap sa paningin na iyong inilarawan, ang isang Ophthalmologist ay may mga espesyal na kagamitan upang masuri ang kaloob-looban ng mata at retina na hindi nakikita sa karaniwang checkup upang maagapan ang paglabo."
     * Example (Bad - Generic): "Dahil masakit ang mata mo, kailangan mo ng eye doctor para matingnan ka."
   - Keep it strictly non-diagnostic: explain why the referral is suited, do NOT diagnose a specific disease or condition.
3. ELIMINATE all dense clinical jargon (e.g. do NOT say "etiology", "pathology", "bilateral presentation", "manifests", "symptomatology"). Use everyday words like "swelling", "stiffness", "airways", "digestion", "joint wear", "retina/eye lining".
4. LANGUAGE MIRRORING:
   - Detect whether the patient's symptom description is in English or Tagalog.
   - ENGLISH INPUT -> Write "reason" and "question" strictly in ENGLISH.
   - TAGALOG INPUT -> Write "reason" and "question" strictly in natural, conversational TAGALOG.
5. The "specialty" and "sub_specialty" fields MUST ALWAYS be returned in their exact English taxonomy names from the list below, regardless of the patient's input language.
6. The "reason" must be 1 to 3 clear sentences (approx. 20 to 50 words). Concise, reassuring, and easy for elderly or low-literacy patients to understand.
7. The "question" field (if asking a follow-up) must be a single short question in the patient's language. No numbered lists, no bullet points.

VALID SPECIALTY / SUB-SPECIALTY PAIRS (specialty: sub-specialty):
${taxonomyLines}

SPECIALTIES WITH NO SUB-SPECIALTY (use sub_specialty: null for these):
${noSubLines}`;

  // 6. Build the user turn content
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

  // Build the full contents array: history turns first, then the current user turn
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

  // 7. Call the Gemini API with automatic model fallback
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

  // 8. Parse the response
  const parsed = parseAIResponse(rawText);

  if (!parsed) {
    // Log for hackathon debugging. This is the most common failure mode
    console.error('[match] Failed to parse AI response. Raw text:', rawText);
    // Graceful fallback. Never return a 500 for an AI parse failure (Assumption 8)
    return Response.json(PARSE_FALLBACK);
  }

  // 9. Return
  return Response.json(parsed);
}
