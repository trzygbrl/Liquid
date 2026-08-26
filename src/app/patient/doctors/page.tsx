'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import RequireRole from '@/components/RequireRole';
import { supabase } from '@/lib/supabaseClient';
import { rankDoctors, type DoctorRecord } from '@/lib/doctorRanking';
import {
  applyDoctorFilters,
  deriveFilterOptions,
  sortDoctors,
  DEFAULT_FILTERS,
  type DoctorFilters,
} from '@/lib/doctorFilters';
import { getPlainSpecialtyInfo } from '@/lib/specialtyHelpers';
import { IconStar, IconInfo, IconChevronRight } from '@/components/Icons';
import DoctorAvatar from '@/components/DoctorAvatar';
import DoctorFilterPanel from '@/components/DoctorFilterPanel';

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

  // Directory filters: search, specialty, sub-specialty, location, fee
  // ceiling, HMO accreditation, rating floor, availability window and sort.
  // Applied after ranking (see below) and rendered by DoctorFilterPanel.
  const [filters, setFilters] = useState<DoctorFilters>(DEFAULT_FILTERS);

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
              rating
            )
          `
          )
          // Only doctors who've cleared HITL license review appear in patient
          // search (migration 0008 / Task 7.2) -- pending/rejected doctors
          // are excluded, not just visually unbadged.
          .eq('verification_status', 'verified');
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
          verification_status: d.verification_status,
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

  // Every option offered by the filter panel is derived from the doctors
  // actually fetched, so no filter can offer a value that matches nothing.
  const filterOptions = useMemo(
    () => deriveFilterOptions(doctors, filters.specialty),
    [doctors, filters.specialty]
  );

  // Rank first (PRD 8.4) & run the HMO intelligence check (PRD 8.3), then
  // filter. The filters key off the ranker's derived fields (rating, soonest
  // slot, primary clinic), and "Best match" sorting is exactly the ranked
  // order with the non-matching doctors removed. hasHmoMismatch stays a
  // property of the whole specialty search rather than of the filtered view.
  const { ranked: rankedAll, hasHmoMismatch } = useMemo(
    () => rankDoctors(doctors, specialtyParam ?? '', selectedSubSpecialty, patientHmo),
    [doctors, specialtyParam, selectedSubSpecialty, patientHmo]
  );

  const ranked = useMemo(
    () => sortDoctors(applyDoctorFilters(rankedAll, filters), filters.sort),
    [rankedAll, filters]
  );

  const coveredCount = useMemo(
    () => ranked.filter((d) => d.isHmoCovered).length,
    [ranked]
  );

  // Clears the panel filters; the sub-specialty pills are ranking input from
  // the intake flow, so they reset too.
  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSelectedSubSpecialty(null);
  };

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Header Title */}
        <div className="border-b border-slate-200/80 pb-6 mb-6">
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
                <span className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-1 text-brand-700 font-bold shadow-sm">
                  Sub-specialty: {selectedSubSpecialty}
                </span>
              )}
              <span className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-slate-700 font-medium shadow-sm">
                Your HMO:{' '}
                <strong className={patientHmo ? 'text-brand-700 font-bold' : 'text-slate-500'}>
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

        {/* Sub-specialty ranking pills (specialty mode only). These steer the
            ranker's tier-1 match strength rather than filtering outright, so
            they stay separate from the filter panel below. */}
        {!browseAll && availableSubSpecialties.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 card p-5">
            <span className="mr-1 text-xs font-bold uppercase tracking-wider text-slate-500">
              Prioritize:
            </span>
            <button
              type="button"
              onClick={() => setSelectedSubSpecialty(null)}
              className={`rounded-2xl px-4 py-2 text-xs font-bold transition ${
                selectedSubSpecialty === null
                  ? 'bg-brand-600 text-white shadow-sm'
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
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {sub}
              </button>
            ))}
            <p className="mt-1 w-full text-xs text-slate-500">
              Ranks matching sub-specialists first. To hide the rest, use the
              sub-specialty filter below.
            </p>
          </div>
        )}

        {/* Search / filter / sort bar */}
        <DoctorFilterPanel
          filters={filters}
          onChange={setFilters}
          onReset={resetFilters}
          options={filterOptions}
          // In specialty mode the specialty is fixed by the query param.
          showSpecialty={browseAll}
          resultCount={ranked.length}
        />

        {/* Results summary header */}
        <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing <strong className="text-slate-900 font-bold">{ranked.length}</strong>
            {ranked.length !== rankedAll.length && ` of ${rankedAll.length}`} verified doctors
            {selectedSubSpecialty && ` for ${selectedSubSpecialty}`}
          </span>
          {patientHmo && (
            <span className="text-brand-700 font-semibold">
              {coveredCount} accredited with {patientHmo}
            </span>
          )}
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className="card p-12 text-center">
            <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
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
              onClick={resetFilters}
              className="mt-4 rounded-2xl bg-brand-600 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-brand-700"
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
                  className={`fluid-hover relative flex flex-col justify-between rounded-2xl border bg-white p-6 sm:p-7 shadow-sm hover:border-brand-300/80 hover:shadow-lg ${
                    isTopRecommendation
                      ? 'border-brand-200 ring-2 ring-brand-500/20 shadow-brand-500/5'
                      : 'border-slate-200/80'
                  }`}
                >
                  {/* Top recommendation ribbon */}
                  {isTopRecommendation && (
                    <div className="mb-4 inline-flex items-center gap-1.5 self-start rounded-full bg-brand-50/90 px-3 py-1 text-xs font-bold text-brand-700 border border-brand-200/80 shadow-xs">
                      <IconStar className="h-3.5 w-3.5" />
                      <span>Top Clinical Match</span>
                    </div>
                  )}

                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                    {/* Left Column: Doctor Info & Credentials */}
                    <div className="flex-1 min-w-0">
                      {/* Avatar sized to clear two stacked lines: name on top, status below. */}
                      <div className="flex items-start gap-4">
                        <DoctorAvatar name={doctor.name} id={doctor.id} size={64} className="shrink-0" />
                        <div className="min-w-0 flex-1">
                          <h2 className="mt-3 truncate text-lg font-bold text-slate-900 tracking-tight md:text-lg">
                            {doctor.name}
                          </h2>
                          <div className="flex flex-wrap items-center gap-2">
                            {doctor.verification_status === 'verified' && (
                              <span
                                title="Verified Medical License"
                                className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-[0.65rem] font-bold text-brand-700 border border-brand-100 md:text-xs"
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
                            {doctor.averageRating !== null ? (
                              <span className="inline-flex items-center gap-1 font-bold text-amber-700 text-[0.65rem] bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 md:text-xs">
                                <IconStar className="h-3.5 w-3.5" /> {doctor.averageRating.toFixed(1)}
                                <span className="text-slate-600 font-normal">
                                  ({doctor.reviewCount} {doctor.reviewCount === 1 ? 'review' : 'reviews'})
                                </span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-slate-600 text-[0.65rem] md:text-xs">
                                <IconStar className="h-3.5 w-3.5" filled={false} /> New Doctor
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 space-y-2.5">
                        {/* Specialty & Sub-specialty */}
                        <div className="flex flex-wrap items-center gap-2 text-xs lg:text-sm">
                          <span className="font-semibold text-brand-700">
                            {doctor.specialty}
                          </span>
                          {doctor.sub_specialty && (
                            <span className="rounded-md bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-800 text-[0.65rem] lg:text-sm">
                              {doctor.sub_specialty}
                            </span>
                          )}
                        </div>

                        {/* Plain-language subtitle, only when the specialty name
                            itself is clinical enough to need translating. */}
                        {(() => {
                          const plain = getPlainSpecialtyInfo(doctor.specialty);
                          if (!plain) return null;
                          return (
                            <p className="text-sm text-slate-700">
                              <span className="text-brand-700 font-semibold">{plain.plainName}</span>
                              <span className="text-slate-400 mx-1.5">•</span>
                              <span className="italic text-slate-600">{plain.tagalogName}</span>
                            </p>
                          );
                        })()}

                        {/* Credentials text */}
                        {doctor.credentials && (
                          <p className="text-xs leading-relaxed text-slate-700 line-clamp-2 md:text-sm">
                            {doctor.credentials}
                          </p>
                        )}

                        {/* Clinic / hospital list -- tap anywhere in the box to
                            expand or hide the doctor's other locations. */}
                        {clinic && (
                          <div
                            role={doctor.otherClinics.length > 0 ? 'button' : undefined}
                            tabIndex={doctor.otherClinics.length > 0 ? 0 : undefined}
                            aria-expanded={doctor.otherClinics.length > 0 ? expandedClinics.has(doctor.id) : undefined}
                            onClick={() => {
                              if (doctor.otherClinics.length === 0) return;
                              setExpandedClinics((prev) => {
                                const next = new Set(prev);
                                if (next.has(doctor.id)) next.delete(doctor.id);
                                else next.add(doctor.id);
                                return next;
                              });
                            }}
                            onKeyDown={(e) => {
                              if (doctor.otherClinics.length === 0) return;
                              if (e.key !== 'Enter' && e.key !== ' ') return;
                              e.preventDefault();
                              setExpandedClinics((prev) => {
                                const next = new Set(prev);
                                if (next.has(doctor.id)) next.delete(doctor.id);
                                else next.add(doctor.id);
                                return next;
                              });
                            }}
                            className={`rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-[0.65rem] md:text-sm ${
                              doctor.otherClinics.length > 0 ? 'fluid-hover cursor-pointer hover:border-brand-200 hover:bg-brand-50/30 focus:outline-none focus:ring-2 focus:ring-brand-500/30' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="font-bold text-slate-900">{clinic.name}</p>
                                {clinic.room_details && (
                                  <p className="text-slate-600 mt-0.5">{clinic.room_details}</p>
                                )}
                                <p className="text-slate-500 mt-1">{clinic.location}</p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <div className="text-right">
                                  <span className="text-slate-500 block font-medium">Consultation Fee</span>
                                  <span className="font-bold text-slate-900">{formattedFee}</span>
                                </div>
                                {doctor.otherClinics.length > 0 && (
                                  <IconChevronRight
                                    className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                                      expandedClinics.has(doctor.id) ? 'rotate-90' : ''
                                    }`}
                                  />
                                )}
                              </div>
                            </div>

                            {doctor.otherClinics.length > 0 && (
                              <p className="mt-2.5 border-t border-slate-200/60 pt-2.5 font-bold text-brand-700">
                                {expandedClinics.has(doctor.id)
                                  ? 'Hide other locations'
                                  : `Show ${doctor.otherClinics.length} more ${doctor.otherClinics.length === 1 ? 'location' : 'locations'}`}
                              </p>
                            )}

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

                        {/* HMO Coverage / Accreditations */}
                        <div className="flex flex-wrap items-center gap-2 text-[0.65rem] md:text-sm">
                          {doctor.isHmoCovered && patientHmo && (
                            <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1 font-bold text-emerald-800 shadow-sm">
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

                          <span className="font-semibold text-slate-500 mr-1">
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
                                  className={`rounded-xl px-2.5 py-1 font-semibold ${
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
                            <span className="text-slate-500">None (Cash-only)</span>
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
                          <div className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-brand-50 border border-brand-100 px-3.5 py-2 text-xs font-bold text-brand-800">
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
                          className="w-full text-center block rounded-2xl bg-brand-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-brand-700 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-500/50"
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
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
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
