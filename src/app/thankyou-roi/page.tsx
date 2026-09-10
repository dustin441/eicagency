import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { CalendarDays, Check, Clock, Mail, ShieldCheck } from 'lucide-react';
import MarketingHeader from '@/components/MarketingHeader';

const bookingUrl = 'https://api.leadconnectorhq.com/widget/booking/LmpcutlyXS4nP3KRjxMu';

export const metadata: Metadata = {
  title: 'Your ROI Analysis Is on Its Way',
  description:
    'Thanks for submitting your information. EIC is preparing your personalized ROI analysis and will send it to your email shortly.',
  alternates: { canonical: '/thankyou-roi' },
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Your ROI Analysis Is on Its Way | EIC Agency',
    description: 'Your personalized ROI analysis is being prepared and will arrive by email shortly.',
    url: '/thankyou-roi',
  },
};

export default function ThankYouRoiPage() {
  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950 selection:bg-brand-orange/20">
      <MarketingHeader />

      <section className="relative isolate overflow-hidden bg-brand-forest text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(235,84,30,0.28),transparent_30%),radial-gradient(circle_at_82%_22%,rgba(23,156,124,0.25),transparent_34%)]" />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(135deg,rgba(255,255,255,.14)_0,transparent_34%,rgba(255,255,255,.07)_62%,transparent_100%)]" />

        <div className="relative mx-auto max-w-6xl px-6 py-12 sm:py-16 lg:px-8 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-white/75">
                <Check className="h-4 w-4 text-brand-orange" strokeWidth={3} />
                Submission received
              </div>
              <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[0.96] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
                Thank you. Your ROI analysis is on its way.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-white/75">
                We&apos;re combining your information with relevant market benchmarks to prepare your personalized report. We will email it when the analysis is complete. No call is required to receive it.
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/12 bg-white/[0.08] p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-orange text-white shadow-lg shadow-brand-orange/25">
                <Mail className="h-7 w-7" />
              </div>
              <h2 className="mt-6 text-2xl font-black tracking-[-0.035em]">What happens next</h2>
              <div className="mt-6 space-y-5">
                <div className="flex gap-4">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-black text-brand-orange">1</span>
                  <p className="text-sm leading-6 text-white/75">EIC prepares your report using your inputs and current market benchmark data.</p>
                </div>
                <div className="flex gap-4">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-black text-brand-orange">2</span>
                  <p className="text-sm leading-6 text-white/75">Your personalized ROI analysis is sent to the email address you provided.</p>
                </div>
                <div className="flex gap-4">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-black text-brand-orange">3</span>
                  <p className="text-sm leading-6 text-white/75">Review the estimates, assumptions, and practical opportunities highlighted in your report.</p>
                </div>
              </div>
              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/10 p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-orange" />
                <p className="text-xs leading-5 text-white/65">No phone number is required. Your report will be delivered by email.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-brand-orange">While your report is being prepared</p>
            <h2 className="mt-4 text-4xl font-black leading-tight tracking-[-0.045em] text-brand-forest sm:text-5xl">
              Want to explore the opportunity with our team?
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Your report is free whether or not you book a call. If you want help interpreting the estimates or planning your client’s paid media, choose a time to talk with our team.
            </p>
          </div>

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
              loading="lazy"
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

      <footer className="bg-black px-6 py-10 text-white lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 text-center sm:flex-row sm:text-left">
          <Link href="/" aria-label="EIC Agency home" className="block w-14">
            <Image src="/logo-white.svg" alt="EIC Agency" width={56} height={56} className="h-auto w-full" />
          </Link>
          <p className="text-sm text-white/50">© EIC Agency 2026. Every impression counts.</p>
        </div>
      </footer>
    </main>
  );
}
