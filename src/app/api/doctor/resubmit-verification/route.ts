// src/app/api/doctor/resubmit-verification/route.ts
//
// POST /api/doctor/resubmit-verification
// Lets a rejected doctor put themselves back in the HITL review queue
// (Task 7.2). Only 'rejected' -> 'pending' is allowed; there is no
// unauthenticated way to touch verification_status directly (locked by the
// trg_protect_doctor_verification_fields trigger from migration 0008), so
// this route authenticates the caller with their own access token, then
// performs the actual write with the service-role key.
//
// ENV VARS REQUIRED: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY (all already present in .env.local).

import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request): Promise<Response> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return Response.json({ error: 'Server configuration error. Contact the team.' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Missing session token.' }, { status: 401 });
  }
  const accessToken = authHeader.slice('Bearer '.length);

  // Verify identity with the anon key so Supabase Auth actually validates the
  // JWT -- do NOT trust the token's claims unchecked.
  const callerClient = createClient(supabaseUrl, anonKey);
  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser(accessToken);

  if (userError || !user) {
    return Response.json({ error: 'Your session expired. Please log in again.' }, { status: 401 });
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: doctorRow, error: fetchError } = await serviceClient
    .from('doctors')
    .select('verification_status')
    .eq('id', user.id)
    .maybeSingle();

  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 });
  }
  if (!doctorRow) {
    return Response.json({ error: 'Doctor profile not found.' }, { status: 404 });
  }
  if (doctorRow.verification_status !== 'rejected') {
    return Response.json(
      { error: 'Only a rejected profile can be resubmitted for review.' },
      { status: 400 }
    );
  }

  const { error: updateError } = await serviceClient
    .from('doctors')
    .update({
      verification_status: 'pending',
      verification_notes: null,
      reviewed_by: null,
      reviewed_at: null,
    })
    .eq('id', user.id);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
