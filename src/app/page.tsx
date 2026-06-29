'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpenText,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  DollarSign,
  Eye,
  Layers3,
  Lock,
  MessageSquare,
  Quote,
  Megaphone,
  MousePointerClick,
  PlayCircle,
  RadioTower,
  RefreshCw,
  ShieldCheck,
  Users,
  Zap,
  TrendingUp,
  UserCheck,
  Search,
  Globe,
  Palette,
  Handshake,
  Sparkles,
} from 'lucide-react';

const fadeIn = {
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const },
};

const painPoints = [
  {
    title: 'Clients leave for full-service agencies',
    copy: "When a client asks for paid ads and you can't deliver, they start shopping around. A white label partner keeps every client relationship inside your agency.",
    icon: Users,
  },
  {
    title: 'Hiring paid media in-house is expensive',
    copy: 'A competent paid media strategist runs $70–120k/year before benefits, tools, and ramp time. White label gives you a senior team for a fraction of that.',
    icon: DollarSign,
  },
  {
    title: 'Referrals quietly kill retention',
    copy: "Sending a client to another agency for paid media creates a competing relationship. White label keeps you as the single point of accountability.",
    icon: Lock,
  },
];

const howItWorks = [
  {
    step: '01',
    title: 'We audit the accounts first',
    copy: "Before a single ad runs, we go into the real accounts. CTR, audience quality, creative performance, conversion rate — all of it. You get a state of the union and a specific media plan before anything launches.",
  },
  {
    step: '02',
    title: 'We build, run, and optimize — invisibly',
    copy: "EIC handles creative production, campaign builds, optimization, and testing. We operate as your agency's paid media arm. No EIC branding. No co-credits.",
  },
  {
    step: '03',
    title: 'Monday updates hit the dashboard automatically',
    copy: "Every Monday, a fresh update is delivered — built from real internal campaign conversations happening 2–3x per week. Clients see what changed, what the data says, and what we're doing next. No one has to ask.",
  },
  {
    step: '04',
    title: 'You keep the relationship. And the margin.',
    copy: "You invoice your client. We invoice you. The client relationship — and the new revenue line — stays entirely yours.",
  },
];

const deliverables = [
  {
    icon: Layers3,
    title: 'Invisible execution',
    copy: "Strategy, creative production, campaign builds, and ongoing optimization — under your agency's brand. No watermarks, no competing relationships, no awkward introductions.",
  },
  {
    icon: Sparkles,
    title: 'Creative included',
    copy: "Hand us raw photos and videos. We turn them into finished, conversion-tested ads using AI-powered production tools. No need to deliver ready-to-run creative — we handle it.",
  },
  {
    icon: RefreshCw,
    title: 'Monday updates, automatically',
    copy: "Every Monday, a client-ready update hits the dashboard — built from real internal campaign conversations happening 2–3x per week. The story is already written. No one has to chase it.",
  },
  {
    icon: Bot,
    title: 'AI assistant connected to your campaigns',
    copy: "Ask anything about performance, spend, or what changed. The AI is connected to live campaign data and internal campaign notes — answers are grounded in what's actually happening, not generic advice.",
  },
];

const pricingTiers = [
  {
    tier: 'Starter',
    price: '$995',
    period: '/mo',
    note: '$995 setup fee',
    copy: 'Hybrid delivery: AI handles the communication layer, humans handle the optimization. Less status chasing, more actual campaign improvement.',
    includes: [
      'Full account audit + media plan',
      '2 campaigns (evergreen + test)',
      'Creative production from raw assets',
      'Weekly Monday dashboard update',
      'AI assistant (connected to live data)',
      'Live performance dashboard',
    ],
    highlight: false,
  },
  {
    tier: 'Growth',
    price: '$1,950',
    period: '/mo',
    note: 'No setup fee',
    copy: 'Everything in Starter, plus a human strategist on your account for agencies that want direct access.',
    includes: [
      'Everything in Starter',
      'Dedicated human strategist',
      'Bi-weekly strategy calls',
      '24-hour email response time',
      '2+ campaigns across channels',
      'Creative testing included',
    ],
    highlight: true,
  },
  {
    tier: 'Performance',
    price: '15%',
    period: 'of ad spend',
    note: '$10k+ monthly budgets',
    copy: 'For high-spend accounts where the fee scales with what you are investing.',
    includes: [
      'Everything in Growth',
      'Scales with your ad spend',
      'Full-funnel measurement',
      'Executive-level readouts',
      'Budget pacing dashboard',
    ],
    highlight: false,
  },
];

