'use client';

// src/app/patient/dashboard/page.tsx
//
// Patient Dashboard — Navigation Hub & Appointments Overview
//
// Features:
// 1. Symptom check intake entry card (Task 3.1)
// 2. Full doctor directory entry card (Task 3.3)
// 3. Appointments & Consultations section with:
//    - Real-time / updated status tracking
//    - Verified Review submission entry point for completed visits (Task 5.1)

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import RequireRole from '@/components/RequireRole';
import { supabase } from '@/lib/supabaseClient';

interface AppointmentItem {
  id: string;
  status: 'pending' | 'confirmed' | 'declined' | 'completed' | 'cancelled';
  created_at: string;
  symptom_summary: string | null;
  doctor: {
    id: string;
    name: string;
    specialty: string;
    sub_specialty: string | null;
  } | null;
  slot: {
    date: string;
    start_time: string;
    end_time: string;
    clinic: {
      name: string;
      location: string;
    } | null;
  } | null;
  review: {
    id: string;
    rating: number;
  } | null;
}

function fmtTime(timeStr: string): string {
  const [hStr, mStr] = timeStr.split(':');
  const hNum = parseInt(hStr, 10);
  const ampm = hNum >= 12 ? 'PM' : 'AM';
  const h12 = hNum % 12 || 12;
  return `${h12}:${mStr} ${ampm}`;
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function PatientDashboardContent() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [loadingAppts, setLoadingAppts] = useState<boolean>(true);

  useEffect(() => {
    async function loadPatientData() {
      setLoadingAppts(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoadingAppts(false);
        return;
      }

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          status,
          created_at,
          symptom_summary,
          doctors (
            id,
            name,
            specialty,
            sub_specialty
          ),
          schedule_slots (
            date,
            start_time,
            end_time,
            clinics (
              name,
              location
            )
          ),
          reviews (
            id,
            rating
          )
        `)
        .eq('patient_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const formatted: AppointmentItem[] = data.map((item: any) => {
          const doc = Array.isArray(item.doctors) ? item.doctors[0] : item.doctors;
          const slot = Array.isArray(item.schedule_slots) ? item.schedule_slots[0] : item.schedule_slots;
          const clinic = slot ? (Array.isArray(slot.clinics) ? slot.clinics[0] : slot.clinics) : null;
          const rev = Array.isArray(item.reviews) ? item.reviews[0] : item.reviews;

          return {
            id: item.id,
            status: item.status,
            created_at: item.created_at,
            symptom_summary: item.symptom_summary,
            doctor: doc,
            slot: slot
              ? {
                  date: slot.date,
                  start_time: slot.start_time,
                  end_time: slot.end_time,
                  clinic: clinic,
                }
              : null,
            review: rev || null,
          };
        });

        setAppointments(formatted);
      }

      setLoadingAppts(false);
    }

    loadPatientData();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/patient/auth');
  }

  const completedAppts = appointments.filter((a) => a.status === 'completed');
  const activeAppts = appointments.filter((a) => a.status !== 'completed');

  return (
    <main className="flex min-h-screen flex-col bg-[#F8F7FA] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white text-lg font-black shadow-md shadow-violet-500/20 shrink-0">
              ✦
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-600 bg-violet-50 px-2.5 py-0.5 rounded-full border border-violet-100">
                  ✨ Patient Portal
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Good day, Sarah!
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3 self-end sm:self-center">
            <a
              href="/patient/doctors"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
            >
              Doctor Directory
            </a>
            <button
              id="patient-sign-out"
              onClick={handleSignOut}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-500 shadow-sm transition hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Quick Action Navigation Cards */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Hero Intake flow card (Inspo Sleep Tracker card style) */}
          <a
            id="patient-start-intake"
            href="/patient/intake"
            className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-7 text-white shadow-xl shadow-purple-500/15 transition transform hover:-translate-y-0.5"
          >
            {/* Ambient decorative glow circle */}
            <div className="absolute -right-8 -bottom-8 h-40 w-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col justify-between h-full min-h-[170px]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white backdrop-blur-md">
                    ✨ AI Clinical Triage
                  </span>
                  <span className="text-white/80 group-hover:translate-x-1 transition text-lg">
                    →
                  </span>
                </div>
                <h2 className="mt-4 text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Check my symptoms
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-purple-100 max-w-sm">
                  Describe what you or your family member feels in English or Tagalog. We match you to the exact specialist.
                </p>
              </div>

              <div className="mt-5 flex items-center gap-2">
                <span className="rounded-2xl bg-white px-4 py-2 text-xs font-bold text-slate-950 shadow-md transition group-hover:bg-purple-50">
                  Start Symptom Check →
                </span>
              </div>
            </div>
          </a>

          {/* Directory card (Inspo Clean White Card style) */}
          <a
            id="patient-browse-doctors"
            href="/patient/doctors"
            className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-7 shadow-[0_8px_30px_rgb(0,0,0,0.03)] transition transform hover:-translate-y-0.5 hover:border-violet-200"
          >
            <div className="flex flex-col justify-between h-full min-h-[170px]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700 border border-violet-100">
                    🩺 200+ Verified Doctors
                  </span>
                  <span className="text-slate-400 group-hover:translate-x-1 group-hover:text-violet-600 transition text-lg">
                    →
                  </span>
                </div>
                <h2 className="mt-4 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  Browse all doctors
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500 max-w-sm">
                  Filter by 33 medical specialties, clinic location, and HMO accreditations to book open slots directly.
                </p>
              </div>

              <div className="mt-5 flex items-center gap-2">
                <span className="rounded-2xl bg-[#2A2338] px-4 py-2 text-xs font-bold text-white shadow-sm transition group-hover:bg-[#1E192C]">
                  View Doctor Directory →
                </span>
              </div>
            </div>
          </a>
        </div>

        {/* ─── Appointments & Consultations Section ───────────────────────────── */}
        <div className="mt-10">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 mb-6">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">My Consultations & Appointments</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Track your requested bookings, upcoming consultations, and submit verified reviews.
              </p>
            </div>
            {appointments.length > 0 && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 border border-slate-200/80">
                {appointments.length} total
              </span>
            )}
          </div>

          {loadingAppts ? (
            <div className="flex items-center justify-center py-12 text-slate-500 text-xs gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-violet-600" />
              <span>Loading consultations…</span>
            </div>
          ) : appointments.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center text-xl mb-3">
                📅
              </div>
              <p className="text-sm font-semibold text-slate-800">No appointments requested yet.</p>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                Once you check symptoms and book a doctor, your scheduled visits and status updates will appear here.
              </p>
              <a
                href="/patient/intake"
                className="mt-4 inline-block rounded-2xl bg-[#2A2338] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#1E192C] shadow-sm"
              >
                Check Symptoms Now →
              </a>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Active & Pending Appointments */}
              {activeAppts.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Upcoming & Active ({activeAppts.length})
                  </h3>
                  <div className="grid grid-cols-1 gap-3.5">
                    {activeAppts.map((appt) => (
                      <div
                        key={appt.id}
                        className="rounded-3xl border border-slate-100 bg-white p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-bold text-slate-900">
                              {appt.doctor?.name || 'Specialist'}
                            </h4>
                            <span className="text-xs text-slate-400">•</span>
                            <span className="text-xs font-semibold text-violet-700 bg-violet-50 px-2.5 py-0.5 rounded-full border border-violet-100">
                              {appt.doctor?.specialty}
                              {appt.doctor?.sub_specialty ? ` (${appt.doctor.sub_specialty})` : ''}
                            </span>
                          </div>

                          {appt.slot && (
                            <p className="text-xs text-slate-700 font-medium">
                              📅 {fmtDate(appt.slot.date)} at <span className="font-bold text-slate-900">{fmtTime(appt.slot.start_time)}</span>
                              {appt.slot.clinic && ` • 📍 ${appt.slot.clinic.name}`}
                            </p>
                          )}

                          {appt.symptom_summary && (
                            <p className="text-xs text-slate-500 italic">
                              &ldquo;{appt.symptom_summary}&rdquo;
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          {appt.status === 'pending' && (
                            <span className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-bold text-amber-700">
                              ⏳ Pending Confirmation
                            </span>
                          )}
                          {appt.status === 'confirmed' && (
                            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
                              ✓ Confirmed
                            </span>
                          )}
                          {appt.status === 'declined' && (
                            <span className="rounded-full bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-bold text-rose-700">
                              Declined
                            </span>
                          )}
                          {appt.status === 'cancelled' && (
                            <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500">
                              Cancelled
                            </span>
                          )}

                          <a
                            href={`/patient/appointments/${appt.id}/confirmation`}
                            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                          >
                            Details →
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Consultations & Review Prompts */}
              {completedAppts.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                    Completed Consultations ({completedAppts.length})
                  </h3>
                  <div className="grid grid-cols-1 gap-3.5">
                    {completedAppts.map((appt) => (
                      <div
                        key={appt.id}
                        className="rounded-3xl border border-emerald-100 bg-white p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-bold text-slate-900">
                              {appt.doctor?.name || 'Specialist'}
                            </h4>
                            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                              ✓ Completed Visit
                            </span>
                          </div>

                          {appt.slot && (
                            <p className="text-xs text-slate-600">
                              Consulted on {fmtDate(appt.slot.date)}
                              {appt.slot.clinic && ` at ${appt.slot.clinic.name}`}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          {appt.review ? (
                            <div className="flex items-center gap-2">
                              <span className="rounded-2xl bg-amber-50 border border-amber-200 px-3.5 py-1.5 text-xs font-bold text-amber-700">
                                ★ Rated {appt.review.rating}.0
                              </span>
                              <a
                                href={`/patient/appointments/${appt.id}/review`}
                                className="text-xs font-medium text-slate-500 hover:text-slate-900 transition underline"
                              >
                                View Review
                              </a>
                            </div>
                          ) : (
                            <a
                              id={`write-review-${appt.id}`}
                              href={`/patient/appointments/${appt.id}/review`}
                              className="rounded-2xl bg-[#2A2338] px-5 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-[#1E192C]"
                            >
                              ★ Write a Review →
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function PatientDashboardPage() {
  return (
    <RequireRole role="patient">
      <PatientDashboardContent />
    </RequireRole>
  );
}
