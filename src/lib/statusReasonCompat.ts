// src/lib/statusReasonCompat.ts
//
// Bridge for databases where migration 0007_appointment_status_reason.sql has
// not been applied yet.
//
// Without that column, every appointments query naming `status_reason` is
// rejected wholesale by PostgREST (HTTP 400, Postgres 42703). On the patient
// dashboard that meant a broken query and an empty account rendered
// identically, so the failure went unnoticed for a long time.
//
// Rather than drop decline/cancel reasons from the client to match the older
// schema, we detect that one specific error and retry against the pre-0007
// shape. Reads lose nothing (the reason line simply does not render); writes
// still apply the status change, but the reason text has nowhere to go.
//
// Once 0007 is applied the fallback stops firing. Delete this file and its
// call sites in AppointmentsDashboard.tsx and patient/dashboard/page.tsx once
// every environment is known to be migrated.

/** Postgres undefined_column. */
const UNDEFINED_COLUMN = '42703';

// null = not yet determined. Cached for the page load so the retry costs one
// extra round trip in total, not one per query.
let columnExists: boolean | null = null;

interface PostgrestErrorLike {
  code?: string;
  message?: string;
}

/** True when `error` is Postgres reporting that status_reason is missing. */
export function isMissingStatusReason(error: PostgrestErrorLike | null): boolean {
  if (!error) return false;
  return error.code === UNDEFINED_COLUMN && (error.message ?? '').includes('status_reason');
}

/**
 * Whether to include `status_reason` in the next query. Optimistic: we assume
 * the column is there until a query proves otherwise.
 */
export function hasStatusReason(): boolean {
  return columnExists !== false;
}

/** Record that the column is absent, warning once per page load. */
export function noteMissingStatusReason(context: string): void {
  if (columnExists === false) return;
  columnExists = false;
  console.warn(
    `[${context}] appointments.status_reason does not exist, so decline and ` +
      'cancel reasons cannot be saved. Apply ' +
      'supabase/migrations/0007_appointment_status_reason.sql to this database.',
  );
}