const partnerTypes = [
  { icon: Megaphone, label: 'Social Media Agencies', copy: 'You own organic. We own paid. A natural add-on your clients will ask for anyway.' },
  { icon: Search, label: 'SEO Agencies', copy: 'Paid search fills the pipeline while organic rankings build. Complementary, not competing.' },
  { icon: Globe, label: 'Web Design Agencies', copy: 'You build the site. We drive the traffic that actually converts.' },
  { icon: Palette, label: 'Creative Agencies', copy: "Great creative deserves great media distribution. We handle the buying so your work gets seen." },
  { icon: BookOpenText, label: 'PR & Content Agencies', copy: 'Amplify earned media and content with targeted paid campaigns — without touching the client relationship.' },
  { icon: UserCheck, label: 'CRM & Consulting Firms', copy: "Pair strategy and CRM work with the paid engine that feeds the pipeline you're building." },
];

const proofPoints = [
  'Live dashboards built on a real data layer — spend, leads, campaigns, creative, and budget pacing — so your clients always know what they are getting without waiting for a report.',
  'Monday updates are built from internal campaign conversations happening 2–3 times a week. The narrative your clients read is grounded in real strategist and ad manager notes — not generated from thin air.',
  'The AI assistant is connected to your live campaign data and internal notes. Ask why CPL went up last month and get an answer backed by actual account context.',
  'eCommerce and B2B lead gen covered — Google, Meta, LinkedIn, YouTube, and beyond. Full-funnel from first click to closed revenue.',
];

const resourcePosts = [
  {
    title: 'DCO Is the New Standard for Paid Media Success',
    copy: 'How EIC uses dynamic creative optimization to keep campaigns fresh and improve performance month over month.',
    href: '/resources/b2b-lead-gen-dynamic-creative-optimization',
    image: '/resources/assets/6a0f6254e05851175c31dc85-6af6e0ec7f.svg',
  },
  {
    title: 'Use Data Enrichment to Improve Lead Generation',
    copy: 'A practical look at ICP enrichment, lead scoring, and turning colder audiences into better-fit opportunities.',
    href: '/resources/b2b-lead-gen-data-enrichment-ICP',
    image: '/resources/assets/6a05f7720da521d66fece466-2abda21101.svg',
  },
  {
    title: 'The Search to Social Playbook',
    copy: 'The framework for connecting search intent with social retargeting to create more qualified demand for any offer.',
    href: '/resources/eic-search-to-social-playbook',
    image: '/resources/assets/69e16003a2661c2e8fabb1a3-0b49d9e7be.svg',
  },
];

const caseStudies = [
  {
    title: '99% Reduction in CPL, Growth to over 1,500 leads per month',
    copy: 'Complete BI system implementation with dashboards, real-time performance indicators, clear definition of lead quality, full restructuring of all active campaigns.',
    href: 'https://drive.google.com/file/d/1uM_ZdXqdMaB-Ob5Wsw-cKt_kbde9yh8M/view',
    image: '/proof/prepass-case-study-thumb.jpg',
    label: 'Download',
  },
  {
    title: '7x ROAS Increase, 85.5% CPL Reduction',
    copy: 'Launched B2B lead generation campaigns, set up reliable lead and sales tracking, overhauled and optimized active campaigns.',
    href: 'https://drive.google.com/file/d/1J3KJWxZPju3VEo0TVtpinGldSeOqjpRF/view',
    image: '/proof/spartaco-case-study-thumb.jpg',
    label: 'Download',
  },
  {
    title: '900% ROAS Increase in 2 Months',
    copy: 'Full campaign restructuring, audience targeting revamp and BI implementation yielding 9x increases in ROAS in two months.',
    href: 'https://drive.google.com/file/d/1S0KbNbSCw4puhgW_QSkXG-nmRsP_n7y2/view?usp=drive_link',
    image: '/proof/chamfr-case-study-thumb.jpg',
    label: 'Download',
  },
];

const leaders = [
  {
    name: 'Dustin Trout',
    role: '15+ years in digital',
    copy: "Strategy, partner growth, and the systems thinking behind EIC's white label performance engine.",
    href: 'https://www.linkedin.com/in/dustin-trout-32039486/',
    image: '/team/dustin-trout.svg',
  },
  {
    name: 'Mike Patterson',
    role: '12+ years in digital',
    copy: 'Paid media execution, optimization, and hands-on campaign leadership across every channel and budget tier.',
    href: 'https://www.linkedin.com/in/mpattyfly/',
    image: '/team/mike-patterson.svg',
  },
];

