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
import { getPlainSpecialtyInfo } from '@/lib/specialtyHelpers';
import { IconStar, IconInfo } from '@/components/Icons';
import DoctorAvatar from '@/components/DoctorAvatar';

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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Browse-all-mode-only filters (specialty-mode uses the sub-specialty
  // pills below instead, fed by specialtyParam).
  const [search, setSearch] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');

  // Doctor ids whose "other locations" list is expanded on the card
  const [expandedClinics, setExpandedClinics] = useState<Set<string>>(new Set());

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
        // 1. Fetch sub-specialty list for filter pills (specialty mode only;
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
      patientHmo
    );
  }, [visibleDoctors, specialtyParam, selectedSubSpecialty, patientHmo]);

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between border-b border-slate-200/80 pb-4">
          <a
            href="/patient/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition"
          >
            Back to Dashboard
          </a>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-100">
            Verified Doctor Directory
          </span>
        </div>

        {/* Header Title */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {browseAll ? 'Find a Doctor' : `${specialtyParam} Specialists`}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {browseAll
              ? 'Browse 200+ verified specialists or search by practitioner name, medical field, or clinic.'
              : 'Ranked by sub-specialty clinical match, HMO network coverage, and earliest open slot.'}
          </p>

          {/* Active search recap pills (specialty mode only) */}
          {!browseAll && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-slate-700 font-medium shadow-sm">
                Specialty: <strong className="text-slate-900 font-bold">{specialtyParam}</strong>
              </span>
              {selectedSubSpecialty && (
                <span className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 font-bold shadow-sm">
                  Sub-specialty: {selectedSubSpecialty}
                </span>
              )}
              <span className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-slate-700 font-medium shadow-sm">
                Your HMO:{' '}
                <strong className={patientHmo ? 'text-blue-700 font-bold' : 'text-slate-500'}>
                  {patientHmo || 'None (Cash Rates)'}
                </strong>
              </span>
            </div>
          )}
        </div>

        {/* HMO Intelligence Mismatch Banner (PRD Section 8.3) */}
        {hasHmoMismatch && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <IconInfo className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-900">
                  HMO Network Notice
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  No <strong>{selectedSubSpecialty}</strong> doctors in your{' '}
                  <strong>{patientHmo}</strong> network match closely. Below are top-rated{' '}
                  {selectedSubSpecialty} specialists with direct cash consultation rates.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filter & Control Bar */}
        <div className="mb-6 flex flex-col gap-4 card p-5 sm:flex-row sm:items-center sm:justify-between">
          {browseAll ? (
            /* Browse-all mode: free-text search + specialty dropdown */
            <div className="flex flex-1 flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by doctor name, specialty, or clinic..."
                className="flex-1 rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
              />
              <select
                value={specialtyFilter}
                onChange={(e) => setSpecialtyFilter(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 sm:w-64"
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                Filter:
              </span>
              <button
                type="button"
                onClick={() => setSelectedSubSpecialty(null)}
                className={`rounded-2xl px-4 py-2 text-xs font-bold transition ${
                  selectedSubSpecialty === null
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Sub-specialties
              </button>
              {availableSubSpecialties.map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setSelectedSubSpecialty(sub)}
                  className={`rounded-2xl px-4 py-2 text-xs font-bold transition ${
                    selectedSubSpecialty?.toLowerCase() === sub.toLowerCase()
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results summary header */}
        <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing <strong className="text-slate-900 font-bold">{ranked.length}</strong> verified doctors
            {selectedSubSpecialty && ` for ${selectedSubSpecialty}`}
          </span>
          {patientHmo && (
            <span className="text-blue-700 font-semibold">
              {coveredCount} accredited with {patientHmo}
            </span>
          )}
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className="card p-12 text-center">
            <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
            </div>
            <p className="text-sm text-slate-700 font-medium">Finding and ranking matching doctors…</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-xs font-medium text-rose-700">
            {error}
          </div>
        )}

        {/* Doctor Cards List */}
        {!loading && !error && ranked.length === 0 && (
          <div className="card p-12 text-center">
            <p className="text-base text-slate-800 font-medium">No doctors found matching this criteria.</p>
            <button
              type="button"
              onClick={() => {
                setSelectedSubSpecialty(null);
                setSearch('');
                setSpecialtyFilter('all');
              }}
              className="mt-4 rounded-2xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700"
            >
              Reset Filters
            </button>
          </div>
        )}

        {!loading && !error && ranked.length > 0 && (
          <div className="flex flex-col gap-4.5">
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
                  className={`fluid-hover relative flex flex-col justify-between rounded-2xl border bg-white p-6 sm:p-7 shadow-sm hover:border-blue-300/80 hover:shadow-lg ${
                    isTopRecommendation
                      ? 'border-blue-200 ring-2 ring-blue-500/20 shadow-blue-500/5'
                      : 'border-slate-200/80'
                  }`}
                >
                  {/* Top recommendation ribbon */}
                  {isTopRecommendation && (
                    <div className="mb-4 inline-flex items-center gap-1.5 self-start rounded-full bg-blue-50/90 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-200/80 shadow-xs">
                      <IconStar className="h-3.5 w-3.5" />
                      <span>Top Clinical Match</span>
                    </div>
                  )}

                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                    {/* Left Column: Doctor Info & Credentials */}
                    <div className="flex flex-1 gap-4">
                      <DoctorAvatar name={doctor.name} id={doctor.id} size={64} className="mt-1" />
                      <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                          {doctor.name}
                        </h2>
                        {doctor.verified && (
                          <span
                            title="Verified Medical License"
                            className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-100"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
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
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-bold text-blue-700 text-base">
                          {doctor.specialty}
                        </span>
                        {doctor.sub_specialty && (
                          <>
                            <span className="text-slate-400">•</span>
                            <span className="rounded-md bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-800 text-sm">
                              {doctor.sub_specialty}
                            </span>
                          </>
                        )}
                        {doctor.averageRating !== null ? (
                          <>
                            <span className="text-slate-400">•</span>
                            <span className="inline-flex items-center gap-1 font-bold text-amber-700 text-sm bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                              <IconStar className="h-3.5 w-3.5" /> {doctor.averageRating.toFixed(1)}
                              <span className="text-slate-600 font-normal">
                                ({doctor.reviewCount} {doctor.reviewCount === 1 ? 'review' : 'reviews'})
                              </span>
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
                            <span className="text-blue-700 font-semibold">{plain.plainName}</span>
                            <span className="text-slate-400 mx-1.5">•</span>
                            <span className="italic text-slate-600">{plain.tagalogName}</span>
                          </p>
                        );
                      })()}

                      {/* Credentials text */}
                      {doctor.credentials && (
                        <p className="mt-2.5 text-sm leading-relaxed text-slate-700 line-clamp-2">
                          {doctor.credentials}
                        </p>
                      )}

                      {/* Clinic Location & Fee */}
                      {clinic && (
                        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{clinic.name}</p>
                              {clinic.room_details && (
                                <p className="text-slate-600 text-xs mt-0.5">{clinic.room_details}</p>
                              )}
                              <p className="text-slate-500 text-xs mt-1">{clinic.location}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-xs text-slate-500 block font-medium">Consultation Fee</span>
                              <span className="text-sm font-bold text-slate-900">{formattedFee}</span>
                            </div>
                          </div>

                          {doctor.otherClinics.length > 0 && (
                            <div className="mt-3 border-t border-slate-200/60 pt-3">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedClinics((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(doctor.id)) next.delete(doctor.id);
                                    else next.add(doctor.id);
                                    return next;
                                  })
                                }
                                className="text-xs font-bold text-blue-700 hover:text-blue-900 transition"
                              >
                                {expandedClinics.has(doctor.id)
                                  ? 'Hide other locations'
                                  : `Show ${doctor.otherClinics.length} more ${doctor.otherClinics.length === 1 ? 'location' : 'locations'}`}
                              </button>

                              {expandedClinics.has(doctor.id) && (
                                <div className="mt-2.5 flex flex-col gap-2">
                                  {doctor.otherClinics.map((other) => (
                                    <div
                                      key={other.id}
                                      className="flex items-center justify-between gap-2 rounded-xl bg-white border border-slate-200/70 px-3 py-2"
                                    >
                                      <div className="min-w-0">
                                        <p className="font-semibold text-slate-800 truncate">{other.name}</p>
                                        <p className="text-slate-500 mt-0.5">{other.location}</p>
                                      </div>
                                      <span className="shrink-0 font-bold text-slate-900">
                                        ₱{Number(other.consultation_fee).toLocaleString('en-US', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* HMO Coverage Badges */}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {doctor.isHmoCovered && patientHmo && (
                          <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800 shadow-sm">
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

                        <span className="text-xs font-semibold text-slate-500 mr-1">
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
                                className={`rounded-xl px-2.5 py-1 text-xs font-semibold ${
                                  isMatch
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                                }`}
                              >
                                {hmoName}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-xs text-slate-500">None (Cash-only)</span>
                        )}
                      </div>
                      </div>
                    </div>

                    {/* Right Column: Slot Availability & Booking Button */}
                    <div className="flex flex-col justify-between border-t border-slate-100 pt-4 lg:w-64 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0 shrink-0">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                          Earliest Open Slot
                        </span>
                        {doctor.soonestSlot ? (
                          <div className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-blue-50 border border-blue-100 px-3.5 py-2 text-xs font-bold text-blue-800">
                            <span>{doctor.soonestSlot.formatted}</span>
                          </div>
                        ) : (
                          <p className="mt-2 w-full text-xs text-slate-500 italic">
                            No open slots posted
                          </p>
                        )}
                      </div>

                      <div className="mt-6">
                        <a
                          id={`book-doctor-${doctor.id}`}
                          href={`/patient/doctors/${doctor.id}?hmo=${encodeURIComponent(patientHmo || '')}`}
                          className="w-full text-center block rounded-2xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        >
                          View Profile & Book
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
        <div className="mt-10 border-t border-slate-200/80 pt-6 text-center text-xs text-slate-500">
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
          <main className="flex min-h-screen items-center justify-center text-slate-500">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
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
