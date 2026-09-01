'use client';

// src/components/DoctorFilterPanel.tsx
//
// The search + filter + sort control bar above the patient doctor directory.
// Always-visible: free-text search, the filter toggle and the sort dropdown.
// Everything else lives in a collapsible panel so the results stay the focus
// on a phone, with the active choices mirrored as removable chips underneath.

import { useId, useState } from 'react';
import {
  activeFilterChips,
  formatFee,
  AVAILABILITY_OPTIONS,
  RATING_OPTIONS,
  SORT_OPTIONS,
  type DoctorFilters,
  type FilterOptions,
  type SortKey,
} from '@/lib/doctorFilters';
import { IconClose, IconSearch, IconSliders, IconStar } from './Icons';

interface DoctorFilterPanelProps {
  filters: DoctorFilters;
  onChange: (next: DoctorFilters) => void;
  onReset: () => void;
  options: FilterOptions;
  /** The specialty select only makes sense when browsing every specialty. */
  showSpecialty: boolean;
  resultCount: number;
  /** Whether vector search was successfully applied (enables semantic sort option) */
  vectorSearchApplied?: boolean;
}

const CONTROL_CLASS =
  'w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20';

/** Segmented button row used for the rating and availability filters. */
function SegmentedControl<T extends string | number>({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onSelect: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label}>
      <span className="field-label">{label}</span>
      <div className="mt-1.5 flex flex-wrap gap-1 rounded-2xl bg-slate-100 p-1">
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelect(option.value)}
              className={`flex-1 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                isActive
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DoctorFilterPanel({
  filters,
  onChange,
  onReset,
  options,
  showSpecialty,
  resultCount,
  vectorSearchApplied = false,
}: DoctorFilterPanelProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const chips = activeFilterChips(filters);

  // A fee slider needs a range to slide across; a single-priced (or
  // clinic-less) result set gets no fee control at all.
  const hasFeeRange = options.feeMax > options.feeMin;
  const feeValue = filters.maxFee ?? options.feeMax;

  const set = (patch: Partial<DoctorFilters>) => onChange({ ...filters, ...patch });

  const toggleHmo = (hmo: string) =>
    set({
      hmos: filters.hmos.includes(hmo)
        ? filters.hmos.filter((h) => h !== hmo)
        : [...filters.hmos, hmo],
    });

  const availableSortOptions = SORT_OPTIONS.filter(
    (option) => option.value !== 'semantic' || vectorSearchApplied
  );

  return (
    <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      {/* Search bar + filter toggle + sort row */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {/* Search input with leading icon */}
        <div className="relative flex-1">
          <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            placeholder="Search doctors by name, clinic, or HMO…"
            className={`${CONTROL_CLASS} pl-10`}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls={panelId}
            className={`flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition lg:flex-none ${
              open || chips.length > 0
                ? 'border-brand-500 bg-brand-50/60 text-brand-700'
                : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-white'
            }`}
          >
            <IconSliders className="h-4 w-4" />
            Filters
            {chips.length > 0 && (
              <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[0.6875rem] font-bold text-white">
                {chips.length}
              </span>
            )}
          </button>

          <label className="flex flex-1 items-center gap-2 text-xs font-bold text-slate-500 lg:flex-none">
            <span className="hidden sm:inline">Sort</span>
            <select
              value={filters.sort}
              onChange={(e) => set({ sort: e.target.value as SortKey })}
              aria-label="Sort doctors"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-3 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 lg:w-auto"
            >
              {availableSortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Collapsible filter panel */}
      {open && (
        <div
          id={panelId}
          className="mt-4 grid gap-4 border-t border-slate-200/70 pt-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {showSpecialty && options.specialties.length > 0 && (
            <label className="block">
              <span className="field-label">Specialty</span>
              <select
                value={filters.specialty}
                // Sub-specialty options are scoped to the specialty, so a
                // change here resets the stale sub-specialty choice.
                onChange={(e) => set({ specialty: e.target.value, subSpecialty: 'all' })}
                className={`${CONTROL_CLASS} mt-1.5`}
              >
                <option value="all">All specialties</option>
                {options.specialties.map((specialty) => (
                  <option key={specialty} value={specialty}>
                    {specialty}
                  </option>
                ))}
              </select>
            </label>
          )}

          {options.subSpecialties.length > 0 && (
            <label className="block">
              <span className="field-label">Sub-specialty</span>
              <select
                value={filters.subSpecialty}
                onChange={(e) => set({ subSpecialty: e.target.value })}
                className={`${CONTROL_CLASS} mt-1.5`}
              >
                <option value="all">All sub-specialties</option>
                {options.subSpecialties.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </label>
          )}

          {options.locationGroups.length > 0 && (
            <label className="block">
              <span className="field-label">Location</span>
              <select
                value={filters.location}
                onChange={(e) => set({ location: e.target.value })}
                className={`${CONTROL_CLASS} mt-1.5`}
              >
                <option value="all">All locations</option>
                {options.locationGroups.map((group) => (
                  <optgroup key={group.province} label={group.province}>
                    {group.locations.map((location) => {
                      const comma = location.lastIndexOf(',');
                      // The optgroup already names the province, so
                      // showing it again per-option is redundant.
                      const cityLabel = comma === -1 ? location : location.slice(0, comma);
                      return (
                        <option key={location} value={location}>
                          {cityLabel}
                        </option>
                      );
                    })}
                  </optgroup>
                ))}
              </select>
            </label>
          )}

          {hasFeeRange && (
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="field-label">Consultation fee</span>
                <span className="text-xs font-bold text-slate-900">
                  {filters.maxFee === null
                    ? 'Any fee'
                    : `Up to ${formatFee(filters.maxFee)}`}
                </span>
              </div>
              <input
                type="range"
                min={options.feeMin}
                max={options.feeMax}
                step={50}
                value={feeValue}
                aria-label="Maximum consultation fee"
                onChange={(e) => {
                  const next = Number(e.target.value);
                  // Sliding back to the top means "no ceiling" rather than
                  // "exactly the most expensive clinic".
                  set({ maxFee: next >= options.feeMax ? null : next });
                }}
                // Left at the native appearance so the thumb renders in every
                // browser; accent-color is enough to bring it into the theme.
                className="mt-3 w-full cursor-pointer accent-brand-600"
              />
              <div className="mt-1 flex justify-between text-[0.6875rem] font-medium text-slate-500">
                <span>{formatFee(options.feeMin)}</span>
                <span>{formatFee(options.feeMax)}+</span>
              </div>
            </div>
          )}

          {options.hmos.length > 0 && (
            <div className="sm:col-span-2 lg:col-span-3">
              <span className="field-label">HMO accreditation</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {options.hmos.map((hmo) => {
                  const isActive = filters.hmos.includes(hmo);
                  return (
                    <button
                      key={hmo}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => toggleHmo(hmo)}
                      className={`fluid-hover rounded-xl border px-3 py-1.5 text-xs font-bold ${
                        isActive
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {hmo}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <SegmentedControl
            label="Minimum rating"
            value={filters.minRating}
            options={RATING_OPTIONS}
            onSelect={(minRating) => set({ minRating })}
          />

          <SegmentedControl
            label="Availability"
            value={filters.availability}
            options={AVAILABILITY_OPTIONS}
            onSelect={(availability) => set({ availability })}
          />

          <div className="flex items-end justify-between gap-3 sm:col-span-2 lg:col-span-1">
            <p className="text-xs text-slate-500">
              <strong className="font-bold text-slate-900">{resultCount}</strong>{' '}
              {resultCount === 1 ? 'doctor matches' : 'doctors match'}
            </p>
            <button
              type="button"
              onClick={onReset}
              className="rounded-2xl px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Clear all
            </button>
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200/70 pt-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Active
          </span>
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => onChange(chip.next)}
              aria-label={`Remove filter: ${chip.label}`}
              className="fluid-hover inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700 hover:bg-brand-100"
            >
              {chip.id === 'minRating' && <IconStar className="h-3 w-3" />}
              {chip.label}
              <IconClose className="h-3 w-3" />
            </button>
          ))}
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-bold text-slate-500 underline-offset-2 transition hover:text-slate-900 hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
