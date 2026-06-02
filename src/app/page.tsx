'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Eye,
  Layers3,
  LineChart,
  Megaphone,
  MousePointerClick,
  PlayCircle,
  RadioTower,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Zap,
} from 'lucide-react';

const fadeIn = {
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const },
};

const focusCards = [
  {
    eyebrow: 'For B2B teams',
    title: 'A revenue-focused lead generation system, not another ad vendor.',
    copy:
      'We build the paid media, audience, creative, nurturing, and reporting loop that turns attention into sales-ready conversations.',
    icon: Target,
    bullets: ['Omnichannel paid ads', 'ICP + audience targeting', 'Pipeline and ROI reporting'],
  },
  {
    eyebrow: 'For agencies',
    title: 'White-label paid media execution your clients never need to question.',
    copy:
      'Bring in EIC behind the scenes for ad strategy, optimization, dashboards, and client-ready insights while your agency owns the relationship.',
    icon: Building2,
    bullets: ['Under-your-brand delivery', 'Client dashboard access', 'Reporting your team can present'],
  },
];

const operatingSystem = [
  {
    title: 'Audience',
    copy: 'Translate ICP, CRM, and market context into targetable audiences across LinkedIn, Meta, Google, YouTube, TikTok, and more.',
    icon: Users,
  },
  {
    title: 'Creative',
    copy: 'Run the TOF/MOF/BOF creative loop: problem clarity, trust proof, offers, and continuous DCO based on performance.',
    icon: Sparkles,
  },
  {
    title: 'Media',
    copy: 'Launch and optimize campaigns with channel-specific testing instead of forcing every B2B buyer into LinkedIn only.',
    icon: Megaphone,
  },
  {
    title: 'Measurement',
    copy: 'Connect ad spend, leads, CRM stages, client conversations, and next actions into one executive-level dashboard.',
    icon: LineChart,
  },
];

const proofPoints = [
  'Built on the same SaaS dashboard we use for client performance reporting',
  'Designed around closed-won, cost-per-won, and sales pipeline — not vanity metrics',
  'Can support direct EIC clients or invisible white-label delivery for agencies',
  'Turns Fathom meeting context, ClickUp work, and ad-change history into better reporting narratives',
];

