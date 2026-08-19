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

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import RequireRole from '@/components/RequireRole';
import { supabase } from '@/lib/supabaseClient';
import { daysSince } from '@/lib/dateUtils';

// Declined/cancelled appointments older than this drop off the dashboard
// entirely (the row itself stays in the DB for audit history — there's no
// background job in this app to actually purge it).
const DROPPED_APPT_RETENTION_DAYS = 14;

interface AppointmentItem {
  id: string;
  status: 'pending' | 'confirmed' | 'declined' | 'completed' | 'cancelled';
  created_at: string;
  symptom_summary: string | null;
  status_reason: string | null;
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
  const [patientName, setPatientName] = useState<string>('');
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [loadingAppts, setLoadingAppts] = useState<boolean>(true);

  // Which appointment's inline "reason for cancelling" panel is open, and
  // its in-progress text (cancelling requires a reason -- see migration
  // 0007_appointment_status_reason.sql).
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const loadPatientData = useCallback(async () => {
    setLoadingAppts(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoadingAppts(false);
      return;
    }

    // Fetch patient name
    const { data: patientProfile } = await supabase
      .from('patients')
      .select('name')
      .eq('id', user.id)
      .maybeSingle();

    if (patientProfile?.name) {
      setPatientName(patientProfile.name.split(' ')[0]);
    }

    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id,
        status,
        created_at,
        symptom_summary,
        status_reason,
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
          status_reason: item.status_reason,
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
  }, []);

  useEffect(() => {
    loadPatientData();
  }, [loadPatientData]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/patient/auth');
  }

  async function handleCancelConfirm(appointmentId: string) {
    if (cancelReason.trim().length < 3) {
      setCancelError('Please provide a brief reason for cancelling.');
      return;
    }
    setCancelSubmitting(true);
    setCancelError(null);

    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled', status_reason: cancelReason.trim() })
      .eq('id', appointmentId);

    setCancelSubmitting(false);

    if (error) {
      setCancelError('Unable to cancel this appointment. Please try again.');
      return;
    }

    setCancellingId(null);
    setCancelReason('');
    await loadPatientData();
  }

  const completedAppts = appointments.filter((a) => a.status === 'completed');
  // Declined/cancelled appointments older than the retention window are
  // dropped from the dashboard entirely (see DROPPED_APPT_RETENTION_DAYS).
  const activeAppts = appointments.filter((a) => {
    if (a.status === 'completed') return false;
    if (a.status === 'declined' || a.status === 'cancelled') {
      return daysSince(a.created_at) <= DROPPED_APPT_RETENTION_DAYS;
    }
    return true;
  });

