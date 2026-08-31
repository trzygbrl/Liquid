// src/app/api/embed/route.ts
//
// POST /api/embed
// Admin-triggered re-embedding of a single doctor profile (e.g. after
// credentials or specialty updates).
//
// Auth: Bearer token matching SUPABASE_SERVICE_ROLE_KEY in the Authorization header.

import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { SPECIALTY_PLAIN_MAP } from '@/lib/specialtyHelpers';

const EMBEDDING_MODELS = ['gemini-embedding-001', 'gemini-embedding-2', 'text-embedding-004'];
const EMBEDDING_DIMENSIONS = 768;

interface ClinicInfo {
  name: string;
  location: string;
}

interface DoctorProfileData {
  id: string;
  name: string;
  credentials: string | null;
  specialty: string;
  sub_specialty: string | null;
  clinics: ClinicInfo[] | null;
}

/**
 * Builds the canonical structured profile string for vector embedding.
 */
function buildDoctorProfileString(doctor: DoctorProfileData): string {
  const subSpecialtyPart = doctor.sub_specialty
    ? `, sub-specialty: ${doctor.sub_specialty}`
    : '';

  const credentials = doctor.credentials?.trim() || 'Not specified';

  const clinicList = (doctor.clinics ?? [])
    .map((c) => `${c.name} in ${c.location}`)
    .join(', ') || 'Not specified';

  const focusEntry = SPECIALTY_PLAIN_MAP[doctor.specialty];
  const medicalFocus = focusEntry?.description ?? doctor.specialty;

  return [
    `${doctor.name} is a ${doctor.specialty} specialist${subSpecialtyPart}.`,
    `Credentials: ${credentials}.`,
    `Clinic(s): ${clinicList}.`,
    `Medical focus: ${medicalFocus}`,
  ].join(' ');
}

export async function POST(request: Request): Promise<Response> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!supabaseUrl || !serviceRoleKey || !geminiApiKey) {
    return Response.json(
      { error: 'Server configuration error (missing required environment variables).' },
      { status: 500 }
    );
  }

  // 1. Auth check: verify Bearer token matches service role key
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;

  if (!token || token !== serviceRoleKey) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // 2. Parse request body
  let body: { doctorId?: string };
  try {
    body = (await request.json()) as { doctorId?: string };
  } catch {
    return Response.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const { doctorId } = body;
  if (!doctorId || typeof doctorId !== 'string') {
    return Response.json({ error: 'Missing or invalid doctorId in request body.' }, { status: 400 });
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 3. Fetch doctor profile data
  const { data: doctor, error: fetchError } = await serviceClient
    .from('doctors')
    .select('id, name, credentials, specialty, sub_specialty, clinics(name, location)')
    .eq('id', doctorId)
    .single();

  if (fetchError || !doctor) {
    return Response.json(
      { error: fetchError?.message || `Doctor not found with ID: ${doctorId}` },
      { status: fetchError?.code === 'PGRST116' ? 404 : 500 }
    );
  }

  // 4. Build structured profile string
  const profileString = buildDoctorProfileString(doctor as unknown as DoctorProfileData);

  // 5. Call Gemini embedding model with 768-dim output
  const ai = new GoogleGenAI({ apiKey: geminiApiKey });
  let vector: number[] | null = null;
  let lastEmbedError: unknown = null;

  for (const model of EMBEDDING_MODELS) {
    try {
      const response = await ai.models.embedContent({
        model,
        contents: profileString,
        config: {
          taskType: 'RETRIEVAL_DOCUMENT',
          outputDimensionality: EMBEDDING_DIMENSIONS,
        },
      });

      const vals = response.embeddings?.[0]?.values;
      if (vals && vals.length === EMBEDDING_DIMENSIONS) {
        vector = vals;
        break;
      }
    } catch (err) {
      lastEmbedError = err;
    }
  }

  if (!vector || vector.length !== EMBEDDING_DIMENSIONS) {
    const errorMsg = lastEmbedError instanceof Error ? lastEmbedError.message : String(lastEmbedError);
    return Response.json(
      { error: `Failed to generate vector embedding: ${errorMsg}` },
      { status: 500 }
    );
  }

  // 6. Upsert embedding to doctors table
  const { error: updateError } = await serviceClient
    .from('doctors')
    .update({ embedding: vector })
    .eq('id', doctorId);

  if (updateError) {
    return Response.json(
      { error: `Failed to save embedding to database: ${updateError.message}` },
      { status: 500 }
    );
  }

  // 7. Log & Return
  console.log('[embed] Re-embedded doctor:', doctorId);
  return Response.json({ success: true, doctorId });
}
