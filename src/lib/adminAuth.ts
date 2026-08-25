// src/lib/adminAuth.ts
//
// Passcode gate shared by the admin doctor-verification API routes
// (Task 7.2). This is a disclosed speed bump, not real authentication --
// it is deliberately NOT wired into the patient/doctor RequireRole system.
// See /.claude/roadmap.md Task 7.2.

export function checkAdminPasscode(request: Request): Response | null {
  const expected = process.env.ADMIN_VERIFY_PASSCODE;
  if (!expected) {
    return Response.json(
      { error: 'Admin verification is not configured on this server (missing ADMIN_VERIFY_PASSCODE).' },
      { status: 500 }
    );
  }

  const provided = request.headers.get('x-admin-passcode');
  if (provided !== expected) {
    return Response.json({ error: 'Invalid passcode.' }, { status: 401 });
  }

  return null;
}
