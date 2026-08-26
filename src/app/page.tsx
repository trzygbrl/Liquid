import Link from 'next/link';
import PillarCarousel from '@/components/home/PillarCarousel';
import Logo from '@/components/Logo';
import { IconUsers, IconShield, IconStar, IconStethoscope } from '@/components/Icons';

// Editorial photography for the marketing page. Hosted remotely for the demo;
// see next.config.ts. Swap for self-hosted assets before a real deployment.
const IMG = 'https://images.unsplash.com/photo-';
const HERO = `${IMG}1666214280557-f1b5022eb634?w=1920&q=80&auto=format&fit=crop`;
const CARE = `${IMG}1559839734-2b71ea197ec2?w=900&q=80&auto=format&fit=crop`;

const PILLARS = [
  {
    icon: <IconStethoscope className="h-6 w-6" />,
    title: 'Triage that names the sub-specialty',
    body: 'Describe symptoms in English or Tagalog. We map you to one of 33 medical fields and the exact sub-specialty, not a generic search result.',
    image: `${IMG}1576091160399-112ba8d25d1d?w=480&q=80&auto=format&fit=crop`,
    alt: 'A doctor in a white coat using a phone',
  },
  {
    icon: <IconShield className="h-6 w-6" />,
    title: 'HMO checked before you book',
    body: 'Maxicare, Intellicare, Medicard and PhilCare coverage is verified up front. When nothing matches we say so and show cash rates instead.',
    image: `${IMG}1666886573531-48d2e3c2b684?w=480&q=80&auto=format&fit=crop`,
    alt: 'A doctor showing a patient something on a tablet',
  },
  {
    icon: <IconUsers className="h-6 w-6" />,
    title: 'Book for the people you care for',
    body: 'Arrange consultations for a child or an elderly parent. Specialty routing adjusts to their age, not yours.',
    image: `${IMG}1765896387377-e293914d1e69?w=480&q=80&auto=format&fit=crop`,
    alt: 'Two women laughing together indoors',
  },
  {
    icon: <IconStar className="h-6 w-6" />,
    title: 'Reviews from completed visits only',
    body: 'Every rating comes from a patient whose consultation actually happened, so the directory reflects real experience.',
    image: `${IMG}1538108149393-fbbd81895907?w=480&q=80&auto=format&fit=crop`,
    alt: 'Beds in a hospital ward',
  },
];

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="relative mx-auto flex max-w-6xl flex-wrap items-center justify-between px-6 py-5">
          <Logo size={46} />

          <nav className="flex items-center gap-2 sm:gap-6">
            <Link href="/patient/doctors" className="group relative hidden text-base font-semibold text-slate-700 hover:text-brand-700 sm:block">
              Find a doctor
              <span className="absolute inset-x-0 -bottom-0.5 h-[3px] origin-left scale-x-0 bg-current transition-transform duration-300 ease-out group-hover:scale-x-100" />
            </Link>
            <Link href="/doctor/auth" className="group relative hidden text-base font-semibold text-slate-700 hover:text-brand-700 sm:block">
              Register as a doctor
              <span className="absolute inset-x-0 -bottom-0.5 h-[3px] origin-left scale-x-0 bg-current transition-transform duration-300 ease-out group-hover:scale-x-100" />
            </Link>
            <Link
              href="/patient/auth"
              className="fluid-hover rounded-full bg-brand-600 px-8 py-2.5 text-base font-bold text-white hover:bg-brand-700"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative isolate">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO}
          alt="A doctor reviewing a scan on screen with a patient"
          className="h-[700px] w-full object-cover sm:h-[720px] lg:h-[720px]"
        />
        <div className="absolute inset-0 bg-slate-950/55" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-100 sm:text-lg">
            Helping you find the right one, the first time. 
          </p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            King KayApp, Kumayap Ka!
          </h1>
          <Link
            href="/patient/auth"
            className="fluid-hover mt-8 rounded-full bg-brand-600 px-8 py-3.5 text-sm font-bold text-white hover:bg-brand-700 sm:text-base"
          >
            Check your symptoms
          </Link>
        </div>
      </section>

      {/* Sheet that rises over the hero */}
      <div className="relative z-10 -mt-15 overflow-hidden rounded-t-[3rem] bg-white">
        {/* Why it is different */}
        <section className="pt-14 bg-slate-50 py-16">
          <div className="mx-auto max-w-6xl px-6">
            <div className="max-w-2xl text-left">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                A search engine sends you links.
                <span className="mt-1 block text-brand-600">We send you to the right clinic.</span>
              </h2>
              <p className="mt-5 text-base leading-relaxed text-slate-600">
                Most directories stop at the specialty. We keep going to the sub-specialty, verify
                your coverage, and rank real doctors by who can actually see you soonest.
              </p>
            </div>

            <div className="pt-10">
              <PillarCarousel cards={PILLARS} />
            </div>
          </div>
        </section>

        {/* Split feature */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={CARE}
                alt="A doctor in a white coat standing outdoors"
                className="h-72 w-full object-cover sm:h-96"
              />
            </div>
            <div>
              <span className="field-label">Verified providers</span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                Over 200 specialists across 33 fields
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Every listing carries the practitioner's credentials, the clinics they hold hours
                at, their consultation fee, and the HMOs they are accredited with. Open slots come
                straight from the doctor's own calendar, so what you see is bookable.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/patient/doctors"
                  className="fluid-hover rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-white hover:bg-brand-700"
                >
                  Browse the directory
                </Link>
                <Link
                  href="/patient/auth"
                  className="fluid-hover rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 hover:border-brand-300 hover:text-brand-700"
                >
                  Create an account
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Closing panel */}
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="rounded-2xl bg-gradient-to-br from-brand-50 via-brand-100 to-slate-50 p-10 text-center sm:p-14">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Not sure which doctor you need?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-600">
              That is the part we solve. Describe what you are feeling in your own words, in English
              or Tagalog, and we take it from there.
            </p>
            <Link
              href="/patient/auth"
              className="fluid-hover mt-8 inline-flex rounded-full bg-brand-600 px-8 py-3.5 text-sm font-bold text-white hover:bg-brand-700 sm:text-base"
            >
              Start a symptom check
            </Link>
            <p className="mt-6 text-xs text-slate-500">
              Not for emergencies. For severe symptoms call 911 or go to the nearest emergency room.
            </p>
          </div>
        </section>
      </div>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 KayApp Philippines. Clinical triage and consultation booking.</p>
          <div className="flex gap-5">
            <Link href="/patient/auth" className="hover:text-slate-900">Patient portal</Link>
            <Link href="/doctor/auth" className="hover:text-slate-900">Doctor portal</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
