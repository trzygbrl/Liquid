// src/app/api/admin/taxonomy/[id]/route.ts
//
// DELETE /api/admin/taxonomy/[id]
// Removes a specialty_taxonomy row (Task 7.3's self-service "+ Other" entry
// cleanup). Passcode-gated (see src/lib/adminAuth.ts), service-role client.
//
// Note: migration 0005 replaced the old FK from doctors(specialty,
// sub_specialty) -> specialty_taxonomy with a trigger that only validates on
// INSERT/UPDATE of a doctors row. Deleting a taxonomy row here is therefore
// safe against existing doctors (nothing cascades, no FK error) -- but if
// that doctor later edits their profile without changing specialty, the
// trigger will reject the save until they pick a different taxonomy entry.
// The admin UI surfaces the current doctor count for each row so this is a
// visible, informed choice rather than a silent trap.

import { createClient } from '@supabase/supabase-js';
import { checkAdminPasscode } from '@/lib/adminAuth';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const authError = checkAdminPasscode(request);
  if (authError) return authError;

  const { id } = await params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: 'Server configuration error. Contact the team.' }, { status: 500 });
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await serviceClient.from('specialty_taxonomy').delete().eq('id', id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
