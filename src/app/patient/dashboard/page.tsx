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
    <main className="flex min-h-screen flex-col bg-slate-950 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <span className="text-lg font-bold text-white">
              <span className="text-teal-400">Civic</span>Access
            </span>
            <h1 className="mt-1 text-2xl font-semibold text-white">Patient Dashboard</h1>
          </div>
          <button
            id="patient-sign-out"
            onClick={handleSignOut}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Sign out
          </button>
        </div>

        {/* Quick Action Navigation Cards */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Intake flow card */}
          <a
            id="patient-start-intake"
            href="/patient/intake"
            className="group flex items-start gap-5 rounded-2xl border border-teal-500/20 bg-slate-900/60 p-6 transition hover:border-teal-500/40 hover:bg-slate-900/80"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 transition group-hover:bg-teal-500/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-teal-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
                />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-white">Check my symptoms</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Describe your symptoms in English or Tagalog and find the right specialist.
              </p>
              <p className="mt-3 text-xs font-medium text-teal-400 group-hover:text-teal-300 transition">
                Start symptom check →
              </p>
            </div>
          </a>

          {/* Directory card */}
          <a
            id="patient-browse-doctors"
            href="/patient/doctors"
            className="group flex items-start gap-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition hover:border-slate-700 hover:bg-slate-900/80"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-500/10 transition group-hover:bg-slate-500/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-slate-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-white">Browse all doctors</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Search 200+ verified specialists across 33 medical fields directly.
              </p>
              <p className="mt-3 text-xs font-medium text-slate-300 group-hover:text-white transition">
                View directory →
              </p>
            </div>
          </a>
        </div>

        {/* ─── Appointments & Consultations Section ───────────────────────────── */}
        <div className="mt-10">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-6">
            <div>
              <h2 className="text-lg font-bold text-white">My Consultations & Appointments</h2>
              <p className="text-xs text-slate-400">
                Track your requested bookings, upcoming consultations, and submit verified reviews.
              </p>
            </div>
            {appointments.length > 0 && (
              <span className="text-xs font-medium text-slate-400">
                {appointments.length} total
              </span>
            )}
          </div>

          {loadingAppts ? (
            <div className="flex items-center justify-center py-12 text-slate-400 text-xs gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-teal-400" />
              <span>Loading consultations…</span>
            </div>
          ) : appointments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center">
              <p className="text-sm font-medium text-slate-300">No appointments requested yet.</p>
              <p className="mt-1 text-xs text-slate-500">
                Once you check symptoms and book a doctor, your consultations will appear here.
              </p>
              <a
                href="/patient/intake"
                className="mt-4 inline-block rounded-xl bg-teal-600 px-5 py-2 text-xs font-semibold text-white transition hover:bg-teal-500"
              >
                Check Symptoms Now →
              </a>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Active & Pending Appointments */}
              {activeAppts.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Upcoming & Active ({activeAppts.length})
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    {activeAppts.map((appt) => (
                      <div
                        key={appt.id}
                        className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 transition hover:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white">
                              {appt.doctor?.name || 'Specialist'}
                            </h4>
                            <span className="text-xs text-slate-400">•</span>
                            <span className="text-xs text-slate-300">
                              {appt.doctor?.specialty}
                              {appt.doctor?.sub_specialty ? ` (${appt.doctor.sub_specialty})` : ''}
                            </span>
                          </div>

                          {appt.slot && (
                            <p className="text-xs text-teal-300 font-medium">
                              📅 {fmtDate(appt.slot.date)} at {fmtTime(appt.slot.start_time)}
                              {appt.slot.clinic && ` • 📍 ${appt.slot.clinic.name}`}
                            </p>
                          )}

                          {appt.symptom_summary && (
                            <p className="text-[11px] text-slate-400 italic">
                              &ldquo;{appt.symptom_summary}&rdquo;
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          {appt.status === 'pending' && (
                            <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-300">
                              Pending Confirmation
                            </span>
                          )}
                          {appt.status === 'confirmed' && (
                            <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-300">
                              ✓ Confirmed
                            </span>
                          )}
                          {appt.status === 'declined' && (
                            <span className="rounded-full bg-rose-500/15 border border-rose-500/30 px-3 py-1 text-xs font-semibold text-rose-300">
                              Declined
                            </span>
                          )}
                          {appt.status === 'cancelled' && (
                            <span className="rounded-full bg-slate-700/50 border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-400">
                              Cancelled
                            </span>
                          )}

                          <a
                            href={`/patient/appointments/${appt.id}/confirmation`}
                            className="rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-800 hover:text-white"
                          >
                            Details
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
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                    Completed Consultations ({completedAppts.length})
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    {completedAppts.map((appt) => (
                      <div
                        key={appt.id}
                        className="rounded-2xl border border-emerald-500/20 bg-slate-900/80 p-5 transition hover:border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white">
                              {appt.doctor?.name || 'Specialist'}
                            </h4>
                            <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                              ✓ Completed Visit
                            </span>
                          </div>

                          {appt.slot && (
                            <p className="text-xs text-slate-300">
                              Consulted on {fmtDate(appt.slot.date)}
                              {appt.slot.clinic && ` at ${appt.slot.clinic.name}`}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          {appt.review ? (
                            <div className="flex items-center gap-2">
                              <span className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-300">
                                ★ Rated {appt.review.rating}.0
                              </span>
                              <a
                                href={`/patient/appointments/${appt.id}/review`}
                                className="text-xs text-slate-400 hover:text-white transition underline"
                              >
                                View Review
                              </a>
                            </div>
                          ) : (
                            <a
                              id={`write-review-${appt.id}`}
                              href={`/patient/appointments/${appt.id}/review`}
                              className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-lg transition hover:from-amber-400 hover:to-amber-500"
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