const clientLogos = [
  { name: 'Chamfr', image: '/proof/chamfr.png', imgClass: 'w-full h-full object-contain' },
  { name: 'NSI', image: '/proof/nsi.png', imgClass: 'max-h-14' },
  { name: 'Denali', image: '/proof/denali.png', imgClass: 'max-h-14' },
  { name: 'PrePass', image: '/proof/prepass.png', imgClass: 'max-h-14' },
  { name: 'Spartaco Tool Group', image: '/proof/spartaco.png', imgClass: 'max-h-28' },
  { name: 'NBD', image: '/proof/NBD_logo.png', imgClass: 'max-h-20' },
];

const testimonials = [
  { image: '/proof/testimonials/testimonial-1.png', alt: 'EIC client testimonial with client photo' },
  { image: '/proof/testimonials/testimonial-2.png', alt: 'EIC client testimonial with client photo' },
  { image: '/proof/testimonials/testimonial-3.png', alt: 'EIC client testimonial with client photo' },
  { image: '/proof/testimonials/testimonial-4.png', alt: 'EIC client testimonial with client photo' },
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
            Your client's live view
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
                Channels running
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600">
                {['Google', 'Meta', 'LinkedIn', 'YouTube', 'TikTok', 'CRM'].map((item) => (
                  <span key={item} className="rounded-xl border border-slate-200 bg-white px-3 py-2">{item}</span>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                <ClipboardList className="h-4 w-4 text-brand-orange" />
                Weekly readout
              </div>
              <div className="space-y-2 text-xs text-slate-500">
                <p className="rounded-xl bg-slate-50 p-3">What changed this week</p>
                <p className="rounded-xl bg-slate-50 p-3">What the data says</p>
                <p className="rounded-xl bg-slate-50 p-3">What we are doing next</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-5 left-6 hidden rounded-2xl border border-brand-forest/10 bg-white px-4 py-3 text-sm font-semibold text-brand-forest shadow-xl shadow-brand-forest/10 sm:flex sm:items-center sm:gap-2">
        <ShieldCheck className="h-4 w-4 text-brand-orange" />
        White label ready
      </div>
    </div>
  );
}

const dashboardSlides = [
  { src: '/proof/dashboard/dashboard-overview.jpg', alt: 'EIC live dashboard overview — metrics, spend, funnel distribution' },
  { src: '/proof/dashboard/dashboard-segment-cards.jpg', alt: 'EIC dashboard segment performance cards — SMB, ABM, FD360' },
  { src: '/proof/dashboard/dashboard-focus-next-week.jpg', alt: 'EIC weekly focus report — next week priorities' },
  { src: '/proof/dashboard/dashboard-full-report.jpg', alt: 'EIC full weekly report — accomplished and focus' },
  { src: '/proof/dashboard/dashboard-what-accomplished.jpg', alt: 'EIC weekly report — what was accomplished' },
];

function DashboardCarousel() {
  const [current, setCurrent] = useState(0);
  const prev = () => setCurrent((c) => (c - 1 + dashboardSlides.length) % dashboardSlides.length);
  const next = () => setCurrent((c) => (c + 1) % dashboardSlides.length);

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-brand-forest/10 shadow-xl shadow-brand-forest/10">
      <div className="relative h-[420px]">
        {dashboardSlides.map((slide, i) => (
          <div
            key={slide.src}
            className={`absolute inset-0 transition-opacity duration-500 ${i === current ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
          >
            <img src={slide.src} alt={slide.alt} className="h-full w-full object-cover object-top" />
          </div>
        ))}
      </div>

      {/* Left arrow */}
      <button
        onClick={prev}
        className="absolute left-3 top-1/2 z-20 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-md transition hover:bg-white"
        aria-label="Previous slide"
      >
        <ChevronLeft className="h-5 w-5 text-brand-forest" />
      </button>

      {/* Right arrow */}
      <button
        onClick={next}
        className="absolute right-3 top-1/2 z-20 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-md transition hover:bg-white"
        aria-label="Next slide"
      >
        <ChevronRight className="h-5 w-5 text-brand-forest" />
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
        {dashboardSlides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-1.5 rounded-full transition-all ${i === current ? 'w-5 bg-brand-orange' : 'w-1.5 bg-white/60'}`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
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
            <Link href="#who-we-partner-with" className="transition-colors hover:text-brand-forest">Who We Partner With</Link>
            <Link href="#how-it-works" className="transition-colors hover:text-brand-forest">How It Works</Link>
            <Link href="#proof" className="transition-colors hover:text-brand-forest">Proof</Link>
            <Link href="#pricing" className="transition-colors hover:text-brand-forest">Pricing</Link>
            <Link href="#resources" className="transition-colors hover:text-brand-forest">Resources</Link>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden text-sm font-semibold text-slate-600 transition-colors hover:text-brand-forest sm:inline-flex">
              Client login
            </Link>
            <Link
              href="/eic-schedule-demo"
              className="inline-flex items-center gap-2 rounded-full bg-brand-forest px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand-forest/15 transition-transform hover:-translate-y-0.5"
            >
              Become a partner
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden px-5 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24 lg:px-8">
          <div className="absolute left-1/2 top-0 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-brand-orange/10 blur-3xl" />
          <div className="absolute right-0 top-32 h-80 w-80 rounded-full bg-[#179C7C]/15 blur-3xl" />

          <div className="relative mx-auto grid max-w-7xl items-start gap-14 lg:grid-cols-[1.02fr_0.98fr]">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: 'easeOut' }}>
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-brand-forest/10 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-brand-forest shadow-sm">
                <span className="h-2 w-2 rounded-full bg-brand-orange" />
                White label paid media for agencies
              </div>

              <h1 className="max-w-5xl text-5xl font-semibold tracking-[-0.06em] text-brand-forest sm:text-6xl lg:text-7xl xl:text-8xl">
                Your clients want paid ads. Your agency can offer it.
              </h1>

              <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-650 sm:text-xl">
                EIC is the behind-the-scenes performance advertising team for social, SEO, web, and creative agencies. You keep the client relationship. We run the campaigns. Your clients get results in a live dashboard they can actually understand.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/eic-schedule-demo"
                  className="inline-flex items-center justify-center gap-3 rounded-full bg-brand-orange px-7 py-4 text-base font-bold text-white shadow-xl shadow-brand-orange/25 transition-transform hover:-translate-y-0.5"
                >
                  Talk to us about partnering
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  href="#how-it-works"
                  className="inline-flex items-center justify-center gap-3 rounded-full border border-brand-forest/15 bg-white/70 px-7 py-4 text-base font-bold text-brand-forest shadow-sm transition-colors hover:bg-white"
                >
                  See how it works
                  <ChevronRight className="h-5 w-5" />
                </Link>
              </div>

              <div className="mt-10 grid max-w-2xl grid-cols-1 gap-3 text-sm font-semibold text-slate-600 sm:grid-cols-3">
                {['White label execution', 'Client-ready dashboards', 'New revenue for your agency'].map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-2xl border border-brand-forest/10 bg-white/60 px-4 py-3">
                    <CheckCircle2 className="h-4 w-4 text-brand-orange" />
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.75, delay: 0.1, ease: 'easeOut' }} className="lg:mt-16">
              <div className="overflow-hidden rounded-[2rem] border border-brand-forest/10 shadow-2xl shadow-brand-forest/10">
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src="https://www.youtube.com/embed/hXR4qoshTUw"
                    title="White label paid media for agencies"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full"
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Who We Partner With */}
        <section id="who-we-partner-with" className="px-5 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <motion.div {...fadeIn} className="mb-10 max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">Who we partner with</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
                Built for agencies that are great at what they do — and don't do paid.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                If your agency does social, SEO, web, creative, PR, or consulting — and your clients are starting to ask about paid ads — this partnership was built for you.
              </p>
            </motion.div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {partnerTypes.map((type, index) => {
                const Icon = type.icon;
                return (
                  <motion.div
                    key={type.label}
                    {...fadeIn}
                    transition={{ duration: 0.55, delay: index * 0.06, ease: 'easeOut' }}
                    className="group rounded-[2rem] border border-brand-forest/10 bg-white p-7 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-forest/10"
                  >
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-forest text-white">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-semibold tracking-tight text-slate-950">{type.label}</h3>
                    <p className="mt-3 leading-7 text-slate-600">{type.copy}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Pain Points */}
        <section className="px-5 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <motion.div {...fadeIn} className="mb-10 max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">The problem</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
                Agencies without paid media leave three problems unsolved.
              </h2>
            </motion.div>

            <div className="grid gap-5 lg:grid-cols-3">
              {painPoints.map((point, index) => {
                const Icon = point.icon;
                return (
                  <motion.div
                    key={point.title}
                    {...fadeIn}
                    transition={{ duration: 0.55, delay: index * 0.08, ease: 'easeOut' }}
                    className="group relative overflow-hidden rounded-[2rem] border border-brand-forest/10 bg-white p-8 shadow-sm"
                  >
                    <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-orange/10 blur-2xl" />
                    <div className="relative">
                      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-orange/10 text-brand-orange">
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="text-2xl font-semibold tracking-[-0.03em] text-brand-forest">{point.title}</h3>
                      <p className="mt-4 leading-7 text-slate-600">{point.copy}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* How It Works */}
        {/* Feedback Loop */}
        <section className="px-5 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <motion.div {...fadeIn} className="mb-10 max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">How we stay in sync without meetings</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
                Built to answer questions before you have to ask.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                The anxiety with any white label relationship is the same: "Is anyone actually watching? What happens if performance drops and I'm the last to know?" Here is how we solved that without a standing call — and why solving it this way actually improves performance.
              </p>
            </motion.div>

            <div className="grid gap-5 lg:grid-cols-3">
              {[
                {
                  icon: MessageSquare,
                  title: 'Real conversations, 2–3x per week',
                  copy: "Strategists, account managers, and ad managers are in the accounts multiple times a week, reviewing performance, logging changes, and optimizing spend - a real feedback loop, not a dashboard you pull once a month.",
                },
                {
                  icon: RefreshCw,
                  title: 'Monday update writes itself',
                  copy: "Every Monday, those internal conversations get contextualized into a client-ready narrative and pushed directly to the dashboard. Your clients see what changed, what the data says, and what happens next — without anyone sending an email or scheduling a call.",
                },
                {
                  icon: Bot,
                  title: 'AI that actually knows your account',
                  copy: "The AI assistant is connected to your live campaign data and the internal notes your team generates. Ask why cost per lead went up last month and get an answer grounded in what actually happened — not a generic \"it depends.\"",
                },
              ].map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    {...fadeIn}
                    transition={{ duration: 0.55, delay: index * 0.08, ease: 'easeOut' }}
                    className="rounded-[2rem] border border-brand-forest/10 bg-white p-8 shadow-sm"
                  >
                    <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-forest text-white">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-2xl font-semibold tracking-[-0.03em] text-brand-forest">{item.title}</h3>
                    <p className="mt-4 leading-7 text-slate-600">{item.copy}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* What Agencies Get */}
        <section className="px-5 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_1fr] lg:items-start">
            <motion.div {...fadeIn}>
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">What you get</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-brand-forest sm:text-5xl">
                A performance advertising team that operates like it was built inside your agency.
              </h2>
              <p className="mt-6 text-lg leading-8 text-slate-600">
                You stay the hero. We stay invisible. Your clients see results, get answers, and receive a Monday update every week — without anyone scheduling a meeting or chasing a PDF.
              </p>
              <div className="mt-8 space-y-4">
                {[
                  'You own the client relationship — always',
                  'We execute under your agency brand',
                  'Creative production from raw assets — no finished ads required',
                  'Monday updates delivered automatically from real campaign conversations',
                  'AI assistant answers questions from live data — no waiting 24 hours',
                  'White label dashboard on your domain (in development)',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-base font-semibold text-slate-700">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-orange" />
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>

            <div className="space-y-4">
              {deliverables.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    {...fadeIn}
                    transition={{ duration: 0.55, delay: index * 0.06, ease: 'easeOut' }}
                    className="rounded-[1.6rem] border border-brand-forest/10 bg-white p-6 shadow-sm"
                  >
                    <div className="flex gap-5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-orange text-white">
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold tracking-tight text-slate-950">{item.title}</h3>
                        <p className="mt-2 leading-7 text-slate-600">{item.copy}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Proof Loop */}
        <section id="proof" className="px-5 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="rounded-[2.5rem] border border-brand-forest/10 bg-white p-8 shadow-sm sm:p-10 lg:p-14">
              {/* Top row: heading left, carousel right */}
              <motion.div {...fadeIn} className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">The reporting layer</p>
                  <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-brand-forest sm:text-5xl">
                    The dashboard is the differentiator.
                  </h2>
                  <p className="mt-6 text-lg leading-8 text-slate-600">
                    Most white label relationships end with a PDF. EIC's clients — and the agencies that partner with us — get a live system: real data, ad-change history, campaign narratives, and next-step clarity. It is the thing that makes the relationship sticky.
                  </p>
                </div>

                <DashboardCarousel />
              </motion.div>

              {/* Bottom row: 2x2 callouts */}
              <motion.div {...fadeIn} className="mt-10 grid gap-3 sm:grid-cols-2">
                {proofPoints.map((point) => (
                  <div key={point} className="flex items-start gap-4 rounded-2xl bg-slate-50 p-4">
                    <MousePointerClick className="mt-1 h-5 w-5 shrink-0 text-brand-orange" />
                    <p className="font-semibold leading-7 text-slate-700">{point}</p>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        {/* Client Logos */}
        <section className="px-5 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[2.5rem] border border-brand-forest/10 bg-white p-8 shadow-sm sm:p-10 lg:p-12">
            <motion.div {...fadeIn} className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <div className="mb-5 inline-flex items-center gap-3 rounded-full bg-[#f7f4ef] px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-forest">
                  <img src="/proof/five-stars.svg" alt="Five-star review rating" className="h-4 w-auto" />
                  Results that hold up
                </div>
                <h2 className="text-4xl font-semibold tracking-[-0.045em] text-brand-forest sm:text-5xl">
                  Performance advertising work that has to hold up beyond a pretty report.
                </h2>
                <p className="mt-5 text-lg leading-8 text-slate-600">
                  eCommerce, B2B lead gen, multi-location, SaaS, and industrial — backed by the same reporting system agencies use to make confident client presentations.
                </p>
              </div>

              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {clientLogos.map((client) => (
                    <div key={client.name} className="flex min-h-28 items-center justify-center rounded-3xl border border-brand-forest/10 bg-[#f7f4ef] p-5">
                      <img src={client.image} alt={`${client.name} logo`} className={`max-w-full object-contain ${client.imgClass}`} />
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    'eCommerce performance across Google, Meta, and retargeting',
                    'B2B lead gen: pipeline, MQL, SQL, and revenue-tied reporting',
                    'Multi-channel creative testing with documented impact',
                  ].map((item) => (
                    <div key={item} className="rounded-3xl bg-brand-forest p-5 text-sm font-semibold leading-6 text-white/80">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="px-5 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <motion.div {...fadeIn} className="mb-12 max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">Pricing</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-brand-forest sm:text-5xl">
                Transparent tiers. Designed for agency margin.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                Both tiers use the same human team to run and optimize your campaigns. The difference is the communication layer. <strong className="text-slate-900">Starter</strong> is a hybrid model — AI handles data questions and weekly updates, freeing every ad manager hour for actual optimization work. <strong className="text-slate-900">Growth</strong> puts a human strategist in that seat too. Same execution quality either way. You choose based on how much direct human access your client expects.
              </p>
            </motion.div>

            <div className="grid gap-5 lg:grid-cols-3">
              {pricingTiers.map((tier, index) => (
                <motion.div
                  key={tier.tier}
                  {...fadeIn}
                  transition={{ duration: 0.55, delay: index * 0.08, ease: 'easeOut' }}
                  className={`relative overflow-hidden rounded-[2rem] p-8 shadow-sm ${
                    tier.highlight
                      ? 'bg-brand-forest text-white shadow-2xl shadow-brand-forest/30'
                      : 'border border-brand-forest/10 bg-white'
                  }`}
                >
                  {tier.highlight && (
                    <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-brand-orange/15 blur-2xl" />
                  )}
                  <div className="relative">
                    <div className="mb-1 flex items-center justify-between">
                      <span className={`text-sm font-bold uppercase tracking-[0.2em] ${tier.highlight ? 'text-brand-orange' : 'text-brand-orange'}`}>
                        {tier.tier}
                      </span>
                      {tier.highlight && (
                        <span className="rounded-full bg-brand-orange px-3 py-1 text-xs font-bold text-white">Most popular</span>
                      )}
                    </div>
                    <div className="mt-4 flex items-end gap-1">
                      <span className={`text-5xl font-bold tracking-tight ${tier.highlight ? 'text-white' : 'text-brand-forest'}`}>
                        {tier.price}
                      </span>
                      <span className={`mb-2 text-base font-semibold ${tier.highlight ? 'text-white/60' : 'text-slate-500'}`}>
                        {tier.period}
                      </span>
                    </div>
                    <p className={`mt-1 text-sm font-semibold ${tier.highlight ? 'text-white/50' : 'text-slate-500'}`}>{tier.note}</p>
                    <p className={`mt-4 leading-7 ${tier.highlight ? 'text-white/70' : 'text-slate-600'}`}>{tier.copy}</p>

                    <div className={`my-6 h-px ${tier.highlight ? 'bg-white/10' : 'bg-slate-100'}`} />

                    <div className="space-y-3">
                      {tier.includes.map((item) => (
                        <div key={item} className="flex items-center gap-3">
                          <CheckCircle2 className={`h-4 w-4 shrink-0 ${tier.highlight ? 'text-brand-orange' : 'text-brand-orange'}`} />
                          <span className={`text-sm font-semibold ${tier.highlight ? 'text-white/80' : 'text-slate-700'}`}>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

          </div>
        </section>

        <section id="how-it-works" className="px-5 pb-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[2.5rem] bg-brand-forest p-6 text-white shadow-2xl shadow-brand-forest/20 sm:p-10 lg:p-14">
            <motion.div {...fadeIn} className="mb-12 max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">How the partnership works</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
                Four steps from agency gap to new revenue line.
              </h2>
              <p className="mt-5 text-lg leading-8 text-white/65">
                No long onboarding. No complex contracts. You bring the client context, we build and run the machine — invisibly, under your brand.
              </p>
            </motion.div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {howItWorks.map((step, index) => (
                <motion.div
                  key={step.step}
                  {...fadeIn}
                  transition={{ duration: 0.55, delay: index * 0.07, ease: 'easeOut' }}
                  className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
                >
                  <div className="mb-5 text-4xl font-bold tracking-tight text-brand-orange opacity-60">{step.step}</div>
                  <h3 className="text-xl font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/60">{step.copy}</p>
                </motion.div>
              ))}
            </div>

            <motion.div {...fadeIn} className="mt-10 flex justify-start">
              <Link
                href="/eic-schedule-demo"
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brand-orange px-6 py-3 font-bold text-white transition-transform hover:-translate-y-0.5"
              >
                Start the conversation
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="px-5 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <motion.div {...fadeIn} className="mx-auto max-w-4xl text-center">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">Client testimonials</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-brand-forest sm:text-6xl">
                Don't Believe Us. Believe Our Clients.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                Real operators, real results, and performance advertising work that has to hold up beyond the pitch deck. These reviews add the human proof behind the outcomes.
              </p>
            </motion.div>

            <div className="mt-12 grid gap-5 lg:grid-cols-2">
              {testimonials.map((testimonial, index) => (
                <motion.div
                  key={testimonial.image}
                  {...fadeIn}
                  transition={{ duration: 0.55, delay: index * 0.06, ease: 'easeOut' }}
                  className=""
                >
                  <div className="overflow-hidden rounded-[2rem] border border-brand-forest/10 bg-white p-3 shadow-sm transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-brand-forest/10">
                    <img
                      src={testimonial.image}
                      alt={testimonial.alt}
                      className="h-full w-full rounded-[1.5rem] object-contain"
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Case Studies */}
        <section id="case-studies" className="px-5 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] border border-brand-forest/10 bg-white shadow-sm">
            <div className="grid lg:grid-cols-[0.8fr_1.2fr]">
              <motion.div {...fadeIn} className="bg-brand-forest p-8 text-white sm:p-10 lg:p-14">
                <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">Case studies</p>
                <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
                  Don't believe the copy. Believe the work.
                </h2>
                <p className="mt-6 text-lg leading-8 text-white/65">
                  We take great pride in our work.
                </p>
                <p className="mt-4 text-lg leading-8 text-white/65">
                  Check out these case studies for examples of what it actually looks like when performance advertising is executed with the right system behind it.
                </p>
                <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.05] p-5">
                  <Quote className="h-7 w-7 text-brand-orange" />
                  <p className="mt-4 text-xl font-semibold leading-8">
                    "Don't Believe Us. Believe Our Clients."
                  </p>
                  <p className="mt-2 text-sm text-white/50">Agency partners tell us the dashboard is the thing that sells the renewal — not the report.</p>
                </div>
              </motion.div>

              <div className="grid gap-4 p-6 sm:p-8 lg:p-10">
                {caseStudies.map((study, index) => (
                  <motion.article
                    key={study.title}
                    {...fadeIn}
                    transition={{ duration: 0.55, delay: index * 0.06, ease: 'easeOut' }}
                    className={`group rounded-[1.75rem] border border-brand-forest/10 bg-[#f7f4ef] transition-all hover:-translate-y-1 hover:bg-white hover:shadow-xl hover:shadow-brand-forest/10 overflow-hidden ${study.image ? '' : 'p-6'}`}
                  >
                    {study.image ? (
                      <div className="flex h-full items-center gap-0">
                        <div className="shrink-0 p-5">
                          <div className="overflow-hidden rounded-xl border border-brand-forest/10">
                            <img src={study.image} alt={study.title} className="h-36 w-36 object-cover" />
                          </div>
                        </div>
                        <div className="flex flex-1 flex-col justify-between p-4">
                          <div>
                            <h3 className="text-2xl font-semibold tracking-[-0.035em] text-brand-forest">{study.title}</h3>
                            <p className="mt-3 leading-7 text-slate-600">{study.copy}</p>
                          </div>
                          <div className="mt-4 flex justify-end">
                            <Link href={study.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-forest shadow-sm">
                              {study.label ?? 'View'}
                              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1">
                          <h3 className="text-2xl font-semibold tracking-[-0.035em] text-brand-forest">{study.title}</h3>
                          <p className="mt-3 leading-7 text-slate-600">{study.copy}</p>
                        </div>
                        <Link href={study.href} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-forest shadow-sm">
                          {study.label ?? 'View'}
                          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Link>
                      </div>
                    )}
                  </motion.article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Leadership */}
        <section id="leadership" className="px-5 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <motion.div {...fadeIn}>
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">The people behind the system</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-brand-forest sm:text-5xl">
                Senior operators. Not a faceless ad shop.
              </h2>
              <p className="mt-6 text-lg leading-8 text-slate-600">
                Your agency's name is on the client relationship. Trust a white label partner with a combined 27+ years experience — the proof shows up in the work, not just the pitch.
              </p>
              <div className="mt-6 flex gap-3">
                {[
                  { src: '/team/adolfo_profile.png', alt: 'Adolfo' },
                  { src: '/team/adriel_profile.png', alt: 'Adriel' },
                  { src: '/team/gabriela-profile_2.jpg', alt: 'Gabriela' },
                ].map((p) => (
                  <div key={p.alt} className="overflow-hidden rounded-2xl border border-brand-forest/10">
                    <img src={p.src} alt={p.alt} className="h-36 w-36 object-cover" />
                  </div>
                ))}
              </div>
            </motion.div>

            <div className="grid gap-4 sm:grid-cols-2">
              {leaders.map((leader, index) => (
                <motion.article
                  key={leader.name}
                  {...fadeIn}
                  transition={{ duration: 0.55, delay: index * 0.08, ease: 'easeOut' }}
                  className="rounded-[2rem] border border-brand-forest/10 bg-white p-7 shadow-sm"
                >
                  <div className="mb-8 overflow-hidden rounded-3xl border border-brand-forest/10 bg-[#f7f4ef]">
                    <img src={leader.image} alt={`${leader.name} resume`} className="h-48 w-full object-cover object-top" />
                  </div>
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-orange">{leader.role}</p>
                  <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-brand-forest">{leader.name}</h3>
                  <p className="mt-4 leading-7 text-slate-600">{leader.copy}</p>
                  <Link href={leader.href} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 font-bold text-brand-forest">
                    LinkedIn profile
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* Resources */}
        <section id="resources" className="px-5 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <motion.div {...fadeIn} className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">Resources</p>
                <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-brand-forest sm:text-5xl">
                  60+ Instructional Episodes and Downloadable Resources
                </h2>
                <p className="mt-5 text-lg leading-8 text-slate-600">
                  Practical guidance on creative strategy, audience targeting, channel mix, reporting and measurement +more.
                </p>
              </div>
              <Link href="/resources" className="inline-flex items-center justify-center gap-3 rounded-full border border-brand-forest/15 bg-white px-6 py-3 font-bold text-brand-forest shadow-sm transition-colors hover:bg-slate-50">
                View all resources
                <ArrowRight className="h-5 w-5" />
              </Link>
            </motion.div>

            <div className="grid gap-4 lg:grid-cols-3">
              {resourcePosts.map((post, index) => (
                <motion.article
                  key={post.title}
                  {...fadeIn}
                  transition={{ duration: 0.55, delay: index * 0.06, ease: 'easeOut' }}
                  className="group flex flex-col overflow-hidden rounded-[2rem] border border-brand-forest/10 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-brand-forest/10"
                >
                  <div className="flex h-52 w-full items-center justify-center overflow-hidden bg-[#f7f4ef] p-6">
                    <img
                      src={post.image}
                      alt={post.title}
                      className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-1 flex-col justify-between p-7">
                    <div>
                      <h3 className="text-2xl font-semibold tracking-[-0.035em] text-slate-950">{post.title}</h3>
                      <p className="mt-4 leading-7 text-slate-600">{post.copy}</p>
                    </div>
                    <Link href={post.href} className="mt-8 inline-flex items-center gap-2 font-bold text-brand-forest">
                      Read article
                      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-5 pb-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-slate-950 p-8 text-white shadow-2xl shadow-slate-950/20 sm:p-12 lg:p-16">
            <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">Ready to partner?</p>
                <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
                  Add paid media to your agency. Without the hiring, the risk, or the overhead.
                </h2>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-white/60">
                  We start with a real account audit — CTR, audience quality, creative, conversion rate. You get a state of the union and a media plan before we touch anything. One call to get started.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Link href="/eic-schedule-demo" className="inline-flex items-center justify-center gap-3 rounded-full bg-brand-orange px-7 py-4 font-bold text-white transition-transform hover:-translate-y-0.5">
                  Schedule a Call
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
          <p>&copy; {new Date().getFullYear()} EIC Agency. White label performance advertising and client analytics for agencies.</p>
        </div>
      </footer>
    </div>
  );
}
