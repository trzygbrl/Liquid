'use client';

// /patient/appointments/[id]/confirmation
//
// Task 4.3 — Booking Confirmation Screen
//
// Shown immediately after a successful appointment booking (redirected from
// Task 4.2's booking handler on the doctor detail page). Fetches the
// appointment server-side to show doctor name, date/time (Asia/Manila), and
// clinic location from real joined tables, not from in-memory state — so the
// screen survives a browser refresh and remains linkable.
//
// Auth pattern: client-side, consistent with the rest of the app (no
// @supabase/ssr wiring). Verifies patient_id === current user's auth.uid()
// as a defense-in-depth check on top of the RLS "appointments_select_own"
// policy already enforced at the DB level.
//
// "View my appointments" links to /patient/dashboard — the AppointmentsDashboard
// component is currently only mounted on the doctor side. This is the correct
// destination for patients per the current route structure. Flagged in BUILD_LOG
// for Task 5 to add a dedicated patient appointments view.

import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import RequireRole from '@/components/RequireRole';
import { supabase } from '@/lib/supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConfirmationData {
  doctorName: string;
  clinicName: string | null;
  clinicLocation: string | null;
  slotDate: string;        // 'YYYY-MM-DD'
  slotStartTime: string;   // 'HH:MM:SS'
  slotEndTime: string;     // 'HH:MM:SS'
  status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** 'HH:MM:SS' → '9:00 AM' */
