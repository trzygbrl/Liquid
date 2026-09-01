// src/lib/doctorRanking.ts
//
// Doctor Ranking & HMO Matching Intelligence Engine. PRD Sections 8.3 & 8.4 (Task 4.1)
//
// RANKING TIERS (PRD 8.4):
//   1. Sub-specialty match strength (exact match ranks above adjacent/general specialty)
//   2. HMO coverage (covered doctors rank above cash-only)
//   3. Average rating (higher rating ranks first)
//   4. Soonest available slot (earliest available date/time ranks first)

import { todayISO } from './dateUtils.ts';
import { proximityTier, type ProximityTier } from './locationData.ts';

export interface Clinic {
  id: string;
  name: string;
  room_details: string | null;
  location: string;
  consultation_fee: number;
}

export interface ScheduleSlot {
  id: string;
  clinic_id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_booked: 'available' | 'booked' | 'doctor_on_leave';
}

export interface DoctorRecord {
  id: string;
  name: string;
  credentials: string | null;
  specialty: string;
  sub_specialty: string | null;
  hmo_accreditations: string[];
  verification_status: 'pending' | 'verified' | 'rejected';
  clinics: Clinic[];
  schedule_slots: ScheduleSlot[];
  reviews: { rating: number }[];
}

export interface SoonestSlotInfo {
  id: string;
  date: string;
  time: string;
  formatted: string;
  clinicId: string;
}

export interface RankedDoctor extends DoctorRecord {
  similarityScore: number;
  isExactSubSpecialty: boolean;
  isHmoCovered: boolean;
  averageRating: number | null;
  reviewCount: number;
  soonestSlot: SoonestSlotInfo | null;
  primaryClinic: Clinic | null;
  otherClinics: Clinic[];
}

export interface RankingResult {
  ranked: RankedDoctor[];
  hasHmoMismatch: boolean;
  totalCount: number;
  exactMatchCount: number;
  coveredCount: number;
  vectorSearchApplied: boolean;
}

/**
 * The earliest still-open slot in a doctor's schedule, formatted for display.
 *
 * Pass a clinicId to restrict the search to a single practice location. The
 * directory filters use that when a location or fee filter narrows a doctor
 * down to a subset of their clinics, so the slot shown on a card always
 * belongs to the clinic shown beside it.
 */
export function pickSoonestSlot(
  slots: ScheduleSlot[] | null | undefined,
  clinicId: string | null = null,
  todayStr: string = todayISO()
): SoonestSlotInfo | null {
  const availableSlots = (slots ?? [])
    .filter(
      (s) =>
        s.is_booked === 'available' &&
        s.date >= todayStr &&
        (!clinicId || s.clinic_id === clinicId)
    )
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.start_time.localeCompare(b.start_time);
    });

  if (availableSlots.length === 0) return null;

  const first = availableSlots[0];
  // Format time e.g. "09:00:00" -> "9:00 AM"
  const [hStr, mStr] = first.start_time.split(':');
  const hNum = parseInt(hStr, 10);
  const ampm = hNum >= 12 ? 'PM' : 'AM';
  const h12 = hNum % 12 || 12;
  const formattedTime = `${h12}:${mStr} ${ampm}`;

  // Format date e.g. "2026-08-20" -> "Aug 20, 2026"
  const dateParts = first.date.split('-');
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const mIdx = parseInt(dateParts[1], 10) - 1;
  const formattedDate = `${monthNames[mIdx] || dateParts[1]} ${parseInt(dateParts[2], 10)}, ${dateParts[0]}`;

  return {
    id: first.id,
    date: first.date,
    time: first.start_time,
    formatted: `${formattedDate} at ${formattedTime}`,
    clinicId: first.clinic_id,
  };
}

export interface OptimalClinicResult {
  primaryClinic: Clinic | null;
  soonestSlot: SoonestSlotInfo | null;
  otherClinics: Clinic[];
}

/**
 * Picks which of a doctor's clinics to show as the default/primary one
 * on their card, plus that specific clinic's own earliest open slot.
 *
 * Replaces the old "soonest slot anywhere, else whichever clinic happens
 * to be first in the array" default: clinics are ranked by (1) proximity
 * to the patient's location -- same city, then same province, then same
 * region, then unknown, via src/lib/locationData.ts's whitelist -- and
 * (2) which has the soonest open slot, with a slot-having clinic always
 * preferred over one with none. `otherClinics` is returned in this same
 * relevance order so the alternate-clinic picker lists the next-best
 * options first, not just registration order.
 */
export function pickOptimalClinic(
  clinics: Clinic[] | null | undefined,
  slots: ScheduleSlot[] | null | undefined,
  patientLocation: string | null,
  todayStr: string = todayISO()
): OptimalClinicResult {
  const list = clinics ?? [];
  if (list.length === 0) return { primaryClinic: null, soonestSlot: null, otherClinics: [] };

  const scored = list.map((clinic) => ({
    clinic,
    tier: proximityTier(patientLocation, clinic.location) as ProximityTier,
    slot: pickSoonestSlot(slots, clinic.id, todayStr),
  }));

  scored.sort((a, b) => {
    // Proximity first: closer to patient beats farther (same city > same province > same region > unknown).
    if (a.tier !== b.tier) return a.tier - b.tier;
    // Within the same proximity tier, a clinic with an open slot beats one with none.
    if (Boolean(a.slot) !== Boolean(b.slot)) return a.slot ? -1 : 1;
    // Then, among equally-close clinics with slots, earlier wins.
    if (a.slot && b.slot) {
      const dateCmp = a.slot.date.localeCompare(b.slot.date);
      if (dateCmp !== 0) return dateCmp;
      return a.slot.time.localeCompare(b.slot.time);
    }
    return 0;
  });

  const [best, ...rest] = scored;
  return {
    primaryClinic: best.clinic,
    soonestSlot: best.slot,
    otherClinics: rest.map((s) => s.clinic),
  };
}

