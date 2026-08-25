// src/lib/taxonomySelfService.ts
//
// Lets a doctor add a new specialty/sub-specialty pair to specialty_taxonomy
// at onboarding or profile-edit time ("+ Other, please specify" -- Task 7.3),
// instead of the taxonomy being purely seed/migration-driven. Requires the
// specialty_taxonomy_insert_doctors RLS policy from migration 0008.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface TaxonomyEntry {
  specialty: string;
  sub_specialty: string | null;
}

async function findTaxonomyEntry(
  supabase: SupabaseClient,
  specialty: string,
  subSpecialty: string | null
): Promise<TaxonomyEntry | null> {
  let query = supabase
    .from('specialty_taxonomy')
    .select('specialty, sub_specialty')
    .ilike('specialty', specialty);

  query =
    subSpecialty === null
      ? query.is('sub_specialty', null)
      : query.ilike('sub_specialty', subSpecialty);

  const { data } = await query.limit(1).maybeSingle();
  return data ?? null;
}

// Finds an existing specialty_taxonomy row matching (specialty, subSpecialty)
// case-insensitively, snapping onto its stored casing if found -- so
// "cardiology" typed by one doctor lands on the "Cardiology" another doctor
// already created, instead of creating a near-duplicate entry. Inserts a new
// row if none exists. On a unique-violation race (two doctors creating the
// same new pair at once -- the DB's `unique (specialty, sub_specialty)`
// constraint, plus a partial unique index for the null-sub_specialty case),
// re-queries and returns the now-existing row instead of throwing.
export async function findOrCreateTaxonomyEntry(
  supabase: SupabaseClient,
  specialty: string,
  subSpecialty: string | null
): Promise<TaxonomyEntry> {
  const trimmedSpecialty = specialty.trim();
  const trimmedSubSpecialty = subSpecialty?.trim() || null;

  const existing = await findTaxonomyEntry(supabase, trimmedSpecialty, trimmedSubSpecialty);
  if (existing) return existing;

  const { data: inserted, error: insertError } = await supabase
    .from('specialty_taxonomy')
    .insert({ specialty: trimmedSpecialty, sub_specialty: trimmedSubSpecialty })
    .select('specialty, sub_specialty')
    .single();

  if (!insertError && inserted) return inserted;

  if (insertError?.code === '23505') {
    const raced = await findTaxonomyEntry(supabase, trimmedSpecialty, trimmedSubSpecialty);
    if (raced) return raced;
  }

  throw insertError ?? new Error('Failed to create taxonomy entry.');
}
