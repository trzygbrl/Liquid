'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import RequireRole from '@/components/RequireRole';
import { supabase } from '@/lib/supabaseClient';

interface Clinic {
  id: string;
  name: string;
  room_details: string | null;
  location: string;
  consultation_fee: number;
}

interface ScheduleSlot {
  id: string;
  clinic_id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_booked: 'available' | 'booked' | 'doctor_on_leave';
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

interface DoctorDetail {
  id: string;
  name: string;
  credentials: string | null;
  specialty: string;
  sub_specialty: string | null;
  hmo_accreditations: string[];
  verified: boolean;
  clinics: Clinic[];
  schedule_slots: ScheduleSlot[];
  reviews: Review[];
}

function formatTime(timeStr: string): string {
  const [hStr, mStr] = timeStr.split(':');
  const hNum = parseInt(hStr, 10);
  const ampm = hNum >= 12 ? 'PM' : 'AM';
  const h12 = hNum % 12 || 12;
  return `${h12}:${mStr} ${ampm}`;
}

function formatDateHeader(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dayName = days[dateObj.getDay()];
  const monthName = months[dateObj.getMonth()];
  return `${dayName}, ${monthName} ${parseInt(day, 10)}, ${year}`;
}

function formatReviewDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso.split('T')[0];
  }
}

function DoctorDetailPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const doctorId = Array.isArray(params.id) ? params.id[0] : params.id;
  const patientHmo = searchParams.get('hmo') || null;

  const [doctor, setDoctor] = useState<DoctorDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Booking interaction states
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [symptomSummary, setSymptomSummary] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Load doctor details
  useEffect(() => {
    async function loadDoctor() {
      if (!doctorId) return;
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('doctors')
          .select(
            `
            id,
            name,
            credentials,
            specialty,
            sub_specialty,
            hmo_accreditations,
            verified,
            clinics (
              id,
              name,
              room_details,
              location,
              consultation_fee
            ),
            schedule_slots (
              id,
              clinic_id,
              date,
              start_time,
              end_time,
              is_booked
            ),
            reviews (
              id,
              rating,
              comment,
              created_at
            )
          `
          )
          .eq('id', doctorId)
          .single();

        if (fetchError) throw fetchError;

        const docFormatted: DoctorDetail = {
          id: data.id,
          name: data.name,
          credentials: data.credentials,
          specialty: data.specialty,
          sub_specialty: data.sub_specialty,
          hmo_accreditations: Array.isArray(data.hmo_accreditations)
            ? data.hmo_accreditations
            : [],
          verified: Boolean(data.verified),
          clinics: Array.isArray(data.clinics) ? data.clinics : [],
          schedule_slots: Array.isArray(data.schedule_slots) ? data.schedule_slots : [],
          reviews: Array.isArray(data.reviews) ? data.reviews : [],
        };

        setDoctor(docFormatted);
      } catch (err: any) {
        console.error('Error loading doctor:', err);
        setError('Unable to load doctor profile. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    loadDoctor();
  }, [doctorId]);

  // Group open available schedule slots by Date
  const groupedSlots = useMemo(() => {
    if (!doctor) return {};
    const todayStr = new Date().toISOString().split('T')[0];

    const available = (doctor.schedule_slots || [])
      .filter((s) => s.is_booked === 'available' && s.date >= todayStr)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.start_time.localeCompare(b.start_time);
      });

    const groups: { [date: string]: ScheduleSlot[] } = {};
    available.forEach((slot) => {
      if (!groups[slot.date]) {
        groups[slot.date] = [];
      }
      groups[slot.date].push(slot);
    });

    return groups;
  }, [doctor]);

  const selectedSlot = useMemo(() => {
    if (!doctor || !selectedSlotId) return null;
    return doctor.schedule_slots.find((s) => s.id === selectedSlotId) || null;
  }, [doctor, selectedSlotId]);

  const selectedClinic = useMemo(() => {
    if (!doctor || !selectedSlot) return doctor?.clinics?.[0] || null;
    return doctor.clinics.find((c) => c.id === selectedSlot.clinic_id) || doctor.clinics[0] || null;
  }, [doctor, selectedSlot]);

  // Handle appointment booking submission
  async function handleConfirmBooking() {
    if (!doctor || !selectedSlot || isSubmitting) return;

    setIsSubmitting(true);
    setBookingError(null);

    try {
      // 1. Get current authenticated user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Please sign in as a patient to book an appointment.');
      }

      // 2. Insert appointment record (status: 'pending')
      // Note: PostgreSQL trigger trg_sync_slot_status automatically updates schedule_slots.is_booked = 'booked'
      const { data: apptData, error: insertError } = await supabase
        .from('appointments')
        .insert({
          patient_id: user.id,
          doctor_id: doctor.id,
          slot_id: selectedSlot.id,
          status: 'pending',
          symptom_summary: symptomSummary.trim() || null,
        })
        .select('id')
        .single();

      if (insertError) {
        // Handle unique constraint conflict (slot already booked)
        if (insertError.code === '23505' || insertError.message.includes('unique')) {
          throw new Error('This time slot was just booked by another patient. Please pick a different slot.');
        }
        throw insertError;
      }

      // 3. Redirect to the dedicated confirmation screen (Task 4.3).
      // router.replace keeps the history clean so "back" returns to the doctor list
      // rather than re-triggering the booking flow.
      router.replace(`/patient/appointments/${apptData.id}/confirmation`);
    } catch (err: any) {
      console.error('Booking failed:', err);
      setBookingError(err.message || 'Failed to submit booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // ─── Render: Loading State ──────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-slate-400">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-teal-400" />
          <span>Loading doctor profile…</span>
        </div>
      </main>
    );
  }

  // ─── Render: Error State ────────────────────────────────────────────────────
  if (error || !doctor) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 py-12 text-center">
        <div className="max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-8">
          <h2 className="text-lg font-bold text-red-300">Doctor Profile Not Found</h2>
          <p className="mt-2 text-sm text-slate-300">
            {error || "The requested doctor profile could not be found or has been moved."}
          </p>
          <a
            href="/patient/doctors"
            className="mt-6 inline-block rounded-xl bg-slate-800 px-6 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-700"
          >
            ← Return to doctor list
          </a>
        </div>
      </main>
    );
  }


  // Computations for ratings and HMO
  const isHmoCovered = Boolean(
    patientHmo &&
    doctor.hmo_accreditations?.some(
      (h) => h.toLowerCase() === patientHmo.toLowerCase()
    )
  );

  const ratings = doctor.reviews.map((r) => r.rating);
  const avgRating =
    ratings.length > 0
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : null;

  const starDistribution = useMemo(() => {
    const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    if (!doctor?.reviews) return counts;
    for (const r of doctor.reviews) {
      if (r.rating >= 1 && r.rating <= 5) {
        counts[r.rating]++;
      }
    }
    return counts;
  }, [doctor]);

  const sortedReviews = useMemo(() => {
    if (!doctor?.reviews) return [];
    return [...doctor.reviews].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [doctor]);

  const datesWithSlots = Object.keys(groupedSlots);
  const primaryClinic = doctor.clinics[0] || null;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between border-b border-slate-800 pb-4">
          <a
            href={`/patient/doctors?specialty=${encodeURIComponent(
              doctor.specialty
            )}${
              doctor.sub_specialty
                ? `&sub_specialty=${encodeURIComponent(doctor.sub_specialty)}`
                : ''
            }${patientHmo ? `&hmo=${encodeURIComponent(patientHmo)}` : ''}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-400 transition hover:text-teal-300"
          >
            ← Back to doctor list
          </a>
          <span className="text-xs text-slate-500">Doctor Profile & Booking</span>
        </div>

        {/* Doctor Hero Profile Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold text-white sm:text-3xl">
                  {doctor.name}
                </h1>
                {doctor.verified && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-teal-500/10 px-2 py-0.5 text-xs font-medium text-teal-300 border border-teal-500/20">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Verified Medical License
                  </span>
                )}
              </div>

              {/* Specialty & Rating Row */}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-teal-300 text-sm">
                  {doctor.specialty}
                </span>
                {doctor.sub_specialty && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="rounded-md bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-200">
                      {doctor.sub_specialty}
                    </span>
                  </>
                )}
                {avgRating !== null ? (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-300 text-xs">
                      ★ {avgRating} ({doctor.reviews.length} {doctor.reviews.length === 1 ? 'review' : 'reviews'})
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400 text-xs">★ New (No reviews yet)</span>
                  </>
                )}
              </div>

              {/* Credentials / Bio */}
              {doctor.credentials && (
                <div className="mt-4 rounded-xl border border-slate-800/80 bg-slate-800/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Credentials & Experience
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-200">
                    {doctor.credentials}
                  </p>
                </div>
              )}
            </div>

            {/* HMO Coverage Status Card */}
            <div className="rounded-xl border border-slate-800 bg-slate-800/60 p-4 sm:w-64 shrink-0 text-xs">
              <span className="font-semibold uppercase tracking-wider text-slate-400 text-[11px] block">
                HMO Accreditations
              </span>
              {isHmoCovered && patientHmo ? (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-teal-500 px-2.5 py-1 text-xs font-bold text-slate-950">
                  <span>✓ Covered by {patientHmo}</span>
                </div>
              ) : patientHmo ? (
                <div className="mt-2 rounded-lg bg-slate-900/80 p-2 text-slate-300 border border-slate-700">
                  <span className="text-[11px] text-amber-300 block font-medium">Not accredited with {patientHmo}</span>
                  <span className="text-[10px] text-slate-400">Consultation available via cash rate.</span>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-1">
                {doctor.hmo_accreditations && doctor.hmo_accreditations.length > 0 ? (
                  doctor.hmo_accreditations.map((hmo) => (
                    <span
                      key={hmo}
                      className="rounded bg-slate-900 px-2 py-0.5 text-[11px] text-slate-300 border border-slate-750"
                    >
                      {hmo}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500 text-[11px]">No HMO listed (Cash only)</span>
                )}
              </div>
            </div>
          </div>

          {/* Clinics Information */}
          {doctor.clinics && doctor.clinics.length > 0 && (
            <div className="mt-6 border-t border-slate-800/80 pt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Practice Locations & Rates
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {doctor.clinics.map((clinic) => (
                  <div
                    key={clinic.id}
                    className="rounded-xl border border-slate-800 bg-slate-800/30 p-4 text-xs flex flex-col justify-between"
                  >
                    <div>
                      <h4 className="font-semibold text-white text-sm">{clinic.name}</h4>
                      {clinic.room_details && (
                        <p className="text-slate-400 mt-0.5">{clinic.room_details}</p>
                      )}
                      <p className="text-slate-400 mt-1">📍 {clinic.location}</p>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-slate-400">Consultation Fee</span>
                      <span className="font-bold text-teal-300 text-sm">
                        ₱{Number(clinic.consultation_fee).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Schedule Slots Picker Section */}
        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur sm:p-8">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">Select a Consultation Slot</h2>
              <p className="mt-1 text-xs text-slate-400">
                Choose an open schedule time to request your appointment.
              </p>
            </div>
            {selectedSlot && (
              <span className="rounded-lg bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-300 border border-teal-500/30">
                Slot Selected
              </span>
            )}
          </div>

          {datesWithSlots.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-8 text-center text-slate-400 text-sm">
              <p>No available appointment slots posted at this time.</p>
              <p className="mt-1 text-xs text-slate-500">Please check back later or contact the clinic directly.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {datesWithSlots.map((dateStr) => {
                const slotsForDate = groupedSlots[dateStr];
                return (
                  <div key={dateStr} className="rounded-xl border border-slate-800/80 bg-slate-800/20 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-teal-400 mb-3">
                      📅 {formatDateHeader(dateStr)}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {slotsForDate.map((slot) => {
                        const isSelected = selectedSlotId === slot.id;
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => {
                              setSelectedSlotId(slot.id);
                              setBookingError(null);
                            }}
                            className={`flex flex-col items-start rounded-xl p-3 text-left transition ${
                              isSelected
                                ? 'bg-teal-500 text-slate-950 font-bold shadow-md ring-2 ring-teal-400'
                                : 'bg-slate-800/80 border border-slate-700/80 text-white hover:border-teal-500/60 hover:bg-slate-800'
                            }`}
                          >
                            <span className="text-sm font-semibold">
                              {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                            </span>
                            <span
                              className={`text-[11px] mt-0.5 ${
                                isSelected ? 'text-slate-900 font-medium' : 'text-slate-400'
                              }`}
                            >
                              Available for Booking
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Booking Confirmation Box (Active when a slot is chosen) */}
          {selectedSlot && (
            <div className="mt-8 rounded-2xl border border-teal-500/40 bg-teal-500/5 p-6 backdrop-blur">
              <h3 className="text-base font-bold text-white mb-2">Confirm Your Booking</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300 mb-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[11px]">Selected Time:</span>
                  <span className="font-semibold text-white">
                    {formatDateHeader(selectedSlot.date)} at {formatTime(selectedSlot.start_time)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Clinic Location:</span>
                  <span className="font-semibold text-white">
                    {selectedClinic?.name || 'Clinic'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Coverage / Rate:</span>
                  <span className="font-semibold text-teal-300">
                    {isHmoCovered ? `Covered by ${patientHmo}` : `₱${Number(selectedClinic?.consultation_fee || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} (Cash)`}
                  </span>
                </div>
              </div>

              {/* Optional brief symptom note */}
              <div className="mb-4">
                <label htmlFor="symptom-note" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Reason for Consultation / Symptom Note (Optional)
                </label>
                <input
                  id="symptom-note"
                  type="text"
                  value={symptomSummary}
                  onChange={(e) => setSymptomSummary(e.target.value)}
                  placeholder="e.g. Follow-up on blurry vision and dark spots in right eye..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              {bookingError && (
                <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  {bookingError}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  id="confirm-booking-btn"
                  type="button"
                  onClick={handleConfirmBooking}
                  disabled={isSubmitting}
                  className="w-full sm:flex-1 rounded-xl bg-teal-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-teal-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                >
                  {isSubmitting ? 'Requesting appointment…' : 'Confirm & Request Appointment →'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSlotId(null)}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto rounded-xl border border-slate-700 bg-slate-800/80 px-6 py-3.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ─── Patient Reviews & Ratings Section ────────────────────────────── */}
        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 mb-6 gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Patient Reviews & Ratings</h2>
                <span className="rounded-md bg-teal-500/15 px-2 py-0.5 text-[10px] font-semibold text-teal-300 border border-teal-500/20">
                  ✓ Verified Consultations
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Authentic feedback from patients who completed consultations with {doctor.name}.
              </p>
            </div>
            {avgRating && (
              <div className="text-right">
                <span className="text-2xl font-black text-amber-400">★ {avgRating}</span>
                <span className="text-xs text-slate-400 block">
                  {doctor.reviews.length} {doctor.reviews.length === 1 ? 'review' : 'reviews'}
                </span>
              </div>
            )}
          </div>

          {/* Rating Breakdown / Summary Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 rounded-xl border border-slate-800/80 bg-slate-800/30 p-5 mb-8">
            {/* Score & Stars */}
            <div className="flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-slate-800/80 pb-4 md:pb-0 md:pr-4">
              <span className="text-4xl font-extrabold text-white">
                {avgRating ?? '—'}
              </span>
              <div className="flex items-center gap-1 my-1 text-amber-400 text-lg">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star}>
                    {avgRating && star <= Math.round(Number(avgRating)) ? '★' : '☆'}
                  </span>
                ))}
              </div>
              <span className="text-xs text-slate-400">
                {doctor.reviews.length > 0
                  ? `Based on ${doctor.reviews.length} verified ${doctor.reviews.length === 1 ? 'review' : 'reviews'}`
                  : 'No reviews yet'}
              </span>
              <span className="mt-2 text-[10px] text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                100% Verified Visits Only
              </span>
            </div>

            {/* Distribution Bars */}
            <div className="md:col-span-2 space-y-1.5 justify-center flex flex-col">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = starDistribution[star] || 0;
                const total = doctor.reviews.length || 1;
                const percentage = doctor.reviews.length > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={star} className="flex items-center gap-3 text-xs">
                    <span className="w-12 text-slate-400 text-right">{star} ★</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-16 text-[11px] text-slate-400 text-right">
                      {count} ({percentage}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Individual Reviews List */}
          {sortedReviews.length === 0 ? (
            <div className="rounded-xl border border-slate-800/80 bg-slate-800/20 p-8 text-center text-slate-400 text-xs">
              <p className="text-sm font-medium text-slate-300">No patient reviews yet.</p>
              <p className="mt-1 text-slate-500">
                Reviews appear here once patients complete their consultations with this doctor.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Recent Patient Feedback ({sortedReviews.length})
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {sortedReviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="rounded-xl border border-slate-800 bg-slate-800/40 p-4 transition hover:border-slate-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center text-amber-400 text-xs">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <span key={s}>{s <= rev.rating ? '★' : '☆'}</span>
                          ))}
                        </div>
                        <span className="rounded bg-teal-500/10 px-1.5 py-0.5 text-[10px] font-medium text-teal-300 border border-teal-500/20">
                          ✓ Verified Patient
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {formatReviewDate(rev.created_at)}
                      </span>
                    </div>
                    {rev.comment ? (
                      <p className="text-xs leading-relaxed text-slate-200">
                        &ldquo;{rev.comment}&rdquo;
                      </p>
                    ) : (
                      <p className="text-[11px] italic text-slate-500">
                        Rated {rev.rating} out of 5 stars without written comments.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function DoctorDetailPage() {
  return (
    <RequireRole role="patient">
      <Suspense
        fallback={
          <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-teal-400" />
              <span>Loading doctor detail…</span>
            </div>
          </main>
        }
      >
        <DoctorDetailPageContent />
      </Suspense>
    </RequireRole>
  );
}