function fmt24to12(t: string): string {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr.padStart(2, '0');
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${suffix}`;
}

/**
 * 'YYYY-MM-DD' → e.g. 'Wednesday, August 20, 2026' in Asia/Manila local time.
 * We parse with T00:00:00 to avoid UTC-midnight drift.
 */
function fmtDateLong(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  });
}

// ─── Inner content (needs useParams — must be under Suspense) ─────────────────

function ConfirmationContent() {
  const params = useParams();
  const appointmentId = Array.isArray(params.id) ? params.id[0] : (params.id as string);

  const [data, setData] = useState<ConfirmationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!appointmentId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);

      // 1. Get the current authenticated user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        // RequireRole will handle the redirect; nothing to render here
        setLoading(false);
        return;
      }

      // 2. Fetch the appointment joined to schedule_slots, clinics, doctors
      //    FK path: appointments.slot_id → schedule_slots.id
      //             schedule_slots.clinic_id → clinics.id
      //             appointments.doctor_id → doctors.id
      //
      //    Confirmed column names from 0001_initial_schema.sql:
      //      appointments:    id, patient_id, doctor_id, slot_id, status
      //      schedule_slots:  id, doctor_id, clinic_id, date, start_time, end_time
      //      clinics:         id, doctor_id, name, room_details, location, consultation_fee
      //      doctors:         id, name, credentials, specialty, sub_specialty
      const { data: appt, error: apptError } = await supabase
        .from('appointments')
        .select(
          `
          id,
          patient_id,
          status,
          schedule_slots (
            date,
            start_time,
            end_time,
            clinics (
              name,
              location
            )
          ),
          doctors (
            name
          )
        `
        )
        .eq('id', appointmentId)
        .maybeSingle();

      if (apptError || !appt) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // 3. Defense-in-depth: confirm this appointment belongs to the current patient.
      //    RLS policy "appointments_select_own" already blocks cross-patient reads at
      //    the DB level — this is an additional app-layer check.
      if (appt.patient_id !== user.id) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // 4. Extract nested data (Supabase returns nested relations as objects/arrays)
      const slot = Array.isArray(appt.schedule_slots)
        ? appt.schedule_slots[0]
        : (appt.schedule_slots as any);
      const clinic = slot
        ? Array.isArray(slot.clinics)
          ? slot.clinics[0]
          : (slot.clinics as any)
        : null;
      const doctor = Array.isArray(appt.doctors)
        ? appt.doctors[0]
        : (appt.doctors as any);

      setData({
        doctorName: doctor?.name ?? 'Your Doctor',
        clinicName: clinic?.name ?? null,
        clinicLocation: clinic?.location ?? null,
        slotDate: slot?.date ?? '',
        slotStartTime: slot?.start_time ?? '',
        slotEndTime: slot?.end_time ?? '',
        status: appt.status,
      });

      setLoading(false);
    }

    load();
  }, [appointmentId]);

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-teal-400" />
          <span className="text-sm">Loading your booking confirmation…</span>
        </div>
      </main>
    );
  }

  // ─── Not found / unauthorized ─────────────────────────────────────────────────
  if (notFound || !data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12 text-center">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 text-slate-400">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="mt-4 text-lg font-bold text-white">Appointment Not Found</h1>
          <p className="mt-2 text-sm text-slate-400">
            This confirmation link may have expired, or the appointment doesn&apos;t belong to your account.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <a
              href="/patient/doctors"
              className="rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-teal-500"
            >
              Browse Doctors
            </a>
            <a
              href="/patient/dashboard"
              className="rounded-xl border border-slate-700 bg-slate-800/60 px-6 py-3 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      </main>
    );
  }

  // ─── Success ──────────────────────────────────────────────────────────────────
  const timeRange = data.slotStartTime && data.slotEndTime
    ? `${fmt24to12(data.slotStartTime)} – ${fmt24to12(data.slotEndTime)}`
    : null;
  const formattedDate = data.slotDate ? fmtDateLong(data.slotDate) : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12 sm:px-6">
      <div className="w-full max-w-lg">

        {/* Success Card */}
        <div className="rounded-2xl border border-teal-500/40 bg-slate-900/90 p-8 shadow-2xl backdrop-blur text-center">

          {/* Checkmark Icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-500/20 ring-4 ring-teal-500/10">
            <svg className="h-8 w-8 text-teal-400" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          {/* Status pill */}
          <span className="mt-4 inline-block rounded-md bg-teal-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal-300 border border-teal-500/20">
            Appointment Requested
          </span>

          {/* Headline */}
          <h1 className="mt-2 text-2xl font-bold text-white">
            You&apos;re all set.
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Your appointment request has been sent to{' '}
            <span className="font-semibold text-white">{data.doctorName}</span>.
            <br />
            You&apos;ll be notified once it&apos;s confirmed.
          </p>

          {/* Appointment Details */}
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-800/60 p-6 text-left space-y-3.5">

            {/* Doctor */}
            <div className="flex items-start justify-between gap-3">
              <span className="flex-shrink-0 text-sm text-slate-300">Doctor</span>
              <span className="text-sm font-bold text-white text-right">{data.doctorName}</span>
            </div>

            {/* Date */}
            {formattedDate && (
              <div className="flex items-start justify-between gap-3 border-t border-slate-700/60 pt-3.5">
                <span className="flex-shrink-0 text-sm text-slate-300">Date</span>
                <span className="text-sm font-semibold text-white text-right">{formattedDate}</span>
              </div>
            )}

            {/* Time */}
            {timeRange && (
              <div className="flex items-start justify-between gap-3 border-t border-slate-700/60 pt-3.5">
                <span className="flex-shrink-0 text-sm text-slate-300">Time</span>
                <span className="text-sm font-semibold text-white text-right">{timeRange}</span>
              </div>
            )}

            {/* Clinic */}
            {data.clinicName && (
              <div className="flex items-start justify-between gap-3 border-t border-slate-700/60 pt-3.5">
                <span className="flex-shrink-0 text-sm text-slate-300">Clinic</span>
                <span className="text-sm font-semibold text-white text-right">
                  {data.clinicName}
                  {data.clinicLocation && (
                    <span className="block font-normal text-xs text-slate-400 mt-0.5">{data.clinicLocation}</span>
                  )}
                </span>
              </div>
            )}

            {/* Status */}
            <div className="flex items-start justify-between gap-3 border-t border-slate-700/60 pt-3.5">
              <span className="flex-shrink-0 text-sm text-slate-300">Status</span>
              <span className="text-xs font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-3 py-1 rounded-full capitalize">
                {data.status}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-8 flex flex-col gap-3">
            <a
              id="view-appointments-link"
              href="/patient/dashboard"
              className="w-full rounded-xl bg-teal-600 px-6 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-teal-500 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            >
              View my appointments →
            </a>
            <a
              href="/patient/doctors"
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-6 py-3.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              Browse more doctors
            </a>
          </div>
        </div>

        {/* Footer note */}
        <p className="mt-5 text-center text-xs text-slate-500">
          Appointment ID:{' '}
          <span className="font-mono text-slate-400">{appointmentId}</span>
        </p>
      </div>
    </main>
  );
}

// ─── Page Export (RequireRole + Suspense boundary) ────────────────────────────

export default function AppointmentConfirmationPage() {
  return (
    <RequireRole role="patient">
      <Suspense
        fallback={
          <main className="flex min-h-screen items-center justify-center bg-slate-950">
            <div className="flex items-center gap-3 text-slate-400">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-teal-400" />
              <span className="text-sm">Loading confirmation…</span>
            </div>
          </main>
        }
      >
        <ConfirmationContent />
      </Suspense>
    </RequireRole>
  );
}
