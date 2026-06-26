import Link from 'next/link';
import { CalendarDays, Clock, ExternalLink } from 'lucide-react';

const bookingUrl = 'https://api.leadconnectorhq.com/widget/booking/LmpcutlyXS4nP3KRjxMu';

const clientLogos = [
  { name: 'Chamfr', image: '/proof/chamfr.png' },
  { name: 'NSI Industries', image: '/proof/nsi.png' },
  { name: 'Denali', image: '/proof/denali.png' },
  { name: 'PrePass', image: '/proof/prepass.png' },
  { name: 'Spartaco Tool Group', image: '/proof/spartaco.png' },
  { name: 'NBD', image: '/proof/NBD_logo.png' },
];

const testimonials = [
  {
    quote:
      'If you want to get the most out of your digital marketing efforts and grow your business, EIC Agency is the best choice. EIC’s software system is robust and multifaceted and almost a one-stop-shop.',
    name: 'Sue R.',
    company: 'Hundred Mile Brewing',
  },
  {
    quote:
      'I interviewed over 30 agencies and EIC was my first choice. Their level of depth, expertise and understanding of the analytics I required was second to none.',
    name: 'Jim L.',
    company: 'NSI Industries',
  },
  {
    quote:
      'EIC’s mastery of CRM automation significantly enhanced our brand’s impact and supercharged our sales team’s efficiency.',
    name: 'Brett M.',
    company: 'Greenlink HCM',
  },
];

const caseStudies = [
  {
    image: '/proof/chamfr-case-study-thumb.jpg',
    title: '900% ROAS increase in 2 months',
    href: 'https://drive.google.com/file/d/1S0KbNbSCw4puhgW_QSkXG-nmRsP_n7y2/view?usp=drive_link',
  },
  {
    image: '/proof/prepass-case-study-thumb.jpg',
    title: '99% CPL reduction and 1,500+ monthly leads',
    href: 'https://drive.google.com/file/d/1uM_ZdXqdMaB-Ob5Wsw-cKt_kbde9yh8M/view',
  },
  {
    image: '/proof/spartaco-case-study-thumb.jpg',
    title: '7x ROAS increase and 85.5% CPL reduction',
    href: 'https://drive.google.com/file/d/1J3KJWxZPju3VEo0TVtpinGldSeOqjpRF/view',
  },
];

export const metadata = {
  title: 'Schedule a Demo | EIC Agency',
  description: 'Book a 30-minute discovery call with EIC Agency.',
};

