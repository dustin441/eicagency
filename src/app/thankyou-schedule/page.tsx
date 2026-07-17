import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarCheck2,
  Camera,
  Check,
  ExternalLink,
  Mail,
  MessagesSquare,
  Share2,
  Video,
} from 'lucide-react';

const socialImage = '/og-eic-white-label-paid-media.png';

const leaders = [
  {
    name: 'Dustin Trout',
    role: 'Strategy & Partner Growth',
    experience: '15+ years in digital',
    copy: "Dustin leads EIC's strategy, partner growth, and the systems behind our white-label performance engine.",
    href: 'https://www.linkedin.com/in/dustin-trout-32039486/',
    image: '/team/dustin-trout.svg',
  },
  {
    name: 'Mike Patterson',
    role: 'Paid Media Leadership',
    experience: '12+ years in digital',
    copy: 'Mike leads paid media execution, optimization, and hands-on campaign strategy across channels and budget tiers.',
    href: 'https://www.linkedin.com/in/mpattyfly/',
    image: '/team/mike-patterson.svg',
  },
];

const caseStudies = [
  {
    image: '/proof/prepass-case-study-thumb.jpg',
    title: '99% CPL reduction',
    result: 'Growth to 1,500+ leads per month',
    href: 'https://drive.google.com/file/d/1uM_ZdXqdMaB-Ob5Wsw-cKt_kbde9yh8M/view',
  },
  {
    image: '/proof/spartaco-case-study-thumb.jpg',
    title: '7x ROAS increase',
    result: '85.5% reduction in cost per lead',
    href: 'https://drive.google.com/file/d/1J3KJWxZPju3VEo0TVtpinGldSeOqjpRF/view',
  },
  {
    image: '/proof/chamfr-case-study-thumb.jpg',
    title: '900% ROAS increase',
    result: 'Achieved in just two months',
    href: 'https://drive.google.com/file/d/1S0KbNbSCw4puhgW_QSkXG-nmRsP_n7y2/view?usp=drive_link',
  },
];

const socialLinks = [
  {
    name: 'LinkedIn',
    copy: 'Agency insights and paid media strategy',
    href: 'https://www.linkedin.com/company/every-impression-counts',
    icon: Share2,
  },
  {
    name: 'YouTube',
    copy: 'Conversations, explainers, and the EIC Podcast',
    href: 'https://www.youtube.com/@EICAgency',
    icon: Video,
  },
  {
    name: 'Instagram',
    copy: 'Follow the team and our latest work',
    href: 'https://www.instagram.com/everyimpressioncounts/',
    icon: Camera,
  },
  {
    name: 'Facebook',
    copy: 'News, ideas, and updates from EIC',
    href: 'https://www.facebook.com/EveryImpressionCounts',
    icon: MessagesSquare,
  },
];

export const metadata: Metadata = {
  title: 'Your Discovery Call Is Scheduled',
  description: 'Thanks for scheduling a discovery call with EIC Agency. Meet Dustin and Mike, explore client case studies, and connect with EIC online.',
  alternates: {
    canonical: '/thankyou-schedule',
  },
  robots: {
    index: false,
    follow: true,
  },
  openGraph: {
    title: 'Your Discovery Call Is Scheduled | EIC Agency',
    description: 'Thanks for scheduling time with EIC Agency. We look forward to meeting you.',
    url: '/thankyou-schedule',
    images: [socialImage],
  },
};

