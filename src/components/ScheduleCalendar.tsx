'use client';

// src/components/ScheduleCalendar.tsx
//
// Month grid over a doctor's posted slots, so the shape of a month is
// readable at a glance instead of having to scan a flat list of dates.
//
// Purely presentational: it renders whatever slots it is handed and reports
// day clicks upward. ScheduleManager owns the fetching, the realtime
// subscription, and what a selected day actually does.
//
// The grid only navigates forward from the current month, because the slots
// it is given start at today. Rendering an empty April when the doctor did
// have April slots would be worse than not offering the month at all.

import { useMemo, useState } from 'react';
import { IconChevronLeft, IconChevronRight } from '@/components/Icons';
import { isoDate } from '@/lib/dateUtils';

type SlotStatus = 'available' | 'booked' | 'doctor_on_leave';

export interface CalendarSlot {
  date: string; // 'YYYY-MM-DD'
  is_booked: SlotStatus;
}

interface DaySummary {
  available: number;
  booked: number;
  onLeave: number;
  total: number;
}

interface Props {
  slots: CalendarSlot[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  /** Local-calendar today, passed in so the grid and the list agree. */
  today: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function summarise(slots: CalendarSlot[]): Map<string, DaySummary> {
  const map = new Map<string, DaySummary>();
  for (const slot of slots) {
    const day = map.get(slot.date) ?? { available: 0, booked: 0, onLeave: 0, total: 0 };
    if (slot.is_booked === 'available') day.available += 1;
    else if (slot.is_booked === 'booked') day.booked += 1;
    else day.onLeave += 1;
    day.total += 1;
    map.set(slot.date, day);
  }
  return map;
}

/** Reads the count chip out loud for screen readers and on hover. */
function describe(day: DaySummary): string {
  const parts: string[] = [];
  if (day.available) parts.push(`${day.available} open`);
  if (day.booked) parts.push(`${day.booked} booked`);
  if (day.onLeave) parts.push(`${day.onLeave} on leave`);
  return parts.join(', ');
}

export default function ScheduleCalendar({ slots, selectedDate, onSelectDate, today }: Props) {
  const todayDate = new Date(`${today}T00:00:00`);
  const [cursor, setCursor] = useState(() => new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));

  const byDate = useMemo(() => summarise(slots), [slots]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  // Leading nulls pad the grid to the first weekday; trailing nulls square
  // off the last row so the borders line up.
  const cells = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: (string | null)[] = Array(new Date(year, month, 1).getDay()).fill(null);
    for (let d = 1; d <= daysInMonth; d += 1) out.push(isoDate(new Date(year, month, d)));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [year, month]);

  const atCurrentMonth =
    year === todayDate.getFullYear() && month === todayDate.getMonth();

  const monthTotal = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return slots.filter((s) => s.date.startsWith(prefix)).length;
  }, [slots, year, month]);

  function shiftMonth(delta: number) {
    setCursor(new Date(year, month + delta, 1));
  }

  return (
    <section className="card p-5">
      <div className="mb-4 border-b border-slate-100 pb-4">
        <h2 className="text-base font-bold text-slate-900">Schedule Calendar</h2>
        <p className="mt-1 text-xs text-slate-600">
          {monthTotal > 0
            ? `${monthTotal} slot${monthTotal === 1 ? '' : 's'} this month. Select a day to focus it.`
            : 'No slots posted this month yet.'}
        </p>

        {/* Month stepper gets its own row: side by side with the heading it
            would crush the label in a rail this narrow. */}
        <div className="mt-3.5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            disabled={atCurrentMonth}
            aria-label="Previous month"
            title={atCurrentMonth ? 'The calendar starts at the current month' : 'Previous month'}
            className="shrink-0 rounded-full border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-600"
          >
            <IconChevronLeft className="h-4 w-4" />
          </button>

          <span className="text-sm font-bold text-slate-900">
            {cursor.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}
          </span>

          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            title="Next month"
            className="shrink-0 rounded-full border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
          >
            <IconChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            // Two letters, not one: the rail is too narrow for "Wed", but
            // single initials repeat (S/S, T/T) and leave the column ambiguous.
            title={w}
            className="pb-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500"
          >
            {w.slice(0, 2)}
          </div>
        ))}

        {cells.map((iso, i) => {
          if (!iso) return <div key={`pad-${i}`} aria-hidden="true" />;

          const day = byDate.get(iso);
          const isToday = iso === today;
          const isSelected = iso === selectedDate;
          const isPast = iso < today;
          const dayNum = Number(iso.slice(8, 10));

          // Colour follows the most actionable state: a day with open hours
          // reads green, a fully-booked day amber, a blocked-out day grey.
          const chipTone = !day
            ? ''
            : day.available > 0
              ? 'bg-emerald-100 text-emerald-800'
              : day.booked > 0
                ? 'bg-amber-100 text-amber-800'
                : 'bg-slate-200 text-slate-600';

          return (
            <button
              key={iso}
              type="button"
              // Nothing exists before today (the slots query starts there) and
              // nothing can be posted there either, so a past day is shown for
              // orientation only rather than offered as a target.
              disabled={isPast}
              onClick={() => onSelectDate(isSelected ? null : iso)}
              aria-pressed={isSelected}
              aria-label={
                day
                  ? `${iso}, ${describe(day)}`
                  : `${iso}, no slots posted`
              }
              title={day ? describe(day) : undefined}
              className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg border p-0.5 transition ${
                isSelected
                  ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                  : isPast
                    ? 'cursor-default border-transparent bg-transparent'
                    : isToday
                      ? 'border-brand-300 bg-brand-50/70 hover:border-brand-400'
                      : 'border-slate-100 bg-slate-50/60 hover:border-brand-200 hover:bg-white'
              }`}
            >
              <span
                className={`text-xs font-bold leading-none ${
                  isSelected
                    ? 'text-white'
                    : isPast
                      ? 'text-slate-400'
                      : isToday
                        ? 'text-brand-700'
                        : 'text-slate-900'
                }`}
              >
                {dayNum}
              </span>

              {day ? (
                <span
                  className={`rounded-full px-1 text-[10px] font-bold leading-tight ${
                    isSelected ? 'bg-white/25 text-white' : chipTone
                  }`}
                >
                  {day.total}
                </span>
              ) : (
                // Reserves the chip's height so day numbers stay on one baseline.
                <span className="h-3.5" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-slate-100 pt-3.5">
        <Legend className="bg-emerald-100" label="Open" />
        <Legend className="bg-amber-100" label="Booked" />
        <Legend className="bg-slate-200" label="Blocked" />
        {selectedDate && (
          <button
            type="button"
            onClick={() => onSelectDate(null)}
            className="mt-1 w-full rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
          >
            Clear selection
          </button>
        )}
      </div>
    </section>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2 text-xs font-medium text-slate-600">
      <span className={`h-3 w-3 rounded-full ${className}`} aria-hidden="true" />
      {label}
    </span>
  );
}
