'use client';

// src/components/admin/TaxonomyManager.tsx
//
// Inner content for the taxonomy-cleanup tab of the admin tools page
// (Task 7.3 follow-up). Doctors can add a new specialty/sub-specialty via
// "+ Other (please specify)" during onboarding/profile-edit -- this lets an
// admin find and delete odd/duplicate/test entries that came in through
// that self-service path. See src/app/admin/verify-doctors/page.tsx for the
// shared header/passcode gate/tab switcher this renders inside of.

import { useEffect, useMemo, useState } from 'react';

interface TaxonomyRow {
  id: string;
  specialty: string;
  sub_specialty: string | null;
  created_at: string;
  doctorCount: number;
}

export async function fetchTaxonomyWith(passcode: string): Promise<TaxonomyRow[]> {
  const res = await fetch('/api/admin/taxonomy', { headers: { 'x-admin-passcode': passcode } });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Failed to load taxonomy.');
  return body.taxonomy ?? [];
}

export default function TaxonomyManager({ passcode }: { passcode: string }) {
  const [rows, setRows] = useState<TaxonomyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setLoadError(null);
    try {
      setRows(await fetchTaxonomyWith(passcode));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load taxonomy.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passcode]);

  async function handleDelete(id: string) {
    setActioningId(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/taxonomy/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-passcode': passcode },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to delete.');
      setDeletingId(null);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete.');
    } finally {
      setActioningId(null);
    }
  }

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(
      (r) => r.specialty.toLowerCase().includes(query) || (r.sub_specialty ?? '').toLowerCase().includes(query)
    );
  }, [rows, search]);

  // Group by specialty for readability -- there are 100+ rows in the
  // seeded taxonomy, a flat list would be hard to scan.
  const grouped = useMemo(() => {
    const map = new Map<string, TaxonomyRow[]>();
    for (const row of visibleRows) {
      const list = map.get(row.specialty) ?? [];
      list.push(row);
      map.set(row.specialty, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visibleRows]);

  return (
    <div>
      <p className="mb-5 text-sm text-slate-600">
        Doctors can add a new specialty or sub-specialty during onboarding via &ldquo;+ Other (please
        specify).&rdquo; Remove odd, duplicate, or test entries here.
      </p>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search specialties or sub-specialties…"
        className="mb-6 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
      />

      {loadError && (
        <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
          {loadError}
        </p>
      )}
      {actionError && (
        <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
          {actionError}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="card px-6 py-10 text-center text-sm text-slate-500">No matching entries.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map(([specialty, entries]) => (
            <div key={specialty} className="card p-5 sm:p-6">
              <h2 className="text-sm font-bold text-slate-900">{specialty}</h2>
              <div className="mt-3 flex flex-col divide-y divide-slate-100">
                {entries.map((row) => {
                  const isActioning = actioningId === row.id;
                  return (
                    <div key={row.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-slate-800">
                            {row.sub_specialty ?? <span className="italic text-slate-400">(no sub-specialty)</span>}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {row.doctorCount > 0
                              ? `${row.doctorCount} doctor${row.doctorCount === 1 ? '' : 's'} currently using this`
                              : 'No doctors using this'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDeletingId(deletingId === row.id ? null : row.id)}
                          disabled={isActioning}
                          className="fluid-hover shrink-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:border-rose-300 hover:text-rose-600 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>

                      {deletingId === row.id && (
                        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50/40 p-4">
                          <p className="text-xs text-rose-800">
                            {row.doctorCount > 0
                              ? `${row.doctorCount} doctor${row.doctorCount === 1 ? '' : 's'} currently ${row.doctorCount === 1 ? 'has' : 'have'} this specialty/sub-specialty. Deleting it won't change their existing profile, but they won't be able to re-save their profile without picking a different one until they update it.`
                              : 'This will permanently remove the entry. It can be re-added later by any doctor via "+ Other (please specify)".'}
                          </p>
                          <div className="mt-3 flex gap-2.5">
                            <button
                              type="button"
                              onClick={() => handleDelete(row.id)}
                              disabled={isActioning}
                              className="fluid-hover rounded-2xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
                            >
                              {isActioning ? '…' : 'Confirm Delete'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingId(null)}
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
