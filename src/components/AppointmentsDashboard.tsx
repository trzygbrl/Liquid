'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  hasStatusReason,
  isMissingStatusReason,
  noteMissingStatusReason,
} from '@/lib/statusReasonCompat';
import { SPECIALTY_PLAIN_MAP } from '@/lib/specialtyHelpers';

const ALL_SPECIALTIES = Object.keys(SPECIALTY_PLAIN_MAP).sort();

// Types
type AppointmentStatus = 'pending' | 'confirmed' | 'declined' | 'completed' | 'cancelled';

interface Patient {
  name: string;
  age: number | null;
  sex: string | null;
  location?: string | null;
  hmo_provider?: string | null;
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
  status_reason?: string | null;
  ai_recommended_specialty?: string | null;
  ai_recommended_sub_specialty?: string | null;
  doctor_recommended_specialty?: string | null;
  doctor_recommended_sub_specialty?: string | null;
  reassigned_by_doctor?: boolean;
  patients: Patient | null;
  schedule_slots: ScheduleSlot | null;
}

// Helpers
function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/** Formats 'HH:MM:SS' as '9:00 AM' */
function fmt24to12(t: string): string {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr.padStart(2, '0');
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${suffix}`;
}

/** Formats 'YYYY-MM-DD' as 'Tue, Aug 19' */
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
  if (!sex) return 'N/A';
  return sex === 'male' ? 'M' : sex === 'female' ? 'F' : 'O';
}

// Component
export default function AppointmentsDashboard() {
  const [pendingAppts, setPendingAppts] = useState<Appointment[]>([]);
  const [confirmedAppts, setConfirmedAppts] = useState<Appointment[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Track which appointment ids currently have an in-flight accept/decline request
  const [actioning, setActioning] = useState<Set<string>>(new Set());

  // Which appointment's inline decline/re-referral panel is open
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [isReReferral, setIsReReferral] = useState(false);
  const [recommendedSpecialty, setRecommendedSpecialty] = useState('');
  const [recommendedSubSpecialty, setRecommendedSubSpecialty] = useState('');
  const [declineError, setDeclineError] = useState<string | null>(null);

  // Fetch helper, called on init and on realtime events
  const fetchAppointments = useCallback(async (uid: string) => {
    const today = todayISO();

    const runFetch = (withReassign: boolean) => {
      const selectQuery = withReassign
        ? `
          id, status, symptom_summary, created_at, status_reason,
          ai_recommended_specialty, ai_recommended_sub_specialty,
          doctor_recommended_specialty, doctor_recommended_sub_specialty,
          reassigned_by_doctor,
          patients ( name, age, sex, location, hmo_provider ),
          schedule_slots ( date, start_time, end_time, clinics ( name ) )
        `
        : `
          id, status, symptom_summary, created_at,
          patients ( name, age, sex, location, hmo_provider ),
          schedule_slots ( date, start_time, end_time, clinics ( name ) )
        `;

      return Promise.all([
        supabase
          .from('appointments')
          .select(selectQuery)
          .eq('doctor_id', uid)
          .eq('status', 'pending')
          .order('created_at', { ascending: true }),

        supabase
          .from('appointments')
          .select(selectQuery)
          .eq('doctor_id', uid)
          .eq('status', 'confirmed'),
      ]);
    };

    let [pendingRes, confirmedRes] = await runFetch(true);

    if (pendingRes.error?.code === '42703' || confirmedRes.error?.code === '42703') {
      [pendingRes, confirmedRes] = await runFetch(false);
    }

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

  // Mount: get session, fetch data, subscribe to realtime
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session || cancelled) return;

      const uid = session.user.id;

      await fetchAppointments(uid);

      if (cancelled) return;

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

  // Accept / Decline handler with Doctor-in-the-Loop Re-referral support
  async function handleAction(
    appointmentId: string,
    action: 'accept' | 'decline',
    reason?: string,
    recSpecialty?: string,
    recSubSpecialty?: string
  ) {
    const newStatus: AppointmentStatus = action === 'accept' ? 'confirmed' : 'declined';

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

    setPendingAppts((prev) => prev.filter((a) => a.id !== appointmentId));

    const runAction = (withReason: boolean, withReassign: boolean) => {
      const payload: Record<string, unknown> = {
        status: newStatus,
      };
      if (action === 'decline' && withReason && reason) {
        payload.status_reason = reason;
      }
      if (action === 'decline' && withReassign) {
        if (recSpecialty) {
          payload.doctor_recommended_specialty = recSpecialty;
          payload.doctor_recommended_sub_specialty = recSubSpecialty || null;
          payload.reassigned_by_doctor = true;
        } else {
          payload.doctor_recommended_specialty = null;
          payload.doctor_recommended_sub_specialty = null;
          payload.reassigned_by_doctor = false;
        }
      }

      return supabase
        .from('appointments')
        .update(payload)
        .eq('id', appointmentId)
        .eq('status', 'pending')
        .select('id');
    };

    let { data: updatedRows, error } = await runAction(hasStatusReason(), true);

    if (
      error &&
      (error.code === '42703' || error.message?.includes('doctor_recommended_specialty'))
    ) {
      const fallbackRes = await runAction(hasStatusReason(), false);
      updatedRows = fallbackRes.data;
      error = fallbackRes.error;
    }

    if (isMissingStatusReason(error)) {
      noteMissingStatusReason('AppointmentsDashboard');
      ({ data: updatedRows, error } = await runAction(false, false));
    }

    const count = updatedRows?.length ?? 0;

    setActioning((prev) => {
      const next = new Set(prev);
      next.delete(appointmentId);
      return next;
    });

    if (error) {
      console.error('AppointmentsDashboard: action error', error.message);
    }

    await fetchAppointments(session.user.id);

    if (action === 'decline' && !error) {
      setDecliningId(null);
      setDeclineReason('');
      setIsReReferral(false);
      setRecommendedSpecialty('');
      setRecommendedSubSpecialty('');
      setDeclineError(null);
    }
  }

  function handleDeclineClick(appointmentId: string) {
    setDecliningId(appointmentId);
    setDeclineReason('');
    setIsReReferral(false);
    setRecommendedSpecialty('');
    setRecommendedSubSpecialty('');
    setDeclineError(null);
  }

  function handleDeclineConfirm(appointmentId: string) {
    if (declineReason.trim().length < 5) {
      setDeclineError(
        'Please provide an explanation (at least 5 characters) explaining why this appointment is being declined.'
      );
      return;
    }
    if (isReReferral && !recommendedSpecialty) {
      setDeclineError('Please select the recommended specialist for the patient.');
      return;
    }
    handleAction(
      appointmentId,
      'decline',
      declineReason.trim(),
      isReReferral ? recommendedSpecialty : undefined,
      isReReferral && recommendedSubSpecialty.trim() ? recommendedSubSpecialty.trim() : undefined
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-xs font-medium text-rose-700">
        {loadError}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">

      {/* Pending Appointments */}
      <section className="card p-6 sm:p-7">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-slate-900">
              Pending Consultation Requests
            </h2>
            {pendingAppts.length > 0 && (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800 border border-amber-200">
                {pendingAppts.length} new
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500 font-medium">Requires your review</span>
        </div>

        {pendingAppts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center">
            <p className="text-xs font-medium text-slate-500">No pending appointment requests. You're all caught up!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {pendingAppts.map((appt) => {
              const isActioning = actioning.has(appt.id);
              const slot = appt.schedule_slots;
              const patient = appt.patients;

              return (
                <div
                  key={appt.id}
                  className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-5 transition hover:bg-amber-50/60"
                >
                  {/* Top row: patient info + requested slot */}
                  <div className="flex flex-col gap-3.5 sm:flex-row sm:items-start sm:justify-between">

                    {/* Left: patient chip, AI recommendation, symptom, requested slot */}
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-slate-900">
                          {patient?.name ?? 'Patient'}
                        </p>
                        {(patient?.age || patient?.sex) && (
                          <span className="rounded-full bg-white border border-slate-200/80 px-2.5 py-0.5 text-xs text-slate-600 font-medium shadow-2xs">
                            {[patient.age ? `${patient.age} y/o` : null, fmtSex(patient.sex)]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                        {patient?.location && (
                          <span className="rounded-full bg-white border border-slate-200/80 px-2.5 py-0.5 text-xs text-slate-600 font-medium shadow-2xs">
                            📍 {patient.location}
                          </span>
                        )}
                        {patient?.hmo_provider && (
                          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                            🛡️ {patient.hmo_provider}
                          </span>
                        )}
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 border border-amber-200">
                          Pending Review
                        </span>
                      </div>

                      {/* AI Triage Recommendation Badge */}
                      {appt.ai_recommended_specialty && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                            AI Recommendation:
                          </span>
                          <span className="rounded-full bg-blue-100/70 border border-blue-200 px-2.5 py-0.5 text-xs font-bold text-blue-800">
                            {appt.ai_recommended_specialty}
                            {appt.ai_recommended_sub_specialty ? ` · ${appt.ai_recommended_sub_specialty}` : ''}
                          </span>
                        </div>
                      )}

                      {/* Patient-reported symptoms */}
                      {appt.symptom_summary && (
                        <div className="rounded-xl bg-white/80 border border-amber-200/70 p-2.5 text-xs text-slate-800">
                          <span className="font-bold uppercase tracking-wide text-slate-500 mr-1.5 text-[11px]">
                            Reported Symptoms:
                          </span>
                          <span className="font-medium leading-relaxed">{appt.symptom_summary}</span>
                        </div>
                      )}

                      {/* Requested slot details */}
                      {slot ? (
                        <p className="text-xs text-slate-500 font-medium">
                          <span>Requested slot: </span>
                          <strong className="text-slate-900 font-bold">{fmtDate(slot.date)}&nbsp;·&nbsp;{fmt24to12(slot.start_time)} to {fmt24to12(slot.end_time)}</strong>
                          {slot.clinics?.name && (
                            <>&nbsp;·&nbsp;<span className="text-slate-600">{slot.clinics.name}</span></>
                          )}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 italic">Slot details unavailable</p>
                      )}
                    </div>

                    {/* Right: Accept / Decline buttons */}
                    <div className="flex shrink-0 gap-2.5 sm:mt-0.5">
                      <button
                        id={`decline-appt-${appt.id}`}
                        onClick={() => handleDeclineClick(appt.id)}
                        disabled={isActioning}
                        aria-label={`Decline appointment for ${patient?.name ?? 'patient'}`}
                        className="card px-4 py-2.5 min-h-[44px] text-xs font-bold text-slate-700 transition hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50/50 active:scale-[0.98] disabled:opacity-50"
                      >
                        {isActioning ? '…' : 'Decline'}
                      </button>
                      <button
                        id={`accept-appt-${appt.id}`}
                        onClick={() => handleAction(appt.id, 'accept')}
                        disabled={isActioning}
                        aria-label={`Accept appointment for ${patient?.name ?? 'patient'}`}
                        className="rounded-2xl bg-brand-600 px-5 py-2.5 min-h-[44px] text-xs font-bold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50"
                      >
                        {isActioning ? '…' : 'Accept Appointment'}
                      </button>
                    </div>
                  </div>

                  {/* Decline Panel (Explanation always required, re-referral optional) */}
                  {decliningId === appt.id && (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-white p-4 sm:p-5 shadow-sm animate-fade-slide-up">
                      <div className="flex items-start justify-between gap-3 mb-3.5">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">
                            Decline Consultation Request
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                            Please provide an explanation for declining. This reason is required and will be shared with the patient.
                          </p>
                        </div>
                      </div>

                      {/* Required Explanation for Declining */}
                      <div className="mb-3.5">
                        <label
                          htmlFor={`decline-reason-${appt.id}`}
                          className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider"
                        >
                          Explanation / Reason for Declining <span className="text-rose-600">*</span>
                        </label>
                        <textarea
                          id={`decline-reason-${appt.id}`}
                          rows={3}
                          value={declineReason}
                          onChange={(e) => setDeclineReason(e.target.value)}
                          placeholder="e.g. Schedule conflict, fully booked for this clinic date, or patient's symptoms require care outside this specialty..."
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 outline-none transition focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-500/20 resize-none leading-relaxed"
                        />
                      </div>

                      {/* Re-referral Checkbox Option */}
                      <div className="mb-3.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            id={`re-refer-checkbox-${appt.id}`}
                            type="checkbox"
                            checked={isReReferral}
                            onChange={(e) => setIsReReferral(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">
                              Re-refer patient to another specialist (Doctor-in-the-Loop)
                            </span>
                            <span className="text-[11px] text-slate-500 block mt-0.5">
                              Check this if you are declining because the patient needs a different medical specialty. You will be required to choose the appropriate specialist.
                            </span>
                          </div>
                        </label>

                        {/* Conditional Re-referral Specialty Selection */}
                        {isReReferral && (
                          <div className="mt-3.5 pt-3.5 border-t border-slate-200/80 space-y-3 animate-fade-slide-up">
                            <div>
                              <label
                                htmlFor={`decline-specialty-${appt.id}`}
                                className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider"
                              >
                                Recommended Medical Specialist <span className="text-rose-600">*</span>
                              </label>
                              <select
                                id={`decline-specialty-${appt.id}`}
                                value={recommendedSpecialty}
                                onChange={(e) => setRecommendedSpecialty(e.target.value)}
                                className="w-full rounded-xl border border-amber-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                              >
                                <option value="">-- Select the proper specialist for this patient --</option>
                                {ALL_SPECIALTIES.map((spec) => (
                                  <option key={spec} value={spec}>
                                    {spec} — {SPECIALTY_PLAIN_MAP[spec]?.plainName || ''}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label
                                htmlFor={`decline-subspecialty-${appt.id}`}
                                className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider"
                              >
                                Sub-specialty / Clinical Focus (Optional)
                              </label>
                              <input
                                id={`decline-subspecialty-${appt.id}`}
                                type="text"
                                value={recommendedSubSpecialty}
                                onChange={(e) => setRecommendedSubSpecialty(e.target.value)}
                                placeholder="e.g. Spine Surgery, Sports Medicine, Pediatric Pulmonology"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {declineError && (
                        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">
                          {declineError}
                        </div>
                      )}

                      <div className="flex items-center gap-2.5 pt-1">
                        <button
                          id={`decline-confirm-${appt.id}`}
                          type="button"
                          onClick={() => handleDeclineConfirm(appt.id)}
                          disabled={isActioning}
                          className="rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50"
                        >
                          {isActioning
                            ? 'Declining…'
                            : isReReferral
                            ? 'Confirm Re-referral & Decline'
                            : 'Confirm Decline'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDecliningId(null)}
                          disabled={isActioning}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Confirmed / Upcoming Appointments */}
      <section className="card p-6 sm:p-7">
        <div className="border-b border-slate-100 pb-4 mb-5">
          <h2 className="text-lg font-bold text-slate-900">Upcoming Confirmed Consultations</h2>
          <p className="text-sm text-slate-600 mt-1">Scheduled patient appointments for your practice.</p>
        </div>

        {confirmedAppts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center">
            <p className="text-xs font-medium text-slate-500">No upcoming confirmed appointments.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {confirmedAppts.map((appt) => {
              const slot = appt.schedule_slots;
              const patient = appt.patients;

              return (
                <div
                  key={appt.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-5 py-3.5"
                >
                  {/* Left: patient name + slot date/time/clinic */}
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">
                        {patient?.name ?? 'N/A'}
                      </p>
                      {(patient?.age || patient?.sex) && (
                        <span className="rounded-full bg-white border border-slate-200 px-2 py-0.5 text-xs text-slate-600 font-medium">
                          {[patient.age ? `${patient.age} y/o` : null, fmtSex(patient.sex)]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                    </div>
                    {slot ? (
                      <p className="truncate text-xs text-slate-500 font-medium">
                        <strong className="text-slate-800 font-semibold">{fmtDate(slot.date)}&nbsp;·&nbsp;{fmt24to12(slot.start_time)} to {fmt24to12(slot.end_time)}</strong>
                        {slot.clinics?.name && (
                          <>&nbsp;·&nbsp;{slot.clinics.name}</>
                        )}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 italic">Slot details unavailable</p>
                    )}
                  </div>

                  {/* Right: confirmed badge */}
                  <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
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