export default function ThankYouSchedulePage() {
  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950 selection:bg-brand-orange/20">
      <section className="relative isolate overflow-hidden bg-brand-forest text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(235,84,30,0.28),transparent_30%),radial-gradient(circle_at_82%_22%,rgba(23,156,124,0.25),transparent_34%)]" />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(135deg,rgba(255,255,255,.14)_0,transparent_34%,rgba(255,255,255,.07)_62%,transparent_100%)]" />

        <div className="relative mx-auto max-w-6xl px-6 py-10 sm:py-14 lg:px-8 lg:py-20">
          <Link href="/" aria-label="EIC Agency home" className="block w-20">
            <img src="/logo-white.svg" alt="EIC Agency" className="h-auto w-full" />
          </Link>

          <div className="mt-12 grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-white/75">
                <Check className="h-4 w-4 text-brand-orange" strokeWidth={3} />
                Appointment confirmed
              </div>
              <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[0.96] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
                You&apos;re booked. We&apos;re looking forward to meeting you.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-white/72">
                Thanks for scheduling time with EIC Agency. Your call is the start of a practical conversation about your goals, your current paid media operation, and where we can create leverage together.
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/12 bg-white/[0.08] p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-orange text-white shadow-lg shadow-brand-orange/25">
                <CalendarCheck2 className="h-7 w-7" />
              </div>
              <h2 className="mt-6 text-2xl font-black tracking-[-0.035em]">What happens next</h2>
              <div className="mt-6 space-y-5">
                <div className="flex gap-4">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-black text-brand-orange">1</span>
                  <p className="text-sm leading-6 text-white/72">Check your inbox for the calendar confirmation and meeting details.</p>
                </div>
                <div className="flex gap-4">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-black text-brand-orange">2</span>
                  <p className="text-sm leading-6 text-white/72">Bring your goals, questions, and any current paid media challenges you want to unpack.</p>
                </div>
                <div className="flex gap-4">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-black text-brand-orange">3</span>
                  <p className="text-sm leading-6 text-white/72">We&apos;ll use the call to find the clearest next step—whether or not that means working together.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-16 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-brand-orange">Meet your hosts</p>
            <h2 className="mt-4 text-4xl font-black leading-tight tracking-[-0.045em] text-brand-forest sm:text-5xl">
              The people behind the conversation.
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              EIC combines strategic guidance with hands-on execution. Dustin and Mike bring both sides of that equation to every partnership.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {leaders.map((leader) => (
              <article key={leader.name} className="group overflow-hidden rounded-[2rem] border border-brand-forest/10 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-forest/10">
                <div className="grid sm:grid-cols-[210px_1fr]">
                  <div className="flex min-h-64 items-end justify-center overflow-hidden bg-brand-forest/5 px-5 pt-5 sm:min-h-full">
                    <img src={leader.image} alt={leader.name} className="max-h-64 w-full object-contain object-bottom" />
                  </div>
                  <div className="flex flex-col justify-center p-7 sm:p-8">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-orange">{leader.role}</p>
                    <h3 className="mt-3 text-3xl font-black tracking-[-0.04em] text-brand-forest">{leader.name}</h3>
                    <p className="mt-2 text-sm font-bold text-slate-400">{leader.experience}</p>
                    <p className="mt-5 leading-7 text-slate-600">{leader.copy}</p>
                    <a href={leader.href} target="_blank" rel="noreferrer" className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-brand-forest px-5 py-3 text-sm font-bold text-white transition group-hover:bg-brand-orange">
                      Connect on LinkedIn
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-6 py-16 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
            <div className="lg:sticky lg:top-8">
              <p className="text-sm font-black uppercase tracking-[0.24em] text-brand-orange">A little light reading</p>
              <h2 className="mt-4 text-4xl font-black leading-tight tracking-[-0.045em] text-brand-forest sm:text-5xl">
                See what the work can produce.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                These case studies show how better structure, tracking, creative, and optimization translate into measurable business outcomes.
              </p>
              <Link href="/#case-studies" className="mt-7 inline-flex items-center gap-2 text-sm font-black text-brand-forest hover:text-brand-orange">
                Explore more about EIC
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {caseStudies.map((study) => (
                <a key={study.title} href={study.href} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-[2rem] border border-brand-forest/10 bg-[#f7f4ef] p-4 transition hover:-translate-y-1 hover:bg-white hover:shadow-xl hover:shadow-brand-forest/10">
                  <img src={study.image} alt={study.title} className="aspect-square w-full rounded-[1.4rem] object-cover" />
                  <div className="px-2 pb-2 pt-5">
                    <h3 className="text-xl font-black tracking-[-0.035em] text-brand-forest">{study.title}</h3>
                    <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{study.result}</p>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-brand-orange">
                      View case study
                      <ExternalLink className="h-4 w-4" />
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-16 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-brand-forest text-white shadow-2xl shadow-brand-forest/15">
          <div className="grid lg:grid-cols-[0.82fr_1.18fr]">
            <div className="relative overflow-hidden p-8 sm:p-10 lg:p-14">
              <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-brand-orange/25 blur-3xl" />
              <div className="relative">
                <p className="text-sm font-black uppercase tracking-[0.24em] text-brand-orange">Stay connected</p>
                <h2 className="mt-4 text-4xl font-black leading-tight tracking-[-0.045em] sm:text-5xl">
                  Keep the conversation going.
                </h2>
                <p className="mt-5 text-lg leading-8 text-white/65">
                  Follow EIC for paid media insights, honest conversations, podcast episodes, and a look at the systems behind the results.
                </p>
              </div>
            </div>

            <div className="grid gap-px bg-white/10 sm:grid-cols-2">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a key={social.name} href={social.href} target="_blank" rel="noreferrer" className="group bg-brand-forest p-7 transition hover:bg-white/[0.07] sm:p-8">
                    <div className="flex items-center justify-between">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-brand-orange">
                        <Icon className="h-6 w-6" />
                      </div>
                      <ExternalLink className="h-4 w-4 text-white/30 transition group-hover:text-brand-orange" />
                    </div>
                    <h3 className="mt-6 text-xl font-black">{social.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/55">{social.copy}</p>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-20 text-center lg:px-8 lg:pb-28">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-brand-forest/10 bg-white px-7 py-10 shadow-sm sm:px-10">
          <Mail className="mx-auto h-8 w-8 text-brand-orange" />
          <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] text-brand-forest">See you soon.</h2>
          <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600">
            Keep an eye on your inbox for the appointment details. In the meantime, explore our latest thinking and get to know EIC before the call.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/resources" className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-orange px-6 py-3 text-sm font-black text-white transition hover:-translate-y-0.5">
              Explore resources
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/" className="inline-flex items-center justify-center rounded-full border border-brand-forest/15 px-6 py-3 text-sm font-black text-brand-forest transition hover:bg-brand-forest/5">
              Return to EIC Agency
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-black px-6 py-10 text-white lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 text-center sm:flex-row sm:text-left">
          <Link href="/" aria-label="EIC Agency home" className="block w-14">
            <img src="/logo-white.svg" alt="EIC Agency" className="h-auto w-full" />
          </Link>
          <p className="text-sm text-white/50">© EIC Agency 2026. Every impression counts.</p>
        </div>
      </footer>
    </main>
  );
}