/**
 * Ranks doctor records according to PRD 8.4 multi-factor criteria
 * and identifies HMO mismatch state per PRD 8.3.
 *
 * Tiers:
 *   Tier 0: Vector similarity score (if similarityScores map provided)
 *   Tier 1: Sub-specialty match strength (exact match first)
 *   Tier 2: HMO Coverage (if patient has HMO)
 *   Tier 3: Rating (higher average rating first)
 *   Tier 4: Soonest available slot (earlier dates/times first; no slot last)
 *
 * @param doctors - List of doctor records to rank
 * @param targetSpecialty - Desired medical specialty
 * @param targetSubSpecialty - Desired sub-specialty or null
 * @param patientHmo - Patient's HMO provider name or null
 * @param similarityScores - Optional Map of doctorId -> cosine similarity score for Tier 0 sort
 * @param patientLocation - Patient's location string, used to pick each doctor's
 *   closest clinic as their card's default/primary one (see pickOptimalClinic)
 */
export function rankDoctors(
  doctors: DoctorRecord[],
  targetSpecialty: string,
  targetSubSpecialty: string | null,
  patientHmo: string | null,
  similarityScores?: Map<string, number>,
  patientLocation: string | null = null
): RankingResult {
  const todayStr = todayISO();

  const processed: RankedDoctor[] = doctors.map((doc) => {
    // 0. Vector similarity score
    const similarityScore = similarityScores?.get(doc.id) ?? 0;

    // 1. Sub-specialty match strength
    const isExactSubSpecialty = targetSubSpecialty
      ? (doc.sub_specialty || '').trim().toLowerCase() === targetSubSpecialty.trim().toLowerCase()
      : true;

    // 2. HMO Coverage
    const isHmoCovered = Boolean(
      patientHmo &&
      doc.hmo_accreditations?.some(
        (h) => h.trim().toLowerCase() === patientHmo.trim().toLowerCase()
      )
    );

    // 3. Rating
    const ratings = (doc.reviews ?? []).map((r) => r.rating);
    const averageRating =
      ratings.length > 0
        ? ratings.reduce((sum, val) => sum + val, 0) / ratings.length
        : null;

    // 4. Optimal clinic: closest to the patient with an open slot, else
    // just closest (see pickOptimalClinic) -- the displayed clinic and
    // displayed slot always agree since they're picked together.
    const { primaryClinic, soonestSlot, otherClinics } = pickOptimalClinic(
      doc.clinics,
      doc.schedule_slots,
      patientLocation,
      todayStr
    );

    return {
      ...doc,
      similarityScore,
      isExactSubSpecialty,
      isHmoCovered,
      averageRating,
      reviewCount: ratings.length,
      soonestSlot,
      primaryClinic,
      otherClinics,
    };
  });

  // HMO Mismatch detection (PRD 8.3):
  // True if the patient provided an HMO, there exist doctors matching the sub-specialty,
  // but NONE of those matching doctors are accredited with the patient's HMO.
  const exactMatches = targetSubSpecialty
    ? processed.filter((d) => d.isExactSubSpecialty)
    : processed;

  const hasHmoMismatch = Boolean(
    patientHmo &&
    exactMatches.length > 0 &&
    !exactMatches.some((d) => d.isHmoCovered)
  );

  const coveredCount = processed.filter((d) => d.isHmoCovered).length;
  const exactMatchCount = exactMatches.length;

  // Multi-tier sort
  processed.sort((a, b) => {
    // Tier 0: Vector similarity
    // Prioritizes candidates with higher vector similarity score when vector matching is active.
    if (similarityScores && (a.similarityScore > 0 || b.similarityScore > 0)) {
      const diff = b.similarityScore - a.similarityScore;
      if (Math.abs(diff) > 0.01) return diff > 0 ? 1 : -1;
      // within 0.01 tolerance -> fall through to Tier 1
    }

    // Tier 1: Sub-specialty match strength (exact match first)
    if (a.isExactSubSpecialty !== b.isExactSubSpecialty) {
      return a.isExactSubSpecialty ? -1 : 1;
    }

    // Tier 2: HMO Coverage (if patient has HMO)
    if (patientHmo && a.isHmoCovered !== b.isHmoCovered) {
      return a.isHmoCovered ? -1 : 1;
    }

    // Tier 3: Rating (higher average rating first)
    const ratingA = a.averageRating ?? 0;
    const ratingB = b.averageRating ?? 0;
    if (ratingA !== ratingB) {
      return ratingB - ratingA;
    }

    // Tier 4: Soonest available slot (earlier dates/times first; no slot last)
    if (a.soonestSlot && b.soonestSlot) {
      const dateCmp = a.soonestSlot.date.localeCompare(b.soonestSlot.date);
      if (dateCmp !== 0) return dateCmp;
      return a.soonestSlot.time.localeCompare(b.soonestSlot.time);
    }
    if (a.soonestSlot && !b.soonestSlot) return -1;
    if (!a.soonestSlot && b.soonestSlot) return 1;

    return 0;
  });

  return {
    ranked: processed,
    hasHmoMismatch,
    totalCount: processed.length,
    exactMatchCount,
    coveredCount,
    vectorSearchApplied: Boolean(similarityScores && similarityScores.size > 0),
  };
}
