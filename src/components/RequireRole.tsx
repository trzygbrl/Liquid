'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { getRoleFromUser, dashboardRouteForRole, authRouteForRole, type UserRole } from '@/lib/auth';

interface RequireRoleProps {
  role: UserRole;
  children: ReactNode;
}

export default function RequireRole({ role, children }: RequireRoleProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace(authRouteForRole(role));
        return;
      }

      const actualRole = getRoleFromUser(session.user);
      if (actualRole && actualRole !== role) {
        // User is authenticated but on the wrong role's dashboard — redirect them to theirs.
        router.replace(dashboardRouteForRole(actualRole));
        return;
      }

      setReady(true);
    });
  }, [role, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-500" />
      </div>
    );
  }

  return <>{children}</>;
}
