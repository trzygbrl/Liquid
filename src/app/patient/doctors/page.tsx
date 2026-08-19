'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import RequireRole from '@/components/RequireRole';
import { supabase } from '@/lib/supabaseClient';
import {
  rankDoctors,
  type DoctorRecord,
  type RankedDoctor,
  type Clinic,
  type ScheduleSlot,
} from '@/lib/doctorRanking';

function DoctorListContent() {
  const searchParams = useSearchParams();

  // Query parameters from Task 3.4. No `specialty` param means "browse all
  // doctors" mode (reached from the dashboard's directory link) rather than
  // the AI-intake-driven ranked-match flow.
  const specialtyParam = searchParams.get('specialty');
  const browseAll = !specialtyParam;
  const initialSubSpecialty = searchParams.get('sub_specialty') || null;
  const initialHmo = searchParams.get('hmo') || null;

  const [doctors, setDoctors] = useState<DoctorRecord[]>([]);
  const [availableSubSpecialties, setAvailableSubSpecialties] = useState<string[]>([]);
  const [selectedSubSpecialty, setSelectedSubSpecialty] = useState<string | null>(initialSubSpecialty);
  const [patientHmo, setPatientHmo] = useState<string | null>(initialHmo);
  const [showAllHmo, setShowAllHmo] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Browse-all-mode-only filters (specialty-mode uses the sub-specialty
  // pills below instead, fed by specialtyParam).
  const [search, setSearch] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');

  // Sync state if searchParams change
  useEffect(() => {
    setSelectedSubSpecialty(searchParams.get('sub_specialty') || null);
    setPatientHmo(searchParams.get('hmo') || null);
  }, [searchParams]);

  // Fetch doctors and sub-specialty taxonomy on mount
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        // 1. Fetch sub-specialty list for filter pills (specialty mode only —
        // browse-all mode filters by specialty itself via a dropdown instead)
        if (specialtyParam) {
          const { data: taxonomyRows } = await supabase
            .from('specialty_taxonomy')
            .select('sub_specialty')
            .eq('specialty', specialtyParam)
            .order('sub_specialty');

          if (taxonomyRows) {
            const subs = Array.from(new Set(taxonomyRows.map((r) => r.sub_specialty)));
            setAvailableSubSpecialties(subs);
          }
        } else {
          setAvailableSubSpecialties([]);
        }

        // 2. Fetch doctors with clinics, slots, and reviews
        let doctorQuery = supabase
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
              rating
            )
          `
          );
        if (specialtyParam) {
          doctorQuery = doctorQuery.eq('specialty', specialtyParam);
        }
        const { data: doctorRows, error: docError } = await doctorQuery;

        if (docError) {
          throw docError;
        }

        // Cast nested Supabase relations
        const formattedDoctors: DoctorRecord[] = (doctorRows || []).map((d: any) => ({
          id: d.id,
          name: d.name,
          credentials: d.credentials,
          specialty: d.specialty,
          sub_specialty: d.sub_specialty,
          hmo_accreditations: Array.isArray(d.hmo_accreditations) ? d.hmo_accreditations : [],
          verified: Boolean(d.verified),
          clinics: Array.isArray(d.clinics) ? d.clinics : [],
          schedule_slots: Array.isArray(d.schedule_slots) ? d.schedule_slots : [],
          reviews: Array.isArray(d.reviews) ? d.reviews : [],
        }));

        setDoctors(formattedDoctors);
      } catch (err: any) {
        console.error('Failed to load doctors:', err);
        setError('Unable to load doctor profiles at this time.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [specialtyParam]);

  // Distinct specialties present in the fetched set, for the browse-all
  // mode's specialty dropdown.
  const availableSpecialties = useMemo(() => {
    if (!browseAll) return [];
    return Array.from(new Set(doctors.map((d) => d.specialty))).sort();
  }, [browseAll, doctors]);

  // Browse-all mode applies free-text + specialty-dropdown filtering
  // client-side; specialty mode is already filtered server-side.
  const visibleDoctors = useMemo(() => {
    if (!browseAll) return doctors;
    const query = search.trim().toLowerCase();
    return doctors.filter((d) => {
      if (specialtyFilter !== 'all' && d.specialty !== specialtyFilter) return false;
      if (!query) return true;
      const haystack = [
        d.name,
        d.specialty,
        d.sub_specialty ?? '',
        ...d.clinics.map((c) => c.name),
        ...d.clinics.map((c) => c.location),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [browseAll, doctors, search, specialtyFilter]);

  // Execute deterministic ranking algorithm (PRD 8.4) & HMO intelligence check (PRD 8.3)
  const { ranked, hasHmoMismatch, totalCount, exactMatchCount, coveredCount } = useMemo(() => {
    return rankDoctors(
      visibleDoctors,
      specialtyParam ?? '',
      selectedSubSpecialty,
      patientHmo,
      showAllHmo
    );
  }, [visibleDoctors, specialtyParam, selectedSubSpecialty, patientHmo, showAllHmo]);

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        {/* Navigation & Header */}
        <div className="mb-6 flex flex-col gap-2 border-b border-slate-800 pb-6">
          <div className="flex items-center justify-between">
            <a
              href={browseAll ? '/patient/dashboard' : '/patient/intake'}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-400 transition hover:text-teal-300"
            >
              ← {browseAll ? 'Back to dashboard' : 'Back to symptom check'}
            </a>
            <span className="text-xs text-slate-500">CivicAccess Clinical Directory</span>
          </div>

          <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
            {browseAll
              ? 'All Doctors'
              : selectedSubSpecialty
                ? `${specialtyParam} Specialists — ${selectedSubSpecialty}`
                : `All ${specialtyParam} Specialists`}
          </h1>
          <p className="text-sm text-slate-400">
            {browseAll
              ? 'Browse the full directory, or search by doctor, specialty, or clinic.'
              : 'Ranked by clinical sub-specialty match, HMO coverage, and next available consultation.'}
          </p>

          {/* Active search recap pills (specialty mode only) */}
          {!browseAll && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-md border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-slate-300">
                Specialty: <strong className="text-white">{specialtyParam}</strong>
              </span>
              {selectedSubSpecialty && (
                <span className="rounded-md border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-teal-300 font-medium">
                  Sub-specialty: {selectedSubSpecialty}
                </span>
              )}
              <span className="rounded-md border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-slate-300">
                Your HMO:{' '}
                <strong className={patientHmo ? 'text-teal-300' : 'text-slate-400'}>
                  {patientHmo || 'None (Cash Rates)'}
                </strong>
              </span>
            </div>
          )}
        </div>

        {/* HMO Intelligence Mismatch Banner (PRD Section 8.3) */}
        {hasHmoMismatch && (
          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-200">
                  HMO Network Notice
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-amber-100/90">
                  No <strong>{selectedSubSpecialty}</strong> doctors in your{' '}
                  <strong>{patientHmo}</strong> network match closely. Here are the top-rated{' '}
                  {selectedSubSpecialty} specialists in your area with estimated cash consultation rates.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filter & Control Bar */}
        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          {browseAll ? (
            /* Browse-all mode: free-text search + specialty dropdown */
            <div className="flex flex-1 flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by doctor, specialty, or clinic..."
                className="flex-1 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 transition"
              />
              <select
                value={specialtyFilter}
                onChange={(e) => setSpecialtyFilter(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 transition sm:w-64"
              >
                <option value="all">All specialties</option>
                {availableSpecialties.map((specialty) => (
                  <option key={specialty} value={specialty}>
                    {specialty}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            /* Sub-specialty filter pills */
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Filter:
              </span>
              <button
                type="button"
                onClick={() => setSelectedSubSpecialty(null)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  selectedSubSpecialty === null
                    ? 'bg-teal-500 text-slate-950 font-semibold shadow'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                All Sub-specialties
              </button>
              {availableSubSpecialties.map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setSelectedSubSpecialty(sub)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    selectedSubSpecialty?.toLowerCase() === sub.toLowerCase()
                      ? 'bg-teal-500 text-slate-950 font-semibold shadow'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}

          {/* HMO coverage toggle (if patient has HMO) */}
          {patientHmo && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300 select-none">
              <input
                type="checkbox"
                checked={showAllHmo}
                onChange={(e) => setShowAllHmo(e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-teal-500 focus:ring-teal-500"
              />
              <span>Show all (ignore HMO filter)</span>
            </label>
          )}
        </div>

        {/* Results summary header */}
        <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
          <span>
            Showing <strong className="text-white">{ranked.length}</strong> ranked specialists
            {selectedSubSpecialty && ` for ${selectedSubSpecialty}`}
          </span>
          {patientHmo && !showAllHmo && (
            <span className="text-teal-400">
              {coveredCount} accredited with {patientHmo}
            </span>
          )}
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
            <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/10">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-teal-400" />
            </div>
            <p className="text-sm text-slate-300 font-medium">Finding and ranking matching doctors…</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Doctor Cards List */}
        {!loading && !error && ranked.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
            <p className="text-base text-slate-300">No doctors found matching this criteria.</p>
            <button
              type="button"
              onClick={() => {
                setSelectedSubSpecialty(null);
                setShowAllHmo(true);
                setSearch('');
                setSpecialtyFilter('all');
              }}
              className="mt-4 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
            >
              Reset Filters & Show All
            </button>
          </div>
        )}

        {!loading && !error && ranked.length > 0 && (
          <div className="flex flex-col gap-4">
            {ranked.map((doctor, index) => {
              const isTopRecommendation =
                index === 0 && (doctor.isExactSubSpecialty || ranked.length === 1);
              const clinic = doctor.primaryClinic;
              const formattedFee = clinic
                ? `₱${Number(clinic.consultation_fee).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                : 'Fee on inquiry';

              return (
                <div
                  key={doctor.id}
                  className={`relative flex flex-col justify-between rounded-2xl border bg-slate-900/80 p-6 shadow-lg backdrop-blur transition hover:border-slate-700 sm:p-7 ${
                    isTopRecommendation
                      ? 'border-teal-500/50 ring-1 ring-teal-500/20'
                      : 'border-slate-800'
                  }`}
                >
                  {/* Top recommendation ribbon */}
                  {isTopRecommendation && (
                    <div className="mb-4 inline-flex items-center gap-1.5 self-start rounded-full bg-teal-400/15 px-3 py-1 text-xs font-semibold text-teal-300 border border-teal-500/30">
                      <span>⭐ Top Recommendation</span>
                    </div>
                  )}

                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                    {/* Left Column: Doctor Info & Credentials */}
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold text-white sm:text-2xl">
                          {doctor.name}
                        </h2>
                        {doctor.verified && (
                          <span
                            title="Verified Medical License"
                            className="inline-flex items-center gap-1 rounded-md bg-teal-500/10 px-2 py-0.5 text-xs font-medium text-teal-300 border border-teal-500/20"
                          >
                            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Verified
                          </span>
                        )}
                      </div>

                      {/* Specialty & Sub-specialty Pill */}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-teal-300">
                          {doctor.specialty}
                        </span>
                        {doctor.sub_specialty && (
                          <>
                            <span className="text-slate-600">•</span>
                            <span className="rounded-md bg-slate-800 px-2 py-0.5 font-medium text-slate-200">
                              {doctor.sub_specialty}
                            </span>
                          </>
                        )}
                        {doctor.averageRating !== null ? (
                          <>
                            <span className="text-slate-600">•</span>
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-300">
                              ★ {doctor.averageRating.toFixed(1)}
                              <span className="text-slate-500 font-normal">
                                ({doctor.reviewCount} {doctor.reviewCount === 1 ? 'review' : 'reviews'})
                              </span>
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-slate-600">•</span>
                            <span className="text-slate-400 text-xs">★ New (No reviews yet)</span>
                          </>
                        )}
                      </div>

                      {/* Credentials text */}
                      {doctor.credentials && (
                        <p className="mt-3 text-xs leading-relaxed text-slate-400 line-clamp-2">
                          {doctor.credentials}
                        </p>
                      )}

                      {/* Clinic Location & Fee */}
                      {clinic && (
                        <div className="mt-4 rounded-xl border border-slate-800/80 bg-slate-800/40 p-3 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-medium text-slate-200">{clinic.name}</p>
                              {clinic.room_details && (
                                <p className="text-slate-400 text-[11px]">{clinic.room_details}</p>
                              )}
                              <p className="text-slate-400 text-[11px] mt-0.5">📍 {clinic.location}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[11px] text-slate-400 block">Consultation Fee</span>
                              <span className="text-sm font-bold text-teal-300">{formattedFee}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* HMO Coverage Badges */}
                      <div className="mt-4 flex flex-wrap items-center gap-1.5">
                        {doctor.isHmoCovered && patientHmo && (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-teal-500 px-2.5 py-1 text-xs font-semibold text-slate-950 shadow-sm">
                            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Covered by {patientHmo}
                          </span>
                        )}

                        <span className="text-[11px] font-medium text-slate-500 mr-1">
                          Accreditations:
                        </span>
                        {doctor.hmo_accreditations && doctor.hmo_accreditations.length > 0 ? (
                          doctor.hmo_accreditations.map((hmoName) => {
                            const isMatch =
                              patientHmo &&
                              hmoName.toLowerCase() === patientHmo.toLowerCase();
                            return (
                              <span
                                key={hmoName}
                                className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                                  isMatch
                                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {hmoName}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-[11px] text-slate-500">None (Cash-only)</span>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Slot Availability & Booking Button */}
                    <div className="flex flex-col justify-between border-t border-slate-800 pt-4 lg:w-64 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0 shrink-0">
                      <div>
                        <span className="text-xs font-medium uppercase tracking-wider text-slate-400 block">
                          Earliest Open Slot
                        </span>
                        {doctor.soonestSlot ? (
                          <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20 px-3 py-2 text-xs font-semibold text-teal-300">
                            <span>📅</span>
                            <span>{doctor.soonestSlot.formatted}</span>
                          </div>
                        ) : (
                          <p className="mt-1.5 text-xs text-slate-500 italic">
                            No open slots posted
                          </p>
                        )}
                      </div>

                      <div className="mt-6">
                        <a
                          id={`book-doctor-${doctor.id}`}
                          href={`/patient/doctors/${doctor.id}?hmo=${encodeURIComponent(patientHmo || '')}`}
                          className="w-full text-center block rounded-xl bg-teal-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-teal-500 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                        >
                          View Profile & Book →
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footnote Disclaimer (PRD Section 8.3) */}
        <div className="mt-10 border-t border-slate-900 pt-6 text-center text-xs text-slate-500">
          <p>
            Disclaimer: HMO accreditation, consultation fees, and posted doctor schedules are for prototype demonstration purposes.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function PatientDoctorListPage() {
  return (
    <RequireRole role="patient">
      <Suspense
        fallback={
          <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-teal-400" />
              <span>Loading doctor directory…</span>
            </div>
          </main>
        }
      >
        <DoctorListContent />
      </Suspense>
    </RequireRole>
  );
}
