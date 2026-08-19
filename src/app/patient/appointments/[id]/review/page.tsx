'use client';

// src/app/patient/appointments/[id]/review/page.tsx
//
// Task 5.1 — Verified Patient Reviews & Rating Submission
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
  1: '1 - Poor Experience',
  2: '2 - Fair / Room for Improvement',
  3: '3 - Good / Satisfactory',
  4: '4 - Very Good / Attentive Care',
  5: '5 - Excellent / Highly Recommended',
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

  // ─── Loading State ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-slate-400">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-teal-400" />
          <span>Verifying consultation status…</span>
        </div>
      </main>
    );
  }

  // ─── Blocked State: Not Completed ──────────────────────────────────────────
  if (errorStatus && errorStatus.startsWith('not_completed')) {
    const rawStatus = errorStatus.split(':')[1] || 'pending';
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12 sm:px-6">
        <div className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-slate-900/90 p-8 text-center shadow-2xl backdrop-blur">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>

          <span className="mt-4 inline-block rounded-md bg-amber-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-300 border border-amber-500/30">
            Verified-Visit Only
          </span>

          <h1 className="mt-2 text-2xl font-bold text-white">Review Unavailable</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            To ensure authentic, high-quality patient feedback, reviews can only be submitted after your consultation has been marked as{' '}
            <strong className="text-emerald-400">completed</strong> by the clinic.
          </p>

          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-800/50 p-4 text-xs text-slate-400 space-y-2">
            <div className="flex justify-between items-center">
              <span>Appointment ID:</span>
              <span className="font-mono text-slate-300">{appointmentId.slice(0, 8)}…</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Current Status:</span>
              <span className="capitalize font-semibold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded">
                {rawStatus}
              </span>
            </div>
            {appointment?.doctor && (
              <div className="flex justify-between items-center">
                <span>Doctor:</span>
                <span className="font-semibold text-white">{appointment.doctor.name}</span>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <a
              href="/patient/dashboard"
              className="w-full rounded-xl bg-teal-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-teal-500"
            >
              Return to Patient Dashboard →
            </a>
            {appointment?.doctor && (
              <a
                href={`/patient/doctors/${appointment.doctor.id}`}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-6 py-3 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                View Doctor Profile
              </a>
            )}
          </div>
        </div>
      </main>
    );
  }

  // ─── Error State: Not Found / Unauthorized ─────────────────────────────────
  if (errorStatus || !appointment) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12 text-center">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 text-slate-400">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="mt-4 text-lg font-bold text-white">Consultation Not Found</h1>
          <p className="mt-2 text-sm text-slate-400">
            This appointment could not be verified or does not belong to your account.
          </p>
          <a
            href="/patient/dashboard"
            className="mt-6 inline-block rounded-xl bg-slate-800 px-6 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-700"
          >
            ← Return to Dashboard
          </a>
        </div>
      </main>
    );
  }

  const activeStars = hoverRating !== null ? hoverRating : rating;

  // ─── Render: Review Already Submitted / Success State ──────────────────────
  if (existingReview || submittedSuccessfully) {
    const rev = existingReview!;
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12 sm:px-6">
        <div className="w-full max-w-lg rounded-2xl border border-teal-500/40 bg-slate-900/90 p-8 text-center shadow-2xl backdrop-blur">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-500/20 text-teal-400">
            <svg className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          <span className="mt-4 inline-block rounded-md bg-teal-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal-300 border border-teal-500/30">
            ✓ Verified Review Submitted
          </span>

          <h1 className="mt-2 text-2xl font-bold text-white">Thank You For Your Feedback!</h1>
          <p className="mt-2 text-sm text-slate-300">
            Your review for <span className="font-semibold text-white">{appointment.doctor?.name}</span> helps other patients make informed healthcare choices.
          </p>

          {/* Submitted Review Card */}
          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-800/60 p-5 text-left text-xs space-y-3 text-slate-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-amber-400">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} className="text-lg">
                    {star <= rev.rating ? '★' : '☆'}
                  </span>
                ))}
                <span className="ml-2 font-bold text-white">{rev.rating}.0 / 5.0</span>
              </div>
              <span className="text-[11px] text-slate-400">
                {RATING_LABELS[rev.rating]}
              </span>
            </div>

            {rev.comment && (
              <p className="border-t border-slate-700/60 pt-3 text-sm italic text-slate-200 leading-relaxed">
                &ldquo;{rev.comment}&rdquo;
              </p>
            )}

            <div className="border-t border-slate-700/60 pt-2 flex justify-between text-[11px] text-slate-400">
              <span>Doctor: {appointment.doctor?.name}</span>
              <span>{formatDate(appointment.slot?.date || rev.created_at.split('T')[0])}</span>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            {appointment.doctor && (
              <a
                href={`/patient/doctors/${appointment.doctor.id}`}
                className="w-full rounded-xl bg-teal-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-teal-500"
              >
                View Doctor Profile & Ratings →
              </a>
            )}
            <a
              href="/patient/dashboard"
              className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-6 py-3 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              Return to Patient Dashboard
            </a>
          </div>
        </div>
      </main>
    );
  }

  // ─── Render: Review Form ───────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between border-b border-slate-800 pb-4">
          <a
            href="/patient/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-400 transition hover:text-teal-300"
          >
            ← Back to dashboard
          </a>
          <span className="text-xs text-slate-500">Verified Patient Review</span>
        </div>

        {/* Form Container */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur sm:p-8">
          <div className="text-center">
            <span className="inline-block rounded-md bg-teal-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal-300 border border-teal-500/30">
              Verified Consultation
            </span>
            <h1 className="mt-3 text-2xl font-bold text-white">
              How was your consultation?
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Share your experience with{' '}
              <strong className="text-white">{appointment.doctor?.name}</strong>{' '}
              ({appointment.doctor?.specialty}
              {appointment.doctor?.sub_specialty ? ` — ${appointment.doctor?.sub_specialty}` : ''})
            </p>

            {appointment.slot && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-800/60 px-4 py-2 text-xs text-slate-400 border border-slate-800">
                <span>📅 {formatDate(appointment.slot.date)}</span>
                {appointment.slot.clinic && (
                  <>
                    <span>•</span>
                    <span>🏥 {appointment.slot.clinic.name}</span>
                  </>
                )}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmitReview} className="mt-8 space-y-6">
            {/* Interactive Star Rating Picker */}
            <div>
              <label className="block text-center text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Overall Rating (Required)
              </label>
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isFilled = star <= activeStars;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      className="group p-1.5 text-3xl sm:text-4xl transition transform active:scale-125 focus:outline-none"
                      aria-label={`${star} star`}
                    >
                      <span
                        className={`transition-colors duration-150 ${
                          isFilled
                            ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                            : 'text-slate-700 hover:text-slate-500'
                        }`}
                      >
                        ★
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Rating Label Text */}
              <p className="mt-2 text-center text-xs font-medium text-amber-300">
                {RATING_LABELS[activeStars]}
              </p>
            </div>

            {/* Written Comment Textarea */}
            <div>
              <label htmlFor="review-comment" className="block text-xs font-medium text-slate-300 mb-1.5">
                Written Feedback & Experience (Optional)
              </label>
              <textarea
                id="review-comment"
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="How was the doctor's communication? Was the clinic staff helpful? Did the consultation address your concerns?"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-xs leading-relaxed text-white placeholder-slate-500 outline-none transition focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
              <p className="mt-1 text-right text-[11px] text-slate-500">
                {comment.length} / 1000 characters
              </p>
            </div>

            {submitError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                {submitError}
              </div>
            )}

            {/* Submit & Cancel Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:flex-1 rounded-xl bg-teal-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-teal-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              >
                {submitting ? 'Submitting review…' : 'Submit Verified Review →'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/patient/dashboard')}
                disabled={submitting}
                className="w-full sm:w-auto rounded-xl border border-slate-700 bg-slate-800/80 px-6 py-3.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
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
          <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-teal-400" />
              <span>Loading consultation review…</span>
            </div>
          </main>
        }
      >
        <ReviewPageContent />
      </Suspense>
    </RequireRole>
  );
}
