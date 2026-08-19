'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

// ─── Types ───────────────────────────────────────────────────────────────────

type AppointmentStatus = 'pending' | 'confirmed' | 'declined' | 'completed' | 'cancelled';

interface Patient {
  name: string;
  age: number | null;
  sex: string | null;
}

interface Clinic {
  name: string;
}

interface ScheduleSlot {
  date: string;        // 'YYYY-MM-DD'
  start_time: string;  // 'HH:MM:SS'
  end_time: string;
  clinics: Clinic | null;
}

interface Appointment {
  id: string;
  status: AppointmentStatus;
  symptom_summary: string | null;
  created_at: string;
  patients: Patient | null;
  schedule_slots: ScheduleSlot | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/** 'HH:MM:SS' → '9:00 AM' */
function fmt24to12(t: string): string {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr.padStart(2, '0');
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${suffix}`;
}

/** 'YYYY-MM-DD' → 'Tue, Aug 19' */
function fmtDate(iso: string): string {
  // Append T00:00:00 so Date parses in local time, not UTC midnight
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** Sex abbreviation for the patient chip */
function fmtSex(sex: string | null): string {
  if (!sex) return '—';
  return sex === 'male' ? 'M' : sex === 'female' ? 'F' : 'O';
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AppointmentsDashboard() {
  const [pendingAppts, setPendingAppts] = useState<Appointment[]>([]);
  const [confirmedAppts, setConfirmedAppts] = useState<Appointment[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Track which appointment ids currently have an in-flight accept/decline request
  const [actioning, setActioning] = useState<Set<string>>(new Set());

  // ── Fetch helper — called on init and on realtime events
  const fetchAppointments = useCallback(async (uid: string) => {
    const today = todayISO();

    const [pendingRes, confirmedRes] = await Promise.all([
      supabase
        .from('appointments')
        .select(`
          id, status, symptom_summary, created_at,
          patients ( name, age, sex ),
          schedule_slots ( date, start_time, end_time, clinics ( name ) )
        `)
        .eq('doctor_id', uid)
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),

      supabase
        .from('appointments')
        .select(`
          id, status, symptom_summary, created_at,
          patients ( name, age, sex ),
          schedule_slots ( date, start_time, end_time, clinics ( name ) )
        `)
        .eq('doctor_id', uid)
        .eq('status', 'confirmed'),
    ]);

    if (pendingRes.error) {
      setLoadError(`Could not load pending appointments: ${pendingRes.error.message}`);
      setLoading(false);
      return;
    }
    if (confirmedRes.error) {
      setLoadError(`Could not load confirmed appointments: ${confirmedRes.error.message}`);
      setLoading(false);
      return;
    }

    setPendingAppts((pendingRes.data ?? []) as unknown as Appointment[]);

    // Assumption 5: client-side filter for upcoming (date >= today) + sort ascending
    // by slot date then start_time. Supabase embedded-resource filters on the nested
    // schedule_slots object filter the nested object per row, not which parent rows
    // come back — so we can't reliably exclude past-dated appointments at query level.
    const upcoming = ((confirmedRes.data ?? []) as unknown as Appointment[])
      .filter((a) => {
        const slotDate = a.schedule_slots?.date;
        return slotDate !== undefined && slotDate >= today;
      })
      .sort((a, b) => {
        const da = a.schedule_slots?.date ?? '';
        const db = b.schedule_slots?.date ?? '';
        if (da !== db) return da.localeCompare(db);
        const ta = a.schedule_slots?.start_time ?? '';
        const tb = b.schedule_slots?.start_time ?? '';
        return ta.localeCompare(tb);
      });

    setConfirmedAppts(upcoming);
    setLoading(false);
  }, []);

  // ── Mount: get session, fetch data, subscribe to realtime
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    // Prevents duplicate subscriptions in React StrictMode
    // (same cancellation pattern as ScheduleManager)
    let cancelled = false;

    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session || cancelled) return;

      const uid = session.user.id;

      await fetchAppointments(uid);

      if (cancelled) return;

      // ── Realtime subscription (Assumption 8 — deliberate pull-forward of Task 4.4)
      // Filtered by doctor_id so we only receive events relevant to this doctor.
      // Channel name is scoped to the uid so it can't collide on StrictMode remounts.
      channel = supabase
        .channel(`appointments_${uid}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'appointments',
            filter: `doctor_id=eq.${uid}`,
          },
          (_payload) => {
            // Re-fetch on any appointment change. The raw postgres_changes payload
            // does not include nested join data (patients, schedule_slots, clinics),
            // so a full re-fetch is simpler and avoids stale joined state.
            // Appointment volume per doctor is small for a hackathon demo.
            fetchAppointments(uid);
          }
        )
        .subscribe();
    }

    init();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchAppointments]);

  // ── Accept / Decline handler
  async function handleAction(
    appointmentId: string,
    action: 'accept' | 'decline'
  ) {
    const newStatus: AppointmentStatus = action === 'accept' ? 'confirmed' : 'declined';

    // Disable both buttons on this row while request is in flight
    setActioning((prev) => new Set(prev).add(appointmentId));

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setActioning((prev) => {
        const next = new Set(prev);
        next.delete(appointmentId);
        return next;
      });
      return;
    }

    // Optimistic update — remove from the pending list immediately so the
    // doctor sees instant feedback rather than waiting for the re-fetch.
    setPendingAppts((prev) => prev.filter((a) => a.id !== appointmentId));

    // Assumption 3: only write appointments.status — do NOT touch schedule_slots.is_booked.
    // The trg_sync_slot_status trigger handles the slot flip automatically.
    //
    // Assumption 4: scope the update with .eq('status', 'pending') so that a
    // double-click or a second tab acting on the same appointment doesn't silently
    // double-apply. If count === 0, someone already actioned it — re-fetch reconciles.
    const { data: updatedRows, error } = await supabase
      .from('appointments')
      .update({ status: newStatus })
      .eq('id', appointmentId)
      .eq('status', 'pending')
      .select('id');

    // count === 0 means someone else already actioned this appointment (Assumption 4)
    const count = updatedRows?.length ?? 0;

    setActioning((prev) => {
      const next = new Set(prev);
      next.delete(appointmentId);
      return next;
    });

    if (error) {
      // Surface error in the console; re-fetch will restore true state
      console.error('AppointmentsDashboard: action error', error.message);
    }

    if (!error && count === 0) {
      // Assumption 4: zero rows updated → already actioned by another tab/device.
      // Treat gracefully — re-fetch below will reconcile the UI.
    }

    // Re-fetch to reconcile: reflects the trigger-driven slot status change and
    // the correct post-action appointment state from the DB.
    await fetchAppointments(session.user.id);
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-500" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mt-8 rounded-xl border border-red-500/30 bg-red-500/10 px-6 py-4 text-sm text-red-400">
        {loadError}
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-8">

      {/* ── Pending Appointments ──────────────────────────────────────────────
          Shown first so decisions needing a response are the first thing the
          doctor sees (per task brief and Assumption 1). Oldest created_at first
          (FIFO) per Assumption 10.
      ──────────────────────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-white">
          Pending appointments
          {pendingAppts.length > 0 && (
            <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
              {pendingAppts.length}
            </span>
          )}
        </h2>

        {pendingAppts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-10 text-center">
            <p className="text-sm text-slate-500">No pending appointments — you're all caught up.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pendingAppts.map((appt) => {
              const isActioning = actioning.has(appt.id);
              const slot = appt.schedule_slots;
              const patient = appt.patients;

              return (
                <div
                  key={appt.id}
                  className="rounded-xl border border-amber-500/20 bg-slate-900/60 px-5 py-4"
                >
                  {/* Top row: patient info + requested slot */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                    {/* Left: patient chip, symptom, requested slot */}
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white">
                          {patient?.name ?? '—'}
                        </p>
                        {/* Age / Sex — Assumption 6: name, age, sex shown; location/hmo_provider intentionally omitted */}
                        {(patient?.age || patient?.sex) && (
                          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-400">
                            {[patient.age ? `${patient.age} y/o` : null, fmtSex(patient.sex)]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                          Pending
                        </span>
                      </div>

                      {appt.symptom_summary && (
                        <p className="text-sm text-slate-300 leading-snug">
                          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 mr-1">
                            Symptoms:
                          </span>
                          {appt.symptom_summary}
                        </p>
                      )}

                      {/* Requested slot details */}
                      {slot ? (
                        <p className="text-xs text-slate-400">
                          <span className="text-slate-500">Requested slot: </span>
                          {fmtDate(slot.date)}&nbsp;·&nbsp;
                          {fmt24to12(slot.start_time)}–{fmt24to12(slot.end_time)}
                          {slot.clinics?.name && (
                            <>&nbsp;·&nbsp;<span className="text-slate-400">{slot.clinics.name}</span></>
                          )}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500">Slot details unavailable</p>
                      )}
                    </div>

                    {/* Right: Accept / Decline buttons — disabled while actioning */}
                    <div className="flex shrink-0 gap-2.5 sm:mt-0.5">
                      <button
                        id={`decline-appt-${appt.id}`}
                        onClick={() => handleAction(appt.id, 'decline')}
                        disabled={isActioning}
                        aria-label={`Decline appointment for ${patient?.name ?? 'patient'}`}
                        className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-slate-300 transition hover:border-red-500/60 hover:text-red-400 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isActioning ? '…' : 'Decline'}
                      </button>
                      <button
                        id={`accept-appt-${appt.id}`}
                        onClick={() => handleAction(appt.id, 'accept')}
                        disabled={isActioning}
                        aria-label={`Accept appointment for ${patient?.name ?? 'patient'}`}
                        className="rounded-xl bg-indigo-600 px-5 py-2.5 min-h-[44px] text-sm font-semibold text-white shadow-md transition hover:bg-indigo-500 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isActioning ? '…' : 'Accept'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Confirmed / Upcoming Appointments ────────────────────────────────
          Read-only reference list. Client-side filtered to slot.date >= today,
          sorted soonest first (Assumptions 5 and 10). No action buttons per
          Assumption 2 (completed/declined/cancelled out of scope for this task).
      ──────────────────────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-white">Upcoming confirmed appointments</h2>

        {confirmedAppts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-10 text-center">
            <p className="text-sm text-slate-500">No upcoming confirmed appointments.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {confirmedAppts.map((appt) => {
              const slot = appt.schedule_slots;
              const patient = appt.patients;

              return (
                <div
                  key={appt.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-slate-700/60 bg-slate-900/60 px-5 py-3.5"
                >
                  {/* Left: patient name + slot date/time/clinic */}
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">
                        {patient?.name ?? '—'}
                      </p>
                      {(patient?.age || patient?.sex) && (
                        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-400">
                          {[patient.age ? `${patient.age} y/o` : null, fmtSex(patient.sex)]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                    </div>
                    {slot ? (
                      <p className="truncate text-xs text-slate-400">
                        {fmtDate(slot.date)}&nbsp;·&nbsp;
                        {fmt24to12(slot.start_time)}–{fmt24to12(slot.end_time)}
                        {slot.clinics?.name && (
                          <>&nbsp;·&nbsp;{slot.clinics.name}</>
                        )}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500">Slot details unavailable</p>
                    )}
                  </div>

                  {/* Right: confirmed badge — no action buttons on this list */}
                  <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                    Confirmed
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
