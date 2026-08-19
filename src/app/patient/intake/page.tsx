import RequireRole from '@/components/RequireRole';
import IntakeFlow from '@/components/IntakeFlow';

function IntakePage() {
  return (
    <main className="flex min-h-screen flex-col bg-slate-950 px-6 py-10">
      {/* Header */}
      <div className="border-b border-slate-800 pb-6 mb-8">
        <span className="text-lg font-bold text-white">
          <span className="text-teal-400">Civic</span>Access
        </span>
        <h1 className="mt-1 text-2xl font-semibold text-white">Check my symptoms</h1>
        <p className="mt-1 text-sm text-slate-400">
          Tell us what you're feeling and we'll help find the right doctor.
        </p>
      </div>

      {/* Constrained width for readability on wider screens */}
      <div className="w-full max-w-lg">
        <IntakeFlow />
      </div>
    </main>
  );
}

export default function PatientIntakePage() {
  return (
    <RequireRole role="patient">
      <IntakePage />
    </RequireRole>
  );
}
