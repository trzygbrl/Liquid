// src/app/api/admin/doctors/[id]/route.ts
//
// PATCH /api/admin/doctors/[id]
// Approves or rejects a doctor's HITL license verification (Task 7.2).
// Passcode-gated (see src/lib/adminAuth.ts), service-role client so the
// write bypasses the trg_protect_doctor_verification_fields trigger from
// migration 0008 (which only allows service-role writes to these columns).

import { createClient } from '@supabase/supabase-js';
import { checkAdminPasscode } from '@/lib/adminAuth';
import { buildDoctorProfileString, embedText, type ProfileInput } from '@/lib/vectorMatch';

interface PatchBody {
  verification_status: 'verified' | 'rejected';
  verification_notes?: string;
  reviewed_by?: string;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const authError = checkAdminPasscode(request);
  if (authError) return authError;

  const { id } = await params;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (body.verification_status !== 'verified' && body.verification_status !== 'rejected') {
    return Response.json(
      { error: "verification_status must be 'verified' or 'rejected'." },
      { status: 400 }
    );
  }
  if (body.verification_status === 'rejected' && !body.verification_notes?.trim()) {
    return Response.json({ error: 'A reason is required to reject a doctor.' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: 'Server configuration error. Contact the team.' }, { status: 500 });
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await serviceClient
    .from('doctors')
    .update({
      verification_status: body.verification_status,
      verification_notes: body.verification_notes?.trim() || null,
      reviewed_by: body.reviewed_by?.trim() || 'admin',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Fully Automated Embedding: When a doctor is approved, automatically build and save their vector embedding
  if (body.verification_status === 'verified') {
    try {
      const { data: doctorData } = await serviceClient
        .from('doctors')
        .select('id, name, credentials, specialty, sub_specialty, clinics(name, location)')
        .eq('id', id)
        .single();

      if (doctorData) {
        const profileInput: ProfileInput = {
          name: doctorData.name,
          specialty: doctorData.specialty,
          sub_specialty: doctorData.sub_specialty,
          credentials: doctorData.credentials,
          clinics: (doctorData.clinics ?? []).map((c: any) => ({
            name: c.name,
            location: c.location,
          })),
        };
        const profileString = buildDoctorProfileString(profileInput);
        const vector = await embedText(profileString, 'RETRIEVAL_DOCUMENT');
        await serviceClient
          .from('doctors')
          .update({ embedding: vector as unknown as string })
          .eq('id', id);
        console.log(`[admin/verify] Successfully generated and stored vector embedding for Dr. ${doctorData.name} (${id})`);
      }
    } catch (embedErr) {
      console.warn(`[admin/verify] Non-blocking warning: Failed to auto-generate embedding for doctor ${id}:`, embedErr);
    }
  }

  return Response.json({ ok: true });
}
