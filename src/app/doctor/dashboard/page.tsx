'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import RequireRole from '@/components/RequireRole';
import { supabase } from '@/lib/supabaseClient';
import ScheduleManager from '@/components/ScheduleManager';
import AppointmentsDashboard from '@/components/AppointmentsDashboard';

function DashboardContent() {
  const router = useRouter();
  // true = still checking; null content is rendered as a spinner until confirmed
  const [checkingProfile, setCheckingProfile] = useState(true);

  useEffect(() => {
    async function checkProfile() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return; // RequireRole handles the unauthenticated redirect

      const { data: doctorRow } = await supabase
        .from('doctors')
        .select('id')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!doctorRow) {
        // No doctor row at all — send through onboarding.
        router.replace('/doctor/profile-setup');
        return;
      }

      // "Profile complete" now requires both a doctors row *and* at least one clinics row.
      // If only the doctors row exists (partial failure from a prior attempt), send them
      // back to the setup page which will pre-fill the already-saved doctor data.
      const { data: clinicRows } = await supabase
        .from('clinics')
        .select('id')
        .eq('doctor_id', session.user.id)
        .limit(1);

      if (!clinicRows || clinicRows.length === 0) {
        router.replace('/doctor/profile-setup');
        return;
      }

      setCheckingProfile(false);
    }

    checkProfile();
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/doctor/auth');
  }

  if (checkingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F7FA]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#F8F7FA] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-6 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-extrabold text-slate-900">
                Civic<span className="text-violet-600">Access</span>
              </span>
              <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-bold text-violet-700 border border-violet-100">
                Doctor Portal
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Practice Dashboard</h1>
          </div>
          <button
            id="doctor-sign-out"
            onClick={handleSignOut}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 shadow-sm"
          >
            Sign out
          </button>
        </div>

        <div className="space-y-8">
          <AppointmentsDashboard />
          <ScheduleManager />
        </div>
      </div>
    </main>
  );
}

export default function DoctorDashboardPage() {
  return (
    <RequireRole role="doctor">
      <DashboardContent />
    </RequireRole>
  );
}