export default function ScheduleDemoPage() {
  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950 selection:bg-brand-orange/20">
      <section className="relative isolate overflow-hidden border-b border-brand-forest/10 bg-brand-forest text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(235,84,30,0.24),transparent_32%),radial-gradient(circle_at_78%_16%,rgba(23,156,124,0.22),transparent_34%)]" />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(135deg,rgba(255,255,255,.16)_0,transparent_34%,rgba(255,255,255,.08)_62%,transparent_100%)]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-6 py-14 lg:grid-cols-[0.92fr_1.08fr] lg:px-8 lg:py-16">
          <div className="text-center lg:text-left">
            <Link href="/" aria-label="EIC Agency home" className="mx-auto mb-9 block w-20 lg:mx-0">
              <img src="/logo-white.svg" alt="EIC Agency" className="h-auto w-full" />
            </Link>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-white/70">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" />
              30-minute discovery call
            </p>
            <h1 className="mx-auto max-w-2xl text-4xl font-black leading-[1.02] tracking-[-0.045em] sm:text-5xl lg:mx-0 lg:text-6xl">
              Schedule your discovery call with Mike today.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/75 lg:mx-0">
              We’ll show you how our system works and address your questions on a focused 30-minute discovery call.
            </p>
          </div>

          <div className="relative">
            <div className="absolute -inset-5 rounded-[2.5rem] bg-brand-orange/20 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] bg-black shadow-2xl shadow-black/30 ring-8 ring-white/90">
              <div className="relative aspect-video">
                <iframe
                  className="absolute inset-0 h-full w-full"
                  src="https://www.youtube.com/embed/JwRk3RSTOqo?rel=0&controls=1&mute=1"
                  title="EIC Agency overview video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="calendar" className="px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-5 flex flex-col gap-4 rounded-[2rem] border border-brand-forest/10 bg-white px-6 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-forest/5">
                <CalendarDays className="h-5 w-5 text-brand-forest" />
              </div>
              <div>
                <p className="text-sm font-black text-brand-forest">EIC Initial Discovery Call</p>
                <p className="text-xs font-semibold text-slate-500">Select a date and time below</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-4 py-2 text-xs font-black text-white">
              <Clock className="h-3.5 w-3.5" />
              30 min
            </div>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-brand-forest/10 bg-white p-2 shadow-2xl shadow-brand-forest/10">
            <iframe
              src={bookingUrl}
              title="Schedule an EIC Initial Discovery Call"
              className="h-[760px] w-full rounded-[1.5rem] bg-white"
              loading="eager"
            />
          </div>
          <p className="mt-4 text-center text-sm text-slate-500">
            Trouble loading the scheduler?{' '}
            <a href={bookingUrl} className="font-bold text-brand-orange underline" target="_blank" rel="noreferrer">
              Open the calendar in a new tab.
            </a>
          </p>
        </div>
      </section>

      <section id="proof" className="bg-white px-6 py-16 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl text-center">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-slate-500">Our work speaks for itself</p>
          <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-black leading-tight tracking-[-0.045em] text-brand-forest sm:text-5xl">
            Don’t believe us, believe our clients.
          </h2>
          <div className="mt-12 grid grid-cols-2 items-center gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {clientLogos.map((logo) => (
              <div key={logo.name} className="flex h-24 items-center justify-center rounded-2xl border border-brand-forest/10 bg-[#f7f4ef] p-5 shadow-sm">
                <img src={logo.image} alt={logo.name} className="max-h-14 max-w-full object-contain" />
              </div>
            ))}
          </div>
          <div className="mt-12 grid gap-5 text-left lg:grid-cols-3">
            {testimonials.map((testimonial) => (
              <figure key={testimonial.name} className="rounded-[2rem] border border-brand-forest/10 bg-[#f7f4ef] p-7 shadow-sm">
                <blockquote className="text-base leading-8 text-slate-700">“{testimonial.quote}”</blockquote>
                <figcaption className="mt-6 border-t border-brand-forest/10 pt-5">
                  <p className="font-black text-brand-forest">{testimonial.name}</p>
                  <p className="text-sm font-semibold text-slate-500">{testimonial.company}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.24em] text-brand-orange">The proof is in the pudding</p>
            <h2 className="mt-4 text-4xl font-black leading-tight tracking-[-0.045em] text-brand-forest sm:text-5xl">Check out our case studies.</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {caseStudies.map((study) => (
              <a
                key={study.title}
                href={study.href}
                target="_blank"
                rel="noreferrer"
                className="group rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-brand-forest/10 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-forest/10"
              >
                <img src={study.image} alt={study.title} className="aspect-square w-full rounded-[1.5rem] object-cover" />
                <p className="mt-4 min-h-14 text-sm font-bold leading-6 text-brand-forest">{study.title}</p>
                <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-orange px-5 py-3 text-sm font-bold text-white">
                  Download
                  <ExternalLink className="h-4 w-4" />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-black px-6 py-12 text-white lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-5 text-center">
          <Link href="/" aria-label="EIC Agency home" className="block w-16">
            <img src="/logo-white.svg" alt="EIC Agency" className="h-auto w-full" />
          </Link>
          <p className="text-sm text-white/60">© EIC Agency 2026 All Rights Reserved</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm font-semibold text-white/70">
            <a className="hover:text-brand-orange" href="https://www.instagram.com/everyimpressioncounts/" target="_blank" rel="noreferrer">Instagram</a>
            <a className="hover:text-brand-orange" href="https://www.linkedin.com/company/every-impression-counts" target="_blank" rel="noreferrer">LinkedIn</a>
            <a className="hover:text-brand-orange" href="https://www.facebook.com/EveryImpressionCounts" target="_blank" rel="noreferrer">Facebook</a>
            <a className="hover:text-brand-orange" href="https://www.youtube.com/@EICAgency" target="_blank" rel="noreferrer">YouTube</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
