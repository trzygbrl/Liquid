'use client';

// src/components/admin/DoctorVerificationQueue.tsx
//
// Inner content for the HITL doctor license-verification tab of the admin
// tools page (Task 7.2). See src/app/admin/verify-doctors/page.tsx for the
// shared header/passcode gate/tab switcher this renders inside of.

import { useEffect, useState } from 'react';

type VerificationStatus = 'pending' | 'verified' | 'rejected';

interface AdminDoctor {
  id: string;
  name: string;
  credentials: string | null;
  specialty: string;
  sub_specialty: string | null;
  verification_status: VerificationStatus;
  verification_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const STATUS_TABS: { id: VerificationStatus | 'all'; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'verified', label: 'Verified' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export async function fetchDoctorsWith(passcode: string): Promise<AdminDoctor[]> {
  const res = await fetch('/api/admin/doctors', { headers: { 'x-admin-passcode': passcode } });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Failed to load doctors.');
  return body.doctors ?? [];
}

export default function DoctorVerificationQueue({ passcode }: { passcode: string }) {
  const [doctors, setDoctors] = useState<AdminDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<VerificationStatus | 'all'>('pending');

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setLoadError(null);
    try {
      setDoctors(await fetchDoctorsWith(passcode));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load doctors.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passcode]);

  async function handleApprove(id: string) {
    setActioningId(id);
    try {
      const res = await fetch(`/api/admin/doctors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-passcode': passcode },
        body: JSON.stringify({ verification_status: 'verified' }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to approve.');
      await reload();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to approve.');
    } finally {
      setActioningId(null);
    }
  }

  function handleRejectClick(id: string) {
    setRejectingId(id);
    setRejectReason('');
    setRejectError(null);
  }

  async function handleRejectConfirm(id: string) {
    if (rejectReason.trim().length < 3) {
      setRejectError('Please provide a brief reason (at least a few words) for the doctor.');
      return;
    }
    setActioningId(id);
    try {
      const res = await fetch(`/api/admin/doctors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-passcode': passcode },
        body: JSON.stringify({ verification_status: 'rejected', verification_notes: rejectReason.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to reject.');
      setRejectingId(null);
      setRejectReason('');
      await reload();
    } catch (err) {
      setRejectError(err instanceof Error ? err.message : 'Failed to reject.');
    } finally {
      setActioningId(null);
    }
  }

  function handleCopy(id: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
    });
  }

  const visibleDoctors = tab === 'all' ? doctors : doctors.filter((d) => d.verification_status === tab);

  return (
    <div>
      <p className="mb-5 text-sm text-slate-600">
        Check each license number against{' '}
        <a
          href="https://verification.prc.gov.ph/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-700 underline hover:text-blue-900"
        >
          the PRC verification portal
        </a>{' '}
        before approving. There is no PRC API -- this is a manual check.
      </p>

      {/* Status sub-tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {STATUS_TABS.map((t) => {
          const count = t.id === 'all' ? doctors.length : doctors.filter((d) => d.verification_status === t.id).length;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={active ? 'page' : undefined}
              className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                active ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label} <span className="text-xs text-slate-400">({count})</span>
            </button>
          );
        })}
      </div>

      {loadError && (
        <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
          {loadError}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
        </div>
      ) : visibleDoctors.length === 0 ? (
        <div className="card px-6 py-10 text-center text-sm text-slate-500">No doctors in this category.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleDoctors.map((doctor) => {
            const isActioning = actioningId === doctor.id;
            return (
              <div key={doctor.id} className="card card-interactive p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold text-slate-900">{doctor.name}</h2>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          doctor.verification_status === 'verified'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : doctor.verification_status === 'rejected'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {doctor.verification_status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {doctor.specialty}
                      {doctor.sub_specialty ? ` — ${doctor.sub_specialty}` : ''} · Signed up{' '}
                      {formatDate(doctor.created_at)}
                    </p>

                    <div className="mt-3 flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                      <p className="min-w-0 flex-1 break-words text-sm font-medium text-slate-800">
                        {doctor.credentials || <span className="italic text-slate-400">No credentials entered.</span>}
                      </p>
                      {doctor.credentials && (
                        <button
                          type="button"
                          onClick={() => handleCopy(doctor.id, doctor.credentials!)}
                          className="fluid-hover shrink-0 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          {copiedId === doctor.id ? 'Copied' : 'Copy'}
                        </button>
                      )}
                    </div>

                    {doctor.verification_status !== 'pending' && (doctor.verification_notes || doctor.reviewed_at) && (
                      <p className="mt-2.5 text-xs text-slate-500">
                        {doctor.verification_notes && (
                          <>
                            <span className="font-bold">Notes:</span> {doctor.verification_notes}{' '}
                          </>
                        )}
                        {doctor.reviewed_at &&
                          `(reviewed ${formatDate(doctor.reviewed_at)}${doctor.reviewed_by ? ` by ${doctor.reviewed_by}` : ''})`}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleApprove(doctor.id)}
                      disabled={isActioning || doctor.verification_status === 'verified'}
                      className="fluid-hover min-h-[44px] rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {isActioning ? '…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectClick(doctor.id)}
                      disabled={isActioning || doctor.verification_status === 'rejected'}
                      className="fluid-hover min-h-[44px] rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:border-rose-300 hover:text-rose-600 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>

                {rejectingId === doctor.id && (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/40 p-4">
                    <label className="field-label mb-1.5 block">Reason for rejecting (shown to the doctor)</label>
                    <textarea
                      rows={2}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="e.g. License number could not be verified against the PRC portal."
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20 resize-none"
                    />
                    {rejectError && <p className="mt-1.5 text-xs font-medium text-rose-700">{rejectError}</p>}
                    <div className="mt-3 flex gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleRejectConfirm(doctor.id)}
                        disabled={isActioning}
                        className="fluid-hover rounded-2xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
                      >
                        {isActioning ? '…' : 'Confirm Reject'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectingId(null)}
                        disabled={isActioning}
                        className="fluid-hover rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Nevermind
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
