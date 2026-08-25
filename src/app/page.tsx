import Link from 'next/link';
import ServiceCarousel, { type ServiceCard } from '@/components/home/ServiceCarousel';
import Logo from '@/components/Logo';
import { IconUsers, IconShield, IconStar, IconStethoscope } from '@/components/Icons';

// Editorial photography for the marketing page. Hosted remotely for the demo;
// see next.config.ts. Swap for self-hosted assets before a real deployment.
const IMG = 'https://images.unsplash.com/photo-';
const HERO = `${IMG}1666214280557-f1b5022eb634?w=1920&q=80&auto=format&fit=crop`;
const CARE = `${IMG}1559839734-2b71ea197ec2?w=900&q=80&auto=format&fit=crop`;

const SERVICES: ServiceCard[] = [
  {
    title: 'Check your symptoms',
    action: 'Start now',
    href: '/patient/auth',
    image: `${IMG}1576091160399-112ba8d25d1d?w=640&q=80&auto=format&fit=crop`,
    alt: 'A doctor in a white coat using a phone',
  },
  {
    title: 'Consult a specialist',
    action: 'Find a doctor',
    href: '/patient/doctors',
    image: `${IMG}1631217868264-e5b90bb7e133?w=640&q=80&auto=format&fit=crop`,
    alt: 'A doctor talking with a patient during a consultation',
  },
  {
    title: 'Procedures and surgery',
    action: 'Learn more',
    href: '/patient/doctors',
    image: `${IMG}1551076805-e1869033e561?w=640&q=80&auto=format&fit=crop`,
    alt: 'An operating theatre prepared for a procedure',
  },
  {
    title: 'Clinics near you',
    action: 'Browse clinics',
    href: '/patient/doctors',
    image: `${IMG}1519494026892-80bbd2d6fd0d?w=640&q=80&auto=format&fit=crop`,
    alt: 'The reception desk of a medical clinic',
  },
  {
    title: 'Hospital and in-patient care',
    action: 'Learn more',
    href: '/patient/doctors',
    image: `${IMG}1538108149393-fbbd81895907?w=640&q=80&auto=format&fit=crop`,
    alt: 'Beds in a hospital ward',
  },
  {
    title: 'Understand your condition',
    action: 'Read up',
    href: '/patient/auth',
    image: `${IMG}1530026186672-2cd00ffc50fe?w=640&q=80&auto=format&fit=crop`,
    alt: 'An anatomical heart model resting on an open medical textbook',
  },
];

const PILLARS = [
  {
    icon: <IconStethoscope className="h-6 w-6" />,
    title: 'Triage that names the sub-specialty',
    body: 'Describe symptoms in English or Tagalog. We map you to one of 33 medical fields and the exact sub-specialty, not a generic search result.',
  },
  {
    icon: <IconShield className="h-6 w-6" />,
    title: 'HMO checked before you book',
    body: 'Maxicare, Intellicare, Medicard and PhilCare coverage is verified up front. When nothing matches we say so and show cash rates instead.',
  },
  {
    icon: <IconUsers className="h-6 w-6" />,
    title: 'Book for the people you care for',
    body: 'Arrange consultations for a child or an elderly parent. Specialty routing adjusts to their age, not yours.',
  },
  {
    icon: <IconStar className="h-6 w-6" />,
    title: 'Reviews from completed visits only',
    body: 'Every rating comes from a patient whose consultation actually happened, so the directory reflects real experience.',
  },
];

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-white">
      {/* Utility bar */}
      <div className="hidden border-b border-slate-200 bg-white md:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2 text-xs text-slate-600">
          <span className="font-medium">Philippines</span>
          <div className="flex items-center gap-5">
            <Link href="/patient/doctors" className="hover:text-slate-900">Doctor directory</Link>
            <Link href="/doctor/auth" className="hover:text-slate-900">For clinics</Link>
            <span className="font-medium text-slate-500">EN</span>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Logo size={38} />

          <nav className="flex items-center gap-2 sm:gap-6">
            <Link href="/patient/doctors" className="hidden text-sm font-semibold text-slate-700 hover:text-blue-700 sm:block">
              Find a doctor
            </Link>
            <Link href="/doctor/auth" className="hidden text-sm font-semibold text-slate-700 hover:text-blue-700 sm:block">
              For clinics
            </Link>
            <Link
              href="/patient/auth"
              className="fluid-hover rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
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
          className="h-[440px] w-full object-cover sm:h-[540px]"
        />
        <div className="absolute inset-0 bg-slate-950/55" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            The right doctor, not just any doctor
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-100 sm:text-lg">
            Clinical triage for the Philippines. Tell us what you feel, and we point you to the
            specialist who treats it, at a clinic that takes your HMO.
          </p>
          <Link
            href="/patient/auth"
            className="fluid-hover mt-8 rounded-full bg-blue-600 px-8 py-3.5 text-sm font-bold text-white hover:bg-blue-700 sm:text-base"
          >
            Check your symptoms
          </Link>
        </div>
      </section>

      {/* Sheet that rises over the hero */}
      <div className="relative z-10 -mt-10 rounded-t-[2.5rem] bg-white">
        <section className="mx-auto max-w-6xl px-6 pt-14">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Care for every step, anywhere in the country
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              From a first symptom check to booking a sub-specialist at a clinic near you, each
              step hands off to the next without you starting over.
            </p>
          </div>

          <div className="mt-8">
            <ServiceCarousel cards={SERVICES} />
          </div>
        </section>

        {/* Why it is different */}
        <section className="mt-16 bg-slate-50 py-16">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                A search engine sends you links.
                <span className="mt-1 block text-blue-600">We send you to the right clinic.</span>
              </h2>
              <p className="mt-5 text-base leading-relaxed text-slate-600">
                Most directories stop at the specialty. We keep going to the sub-specialty, verify
                your coverage, and rank real doctors by who can actually see you soonest.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {PILLARS.map((p) => (
                <div key={p.title} className="card p-6 sm:p-7">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    {p.icon}
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-slate-900">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.body}</p>
                </div>
              ))}
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
                  className="fluid-hover rounded-full bg-blue-600 px-6 py-3 text-sm font-bold text-white hover:bg-blue-700"
                >
                  Browse the directory
                </Link>
                <Link
                  href="/patient/auth"
                  className="fluid-hover rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700"
                >
                  Create an account
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Closing panel */}
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="rounded-2xl bg-gradient-to-br from-blue-50 via-indigo-50 to-slate-50 p-10 text-center sm:p-14">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Not sure which doctor you need?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-600">
              That is the part we solve. Describe what you are feeling in your own words, in English
              or Tagalog, and we take it from there.
            </p>
            <Link
              href="/patient/auth"
              className="fluid-hover mt-8 inline-flex rounded-full bg-blue-600 px-8 py-3.5 text-sm font-bold text-white hover:bg-blue-700 sm:text-base"
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
