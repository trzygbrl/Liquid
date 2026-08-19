'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import RequireRole from '@/components/RequireRole';
import { supabase } from '@/lib/supabaseClient';

interface ScheduleSlot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_booked: 'available' | 'booked' | 'doctor_on_leave';
}

interface Clinic {
  id: string;
  name: string;
  location: string;
  room_details: string | null;
  consultation_fee: number;
  schedule_slots: ScheduleSlot[];
}

interface Doctor {
  id: string;
  name: string;
  credentials: string | null;
  specialty: string;
  sub_specialty: string | null;
  hmo_accreditations: string[];
  verified: boolean;
  clinics: Clinic[];
}

function formatTime(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function BookingContent() {
  const router = useRouter();
  const params = useParams<{ doctorId: string }>();
  const doctorId = params.doctorId;

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [symptomSummary, setSymptomSummary] = useState('');
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/patient/auth');
  }

  const loadDoctor = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const { data, error } = await supabase
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
          location,
          room_details,
          consultation_fee,
          schedule_slots ( id, date, start_time, end_time, is_booked )
        )
      `
      )
      .eq('id', doctorId)
      .single();

    if (error) {
      setLoadError(error.message);
      setDoctor(null);
    } else {
      const loaded = data as unknown as Doctor;
      setDoctor(loaded);
      setSelectedClinicId((prev) => prev ?? loaded.clinics[0]?.id ?? null);
    }
    setLoading(false);
  }, [doctorId]);

  useEffect(() => {
    loadDoctor();
  }, [loadDoctor]);

  const selectedClinic = useMemo(
    () => doctor?.clinics.find((c) => c.id === selectedClinicId) ?? null,
    [doctor, selectedClinicId]
  );

  const slotsByDate = useMemo(() => {
    if (!selectedClinic) return [];
    const today = new Date().toISOString().slice(0, 10);
    const available = selectedClinic.schedule_slots
      .filter((s) => s.is_booked === 'available' && s.date >= today)
      .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));

    const groups: { date: string; slots: ScheduleSlot[] }[] = [];
    for (const slot of available) {
      const group = groups.find((g) => g.date === slot.date);
      if (group) {
        group.slots.push(slot);
      } else {
        groups.push({ date: slot.date, slots: [slot] });
      }
    }
    return groups;
  }, [selectedClinic]);

  function handleSelectClinic(clinicId: string) {
    setSelectedClinicId(clinicId);
    setSelectedSlotId(null);
    setBookingError(null);
  }

  async function handleBook() {
    if (!selectedSlotId || !doctor) return;
    setBooking(true);
    setBookingError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setBookingError('You must be signed in to book an appointment.');
      setBooking(false);
      return;
    }

    const patientId = session.user.id;

    // Patient profile setup isn't built yet, so there may be no row in
    // `patients` for this user -- appointments.patient_id has an FK to it.
    // Create a minimal row (leaving intake fields blank) if one doesn't
    // already exist, without overwriting a real profile.
    const { error: patientError } = await supabase
      .from('patients')
      .upsert(
        { id: patientId, name: session.user.email ?? 'Patient' },
        { onConflict: 'id', ignoreDuplicates: true }
      );

    if (patientError) {
      setBookingError(patientError.message);
      setBooking(false);
      return;
    }

    const { error: appointmentError } = await supabase.from('appointments').insert({
      patient_id: patientId,
      doctor_id: doctor.id,
      slot_id: selectedSlotId,
      symptom_summary: symptomSummary.trim() || null,
    });

    setBooking(false);

    if (appointmentError) {
      setBookingError(
        appointmentError.code === '23505'
          ? 'That slot was just booked by someone else. Please pick another time.'
          : appointmentError.message
      );
      setSelectedSlotId(null);
      loadDoctor();
      return;
    }

    setBookingSuccess(true);
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 px-6 py-10">
      <div className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div>
          <span className="text-lg font-bold text-white">
            <span className="text-teal-400">Civic</span>Access
          </span>
          <h1 className="mt-1 text-2xl font-semibold text-white">Book an appointment</h1>
        </div>
        <button
          onClick={handleSignOut}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
        >
          Sign out
        </button>
      </div>

      <Link
        href="/patient/dashboard"
        className="mt-6 inline-flex w-fit items-center gap-1 text-sm text-slate-400 hover:text-teal-400"
      >
        ← Back to directory
      </Link>

      {loading && (
        <div className="mt-16 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-teal-500" />
        </div>
      )}

      {!loading && loadError && (
        <div className="mt-10 rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center text-sm text-red-400">
          Couldn&apos;t load this doctor: {loadError}
        </div>
      )}

      {!loading && !loadError && doctor && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Doctor header + clinic picker */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">{doctor.name}</h2>
                {doctor.verified && (
                  <span className="shrink-0 rounded-full bg-teal-500/10 px-2.5 py-1 text-xs font-medium text-teal-400">
                    Verified
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-teal-400">
                {doctor.specialty}
                {doctor.sub_specialty ? ` · ${doctor.sub_specialty}` : ''}
              </p>
              {doctor.credentials && (
                <p className="mt-2 text-xs text-slate-500">{doctor.credentials}</p>
              )}
              {doctor.hmo_accreditations.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {doctor.hmo_accreditations.map((hmo) => (
                    <span
                      key={hmo}
                      className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-300"
                    >
                      {hmo}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <p className="text-xs font-medium text-slate-400">Clinic</p>
              <div className="mt-3 flex flex-col gap-2">
                {doctor.clinics.map((clinic) => (
                  <button
                    key={clinic.id}
                    onClick={() => handleSelectClinic(clinic.id)}
                    className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                      selectedClinicId === clinic.id
                        ? 'border-teal-500 bg-teal-500/10 text-white'
                        : 'border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <span className="font-medium">{clinic.name}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      {clinic.location}
                      {clinic.room_details ? ` · ${clinic.room_details}` : ''}
                    </span>
                    <span className="mt-0.5 block text-xs text-teal-400">
                      ₱{Number(clinic.consultation_fee).toLocaleString()} consultation fee
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Slot picker + booking */}
          <div className="lg:col-span-2">
            {bookingSuccess ? (
              <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-8 text-center">
                <h3 className="text-lg font-semibold text-white">Appointment requested</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Your request has been sent to {doctor.name}. You&apos;ll be notified once it&apos;s
                  confirmed.
                </p>
                <Link
                  href="/patient/dashboard"
                  className="mt-6 inline-block rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-500"
                >
                  Back to directory
                </Link>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
                <p className="text-xs font-medium text-slate-400">Available times</p>

                {slotsByDate.length === 0 && (
                  <p className="mt-4 text-sm text-slate-500">
                    No upcoming availability at this clinic.
                  </p>
                )}

                <div className="mt-3 flex flex-col gap-4">
                  {slotsByDate.map(({ date, slots }) => (
                    <div key={date}>
                      <p className="text-sm font-medium text-slate-300">{formatDate(date)}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {slots.map((slot) => (
                          <button
                            key={slot.id}
                            onClick={() => setSelectedSlotId(slot.id)}
                            className={`rounded-lg border px-3 py-2 text-sm transition ${
                              selectedSlotId === slot.id
                                ? 'border-teal-500 bg-teal-500 text-white'
                                : 'border-slate-700 text-slate-300 hover:border-slate-500'
                            }`}
                          >
                            {formatTime(slot.start_time)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 border-t border-slate-800 pt-5">
                  <label htmlFor="symptom_summary" className="text-xs font-medium text-slate-400">
                    What&apos;s the reason for your visit? (optional)
                  </label>
                  <textarea
                    id="symptom_summary"
                    value={symptomSummary}
                    onChange={(e) => setSymptomSummary(e.target.value)}
                    rows={3}
                    placeholder="Briefly describe your symptoms or reason for the visit..."
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 transition"
                  />
                </div>

                {bookingError && (
                  <p className="mt-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-sm text-red-400">
                    {bookingError}
                  </p>
                )}

                <button
                  onClick={handleBook}
                  disabled={!selectedSlotId || booking}
                  className="mt-4 w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {booking ? 'Booking…' : 'Request appointment'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default function DoctorBookingPage() {
  return (
    <RequireRole role="patient">
      <BookingContent />
    </RequireRole>
  );
}