function DashboardPreview() {
  const stages = [
    { label: 'Spend', width: '92%' },
    { label: 'Leads', width: '76%' },
    { label: 'MQL', width: '58%' },
    { label: 'SQL', width: '43%' },
    { label: 'Won', width: '31%' },
  ];

  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-brand-orange/20 via-brand-forest/10 to-[#179C7C]/20 blur-3xl" />
      <div className="relative overflow-hidden rounded-[2rem] border border-brand-forest/10 bg-white shadow-2xl shadow-brand-forest/20">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          </div>
          <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
            Client command center
          </div>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl bg-brand-forest p-5 text-white">
            <div className="mb-8 flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">North Star</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">Cost per won</h3>
              </div>
              <div className="rounded-2xl bg-brand-orange px-3 py-2 text-xs font-bold uppercase tracking-wide">Live</div>
            </div>
            <div className="space-y-4">
              {stages.map((stage) => (
                <div key={stage.label}>
                  <div className="mb-2 flex items-center justify-between text-xs text-white/60">
                    <span>{stage.label}</span>
                    <span>tracked</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-orange to-[#18a77f]" style={{ width: stage.width }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
                <RadioTower className="h-4 w-4 text-brand-orange" />
                Omnichannel mix
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600">
                {['LinkedIn', 'Google', 'Meta', 'YouTube', 'TikTok', 'CRM'].map((item) => (
                  <span key={item} className="rounded-xl border border-slate-200 bg-white px-3 py-2">{item}</span>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                <ClipboardList className="h-4 w-4 text-brand-orange" />
                Client readout
              </div>
              <div className="space-y-2 text-xs text-slate-500">
                <p className="rounded-xl bg-slate-50 p-3">What changed last week</p>
                <p className="rounded-xl bg-slate-50 p-3">What the data says</p>
                <p className="rounded-xl bg-slate-50 p-3">What we are doing next</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-5 left-6 hidden rounded-2xl border border-brand-forest/10 bg-white px-4 py-3 text-sm font-semibold text-brand-forest shadow-xl shadow-brand-forest/10 sm:flex sm:items-center sm:gap-2">
        <ShieldCheck className="h-4 w-4 text-brand-orange" />
        White-label ready
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#f7f4ef] text-slate-950 selection:bg-brand-orange/20">
      <nav className="sticky top-0 z-50 border-b border-brand-forest/10 bg-[#f7f4ef]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="EIC Agency home">
            <img src="/logo.svg" alt="EIC Agency" className="h-9 w-auto" />
          </Link>

          <div className="hidden items-center gap-8 text-sm font-semibold text-slate-600 md:flex">
            <Link href="#focus" className="transition-colors hover:text-brand-forest">Who we help</Link>
            <Link href="#system" className="transition-colors hover:text-brand-forest">System</Link>
            <Link href="#white-label" className="transition-colors hover:text-brand-forest">White label</Link>
            <Link href="#proof" className="transition-colors hover:text-brand-forest">Proof loop</Link>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden text-sm font-semibold text-slate-600 transition-colors hover:text-brand-forest sm:inline-flex">
              Client login
            </Link>
            <Link
              href="https://eic.agency/eic-schedule-demo"
              className="inline-flex items-center gap-2 rounded-full bg-brand-forest px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand-forest/15 transition-transform hover:-translate-y-0.5"
            >
              Book a call
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative overflow-hidden px-5 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24 lg:px-8">
          <div className="absolute left-1/2 top-0 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-brand-orange/10 blur-3xl" />
          <div className="absolute right-0 top-32 h-80 w-80 rounded-full bg-[#179C7C]/15 blur-3xl" />

          <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.02fr_0.98fr]">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: 'easeOut' }}>
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-brand-forest/10 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-brand-forest shadow-sm">
                <span className="h-2 w-2 rounded-full bg-brand-orange" />
                Paid media + client analytics
              </div>

              <h1 className="max-w-5xl text-5xl font-semibold tracking-[-0.06em] text-brand-forest sm:text-6xl lg:text-7xl xl:text-8xl">
                Your ads team, dashboard, and growth loop in one system.
              </h1>

              <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-650 sm:text-xl">
                EIC helps B2B companies scale sales-ready conversations — and gives agencies a white-label paid media engine they can confidently put in front of clients.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="https://eic.agency/eic-schedule-demo"
                  className="inline-flex items-center justify-center gap-3 rounded-full bg-brand-orange px-7 py-4 text-base font-bold text-white shadow-xl shadow-brand-orange/25 transition-transform hover:-translate-y-0.5"
                >
                  Build my growth system
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  href="#white-label"
                  className="inline-flex items-center justify-center gap-3 rounded-full border border-brand-forest/15 bg-white/70 px-7 py-4 text-base font-bold text-brand-forest shadow-sm transition-colors hover:bg-white"
                >
                  Explore white-label ads
                  <ChevronRight className="h-5 w-5" />
                </Link>
              </div>

              <div className="mt-10 grid max-w-2xl grid-cols-1 gap-3 text-sm font-semibold text-slate-600 sm:grid-cols-3">
                {['B2B paid media', 'White-label delivery', 'Client-ready dashboards'].map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-2xl border border-brand-forest/10 bg-white/60 px-4 py-3">
                    <CheckCircle2 className="h-4 w-4 text-brand-orange" />
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.75, delay: 0.1, ease: 'easeOut' }}>
              <DashboardPreview />
            </motion.div>
          </div>
        </section>

        <section id="focus" className="px-5 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <motion.div {...fadeIn} className="mb-10 max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">Two ways to work with EIC</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
                Direct B2B growth or invisible agency execution.
              </h2>
            </motion.div>

            <div className="grid gap-5 lg:grid-cols-2">
              {focusCards.map((card, index) => {
                const Icon = card.icon;
                return (
                  <motion.article
                    key={card.eyebrow}
                    {...fadeIn}
                    transition={{ duration: 0.55, delay: index * 0.08, ease: 'easeOut' }}
                    className="group relative overflow-hidden rounded-[2rem] border border-brand-forest/10 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-brand-forest/10"
                  >
                    <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand-orange/10 blur-2xl transition-transform group-hover:scale-125" />
                    <div className="relative">
                      <div className="mb-8 flex items-center justify-between">
                        <div className="rounded-2xl bg-brand-forest p-3 text-white">
                          <Icon className="h-7 w-7" />
                        </div>
                        <span className="rounded-full bg-brand-orange/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-orange">
                          {card.eyebrow}
                        </span>
                      </div>
                      <h3 className="text-3xl font-semibold tracking-[-0.035em] text-brand-forest">{card.title}</h3>
                      <p className="mt-5 text-lg leading-8 text-slate-600">{card.copy}</p>
                      <div className="mt-8 grid gap-3 sm:grid-cols-3">
                        {card.bullets.map((bullet) => (
                          <div key={bullet} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                            {bullet}
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="system" className="px-5 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[2.5rem] bg-brand-forest p-6 text-white shadow-2xl shadow-brand-forest/20 sm:p-10 lg:p-14">
            <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
              <motion.div {...fadeIn}>
                <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">The operating system</p>
                <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
                  Ads work better when every part of the loop is connected.
                </h2>
                <p className="mt-6 text-lg leading-8 text-white/65">
                  The site should sell what makes EIC different: strategy, execution, measurement, and the decision-making cadence clients actually need after launch.
                </p>
              </motion.div>

              <div className="grid gap-4 sm:grid-cols-2">
                {operatingSystem.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={item.title}
                      {...fadeIn}
                      transition={{ duration: 0.55, delay: index * 0.06, ease: 'easeOut' }}
                      className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
                    >
                      <Icon className="h-7 w-7 text-brand-orange" />
                      <h3 className="mt-5 text-xl font-semibold tracking-tight">{item.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-white/60">{item.copy}</p>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section id="white-label" className="px-5 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
            <motion.div {...fadeIn} className="rounded-[2rem] border border-brand-forest/10 bg-white p-8 shadow-sm">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">White-label emphasis</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-brand-forest sm:text-5xl">
                Give your agency a paid media department without hiring one.
              </h2>
              <p className="mt-6 text-lg leading-8 text-slate-600">
                EIC can sit behind your brand as the ads, analytics, and optimization partner. Your clients see a polished system. Your team gets clear strategy, campaign actions, and reporting support.
              </p>
              <div className="mt-8 space-y-4">
                {['You own the client relationship', 'We handle the paid media engine', 'Dashboards make results easier to explain', 'Reporting ties actions to performance'].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-base font-semibold text-slate-700">
                    <CheckCircle2 className="h-5 w-5 text-brand-orange" />
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div {...fadeIn} className="space-y-4">
              {[
                { icon: Layers3, title: 'Plug-in team', copy: 'Strategy, media buying, creative testing, and optimization capacity for your agency.' },
                { icon: Eye, title: 'Client-visible clarity', copy: 'A polished dashboard experience that helps clients understand what happened, why, and what comes next.' },
                { icon: PlayCircle, title: 'Presentation-ready reporting', copy: 'Insights can connect performance data with call context, ClickUp work, and campaign changes.' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-[1.6rem] border border-brand-forest/10 bg-white/70 p-6 shadow-sm">
                    <div className="flex gap-5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-orange text-white">
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold tracking-tight text-slate-950">{item.title}</h3>
                        <p className="mt-2 leading-7 text-slate-600">{item.copy}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </div>
        </section>

        <section id="proof" className="px-5 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <motion.div {...fadeIn} className="grid gap-10 rounded-[2.5rem] border border-brand-forest/10 bg-white p-8 shadow-sm sm:p-10 lg:grid-cols-[0.9fr_1.1fr] lg:p-14">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">Proof loop</p>
                <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-brand-forest sm:text-5xl">
                  The homepage should sell the system clients already experience.
                </h2>
                <p className="mt-6 text-lg leading-8 text-slate-600">
                  This redesign can turn the dashboard product into the front door: one message for B2B companies, one stronger path for agencies that want EIC as their white-label ads partner.
                </p>
              </div>

              <div className="grid gap-3">
                {proofPoints.map((point) => (
                  <div key={point} className="flex items-start gap-4 rounded-2xl bg-slate-50 p-4">
                    <MousePointerClick className="mt-1 h-5 w-5 shrink-0 text-brand-orange" />
                    <p className="font-semibold leading-7 text-slate-700">{point}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        <section className="px-5 pb-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-slate-950 p-8 text-white shadow-2xl shadow-slate-950/20 sm:p-12 lg:p-16">
            <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">Next step</p>
                <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
                  Let’s make the site feel as strong as the system behind it.
                </h2>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-white/60">
                  Start with the homepage, then split the experience into dedicated B2B growth and white-label agency pages.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Link href="https://eic.agency/eic-schedule-demo" className="inline-flex items-center justify-center gap-3 rounded-full bg-brand-orange px-7 py-4 font-bold text-white transition-transform hover:-translate-y-0.5">
                  Book a call
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link href="/login" className="inline-flex items-center justify-center gap-3 rounded-full border border-white/10 bg-white/5 px-7 py-4 font-bold text-white transition-colors hover:bg-white/10">
                  Client login
                  <Zap className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-brand-forest/10 px-5 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <img src="/logo.svg" alt="EIC Agency" className="h-8 w-auto opacity-80" />
          <p>&copy; {new Date().getFullYear()} EIC Agency. Paid media, analytics, and white-label growth systems.</p>
        </div>
      </footer>
    </div>
  );
}
