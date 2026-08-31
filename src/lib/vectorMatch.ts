// src/lib/vectorMatch.ts
//
// Semantic specialist matching and embedding utilities for KayApp.
// Generates 768-dimensional embeddings using Gemini text-embedding models
// and runs cosine similarity queries via Supabase pgvector RPC.

import { GoogleGenAI } from '@google/genai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SPECIALTY_PLAIN_MAP } from './specialtyHelpers.ts';

export const EMBEDDING_MODELS = ['gemini-embedding-001', 'gemini-embedding-2', 'text-embedding-004'];
export const EMBEDDING_DIMENSIONS = 768;

/**
 * Minimal doctor profile input required to construct an embedding string.
 */
export interface ProfileInput {
  name: string;
  specialty: string;
  sub_specialty: string | null;
  credentials: string | null;
  clinics: { name: string; location: string }[];
}

/**
 * Similarity match record returned from the pgvector RPC search.
 */
export interface DoctorSimilarityMatch {
  id: string;
  similarity: number;
}

/**
 * Produces the canonical structured profile string for vector embedding.
 *
 * Output format:
 * "[name] is a [specialty] specialist[, sub-specialty: sub_specialty if set].
 *  Credentials: [credentials or 'Not specified'].
 *  Clinic(s): [comma-joined 'clinic.name in clinic.location'].
 *  Medical focus: [SPECIALTY_PLAIN_MAP description, fallback to specialty name]."
 *
 * @param doctor - Doctor profile details
 * @returns Formatted single string for text-embedding input
 */
export function buildDoctorProfileString(doctor: ProfileInput): string {
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

/**
 * Generates a 768-dimensional float embedding for a given text snippet.
 *
 * @param text - The document or query string to embed
 * @param taskType - 'RETRIEVAL_DOCUMENT' for doctor profiles, 'RETRIEVAL_QUERY' for patient symptom queries
 * @returns A promise resolving to a 768-element number array
 * @throws Error if GEMINI_API_KEY is missing or the embedding API fails
 */
export async function embedText(
  text: string,
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'
): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('[vectorMatch] Missing GEMINI_API_KEY environment variable.');
  }

  const ai = new GoogleGenAI({ apiKey });
  let lastError: unknown = null;

  for (const model of EMBEDDING_MODELS) {
    try {
      const response = await ai.models.embedContent({
        model,
        contents: text,
        config: {
          taskType,
          outputDimensionality: EMBEDDING_DIMENSIONS,
        },
      });

      const vector = response.embeddings?.[0]?.values;
      if (vector && vector.length === EMBEDDING_DIMENSIONS) {
        return vector;
      }
    } catch (err) {
      lastError = err;
    }
  }

  const msg = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`[vectorMatch] Failed to embed text (${taskType}): ${msg}`);
}

/**
 * Executes a cosine similarity search against public.doctors via Supabase RPC.
 * Returns the top K closest doctors sorted by similarity descending (highest first).
 *
 * Implements strict graceful degradation: if pgvector or the RPC function fails,
 * it catches the error, logs a warning, and safely returns an empty array.
 *
 * @param supabaseClient - Supabase client instance (anonymous or service role)
 * @param symptomEmbedding - 768-dimensional query vector
 * @param topK - Maximum number of doctor candidates to return (default 20)
 * @returns Array of doctor IDs and similarity scores (0.0 to 1.0)
 */
export async function vectorSearchDoctors(
  supabaseClient: SupabaseClient,
  symptomEmbedding: number[],
  topK: number = 20
): Promise<DoctorSimilarityMatch[]> {
  try {
    const { data, error } = await supabaseClient.rpc('match_doctors_by_embedding', {
      query_embedding: symptomEmbedding,
      match_count: topK,
    });

    if (error) {
      console.warn('[vectorMatch] match_doctors_by_embedding RPC error:', error.message);
      return [];
    }

    if (!Array.isArray(data)) {
      return [];
    }

    // Ensure sorted descending by similarity score
    return (data as DoctorSimilarityMatch[]).sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
  } catch (err) {
    console.warn('[vectorMatch] Unexpected error during vectorSearchDoctors:', err);
    return [];
  }
}
