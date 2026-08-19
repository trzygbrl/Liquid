import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#F8F7FA] px-4 py-12 sm:px-6 lg:px-8 flex flex-col justify-between">
      <div className="mx-auto w-full max-w-4xl">
        {/* Navigation bar */}
        <header className="flex items-center justify-between border-b border-slate-200/80 pb-6 mb-12">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-600 text-white font-extrabold text-lg shadow-md shadow-violet-500/20">
              CA
            </div>
            <div>
              <span className="text-xl font-extrabold text-slate-900 tracking-tight">
                Civic<span className="text-violet-600">Access</span>
              </span>
              <span className="block text-[10px] uppercase font-bold tracking-widest text-slate-400">
                Philippine Clinical Triage & Directory
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/doctor/auth"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
            >
              Doctor Portal →
            </Link>
          </div>
        </header>

        {/* Hero Section */}
        <div className="rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-8 sm:p-12 text-white shadow-xl shadow-purple-500/15 mb-10 relative overflow-hidden">
          <div className="relative z-10 max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-md mb-4 border border-white/20">
              ✨ AI-Powered Healthcare Navigation
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
              Connect to the right doctor in seconds.
            </h1>
            <p className="mt-4 text-sm sm:text-base leading-relaxed text-purple-100 font-medium">
              Describe what you or your family member are feeling in English or Tagalog. Our clinical AI maps you to 33 specialized medical fields and verified providers.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
              <Link
                href="/patient/auth"
                className="rounded-2xl bg-[#2A2338] px-8 py-4 text-center text-sm sm:text-base font-bold text-white shadow-lg transition hover:bg-[#1E192C] active:scale-[0.98]"
              >
                Start Symptom Check →
              </Link>
              <Link
                href="/patient/doctors"
                className="rounded-2xl bg-white/15 px-6 py-4 text-center text-sm sm:text-base font-bold text-white backdrop-blur-md transition hover:bg-white/25 active:scale-[0.98] border border-white/20"
              >
                Browse 200+ Doctors
              </Link>
            </div>
          </div>

          <div className="absolute right-0 bottom-0 translate-x-8 translate-y-8 opacity-10 text-[180px] pointer-events-none select-none">
            🩺
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 text-2xl mb-4">
              👨‍👩‍👧
            </div>
            <h2 className="text-base font-bold text-slate-900">Family Member Booking</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 font-medium">
              Easily triage and schedule consultations for elderly parents, children, or relatives with age-specific specialty routing.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 text-2xl mb-4">
              🛡️
            </div>
            <h2 className="text-base font-bold text-slate-900">HMO & Cash Transparency</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 font-medium">
              Filter specialists accredited by Maxicare, Intellicare, Medicard, and PhilCare, or view direct cash rates.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 text-2xl mb-4">
              ★
            </div>
            <h2 className="text-base font-bold text-slate-900">Verified Patient Reviews</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 font-medium">
              100% authentic ratings from patients with completed consultations, giving you total peace of mind.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mx-auto w-full max-w-4xl border-t border-slate-200/80 pt-8 mt-16 text-center text-xs text-slate-400">
        <p>© 2026 CivicAccess Philippines. Clinical specialist triage and consultation booking platform.</p>
      </footer>
    </main>
  );
}