  return (
    <main className="flex min-h-screen flex-col px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white text-lg font-black shadow-lg shadow-violet-500/25 shrink-0 animate-pulse-gentle">
              ✦
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-700 bg-violet-50/90 px-3 py-0.5 rounded-full border border-violet-200/60 backdrop-blur-sm">
                  ✨ Patient Portal
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Good day{patientName ? `, ${patientName}` : ''}!
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3 self-end sm:self-center">
            <a
              href="/patient/doctors"
              className="fluid-hover rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur-md px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-white hover:text-slate-900 hover:border-slate-300"
            >
              Doctor Directory
            </a>
            <button
              id="patient-sign-out"
              onClick={handleSignOut}
              className="fluid-hover rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur-md px-4 py-2.5 text-xs font-semibold text-slate-500 shadow-sm hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Quick Action Navigation Cards */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Hero Intake flow card with internal breathing aura */}
          <a
            id="patient-start-intake"
            href="/patient/intake"
            className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-7 text-white shadow-xl shadow-purple-500/20 fluid-hover border border-white/10"
          >
            {/* Ambient breathing aura inside the hero card */}
            <div className="absolute -right-12 -bottom-12 h-48 w-48 rounded-full bg-white/20 blur-3xl pointer-events-none animate-pulse-gentle" />
            <div className="absolute -left-10 -top-10 h-36 w-36 rounded-full bg-indigo-400/20 blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col justify-between h-full min-h-[170px]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white backdrop-blur-md border border-white/20 shadow-inner">
                    ✨ AI Clinical Triage
                  </span>
                  <span className="text-white/80 group-hover:translate-x-1.5 transition-transform duration-300 text-lg">
                    →
                  </span>
                </div>
                <h2 className="mt-4 text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                  Check my symptoms
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-purple-100 max-w-sm font-medium">
                  Describe what you or your family member feels in English or Tagalog. We match you to the exact specialist.
                </p>
              </div>

              <div className="mt-5 flex items-center gap-2">
                <span className="rounded-2xl bg-white px-4.5 py-2.5 text-xs font-extrabold text-slate-950 shadow-md transition group-hover:bg-purple-50 group-hover:shadow-lg">
                  Start Symptom Check →
                </span>
              </div>
            </div>
          </a>

          {/* Directory card */}
          <a
            id="patient-browse-doctors"
            href="/patient/doctors"
            className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 backdrop-blur-xl p-7 shadow-[0_8px_30px_rgb(0,0,0,0.03)] fluid-hover hover:border-violet-300/80 hover:shadow-lg"
          >
            <div className="flex flex-col justify-between h-full min-h-[170px]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50/90 px-3 py-1 text-xs font-bold text-violet-700 border border-violet-200/60 shadow-xs">
                    🩺 200+ Verified Doctors
                  </span>
                  <span className="text-slate-400 group-hover:translate-x-1.5 group-hover:text-violet-600 transition-all duration-300 text-lg">
                    →
                  </span>
                </div>
                <h2 className="mt-4 text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
                  Browse all doctors
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500 max-w-sm font-medium">
                  Filter by 33 medical specialties, clinic location, and HMO accreditations to book open slots directly.
                </p>
              </div>

              <div className="mt-5 flex items-center gap-2">
                <span className="rounded-2xl bg-[#2A2338] px-4.5 py-2.5 text-xs font-extrabold text-white shadow-sm transition group-hover:bg-[#1E192C] group-hover:shadow-md">
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
                    {activeAppts.map((appt) => {
                      const canCancel = appt.status === 'pending' || appt.status === 'confirmed';
                      return (
                      <div
                        key={appt.id}
                        className="rounded-3xl border border-slate-200/70 bg-white/90 backdrop-blur-xl p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] fluid-hover hover:border-violet-300/70 hover:shadow-md"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

                            {(appt.status === 'declined' || appt.status === 'cancelled') && appt.status_reason && (
                              <p className="text-xs text-slate-600">
                                <span className="font-bold uppercase tracking-wide text-slate-500 mr-1 text-[11px]">
                                  Reason:
                                </span>
                                {appt.status_reason}
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

                            {canCancel && (
                              <button
                                id={`cancel-appt-${appt.id}`}
                                type="button"
                                onClick={() => {
                                  setCancellingId(appt.id);
                                  setCancelReason('');
                                  setCancelError(null);
                                }}
                                className="fluid-hover rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50/50"
                              >
                                Cancel
                              </button>
                            )}

                            <a
                              href={`/patient/appointments/${appt.id}/confirmation`}
                              className="fluid-hover rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                            >
                              Details →
                            </a>
                          </div>
                        </div>

                        {/* Inline reason panel — cancelling requires a reason */}
                        {cancellingId === appt.id && (
                          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/40 p-4">
                            <label htmlFor={`cancel-reason-${appt.id}`} className="block text-xs font-bold text-slate-700 mb-1.5">
                              Reason for cancelling
                            </label>
                            <textarea
                              id={`cancel-reason-${appt.id}`}
                              rows={2}
                              value={cancelReason}
                              onChange={(e) => setCancelReason(e.target.value)}
                              placeholder="e.g. Schedule conflict — I need to rebook for a later date."
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20 resize-none"
                            />
                            {cancelError && (
                              <p className="mt-1.5 text-xs font-medium text-rose-700">{cancelError}</p>
                            )}
                            <div className="mt-3 flex items-center gap-2.5">
                              <button
                                id={`cancel-confirm-${appt.id}`}
                                type="button"
                                onClick={() => handleCancelConfirm(appt.id)}
                                disabled={cancelSubmitting}
                                className="rounded-2xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-50"
                              >
                                {cancelSubmitting ? '…' : 'Confirm Cancellation'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setCancellingId(null)}
                                disabled={cancelSubmitting}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                              >
                                Nevermind
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      );
                    })}
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
                        className="rounded-3xl border border-emerald-200/60 bg-white/90 backdrop-blur-xl p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] fluid-hover hover:border-emerald-300 hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4"
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
                              className="fluid-hover rounded-2xl bg-[#2A2338] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#1E192C]"
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
