// src/lib/doctorFilters.ts
//
// Filtering, sorting and filter-option derivation for the patient-facing
// doctor directory (/patient/doctors).
//
// These run *after* rankDoctors() so they can key off the fields the ranker
// derives -- average rating, soonest open slot, primary clinic -- instead of
// re-deriving them. "Best match" sorting is therefore just the ranker's own
// PRD 8.4 order with the non-matching doctors removed.

import { todayISO, isoDate } from './dateUtils.ts';
import { normalizeLocation } from './locationData.ts';
import {
  pickSoonestSlot,
  type Clinic,
  type DoctorRecord,
  type RankedDoctor,
} from './doctorRanking.ts';

export type SortKey = 'best' | 'semantic' | 'rating' | 'price_asc' | 'price_desc' | 'soonest' | 'name';
export type AvailabilityKey = 'any' | 'open' | 'week' | 'month';

export interface DoctorFilters {
  /** Free text matched against name, field, clinic, location and HMO. */
  search: string;
  /** 'all' or an exact specialty name. */
  specialty: string;
  /** 'all' or an exact sub-specialty name. */
  subSpecialty: string;
  /** 'all' or an exact clinic location ("City, Province"). */
  location: string;
  /** Consultation-fee ceiling in pesos; null means no ceiling. */
  maxFee: number | null;
  /** HMO accreditations, OR-matched: any one of them is a hit. */
  hmos: string[];
  /** Minimum average rating; 0 means any (including unrated doctors). */
  minRating: number;
  availability: AvailabilityKey;
  sort: SortKey;
}

export const DEFAULT_FILTERS: DoctorFilters = {
  search: '',
  specialty: 'all',
  subSpecialty: 'all',
  location: 'all',
  maxFee: null,
  hmos: [],
  minRating: 0,
  availability: 'any',
  sort: 'best',
};

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'best', label: 'Best match' },
  { value: 'semantic', label: 'Best clinical match' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'price_asc', label: 'Lowest fee' },
  { value: 'price_desc', label: 'Highest fee' },
  { value: 'soonest', label: 'Soonest available' },
  { value: 'name', label: 'Name (A-Z)' },
];

export const RATING_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Any' },
  { value: 3, label: '3.0+' },
  { value: 4, label: '4.0+' },
  { value: 4.5, label: '4.5+' },
];

export const AVAILABILITY_OPTIONS: { value: AvailabilityKey; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'open', label: 'Has open slots' },
  { value: 'week', label: 'Next 7 days' },
  { value: 'month', label: 'Next 30 days' },
];

/** Peso amount without centavos, for filter labels and chips. */
export function formatFee(value: number): string {
  return `₱${Math.round(value).toLocaleString('en-US')}`;
}

// =============================================================
// Filter options derived from the fetched doctor set
// =============================================================

export interface LocationGroup {
  /** Province, per the Region III whitelist (src/lib/locationData.ts). */
  province: string;
  locations: string[];
}

export interface FilterOptions {
  specialties: string[];
  /** Sub-specialties present under the currently selected specialty. */
  subSpecialties: string[];
  locationGroups: LocationGroup[];
  hmos: string[];
  /** Fee slider bounds, rounded outward to the nearest 50. */
  feeMin: number;
  feeMax: number;
}

const FEE_STEP = 50;

/**
 * Builds the option lists for the filter panel from the doctors actually
 * fetched, so no filter can offer a value that matches nothing. The
 * sub-specialty list narrows to `specialty` when one is selected.
 */
export function deriveFilterOptions(
  doctors: DoctorRecord[],
  specialty: string = 'all'
): FilterOptions {
  const specialties = new Set<string>();
  const subSpecialties = new Set<string>();
  // canonical "City, Province" display -> province, for whitelisted clinic locations only
  const locations = new Map<string, string>();
  const hmos = new Map<string, string>(); // lowercased key -> first-seen casing
  let feeMin = Number.POSITIVE_INFINITY;
  let feeMax = 0;

  for (const doctor of doctors) {
    if (doctor.specialty) specialties.add(doctor.specialty);
    if (doctor.sub_specialty && (specialty === 'all' || doctor.specialty === specialty)) {
      subSpecialties.add(doctor.sub_specialty);
    }
    for (const hmo of doctor.hmo_accreditations ?? []) {
      const key = hmo.trim().toLowerCase();
      if (key && !hmos.has(key)) hmos.set(key, hmo.trim());
    }
    for (const clinic of doctor.clinics ?? []) {
      // A clinic location that doesn't normalize to the whitelist is
      // omitted from the dropdown/grouping entirely -- the doctor stays
      // visible under "All locations" (filters.location === 'all' skips
      // the location check in clinicMatches()), just unfilterable by city.
      const normalized = clinic.location ? normalizeLocation(clinic.location) : null;
      if (normalized) locations.set(normalized.display, normalized.province);
      const fee = Number(clinic.consultation_fee);
      if (Number.isFinite(fee)) {
        feeMin = Math.min(feeMin, fee);
        feeMax = Math.max(feeMax, fee);
      }
    }
  }

  // Group whitelisted "City, Province" display strings under their real province.
  const byProvince = new Map<string, string[]>();
  for (const [display, province] of locations) {
    const bucket = byProvince.get(province);
    if (bucket) bucket.push(display);
    else byProvince.set(province, [display]);
  }
  const locationGroups: LocationGroup[] = Array.from(byProvince.entries())
    .map(([province, group]) => ({ province, locations: group.sort() }))
    .sort((a, b) => a.province.localeCompare(b.province));

  const hasFees = Number.isFinite(feeMin) && feeMax > 0;

  return {
    specialties: Array.from(specialties).sort(),
    subSpecialties: Array.from(subSpecialties).sort(),
    locationGroups,
    hmos: Array.from(hmos.values()).sort(),
    feeMin: hasFees ? Math.floor(feeMin / FEE_STEP) * FEE_STEP : 0,
    feeMax: hasFees ? Math.ceil(feeMax / FEE_STEP) * FEE_STEP : 0,
  };
}

