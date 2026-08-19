'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';

// ─── Types ───────────────────────────────────────────────────────────────────

type SlotStatus = 'available' | 'booked' | 'doctor_on_leave';

interface Clinic {
  id: string;
  name: string;
  location: string;
}

interface Slot {
  id: string;
  clinic_id: string;
  date: string;       // 'YYYY-MM-DD'
  start_time: string; // 'HH:MM:SS' from Postgres
  end_time: string;
  is_booked: SlotStatus;
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

const STATUS_BADGE: Record<SlotStatus, { label: string; className: string }> = {
  available:       { label: 'Available',         className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  booked:          { label: 'Booked',            className: 'bg-amber-500/15  text-amber-400  border-amber-500/30'  },
  doctor_on_leave: { label: 'Doctor on leave',   className: 'bg-slate-500/15  text-slate-400  border-slate-500/30'  },
};

// Group slots by date string for display
function groupByDate(slots: Slot[]): Map<string, Slot[]> {
  const map = new Map<string, Slot[]>();
  for (const slot of slots) {
    const arr = map.get(slot.date) ?? [];
    arr.push(slot);
    map.set(slot.date, arr);
  }
  return map;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ScheduleManager() {
  // ── data state
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ── form state
  const [selectedClinicId, setSelectedClinicId] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── delete state (track which slot id is mid-delete)
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── load clinics + slots, then subscribe to realtime
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    // Prevents the async init from subscribing if cleanup already ran.
    // Necessary because React StrictMode unmounts before the first async
    // init finishes, so the cleanup's removeChannel is a no-op (channel
    // is still null). Without this flag the second init would try to add
    // .on() listeners to a channel name that's already subscribed.
    let cancelled = false;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) return;

      const uid = session.user.id;
      const today = todayISO();

      // Fetch clinics and slots in parallel
      const [clinicsRes, slotsRes] = await Promise.all([
        supabase
          .from('clinics')
          .select('id, name, location')
          .eq('doctor_id', uid)
          .order('name'),
        supabase
          .from('schedule_slots')
          .select('id, clinic_id, date, start_time, end_time, is_booked')
          .eq('doctor_id', uid)
          .gte('date', today)
          .order('date')
          .order('start_time'),
      ]);

      if (clinicsRes.error) {
        setLoadError(`Could not load your clinics: ${clinicsRes.error.message}`);
        setLoading(false);
        return;
      }
      if (slotsRes.error) {
        setLoadError(`Could not load your slots: ${slotsRes.error.message}`);
        setLoading(false);
        return;
      }

      const loadedClinics = clinicsRes.data ?? [];
      setClinics(loadedClinics);
      setSlots(slotsRes.data ?? []);

      // Default clinic selection when there's only one
      if (loadedClinics.length === 1) {
        setSelectedClinicId(loadedClinics[0].id);
      }

      setLoading(false);

      // Guard: if the effect was cleaned up while we were awaiting, don't subscribe.
      if (cancelled) return;

      // ── Realtime subscription
      // Channel name is scoped to the uid so it can't collide if StrictMode
      // causes a rapid unmount/remount before the previous channel is removed.
      channel = supabase
        .channel(`schedule_slots_${uid}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'schedule_slots',
            filter: `doctor_id=eq.${uid}`,
          },
          (payload) => {
            if (payload.eventType === 'UPDATE') {
              const updated = payload.new as Slot;
              setSlots((prev) =>
                prev.map((s) => (s.id === updated.id ? { ...s, is_booked: updated.is_booked } : s))
              );
            } else if (payload.eventType === 'DELETE') {
              const deleted = payload.old as { id: string };
              setSlots((prev) => prev.filter((s) => s.id !== deleted.id));
            } else if (payload.eventType === 'INSERT') {
              // Another device/tab added a slot — add it to the list if it's upcoming
              const inserted = payload.new as Slot;
              if (inserted.date >= today) {
                setSlots((prev) =>
                  [...prev, inserted].sort((a, b) =>
                    a.date !== b.date
                      ? a.date.localeCompare(b.date)
                      : a.start_time.localeCompare(b.start_time)
                  )
                );
              }
            }
          }
        )
        .subscribe();
    }

    init();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // ── Add slot
  async function handleAddSlot(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!selectedClinicId) {
      setFormError('Please select a clinic.');
      return;
    }
    if (!date || !startTime || !endTime) {
      setFormError('Please fill in date, start time, and end time.');
      return;
    }
    if (endTime <= startTime) {
      setFormError('End time must be after start time.');
      return;
    }

    setSubmitting(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setFormError('Your session expired — please log in again.');
      setSubmitting(false);
      return;
    }

    const { data: newSlot, error } = await supabase
      .from('schedule_slots')
      .insert({
        doctor_id: session.user.id,
        clinic_id: selectedClinicId, // required — DB trigger rejects mismatched doctor/clinic
        date,
        start_time: startTime,
        end_time: endTime,
        // is_booked defaults to 'available'
      })
      .select('id, clinic_id, date, start_time, end_time, is_booked')
      .single();

    setSubmitting(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    if (newSlot) {
      // Optimistic append — keep list sorted by date then start_time
      setSlots((prev) =>
        [...prev, newSlot as Slot].sort((a, b) =>
          a.date !== b.date
            ? a.date.localeCompare(b.date)
            : a.start_time.localeCompare(b.start_time)
        )
      );
    }

    // Clear form (keep clinic and date selections for fast batch entry)
    setStartTime('');
    setEndTime('');
  }

  // ── Delete slot
  async function handleDelete(slotId: string) {
    setDeletingId(slotId);
    const { error } = await supabase
      .from('schedule_slots')
      .delete()
      .eq('id', slotId);
    setDeletingId(null);

    if (error) {
      // Surface the error in-line without throwing
      setFormError(`Could not delete slot: ${error.message}`);
      return;
    }
    setSlots((prev) => prev.filter((s) => s.id !== slotId));
  }

  // ── Render helpers
  const clinicNameById = (id: string) =>
    clinics.find((c) => c.id === id)?.name ?? '—';

  const grouped = groupByDate(slots);

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

      {/* ── Add slot form ─────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-6">
        <h2 className="mb-5 text-base font-semibold text-white">Add a slot</h2>

        <form onSubmit={handleAddSlot} className="flex flex-col gap-4">

          {/* Clinic */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="slot-clinic" className="text-sm font-medium text-slate-300">
              Clinic <span className="text-red-400">*</span>
            </label>
            <select
              id="slot-clinic"
              value={selectedClinicId}
              onChange={(e) => setSelectedClinicId(e.target.value)}
              required
              className="rounded-lg border border-slate-600 bg-slate-800/60 px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition disabled:opacity-50"
            >
              <option value="">Select clinic</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.location}
                </option>
              ))}
            </select>
            {clinics.length === 0 && (
              <p className="text-xs text-amber-400">
                No clinics found. Complete profile setup to add a clinic.
              </p>
            )}
          </div>

          {/* Date + times row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="slot-date" className="text-sm font-medium text-slate-300">
                Date <span className="text-red-400">*</span>
              </label>
              <input
                id="slot-date"
                type="date"
                min={todayISO()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="rounded-lg border border-slate-600 bg-slate-800/60 px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition [color-scheme:dark]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="slot-start" className="text-sm font-medium text-slate-300">
                Start time <span className="text-red-400">*</span>
              </label>
              <input
                id="slot-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="rounded-lg border border-slate-600 bg-slate-800/60 px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition [color-scheme:dark]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="slot-end" className="text-sm font-medium text-slate-300">
                End time <span className="text-red-400">*</span>
              </label>
              <input
                id="slot-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="rounded-lg border border-slate-600 bg-slate-800/60 px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition [color-scheme:dark]"
              />
            </div>
          </div>

          {formError && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
              {formError}
            </p>
          )}

          <div className="flex justify-end">
            <button
              id="add-slot-submit"
              type="submit"
              disabled={submitting || clinics.length === 0}
              className="rounded-xl bg-indigo-600 px-6 py-3 min-h-[44px] text-sm font-semibold text-white transition hover:bg-indigo-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              {submitting ? 'Adding…' : '+ Add slot'}
            </button>
          </div>
        </form>
      </section>

      {/* ── Upcoming slots list ───────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-white">Upcoming slots</h2>

        {slots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-10 text-center">
            <p className="text-sm text-slate-500">No upcoming slots — add one above.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {Array.from(grouped.entries()).map(([dateStr, daySlots]) => (
              <div key={dateStr}>
                {/* Date header */}
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  {fmtDate(dateStr)}
                </p>

                <div className="flex flex-col gap-2">
                  {daySlots.map((slot) => {
                    const badge = STATUS_BADGE[slot.is_booked];
                    const isAvailable = slot.is_booked === 'available';
                    const isDeleting = deletingId === slot.id;

                    return (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between gap-4 rounded-xl border border-slate-700/60 bg-slate-900/60 px-5 py-3.5"
                      >
                        {/* Left: time + clinic */}
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <p className="text-sm font-medium text-white">
                            {fmt24to12(slot.start_time)} – {fmt24to12(slot.end_time)}
                          </p>
                          <p className="truncate text-xs text-slate-300">
                            {clinicNameById(slot.clinic_id)}
                          </p>
                          {!isAvailable && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {slot.is_booked === 'booked'
                                ? 'A patient has booked this slot'
                                : 'Marked unavailable'}
                            </p>
                          )}
                        </div>

                        {/* Right: badge + delete */}
                        <div className="flex shrink-0 items-center gap-3">
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                          >
                            {badge.label}
                          </span>

                          {isAvailable && (
                            <button
                              id={`delete-slot-${slot.id}`}
                              onClick={() => handleDelete(slot.id)}
                              disabled={isDeleting}
                              aria-label="Delete slot"
                              className="rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-slate-300 transition hover:border-red-500/60 hover:text-red-400 disabled:opacity-50"
                            >
                              {isDeleting ? '…' : 'Delete'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
