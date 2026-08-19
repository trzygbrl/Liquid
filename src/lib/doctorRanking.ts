// src/lib/doctorRanking.ts
//
// Doctor Ranking & HMO Matching Intelligence Engine — PRD Sections 8.3 & 8.4 (Task 4.1)
//
// RANKING TIERS (PRD 8.4):
//   1. Sub-specialty match strength (exact match ranks above adjacent/general specialty)
//   2. HMO coverage (covered doctors rank above cash-only, unless patient toggled "show all")
//   3. Average rating (higher rating ranks first)
//   4. Soonest available slot (earliest available date/time ranks first)

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
  verified: boolean;
  clinics: Clinic[];
  schedule_slots: ScheduleSlot[];
  reviews: { rating: number }[];
}

export interface SoonestSlotInfo {
  id: string;
  date: string;
  time: string;
  formatted: string;
}

export interface RankedDoctor extends DoctorRecord {
  isExactSubSpecialty: boolean;
  isHmoCovered: boolean;
  averageRating: number | null;
  reviewCount: number;
  soonestSlot: SoonestSlotInfo | null;
  primaryClinic: Clinic | null;
}

export interface RankingResult {
  ranked: RankedDoctor[];
  hasHmoMismatch: boolean;
  totalCount: number;
  exactMatchCount: number;
  coveredCount: number;
}

/**
 * Ranks doctor records according to PRD 8.4 multi-factor criteria
 * and identifies HMO mismatch state per PRD 8.3.
 */
export function rankDoctors(
  doctors: DoctorRecord[],
  targetSpecialty: string,
  targetSubSpecialty: string | null,
  patientHmo: string | null,
  showAllHmo: boolean = false
): RankingResult {
  const todayStr = new Date().toISOString().split('T')[0];

  const processed: RankedDoctor[] = doctors.map((doc) => {
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

    // 4. Soonest available slot (date >= today, is_booked === 'available')
    const availableSlots = (doc.schedule_slots ?? [])
      .filter((s) => s.is_booked === 'available' && s.date >= todayStr)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.start_time.localeCompare(b.start_time);
      });

    let soonestSlot: SoonestSlotInfo | null = null;
    if (availableSlots.length > 0) {
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

      soonestSlot = {
        id: first.id,
        date: first.date,
        time: first.start_time,
        formatted: `${formattedDate} at ${formattedTime}`,
      };
    }

    return {
      ...doc,
      isExactSubSpecialty,
      isHmoCovered,
      averageRating,
      reviewCount: ratings.length,
      soonestSlot,
      primaryClinic: doc.clinics?.[0] ?? null,
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
    // Tier 1: Sub-specialty match strength (exact match first)
    if (a.isExactSubSpecialty !== b.isExactSubSpecialty) {
      return a.isExactSubSpecialty ? -1 : 1;
    }

    // Tier 2: HMO Coverage (if patient has HMO and not toggled to ignore)
    if (patientHmo && !showAllHmo && a.isHmoCovered !== b.isHmoCovered) {
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
  };
}
