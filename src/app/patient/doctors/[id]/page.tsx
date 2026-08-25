'use client';

import { Suspense, useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import RequireRole from '@/components/RequireRole';
import { supabase } from '@/lib/supabaseClient';
import { getPlainSpecialtyInfo } from '@/lib/specialtyHelpers';
import { IconStar, IconCheck } from '@/components/Icons';
import DoctorAvatar from '@/components/DoctorAvatar';

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
  verification_status: 'pending' | 'verified' | 'rejected';
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

  // Booking interaction states -- clinic is chosen first (Step A), which
  // scopes which slots Step B shows (Task 7.4).
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [symptomSummary, setSymptomSummary] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);

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
            verification_status,
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
          // Only doctors who've cleared HITL license review are viewable
          // (migration 0008 / Task 7.2) -- a stale/bookmarked link to a
          // pending or rejected doctor falls through to the existing
          // "Doctor Profile Not Found" branch via .single()'s zero-row error.
          .eq('verification_status', 'verified')
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
          verification_status: data.verification_status,
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

  // Step A resolves to a clinic before Step B ever shows slots -- when the
  // doctor only has one clinic there's nothing to choose, so it's picked
  // automatically and the picker UI never renders (Task 7.4).
  const effectiveClinicId = useMemo(() => {
    if (selectedClinicId) return selectedClinicId;
    if (doctor?.clinics.length === 1) return doctor.clinics[0].id;
    return null;
  }, [selectedClinicId, doctor]);

  const selectedClinic = useMemo(() => {
    if (!doctor || !effectiveClinicId) return null;
    return doctor.clinics.find((c) => c.id === effectiveClinicId) || null;
  }, [doctor, effectiveClinicId]);

  function handleSelectClinic(clinicId: string) {
    setSelectedClinicId(clinicId);
    // Changing clinic invalidates whatever slot was picked for the old one.
    setSelectedSlotId(null);
    setBookingError(null);
  }

  // Group open available schedule slots for the chosen clinic by Date --
  // Step B doesn't render at all until a clinic is chosen (see JSX below).
  const groupedSlots = useMemo(() => {
    if (!doctor || !effectiveClinicId) return {};
    const todayStr = new Date().toISOString().split('T')[0];

    const available = (doctor.schedule_slots || [])
      .filter((s) => s.clinic_id === effectiveClinicId && s.is_booked === 'available' && s.date >= todayStr)
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
  }, [doctor, effectiveClinicId]);

  const selectedSlot = useMemo(() => {
    if (!doctor || !selectedSlotId) return null;
    return doctor.schedule_slots.find((s) => s.id === selectedSlotId) || null;
  }, [doctor, selectedSlotId]);

  // Auto-scroll the confirmation box into view on selection -- it can be
  // far below a long, multi-date slot grid otherwise.
  useEffect(() => {
    if (selectedSlotId) {
      confirmationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedSlotId]);

  // Star rating distribution computation
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

  // Sorted reviews list computation
  const sortedReviews = useMemo(() => {
    if (!doctor?.reviews) return [];
    return [...doctor.reviews].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [doctor]);

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

  // Render: Loading State
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12 text-slate-500">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          <span className="text-sm font-medium">Loading doctor profile…</span>
        </div>
      </main>
    );
  }

  // Render: Error State
  if (error || !doctor) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-bold text-rose-700">Doctor Profile Not Found</h2>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            {error || "The requested doctor profile could not be found or has been moved."}
          </p>
          <a
            href="/patient/doctors"
            className="mt-6 inline-block rounded-2xl bg-brand-600 px-6 py-3 text-xs font-bold text-white transition hover:bg-brand-700"
          >
            Return to doctor list
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

  const datesWithSlots = Object.keys(groupedSlots);

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between border-b border-slate-200/80 pb-4">
          <a
            href={`/patient/doctors?specialty=${encodeURIComponent(
              doctor.specialty
            )}${
              doctor.sub_specialty
                ? `&sub_specialty=${encodeURIComponent(doctor.sub_specialty)}`
                : ''
            }${patientHmo ? `&hmo=${encodeURIComponent(patientHmo)}` : ''}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition"
          >
            Back to doctor list
          </a>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700 border border-brand-100">
            Doctor Profile & Booking
          </span>
        </div>

        {/* Doctor Hero Profile Card */}
        <div className="relative overflow-hidden card p-6 sm:p-8">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-stretch sm:justify-between gap-6">
            <div className="flex flex-1 gap-5">
              <DoctorAvatar name={doctor.name} id={doctor.id} size={88} className="mt-1" />
              <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  {doctor.name}
                </h1>
                {doctor.verification_status === 'verified' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700 border border-brand-100 shadow-xs">
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
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-bold text-brand-700 text-lg">
                  {doctor.specialty}
                </span>
                {doctor.sub_specialty && (
                  <>
                    <span className="text-slate-400">•</span>
                    <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-800">
                      {doctor.sub_specialty}
                    </span>
                  </>
                )}
                {avgRating !== null ? (
                  <>
                    <span className="text-slate-400">•</span>
                    <span className="inline-flex items-center gap-1 font-bold text-amber-700 text-sm bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                      <IconStar className="h-3.5 w-3.5" /> {avgRating} ({doctor.reviews.length} {doctor.reviews.length === 1 ? 'review' : 'reviews'})
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-slate-400">•</span>
                    <span className="inline-flex items-center gap-1 text-slate-600 text-sm">
                      <IconStar className="h-3.5 w-3.5" filled={false} /> New Doctor
                    </span>
                  </>
                )}
              </div>

              {/* Plain-language subtitle, only when the specialty name
                  itself is clinical enough to need translating. */}
              {(() => {
                const plain = getPlainSpecialtyInfo(doctor.specialty);
                if (!plain) return null;
                return (
                  <p className="mt-2 text-sm text-slate-700">
                    <span className="text-brand-700 font-semibold">{plain.plainName}</span>
                    <span className="text-slate-400 mx-1.5">•</span>
                    <span className="italic text-slate-600">{plain.tagalogName}</span>
                  </p>
                );
              })()}

              {/* Credentials / Bio */}
              {doctor.credentials && (
                <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Credentials & Experience
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                    {doctor.credentials}
                  </p>
                </div>
              )}
              </div>
            </div>

            {/* HMO Coverage Status Card */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 sm:w-64 shrink-0 text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-500 text-xs block">
                HMO Accreditations
              </span>
              {isHmoCovered && patientHmo ? (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-sm">
                  <IconCheck className="h-3.5 w-3.5" />
                  <span>Covered by {patientHmo}</span>
                </div>
              ) : patientHmo ? (
                <div className="mt-2 rounded-xl bg-white p-2.5 text-slate-700 border border-amber-200 shadow-sm">
                  <span className="text-xs text-amber-800 block font-bold">Not in {patientHmo} network</span>
                  <span className="text-xs text-slate-500 mt-0.5 block">Direct cash rate applies.</span>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-1.5">
                {doctor.hmo_accreditations && doctor.hmo_accreditations.length > 0 ? (
                  doctor.hmo_accreditations.map((hmo) => (
                    <span
                      key={hmo}
                      className="rounded-xl bg-white px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200/80 shadow-sm"
                    >
                      {hmo}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500 text-xs">No HMO listed (Cash only)</span>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Schedule Slots Picker Section */}
        <div className="mt-8 card p-6 sm:p-8">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Book a Consultation</h2>
              <p className="mt-1 text-xs text-slate-500">
                {doctor.clinics.length > 1
                  ? 'Choose a clinic, then an open schedule time to request your appointment.'
                  : 'Choose an open schedule time to request your appointment.'}
              </p>
            </div>
            {selectedSlot && (
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700 border border-brand-100">
                Slot Selected
              </span>
            )}
          </div>

          {/* Step 1: Clinic -- skipped entirely when the doctor only
              practices at one location. */}
          {doctor.clinics.length > 1 && (
            <div className="mb-7">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Step 1 · Choose a Clinic
              </h3>
              <div role="radiogroup" aria-label="Select a clinic" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {doctor.clinics.map((clinic) => {
                  const isSelected = effectiveClinicId === clinic.id;
                  return (
                    <button
                      key={clinic.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={isSubmitting}
                      onClick={() => handleSelectClinic(clinic.id)}
                      className={`fluid-hover flex flex-col items-start rounded-2xl p-4 text-left focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                        isSelected
                          ? 'bg-brand-600 text-white font-bold shadow-md ring-2 ring-brand-500/40'
                          : 'bg-white border border-slate-200/80 text-slate-800 hover:border-brand-300 hover:bg-brand-50/40 shadow-xs'
                      }`}
                    >
                      <span className="text-sm font-bold">{clinic.name}</span>
                      {clinic.room_details && (
                        <span className={`text-xs mt-0.5 ${isSelected ? 'text-brand-100' : 'text-slate-500'}`}>
                          {clinic.room_details}
                        </span>
                      )}
                      <span className={`text-xs mt-0.5 ${isSelected ? 'text-brand-100' : 'text-slate-500'}`}>
                        {clinic.location}
                      </span>
                      <span className={`text-xs mt-1.5 font-bold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                        ₱{Number(clinic.consultation_fee).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Time slot -- only once a clinic is resolved. */}
          {!effectiveClinicId ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-8 text-center text-slate-500 text-sm">
              <p className="font-medium">Choose a clinic above to see its open schedule.</p>
            </div>
          ) : datesWithSlots.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-8 text-center text-slate-500 text-sm">
              <p className="font-medium">No available appointment slots posted for this clinic at this time.</p>
              <p className="mt-1 text-xs text-slate-500">Please check back later or contact the clinic directly.</p>
            </div>
          ) : (
            <div role="radiogroup" aria-label="Select a consultation slot" className="space-y-6">
              {datesWithSlots.map((dateStr) => {
                const slotsForDate = groupedSlots[dateStr];
                return (
                  <div key={dateStr} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:p-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-brand-700 mb-3.5">
                      {formatDateHeader(dateStr)}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {slotsForDate.map((slot) => {
                        const isSelected = selectedSlotId === slot.id;
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            disabled={isSubmitting}
                            onClick={() => {
                              if (isSubmitting) return;
                              setSelectedSlotId(slot.id);
                              setBookingError(null);
                            }}
                            className={`fluid-hover flex flex-col items-start rounded-2xl p-4 min-h-[58px] text-left focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                              isSelected
                                ? 'bg-brand-600 text-white font-bold shadow-md ring-2 ring-brand-500/40'
                                : 'bg-white border border-slate-200/80 text-slate-800 hover:border-brand-300 hover:bg-brand-50/40 shadow-xs'
                            }`}
                          >
                            <span className="text-sm font-bold">
                              {formatTime(slot.start_time)} to {formatTime(slot.end_time)}
                            </span>
                            <span
                              className={`text-xs mt-1 font-medium ${
                                isSelected ? 'text-slate-200' : 'text-emerald-700 font-bold'
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
            <div ref={confirmationRef} className="mt-8 rounded-2xl border border-brand-100 bg-brand-50/50 p-6 sm:p-7">
              <h3 className="text-base font-bold text-slate-900 mb-2">Confirm Your Booking</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-700 mb-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <div>
                  <span className="text-slate-400 block text-xs font-medium">Selected Time:</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">
                    {formatDateHeader(selectedSlot.date)} at {formatTime(selectedSlot.start_time)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-xs font-medium">Clinic Location:</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">
                    {selectedClinic?.name || 'Clinic'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-xs font-medium">Coverage / Rate:</span>
                  <span className="font-bold text-brand-700 mt-0.5 block">
                    {isHmoCovered ? `Covered by ${patientHmo}` : `₱${Number(selectedClinic?.consultation_fee || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} (Cash)`}
                  </span>
                </div>
              </div>

              {/* Optional brief symptom note */}
              <div className="mb-4">
                <label htmlFor="symptom-note" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Reason for Consultation / Symptom Note (Optional)
                </label>
                <input
                  id="symptom-note"
                  type="text"
                  value={symptomSummary}
                  onChange={(e) => setSymptomSummary(e.target.value)}
                  placeholder="e.g. Follow-up on blurry vision and dark spots in right eye..."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              {bookingError && (
                <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-700">
                  {bookingError}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  id="confirm-booking-btn"
                  type="button"
                  onClick={handleConfirmBooking}
                  disabled={isSubmitting}
                  className="w-full sm:flex-1 rounded-2xl bg-brand-600 px-8 py-4 text-base font-semibold text-white shadow-md transition hover:bg-brand-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                >
                  {isSubmitting ? 'Requesting appointment…' : 'Confirm & Request Appointment'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSlotId(null);
                    setSymptomSummary('');
                    setBookingError(null);
                  }}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Patient Reviews & Ratings Section */}
        <div className="mt-8 card p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 mb-6 gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">Patient Reviews & Ratings</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700 border border-brand-100">
                  <IconCheck className="h-3 w-3" /> Verified Visits
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Authentic feedback from patients who completed consultations with {doctor.name}.
              </p>
            </div>
            {avgRating && (
              <div className="text-right">
                <span className="inline-flex items-center gap-1 text-2xl font-bold text-amber-500">
                  <IconStar className="h-5 w-5" /> {avgRating}
                </span>
                <span className="text-xs text-slate-500 block font-medium">
                  {doctor.reviews.length} {doctor.reviews.length === 1 ? 'review' : 'reviews'}
                </span>
              </div>
            )}
          </div>

          {/* Rating Breakdown / Summary Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 rounded-2xl border border-slate-100 bg-slate-50/80 p-5 mb-8">
            {/* Score & Stars */}
            <div className="flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-slate-200/80 pb-4 md:pb-0 md:pr-4">
              <span className="text-4xl font-bold text-slate-900">
                {avgRating ?? 'N/A'}
              </span>
              <div className="flex items-center gap-1 my-1 text-amber-500 text-lg">
                {[1, 2, 3, 4, 5].map((star) => (
                  <IconStar
                    key={star}
                    className="h-4 w-4"
                    filled={Boolean(avgRating) && star <= Math.round(Number(avgRating))}
                  />
                ))}
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {doctor.reviews.length > 0
                  ? `Based on ${doctor.reviews.length} verified ${doctor.reviews.length === 1 ? 'review' : 'reviews'}`
                  : 'No reviews yet'}
              </span>
              <span className="mt-2 text-xs text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-100 font-bold">
                100% Verified Patients
              </span>
            </div>

            {/* Distribution Bars */}
            <div className="md:col-span-2 space-y-2 justify-center flex flex-col">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = starDistribution[star] || 0;
                const total = doctor.reviews.length || 1;
                const percentage = doctor.reviews.length > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={star} className="flex items-center gap-3 text-xs">
                    <span className="w-12 inline-flex items-center justify-end gap-1 text-slate-600 text-right font-medium">
                      {star} <IconStar className="h-3 w-3" />
                    </span>
                    <div className="flex-1 h-2.5 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-16 text-xs text-slate-500 text-right font-medium">
                      {count} ({percentage}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Individual Reviews List */}
          {sortedReviews.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-8 text-center text-slate-500 text-xs">
              <p className="text-sm font-semibold text-slate-800">No patient reviews yet.</p>
              <p className="mt-1 text-slate-400">
                Reviews appear here once patients complete their consultations with this doctor.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Recent Patient Feedback ({sortedReviews.length})
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {sortedReviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5 text-amber-500 text-xs">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <IconStar key={s} className="h-3.5 w-3.5" filled={s <= rev.rating} />
                          ))}
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700 border border-brand-100">
                          <IconCheck className="h-3 w-3" /> Verified Visit
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {formatReviewDate(rev.created_at)}
                      </span>
                    </div>
                    {rev.comment ? (
                      <p className="text-xs leading-relaxed text-slate-700 font-medium">
                        &ldquo;{rev.comment}&rdquo;
                      </p>
                    ) : (
                      <p className="text-xs italic text-slate-400">
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
          <main className="flex min-h-screen items-center justify-center text-slate-500">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
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
