'use client';

// src/app/patient/appointments/[id]/review/page.tsx
//
// Task 5.1. Verified Patient Reviews & Rating Submission
//
// PRD Section 8.6 specifies a verified-visit-only review system:
// Patients can only submit a review if they have a completed appointment
// (status = 'completed') with that doctor.
//
// Gating & Verification:
// 1. Authenticated user must be a patient (RequireRole).
// 2. appointment.patient_id === user.id (defense-in-depth on top of RLS).
// 3. appointment.status === 'completed' (blocks pending, confirmed, declined, cancelled).
// 4. One review per appointment (checked via DB and unique constraint).

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import RequireRole from '@/components/RequireRole';
import { supabase } from '@/lib/supabaseClient';
import { IconWarning, IconClose, IconCheck, IconStar } from '@/components/Icons';

interface AppointmentDetail {
  id: string;
  patient_id: string;
  doctor_id: string;
  status: string;
  created_at: string;
  doctor: {
    id: string;
    name: string;
    specialty: string;
    sub_specialty: string | null;
  } | null;
  slot: {
    date: string;
    start_time: string;
    clinic: {
      name: string;
      location: string;
    } | null;
  } | null;
}

interface ExistingReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Poor Experience',
  2: 'Fair / Room for Improvement',
  3: 'Good / Satisfactory',
  4: 'Very Good / Attentive Care',
  5: 'Excellent / Highly Recommended',
};

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function ReviewPageContent() {
  const params = useParams();
  const router = useRouter();
  const appointmentId = Array.isArray(params.id) ? params.id[0] : (params.id as string);

  const [appointment, setAppointment] = useState<AppointmentDetail | null>(null);
  const [existingReview, setExistingReview] = useState<ExistingReview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  // Form State
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedSuccessfully, setSubmittedSuccessfully] = useState<boolean>(false);

  useEffect(() => {
    if (!appointmentId) {
      setErrorStatus('not_found');
      setLoading(false);
      return;
    }

    async function loadData() {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErrorStatus('unauthenticated');
        setLoading(false);
        return;
      }

      // Fetch appointment with joined doctor, slot, clinic
      const { data: appt, error: apptError } = await supabase
        .from('appointments')
        .select(`
          id,
          patient_id,
          doctor_id,
          status,
          created_at,
          doctors (
            id,
            name,
            specialty,
            sub_specialty
          ),
          schedule_slots (
            date,
            start_time,
            clinics (
              name,
              location
            )
          )
        `)
        .eq('id', appointmentId)
        .maybeSingle();

      if (apptError || !appt) {
        setErrorStatus('not_found');
        setLoading(false);
        return;
      }

      // Defense-in-depth: patient ownership
      if (appt.patient_id !== user.id) {
        setErrorStatus('unauthorized');
        setLoading(false);
        return;
      }

      // Verified visit rule: appointment must be completed
      if (appt.status !== 'completed') {
        setErrorStatus(`not_completed:${appt.status}`);
        setAppointment({
          id: appt.id,
          patient_id: appt.patient_id,
          doctor_id: appt.doctor_id,
          status: appt.status,
          created_at: appt.created_at,
          doctor: Array.isArray(appt.doctors) ? appt.doctors[0] : (appt.doctors as any),
          slot: null,
        });
        setLoading(false);
        return;
      }

      // Check if a review was already submitted
      const { data: rev } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at')
        .eq('appointment_id', appointmentId)
        .maybeSingle();

      if (rev) {
        setExistingReview(rev);
      }

      const slot = Array.isArray(appt.schedule_slots) ? appt.schedule_slots[0] : (appt.schedule_slots as any);
      const clinic = slot ? (Array.isArray(slot.clinics) ? slot.clinics[0] : (slot.clinics as any)) : null;

      setAppointment({
        id: appt.id,
        patient_id: appt.patient_id,
        doctor_id: appt.doctor_id,
        status: appt.status,
        created_at: appt.created_at,
        doctor: Array.isArray(appt.doctors) ? appt.doctors[0] : (appt.doctors as any),
        slot: slot
          ? {
              date: slot.date,
              start_time: slot.start_time,
              clinic: clinic ? { name: clinic.name, location: clinic.location } : null,
            }
          : null,
      });

      setLoading(false);
    }

    loadData();
  }, [appointmentId]);

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!appointment || submitting || rating < 1 || rating > 5) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('You must be signed in as a patient to submit a review.');
      }

      const { data: newReview, error: insertError } = await supabase
        .from('reviews')
        .insert({
          appointment_id: appointment.id,
          patient_id: user.id,
          doctor_id: appointment.doctor_id,
          rating,
          comment: comment.trim() || null,
        })
        .select('id, rating, comment, created_at')
        .single();

      if (insertError) {
        if (insertError.code === '23505' || insertError.message.includes('unique')) {
          throw new Error('A review has already been submitted for this appointment.');
        }
        throw insertError;
      }

      setExistingReview(newReview);
      setSubmittedSuccessfully(true);
    } catch (err: any) {
      console.error('Review submission error:', err);
      setSubmitError(err.message || 'Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // Loading State
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12 text-slate-500">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          <span className="text-sm font-medium">Verifying consultation status…</span>
        </div>
      </main>
    );
  }

  // Blocked State: Not Completed
  if (errorStatus && errorStatus.startsWith('not_completed')) {
    const rawStatus = errorStatus.split(':')[1] || 'pending';
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-lg card p-5 sm:p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <IconWarning className="h-8 w-8" />
          </div>

          <span className="mt-4 inline-block rounded-full bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-800 border border-amber-200">
            Verified-Visit Only
          </span>

          <h1 className="mt-2 text-xl sm:text-2xl font-bold text-slate-900">Review Unavailable</h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            To ensure authentic, high-quality patient feedback, reviews can only be submitted after your consultation has been marked as{' '}
            <strong className="text-emerald-700 font-bold">completed</strong> by the clinic.
          </p>

          <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-xs text-slate-600 space-y-2">
            <div className="flex justify-between items-center">
              <span>Appointment ID:</span>
              <span className="font-mono text-slate-900 font-semibold">{appointmentId.slice(0, 8)}…</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Current Status:</span>
              <span className="capitalize font-bold text-amber-800 bg-amber-100/60 px-2.5 py-0.5 rounded-full">
                {rawStatus}
              </span>
            </div>
            {appointment?.doctor && (
              <div className="flex justify-between items-center">
                <span>Doctor:</span>
                <span className="font-bold text-slate-900">{appointment.doctor.name}</span>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <a
              href="/patient/dashboard"
              className="w-full rounded-2xl bg-brand-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-brand-700"
            >
              Return to Patient Dashboard
            </a>
            {appointment?.doctor && (
              <a
                href={`/patient/doctors/${appointment.doctor.id}`}
                className="w-full card px-6 py-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                View Doctor Profile
              </a>
            )}
          </div>
        </div>
      </main>
    );
  }

  // Error State: Not Found / Unauthorized
  if (errorStatus || !appointment) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12 text-center">
        <div className="w-full max-w-md card p-5 sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <IconClose className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-lg font-bold text-slate-900">Consultation Not Found</h1>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            This appointment could not be verified or does not belong to your account.
          </p>
          <a
            href="/patient/dashboard"
            className="mt-6 inline-block rounded-2xl bg-brand-600 px-6 py-3 text-xs font-bold text-white transition hover:bg-brand-700"
          >
            Return to Dashboard
          </a>
        </div>
      </main>
    );
  }

  const activeStars = hoverRating !== null ? hoverRating : rating;

  // Render: Review Already Submitted / Success State
  if (existingReview || submittedSuccessfully) {
    const rev = existingReview!;
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-lg card p-5 sm:p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <IconCheck className="h-8 w-8" />
          </div>

          <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-brand-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-brand-700 border border-brand-100">
            Verified Review Submitted
          </span>

          <h1 className="mt-2 text-xl sm:text-2xl font-bold text-slate-900">Thank You For Your Feedback!</h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Your review for <span className="font-bold text-slate-900">{appointment.doctor?.name}</span> helps other patients make informed healthcare choices.
          </p>

          {/* Submitted Review Card */}
          <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/80 p-5 text-left text-xs space-y-3 text-slate-700">
            <div className="flex items-center justify-between gap-3">
              <div className="flex shrink-0 items-center gap-1 text-amber-500">
                {[1, 2, 3, 4, 5].map((star) => (
                  <IconStar key={star} className="h-4.5 w-4.5" filled={star <= rev.rating} />
                ))}
              </div>
              <span className="text-right text-xs text-slate-500 font-medium">
                {RATING_LABELS[rev.rating]}
              </span>
            </div>

            {rev.comment && (
              <p className="border-t border-slate-200/60 pt-3 text-xs italic text-slate-700 leading-relaxed font-medium">
                &ldquo;{rev.comment}&rdquo;
              </p>
            )}

            <div className="border-t border-slate-200/60 pt-2 flex justify-between text-xs text-slate-500 font-medium">
              <span>Doctor: {appointment.doctor?.name}</span>
              <span>{formatDate(appointment.slot?.date || rev.created_at.split('T')[0])}</span>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            {appointment.doctor && (
              <a
                href={`/patient/doctors/${appointment.doctor.id}`}
                className="w-full rounded-2xl bg-brand-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-brand-700"
              >
                View Doctor Profile & Ratings
              </a>
            )}
            <a
              href="/patient/dashboard"
              className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Return to Patient Dashboard
            </a>
          </div>
        </div>
      </main>
    );
  }

  // Render: Review Form
  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between border-b border-slate-200/80 pb-4">
          <a
            href="/patient/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition"
          >
            Back to dashboard
          </a>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700 border border-brand-100">
            Verified Patient Review
          </span>
        </div>

        {/* Form Container */}
        <div className="card p-5 sm:p-8">
          <div className="text-center">
            <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-700 border border-brand-100">
              Verified Consultation
            </span>
            <h1 className="mt-3 text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              How was your consultation?
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Share your experience with{' '}
              <strong className="text-slate-900 font-bold">{appointment.doctor?.name}</strong>{' '}
              ({appointment.doctor?.specialty}
              {appointment.doctor?.sub_specialty ? `, ${appointment.doctor?.sub_specialty}` : ''})
            </p>

            {appointment.slot && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-2 text-xs text-slate-600 border border-slate-100 font-medium">
                <span>{formatDate(appointment.slot.date)}</span>
                {appointment.slot.clinic && (
                  <>
                    <span>•</span>
                    <span>{appointment.slot.clinic.name}</span>
                  </>
                )}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmitReview} className="mt-8 space-y-6">
            {/* Interactive Star Rating Picker */}
            <div>
              <label className="block text-center text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Overall Rating (Required)
              </label>
              <div className="flex items-center justify-center gap-3">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isFilled = star <= activeStars;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      className="group p-2 min-h-[48px] min-w-[48px] transition transform active:scale-125 focus:outline-none rounded-2xl"
                      aria-label={`${star} star`}
                    >
                      <IconStar
                        className={`h-9 w-9 sm:h-11 sm:w-11 transition-colors duration-150 ${
                          isFilled
                            ? 'text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]'
                            : 'text-slate-200 group-hover:text-slate-300'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Rating Label Text */}
              <p className="mt-3 text-center text-sm font-bold text-amber-600">
                {RATING_LABELS[activeStars]}
              </p>
            </div>

            {/* Written Comment Textarea */}
            <div>
              <label htmlFor="review-comment" className="block text-sm font-semibold text-slate-700 mb-2">
                Written Feedback & Experience (Optional)
              </label>
              <textarea
                id="review-comment"
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="How was the doctor's communication? Was the clinic staff helpful? Did the consultation address your concerns?"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm leading-relaxed text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
              />
              <p className="mt-1.5 text-right text-xs text-slate-500 font-medium">
                {comment.length} / 1000 characters
              </p>
            </div>

            {submitError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-700">
                {submitError}
              </div>
            )}

            {/* Submit & Cancel Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:flex-1 rounded-2xl bg-brand-600 px-8 py-4 text-base font-semibold text-white shadow-md transition hover:bg-brand-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              >
                {submitting ? 'Submitting review…' : 'Submit Verified Review'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/patient/dashboard')}
                disabled={submitting}
                className="w-full sm:w-auto rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function ReviewPage() {
  return (
    <RequireRole role="patient">
      <Suspense
        fallback={
          <main className="flex min-h-screen items-center justify-center text-slate-500">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
              <span className="text-sm font-medium">Loading consultation review…</span>
            </div>
          </main>
        }
      >
        <ReviewPageContent />
      </Suspense>
    </RequireRole>
  );
}
