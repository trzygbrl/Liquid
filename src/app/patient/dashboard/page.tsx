'use client';

// src/app/patient/dashboard/page.tsx
//
// Patient Dashboard. Navigation Hub & Appointments Overview
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
import { IconCalendar, IconCheck, IconStar, IconStethoscope, IconUsers } from '@/components/Icons';
import DoctorAvatar from '@/components/DoctorAvatar';
import {
  hasStatusReason,
  isMissingStatusReason,
  noteMissingStatusReason,
} from '@/lib/statusReasonCompat';

// Declined/cancelled appointments older than this drop off the dashboard
// entirely (the row itself stays in the DB for audit history; there's no
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
  const [apptTab, setApptTab] = useState<'upcoming' | 'declined' | 'completed'>('upcoming');
  const [loadError, setLoadError] = useState<string | null>(null);

  // Which appointment's inline "reason for cancelling" panel is open, and
  // its in-progress text (cancelling requires a reason -- see migration
  // 0007_appointment_status_reason.sql).
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  // Which declined/cancelled appointment is showing its "are you sure"
  // delete confirmation.
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

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

    // `status_reason` only exists once migration 0007 has been applied.
    // Naming a missing column fails the whole select, so on a pre-0007
    // database retry without it rather than lose the appointment list.
    const runApptQuery = (withReason: boolean) =>
      supabase
        .from('appointments')
        .select(`
          id,
          status,
          created_at,
          symptom_summary,
          ${withReason ? 'status_reason,' : ''}
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

    let { data, error } = await runApptQuery(hasStatusReason());

    if (isMissingStatusReason(error)) {
      noteMissingStatusReason('patient dashboard');
      ({ data, error } = await runApptQuery(false));
    }

    // Surface load failures instead of silently rendering an empty list. A
    // swallowed error here is indistinguishable from "you have no
    // appointments", which hid a broken query for a long time.
    if (error) {
      console.error('[patient dashboard] appointments query failed:', error.message);
      setLoadError(error.message);
      setAppointments([]);
    } else if (data) {
      setLoadError(null);
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
          status_reason: item.status_reason ?? null,
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

  async function handleCancelConfirm(appointmentId: string) {
    if (cancelReason.trim().length < 3) {
      setCancelError('Please provide a brief reason for cancelling.');
      return;
    }
    setCancelSubmitting(true);
    setCancelError(null);

    const runCancel = (withReason: boolean) =>
      supabase
        .from('appointments')
        .update(
          withReason
            ? { status: 'cancelled', status_reason: cancelReason.trim() }
            : { status: 'cancelled' },
        )
        .eq('id', appointmentId);

    let { error } = await runCancel(hasStatusReason());

    // Pre-0007 database: still let the patient cancel. The reason they typed
    // has nowhere to be stored, which the console warning explains.
    if (isMissingStatusReason(error)) {
      noteMissingStatusReason('patient dashboard');
      ({ error } = await runCancel(false));
    }

    setCancelSubmitting(false);

    if (error) {
      setCancelError('Unable to cancel this appointment. Please try again.');
      return;
    }

    setCancellingId(null);
    setCancelReason('');
    await loadPatientData();
  }

  async function handleDeleteConfirm(appointmentId: string) {
    setDeleteSubmitting(true);
    const { error } = await supabase.from('appointments').delete().eq('id', appointmentId);
    setDeleteSubmitting(false);

    if (error) {
      console.error('[patient dashboard] delete appointment failed:', error.message);
      return;
    }

    setDeletingId(null);
    setAppointments((prev) => prev.filter((a) => a.id !== appointmentId));
  }

  // A confirmed slot whose end time has already passed but that the doctor
  // hasn't marked 'completed' yet is neither upcoming nor a verified
  // completed visit -- it's hidden from the patient until the doctor side
  // (AppointmentsDashboard) actually flips the status.
  const isPastSlot = (a: AppointmentItem) => {
    if (!a.slot) return false;
    return new Date(`${a.slot.date}T${a.slot.end_time}`).getTime() < Date.now();
  };

  const slotStart = (a: AppointmentItem) =>
    a.slot ? new Date(`${a.slot.date}T${a.slot.start_time}`).getTime() : null;

  // Only a real 'completed' status counts -- set by the doctor, never
  // inferred client-side (see isPastSlot above).
  const completedAppts = appointments
    .filter((a) => a.status === 'completed')
    // Most recently consulted first.
    .sort((a, b) => (slotStart(b) ?? 0) - (slotStart(a) ?? 0));

  const upcomingAppts = appointments
    .filter((a) => (a.status === 'pending' || a.status === 'confirmed') && !isPastSlot(a))
    // Soonest upcoming date first; appointments with no slot yet trail behind.
    .sort((a, b) => (slotStart(a) ?? Infinity) - (slotStart(b) ?? Infinity));

  // Declined/cancelled appointments older than the retention window are
  // dropped from the dashboard entirely (see DROPPED_APPT_RETENTION_DAYS).
  const declinedAppts = appointments
    .filter((a) => (a.status === 'declined' || a.status === 'cancelled') && daysSince(a.created_at) <= DROPPED_APPT_RETENTION_DAYS)
    // Most recently declined/cancelled first.
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const awaitingReview = completedAppts.filter((a) => !a.review).length;
  const shownAppts =
    apptTab === 'upcoming' ? upcomingAppts : apptTab === 'declined' ? declinedAppts : completedAppts;

  return (
    <main className="flex min-h-screen flex-col px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        {/* Greeting. The primary action lives in the navbar, so it is not
            repeated here. */}
        <div className="border-b border-slate-200/80 pb-6 mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Good day{patientName ? `, ${patientName}` : ''}
          </h1>
          <p className="mt-1.5 text-xs text-slate-600">
            Track your consultations and find the specialist you need.
          </p>
        </div>

        {/* Appointments lead, with a supporting rail beside them. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <div className="card overflow-hidden">
              <div className="space-y-3 border-b border-slate-200 px-5 py-4 sm:px-6">
                <h2 className="min-w-0 truncate text-sm font-bold text-slate-900 md:text-lg">My consultations</h2>
                <div className="flex w-fit gap-1 rounded-full bg-slate-100 p-1">
                  {(
                    [
                      ['upcoming', 'Upcoming', upcomingAppts.length],
                      ['declined', 'Declined', declinedAppts.length],
                      ['completed', 'Completed', completedAppts.length],
                    ] as const
                  ).map(([id, label, count]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setApptTab(id)}
                      aria-current={apptTab === id ? 'true' : undefined}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                        apptTab === id
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {label}
                      <span className="ml-1.5 text-xs md:text-xs text-slate-500">{count}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-5 sm:p-6">
          {loadingAppts ? (
            <div className="flex items-center justify-center py-12 text-slate-500 text-xs gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
              <span>Loading consultations…</span>
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-center">
              <p className="text-sm font-semibold text-rose-800">
                We couldn&apos;t load your consultations.
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm text-rose-700">
                Please try again shortly. If it keeps happening, let the clinic know.
              </p>
              <button
                type="button"
                onClick={() => loadPatientData()}
                className="fluid-hover mt-4 rounded-full bg-rose-600 px-5 py-2 text-sm font-bold text-white hover:bg-rose-700"
              >
                Retry
              </button>
            </div>
          ) : shownAppts.length === 0 ? (
            <div className="py-10 text-center">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-3">
                <IconCalendar className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                {apptTab === 'upcoming'
                  ? 'No upcoming appointments.'
                  : apptTab === 'declined'
                  ? 'No declined or cancelled appointments.'
                  : 'No completed consultations yet.'}
              </p>
              <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
                {apptTab === 'upcoming'
                  ? 'Check your symptoms and book a doctor, and your scheduled visits will appear here.'
                  : apptTab === 'declined'
                  ? 'Declined or cancelled appointments show up here for 14 days.'
                  : 'Once a visit is marked complete by the clinic, it shows up here for review.'}
              </p>
              {apptTab === 'upcoming' && (
                <a
                  href="/patient/intake"
                  className="fluid-hover mt-5 inline-block rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700"
                >
                  Check symptoms
                </a>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Upcoming & declined/cancelled share the same card layout --
                  it already renders the right badge and reason for each
                  status. */}
              {(apptTab === 'upcoming' || apptTab === 'declined') && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3.5">
                    {shownAppts.map((appt) => {
                      const canCancel = appt.status === 'pending' || appt.status === 'confirmed';
                      return (
                      <div
                        key={appt.id}
                        className="card p-5 sm:p-6 fluid-hover hover:border-brand-300/70 hover:shadow-md"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3.5">
                              {appt.doctor && (
                                <DoctorAvatar name={appt.doctor.name} id={appt.doctor.id} size={48} className="shrink-0" />
                              )}
                              <div className="min-w-0">
                                <h4 className="truncate text-sm font-bold text-slate-900">
                                  {appt.doctor?.name || 'Specialist'}
                                </h4>
                                <p className="text-xs font-semibold text-brand-700">
                                  {appt.doctor?.specialty}
                                  {appt.doctor?.sub_specialty ? ` (${appt.doctor.sub_specialty})` : ''}
                                </p>
                              </div>
                            </div>

                            {/* Date/time and location sit below as their own
                                full-width block instead of being indented under
                                the avatar. */}
                            <div className="mt-3 space-y-1">
                              {appt.slot && (
                                <p className="text-xs text-slate-700 font-medium">
                                  {fmtDate(appt.slot.date)} at <span className="font-bold text-slate-900">{fmtTime(appt.slot.start_time)}</span>
                                </p>
                              )}

                              {appt.slot?.clinic && (
                                <p className="text-xs text-slate-600">{appt.slot.clinic.name}</p>
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
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-center">
                            {appt.status === 'pending' && (
                              <span className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-bold text-amber-700">
                                Pending
                              </span>
                            )}
                            {appt.status === 'confirmed' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
                                <IconCheck className="h-3 w-3" /> Confirmed
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
                                className="fluid-hover rounded-2xl border border-slate-200 bg-white px-4 py-1 text-xs font-semibold text-slate-600 hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50/50"
                              >
                                Cancel
                              </button>
                            )}

                            {apptTab === 'declined' ? (
                              deletingId === appt.id ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteConfirm(appt.id)}
                                    disabled={deleteSubmitting}
                                    className="rounded-2xl bg-rose-600 px-4 py-1 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-50"
                                  >
                                    {deleteSubmitting ? '…' : 'Confirm'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingId(null)}
                                    disabled={deleteSubmitting}
                                    className="rounded-2xl border border-slate-200 bg-white px-4 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                                  >
                                    Nevermind
                                  </button>
                                </div>
                              ) : (
                                <button
                                  id={`delete-appt-${appt.id}`}
                                  type="button"
                                  onClick={() => setDeletingId(appt.id)}
                                  className="fluid-hover rounded-2xl border border-slate-200 bg-white px-4 py-1 text-xs font-semibold text-slate-600 hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50/50"
                                >
                                  Delete
                                </button>
                              )
                            ) : (
                              <a
                                href={`/patient/appointments/${appt.id}/confirmation`}
                                className="fluid-hover rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                              >
                                Details
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Inline reason panel: cancelling requires a reason */}
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
                              placeholder="e.g. Schedule conflict. I need to rebook for a later date."
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
                                {cancelSubmitting ? '…' : 'Confirm'}
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
              {apptTab === 'completed' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3.5">
                    {completedAppts.map((appt) => (
                      <div
                        key={appt.id}
                        className="card p-5 sm:p-6 fluid-hover hover:border-emerald-300/70 hover:shadow-md"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3.5">
                              {appt.doctor && (
                                <DoctorAvatar name={appt.doctor.name} id={appt.doctor.id} size={48} className="shrink-0" />
                              )}
                              <div className="min-w-0">
                                <h4 className="truncate text-sm font-bold text-slate-900">
                                  {appt.doctor?.name || 'Specialist'}
                                </h4>
                                <p className="text-xs font-semibold text-brand-700">
                                  {appt.doctor?.specialty}
                                  {appt.doctor?.sub_specialty ? ` (${appt.doctor.sub_specialty})` : ''}
                                </p>
                              </div>
                            </div>

                            {/* Date/time and location sit below as their own
                                full-width block instead of being indented under
                                the avatar. */}
                            <div className="mt-3 space-y-1">
                              {appt.slot && (
                                <p className="text-xs text-slate-700 font-medium">
                                  Consulted {fmtDate(appt.slot.date)} at <span className="font-bold text-slate-900">{fmtTime(appt.slot.start_time)}</span>
                                </p>
                              )}

                              {appt.slot?.clinic && (
                                <p className="text-xs text-slate-600">{appt.slot.clinic.name}</p>
                              )}

                              {appt.symptom_summary && (
                                <p className="text-xs text-slate-500 italic">
                                  &ldquo;{appt.symptom_summary}&rdquo;
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-center">
                            {appt.review ? (
                              <>
                                <span
                                  aria-disabled="true"
                                  className="inline-flex items-center gap-1 rounded-2xl bg-amber-50 border border-amber-200 px-3.5 py-1.5 text-xs font-bold text-amber-700"
                                >
                                  <IconStar className="h-3.5 w-3.5" /> Rated {appt.review.rating}.0
                                </span>
                                <a
                                  href={`/patient/appointments/${appt.id}/review`}
                                  className="fluid-hover rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                                >
                                  View Review
                                </a>
                              </>
                            ) : (
                              <a
                                id={`write-review-${appt.id}`}
                                href={`/patient/appointments/${appt.id}/review`}
                                className="fluid-hover rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                              >
                                Write a Review
                              </a>
                            )}
                          </div>
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
          </section>

          {/* Supporting rail. order-first (reset by lg:order-none) puts "At a
              glance" ahead of the consultations list once the grid collapses
              to a single column on mobile/tablet. */}
          <aside className="order-first space-y-5 lg:order-none">
            <div className="card p-5">
              <h2 className="text-sm font-bold text-slate-900 md:text-base">At a glance</h2>
              <dl className="mt-3 divide-y divide-slate-100">
                {[
                  { label: 'Upcoming', value: upcomingAppts.length, tone: 'text-brand-700' },
                  { label: 'Completed visits', value: completedAppts.length, tone: 'text-emerald-700' },
                  { label: 'Declined/cancelled', value: declinedAppts.length, tone: 'text-rose-700' },
                  { label: 'Awaiting your review', value: awaitingReview, tone: 'text-amber-700' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between py-2.5">
                    <dt className="text-xs text-slate-600 md:text-sm">{row.label}</dt>
                    <dd className={`text-xs font-bold md:text-sm ${row.tone}`}>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="hidden card p-5 lg:block">
              <h2 className="text-sm font-bold text-slate-900 md:text-base">Quick actions</h2>
              <div className="mt-3 space-y-2">
                <a
                  id="patient-start-intake"
                  href="/patient/intake"
                  className="fluid-hover flex items-start gap-3 rounded-xl border border-slate-200 p-3 hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <IconStethoscope className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-slate-900 md:text-sm">Check symptoms</span>
                    <span className="block text-xs leading-relaxed text-slate-600 md:text-sm">
                      Describe what you feel in English or Tagalog.
                    </span>
                  </span>
                </a>

                <a
                  id="patient-browse-doctors"
                  href="/patient/doctors"
                  className="fluid-hover flex items-start gap-3 rounded-xl border border-slate-200 p-3 hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <IconUsers className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-slate-900 md:text-sm">Find a doctor</span>
                    <span className="block text-xs leading-relaxed text-slate-600 md:text-sm">
                      Browse 200+ specialists by field, clinic and HMO.
                    </span>
                  </span>
                </a>
              </div>
            </div>
          </aside>
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
