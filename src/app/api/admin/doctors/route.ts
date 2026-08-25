// src/app/api/admin/doctors/route.ts
//
// GET /api/admin/doctors
// Lists doctors for the HITL license-verification admin page (Task 7.2).
// Passcode-gated (see src/lib/adminAuth.ts), service-role client so RLS
// (which has no admin-facing read policy) doesn't apply here.

import { createClient } from '@supabase/supabase-js';
import { checkAdminPasscode } from '@/lib/adminAuth';

export async function GET(request: Request): Promise<Response> {
  const authError = checkAdminPasscode(request);
  if (authError) return authError;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: 'Server configuration error. Contact the team.' }, { status: 500 });
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await serviceClient
    .from('doctors')
    .select(
      'id, name, credentials, specialty, sub_specialty, verification_status, verification_notes, reviewed_by, reviewed_at, created_at'
    )
    .order('created_at', { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ doctors: data ?? [] });
}
