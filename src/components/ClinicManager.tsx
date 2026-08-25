'use client';

// src/components/ClinicManager.tsx
//
// Lets a doctor add, edit, and delete their secondary clinic/hospital
// locations from the dashboard (Task: Doctor Portal Location Management).
// Modeled directly on ScheduleManager.tsx's "form on top, persisted list
// below" pattern, including the realtime subscription approach.

import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Clinic {
  id: string;
  name: string;
  room_details: string | null;
  location: string;
  consultation_fee: number;
}

interface ClinicFormState {
  name: string;
  roomDetails: string;
  location: string;
  consultationFee: string;
}

const BLANK_FORM: ClinicFormState = { name: '', roomDetails: '', location: '', consultationFee: '' };

function validate(f: ClinicFormState): string | null {
  if (!f.name.trim() || !f.location.trim() || !f.consultationFee) {
    return 'Please fill in clinic name, location, and consultation fee.';
  }
  const fee = parseFloat(f.consultationFee);
  if (Number.isNaN(fee) || fee < 0) {
    return 'Consultation fee must be a positive number.';
  }
  return null;
}

export default function ClinicManager() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Add-form state
  const [form, setForm] = useState<ClinicFormState>(BLANK_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Per-row edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ClinicFormState>(BLANK_FORM);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // delete state (track which clinic id is mid-delete)
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    // Prevents duplicate subscriptions in React StrictMode (same pattern as ScheduleManager)
    let cancelled = false;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      const uid = session.user.id;

      const { data, error } = await supabase
        .from('clinics')
        .select('id, name, room_details, location, consultation_fee')
        .eq('doctor_id', uid)
        .order('name');

      if (error) {
        setLoadError(`Could not load your clinics: ${error.message}`);
        setLoading(false);
        return;
      }

      setClinics(data ?? []);
      setLoading(false);

      if (cancelled) return;

      channel = supabase
        .channel(`clinics_${uid}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'clinics', filter: `doctor_id=eq.${uid}` },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const inserted = payload.new as Clinic;
              setClinics((prev) =>
                prev.some((c) => c.id === inserted.id)
                  ? prev
                  : [...prev, inserted].sort((a, b) => a.name.localeCompare(b.name))
              );
            } else if (payload.eventType === 'UPDATE') {
              const updated = payload.new as Clinic;
              setClinics((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
            } else if (payload.eventType === 'DELETE') {
              const deleted = payload.old as { id: string };
              setClinics((prev) => prev.filter((c) => c.id !== deleted.id));
            }
          }
        )
        .subscribe();
    }

    init();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Add clinic
  async function handleAddClinic(e: FormEvent) {
    e.preventDefault();
    const err = validate(form);
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    setSubmitting(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setFormError('Your session expired. Please log in again.');
      setSubmitting(false);
      return;
    }

    const { data: newClinic, error } = await supabase
      .from('clinics')
      .insert({
        doctor_id: session.user.id,
        name: form.name.trim(),
        room_details: form.roomDetails.trim() || null,
        location: form.location.trim(),
        consultation_fee: parseFloat(form.consultationFee),
      })
      .select('id, name, room_details, location, consultation_fee')
      .single();

    setSubmitting(false);

    if (error) {
      setFormError(error.message);
      return;
    }
    if (newClinic) {
      setClinics((prev) => [...prev, newClinic as Clinic].sort((a, b) => a.name.localeCompare(b.name)));
    }
    setForm(BLANK_FORM);
  }

  // Edit clinic
  function startEdit(clinic: Clinic) {
    setEditingId(clinic.id);
    setEditForm({
      name: clinic.name,
      roomDetails: clinic.room_details ?? '',
      location: clinic.location,
      consultationFee: String(clinic.consultation_fee),
    });
    setEditError(null);
  }

  async function handleSaveEdit(clinicId: string) {
    const err = validate(editForm);
    if (err) {
      setEditError(err);
      return;
    }
    setEditError(null);
    setEditSubmitting(true);

    const parsedFee = parseFloat(editForm.consultationFee);
    const { error } = await supabase
      .from('clinics')
      .update({
        name: editForm.name.trim(),
        room_details: editForm.roomDetails.trim() || null,
        location: editForm.location.trim(),
        consultation_fee: parsedFee,
      })
      .eq('id', clinicId);

    setEditSubmitting(false);

    if (error) {
      setEditError(error.message);
      return;
    }

    setClinics((prev) =>
      prev.map((c) =>
        c.id === clinicId
          ? {
              ...c,
              name: editForm.name.trim(),
              room_details: editForm.roomDetails.trim() || null,
              location: editForm.location.trim(),
              consultation_fee: parsedFee,
            }
          : c
      )
    );
    setEditingId(null);
  }

  // Delete clinic (a doctor must keep at least one -- profile-setup/dashboard
  // gating requires >=1 clinics row to be considered onboarded)
  async function handleDelete(clinicId: string) {
    if (clinics.length <= 1) return;
    setDeletingId(clinicId);
    const { error } = await supabase.from('clinics').delete().eq('id', clinicId);
    setDeletingId(null);

    if (error) {
      setFormError(`Could not delete clinic: ${error.message}`);
      return;
    }
    setClinics((prev) => prev.filter((c) => c.id !== clinicId));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-medium text-rose-700">
        {loadError}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">

      {/* Add clinic form */}
      <section className="card p-6 sm:p-7">
        <div className="border-b border-slate-100 pb-4 mb-5">
          <h2 className="text-lg font-bold text-slate-900">Add a Clinic Location</h2>
          <p className="text-sm text-slate-600 mt-1">Add another practice location patients can book at.</p>
        </div>

        <form onSubmit={handleAddClinic} className="flex flex-col gap-4.5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-clinic-name" className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Clinic / Hospital Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="new-clinic-name"
                type="text"
                placeholder="e.g. Angeles University Foundation Medical Center"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-clinic-room" className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Room / Suite Details
                <span className="ml-1.5 text-xs font-normal text-slate-400 normal-case">(optional)</span>
              </label>
              <input
                id="new-clinic-room"
                type="text"
                placeholder="e.g. 3rd Floor, Suite 210"
                value={form.roomDetails}
                onChange={(e) => setForm((f) => ({ ...f, roomDetails: e.target.value }))}
                className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-clinic-location" className="text-xs font-bold uppercase tracking-wider text-slate-600">
                City / Province Location <span className="text-rose-500">*</span>
              </label>
              <input
                id="new-clinic-location"
                type="text"
                placeholder="e.g. MacArthur Highway, Angeles City, Pampanga"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-clinic-fee" className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Consultation Fee (PHP) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₱</span>
                <input
                  id="new-clinic-fee"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="500.00"
                  value={form.consultationFee}
                  onChange={(e) => setForm((f) => ({ ...f, consultationFee: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-3.5 pl-8 pr-4 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
            </div>
          </div>

          {formError && (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
              {formError}
            </p>
          )}

          <div className="flex justify-end pt-1">
            <button
              id="add-clinic-submit"
              type="submit"
              disabled={submitting}
              className="rounded-2xl bg-brand-600 px-7 py-3.5 min-h-[48px] text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              {submitting ? 'Adding clinic…' : '+ Add Clinic Location'}
            </button>
          </div>
        </form>
      </section>

      {/* Existing clinics list */}
      <section className="card p-6 sm:p-7">
        <div className="border-b border-slate-100 pb-4 mb-5">
          <h2 className="text-lg font-bold text-slate-900">Your Practice Locations</h2>
          <p className="text-sm text-slate-600 mt-1">Patients see these clinics on your public profile.</p>
        </div>

        {clinics.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center">
            <p className="text-xs font-medium text-slate-500">No clinics yet. Add one above.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {clinics.map((clinic) => {
              const isEditing = editingId === clinic.id;
              const isDeleting = deletingId === clinic.id;

              if (isEditing) {
                return (
                  <div key={clinic.id} className="rounded-2xl border border-brand-200 bg-brand-50/30 p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Clinic name"
                        className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                      />
                      <input
                        type="text"
                        value={editForm.roomDetails}
                        onChange={(e) => setEditForm((f) => ({ ...f, roomDetails: e.target.value }))}
                        placeholder="Room / suite (optional)"
                        className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                      />
                      <input
                        type="text"
                        value={editForm.location}
                        onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                        placeholder="Location"
                        className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                      />
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₱</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editForm.consultationFee}
                          onChange={(e) => setEditForm((f) => ({ ...f, consultationFee: e.target.value }))}
                          placeholder="Consultation fee"
                          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-7 pr-3.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                        />
                      </div>
                    </div>
                    {editError && <p className="mt-2 text-xs font-medium text-rose-700">{editError}</p>}
                    <div className="mt-3 flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(clinic.id)}
                        disabled={editSubmitting}
                        className="rounded-2xl bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
                      >
                        {editSubmitting ? '…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        disabled={editSubmitting}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={clinic.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-5 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{clinic.name}</p>
                    {clinic.room_details && (
                      <p className="text-xs text-slate-600 mt-0.5">{clinic.room_details}</p>
                    )}
                    <p className="text-xs text-slate-500 mt-0.5">
                      {clinic.location} · ₱
                      {Number(clinic.consultation_fee).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(clinic)}
                      className="card px-3.5 py-1.5 min-h-[38px] text-xs font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(clinic.id)}
                      disabled={isDeleting || clinics.length <= 1}
                      title={clinics.length <= 1 ? 'You must have at least one clinic location' : undefined}
                      className="card px-3.5 py-1.5 min-h-[38px] text-xs font-semibold text-slate-700 transition hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDeleting ? '…' : 'Delete'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
