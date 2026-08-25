'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import RequireRole from '@/components/RequireRole';
import { supabase } from '@/lib/supabaseClient';
import ScheduleManager from '@/components/ScheduleManager';
import AppointmentsDashboard from '@/components/AppointmentsDashboard';
import ClinicManager from '@/components/ClinicManager';
import ProfileEditor from '@/components/ProfileEditor';
import StatTile from '@/components/StatTile';
import { IconCalendar, IconCheck, IconUsers } from '@/components/Icons';

interface PracticeStats {
  pending: number;
  upcoming: number;
  clinics: number;
}

type TabId = 'appointments' | 'schedule' | 'clinics' | 'profile';

const TABS: { id: TabId; label: string }[] = [
  { id: 'appointments', label: 'Appointments' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'clinics', label: 'Clinics' },
  { id: 'profile', label: 'Profile' },
];

function DashboardContent() {
  const router = useRouter();
  // true = still checking; null content is rendered as a spinner until confirmed
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [stats, setStats] = useState<PracticeStats>({ pending: 0, upcoming: 0, clinics: 0 });
  const [tab, setTab] = useState<TabId>('appointments');

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
        // No doctor row at all. Send through onboarding.
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
      loadStats(session.user.id);
    }

    // Counts for the summary tiles. `head: true` keeps these count-only
    // queries from pulling rows the tiles never render.
    async function loadStats(uid: string) {
      const today = new Date().toISOString().split('T')[0];
      const [pendingRes, upcomingRes, clinicsRes] = await Promise.all([
        supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('doctor_id', uid)
          .eq('status', 'pending'),
        supabase
          .from('schedule_slots')
          .select('id', { count: 'exact', head: true })
          .eq('doctor_id', uid)
          .eq('is_booked', 'available')
          .gte('date', today),
        supabase
          .from('clinics')
          .select('id', { count: 'exact', head: true })
          .eq('doctor_id', uid),
      ]);

      setStats({
        pending: pendingRes.count ?? 0,
        upcoming: upcomingRes.count ?? 0,
        clinics: clinicsRes.count ?? 0,
      });
    }

    checkProfile();
  }, [router]);

  if (checkingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        {/* Greeting */}
        <div className="mb-7">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Practice Dashboard</h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Review booking requests, publish open hours, and keep your listing current.
          </p>
        </div>

        {/* At-a-glance practice metrics */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile
            icon={<IconCalendar className="h-5 w-5" />}
            value={stats.pending}
            label="Pending requests"
            caption="Waiting on your review"
            tone="amber"
          />
          <StatTile
            icon={<IconCheck className="h-5 w-5" />}
            value={stats.upcoming}
            label="Open slots"
            caption="Available from today onward"
            tone="emerald"
          />
          <StatTile
            icon={<IconUsers className="h-5 w-5" />}
            value={stats.clinics}
            label="Practice locations"
            caption="Clinics on your public profile"
          />
        </div>

        {/* Section tabs. The four managers are heavy, so only one renders at a
            time instead of stacking into one very long page. */}
        <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={active ? 'page' : undefined}
                className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                  active
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
                {t.id === 'appointments' && stats.pending > 0 && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                    {stats.pending}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div>
          {tab === 'appointments' && <AppointmentsDashboard />}
          {tab === 'schedule' && <ScheduleManager />}
          {tab === 'clinics' && <ClinicManager />}
          {tab === 'profile' && <ProfileEditor />}
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