// =============================================================
// Filtering
// =============================================================

/** Latest slot date still inside the selected availability window. */
function availabilityHorizon(availability: AvailabilityKey): string | null {
  if (availability === 'week' || availability === 'month') {
    const days = availability === 'week' ? 6 : 29;
    const end = new Date();
    end.setDate(end.getDate() + days);
    return isoDate(end);
  }
  return null;
}

function matchesSearch(doctor: RankedDoctor, query: string): boolean {
  const haystack = [
    doctor.name,
    doctor.specialty,
    doctor.sub_specialty ?? '',
    doctor.credentials ?? '',
    ...(doctor.hmo_accreditations ?? []),
    ...(doctor.clinics ?? []).map((c) => c.name),
    ...(doctor.clinics ?? []).map((c) => c.location),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

function clinicMatches(clinic: Clinic, filters: DoctorFilters): boolean {
  if (filters.location !== 'all') {
    const normalized = normalizeLocation(clinic.location);
    if (!normalized || normalized.display !== filters.location) return false;
  }
  if (filters.maxFee !== null && Number(clinic.consultation_fee) > filters.maxFee) return false;
  return true;
}

/**
 * Re-points a doctor's card at the clinics that survived the location/fee
 * filter: the primary clinic becomes whichever match has the soonest open
 * slot (the cheapest match when none has any), the slot shown is re-derived
 * for that clinic, and the "other locations" list drops what was filtered
 * out. Without this, a doctor narrowed to one city could still show a clinic
 * and a fee from a city the patient excluded.
 */
function repointToClinics(
  doctor: RankedDoctor,
  matching: Clinic[],
  todayStr: string
): RankedDoctor {
  let primary = matching[0];
  let slot = pickSoonestSlot(doctor.schedule_slots, primary.id, todayStr);

  for (const candidate of matching.slice(1)) {
    const candidateSlot = pickSoonestSlot(doctor.schedule_slots, candidate.id, todayStr);
    const takesOver = slot
      ? Boolean(
          candidateSlot &&
            (candidateSlot.date < slot.date ||
              (candidateSlot.date === slot.date && candidateSlot.time < slot.time))
        )
      : Boolean(candidateSlot) ||
        Number(candidate.consultation_fee) < Number(primary.consultation_fee);

    if (takesOver) {
      primary = candidate;
      slot = candidateSlot;
    }
  }

  return {
    ...doctor,
    primaryClinic: primary,
    otherClinics: matching.filter((c) => c.id !== primary.id),
    soonestSlot: slot,
  };
}

/**
 * Applies every active filter. Doctor-level filters reject outright; the
 * location and fee filters work per-clinic, keeping a doctor as long as one
 * of their practice locations qualifies.
 */
export function applyDoctorFilters(
  doctors: RankedDoctor[],
  filters: DoctorFilters
): RankedDoctor[] {
  const query = filters.search.trim().toLowerCase();
  const wantedHmos = filters.hmos.map((h) => h.trim().toLowerCase()).filter(Boolean);
  const clinicFilterActive = filters.location !== 'all' || filters.maxFee !== null;
  const horizon = availabilityHorizon(filters.availability);
  const todayStr = todayISO();

  const results: RankedDoctor[] = [];

  for (const doctor of doctors) {
    if (filters.specialty !== 'all' && doctor.specialty !== filters.specialty) continue;
    if (filters.subSpecialty !== 'all' && (doctor.sub_specialty ?? '') !== filters.subSpecialty) {
      continue;
    }
    if (query && !matchesSearch(doctor, query)) continue;
    if (
      wantedHmos.length > 0 &&
      !(doctor.hmo_accreditations ?? []).some((h) => wantedHmos.includes(h.trim().toLowerCase()))
    ) {
      continue;
    }
    // Unrated ("New Doctor") profiles fall out of any explicit rating floor.
    if (filters.minRating > 0 && (doctor.averageRating ?? 0) < filters.minRating) continue;

    let entry = doctor;
    if (clinicFilterActive) {
      const matching = (doctor.clinics ?? []).filter((c) => clinicMatches(c, filters));
      if (matching.length === 0) continue;
      entry = repointToClinics(doctor, matching, todayStr);
    }

    if (filters.availability !== 'any') {
      if (!entry.soonestSlot) continue;
      if (horizon && entry.soonestSlot.date > horizon) continue;
    }

    results.push(entry);
  }

  return results;
}

// =============================================================
// Sorting
// =============================================================

/** The fee a doctor sorts by: the clinic on their card, else their cheapest. */
function feeValue(doctor: RankedDoctor): number | null {
  if (doctor.primaryClinic) return Number(doctor.primaryClinic.consultation_fee);
  const fees = (doctor.clinics ?? [])
    .map((c) => Number(c.consultation_fee))
    .filter((f) => Number.isFinite(f));
  return fees.length > 0 ? Math.min(...fees) : null;
}

/**
 * Orders two possibly-missing sort keys, sinking the missing ones to the
 * bottom in either direction. Returns null when both are present and compare
 * equal, so callers can fall through to a tiebreaker.
 */
function nullsLast<T>(a: T | null, b: T | null, compare: (x: T, y: T) => number): number | null {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return compare(a, b) || null;
}

export function sortDoctors(doctors: RankedDoctor[], sort: SortKey): RankedDoctor[] {
  // 'best' is the ranker's own multi-tier order, already applied.
  if (sort === 'best') return doctors;

  const sorted = [...doctors];

  switch (sort) {
    case 'semantic':
      sorted.sort((a, b) => (b.similarityScore ?? 0) - (a.similarityScore ?? 0));
      break;
    case 'rating':
      sorted.sort((a, b) => {
        const cmp = nullsLast(a.averageRating, b.averageRating, (x, y) => y - x);
        if (cmp !== null) return cmp;
        return b.reviewCount - a.reviewCount;
      });
      break;
    case 'price_asc':
      sorted.sort((a, b) => nullsLast(feeValue(a), feeValue(b), (x, y) => x - y) ?? 0);
      break;
    case 'price_desc':
      sorted.sort((a, b) => nullsLast(feeValue(a), feeValue(b), (x, y) => y - x) ?? 0);
      break;
    case 'soonest':
      sorted.sort(
        (a, b) =>
          nullsLast(
            a.soonestSlot,
            b.soonestSlot,
            (x, y) => x.date.localeCompare(y.date) || x.time.localeCompare(y.time)
          ) ?? 0
      );
      break;
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }

  return sorted;
}

// =============================================================
// Active-filter summary (the removable chips under the panel)
// =============================================================

export interface FilterChip {
  id: string;
  label: string;
  /** The filter set with just this chip cleared. */
  next: DoctorFilters;
}

/**
 * One chip per active filter, each carrying the filter state that results
 * from clearing it. Search and sort are excluded: both stay visible in their
 * own always-on controls.
 */
export function activeFilterChips(filters: DoctorFilters): FilterChip[] {
  const chips: FilterChip[] = [];

  if (filters.specialty !== 'all') {
    chips.push({
      id: 'specialty',
      label: filters.specialty,
      // Sub-specialty options are scoped to a specialty, so it clears too.
      next: { ...filters, specialty: 'all', subSpecialty: 'all' },
    });
  }
  if (filters.subSpecialty !== 'all') {
    chips.push({
      id: 'subSpecialty',
      label: filters.subSpecialty,
      next: { ...filters, subSpecialty: 'all' },
    });
  }
  if (filters.location !== 'all') {
    chips.push({
      id: 'location',
      label: filters.location,
      next: { ...filters, location: 'all' },
    });
  }
  if (filters.maxFee !== null) {
    chips.push({
      id: 'maxFee',
      label: `Up to ${formatFee(filters.maxFee)}`,
      next: { ...filters, maxFee: null },
    });
  }
  for (const hmo of filters.hmos) {
    chips.push({
      id: `hmo:${hmo}`,
      label: hmo,
      next: { ...filters, hmos: filters.hmos.filter((h) => h !== hmo) },
    });
  }
  if (filters.minRating > 0) {
    chips.push({
      id: 'minRating',
      label: `${filters.minRating.toFixed(1)}+ rating`,
      next: { ...filters, minRating: 0 },
    });
  }
  if (filters.availability !== 'any') {
    const option = AVAILABILITY_OPTIONS.find((o) => o.value === filters.availability);
    chips.push({
      id: 'availability',
      label: option?.label ?? filters.availability,
      next: { ...filters, availability: 'any' },
    });
  }

  return chips;
}

/** How many panel filters are narrowing the list right now. */
export function activeFilterCount(filters: DoctorFilters): number {
  return activeFilterChips(filters).length;
}
