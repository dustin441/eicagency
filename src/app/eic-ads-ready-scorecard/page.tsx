'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowLeft, CheckCircle2, XCircle, AlertCircle, ChevronRight } from 'lucide-react';

// ─── Quiz Data ───────────────────────────────────────────────────────────────

const sections = [
  {
    id: 'audience',
    label: 'Audience Clarity',
    description: "Do you know exactly whom you're targeting?",
    questions: [
      'Do you have a documented Ideal Customer Profile (ICP) with specific demographics, firmographics, or psychographics?',
      "Can you describe your target customer's day-to-day challenges in their own words?",
      'Do you know which platforms and channels your ideal customer uses to research purchases?',
      'Have you validated your audience definition against data from actual paying customers?',
    ],
    risk: 'Without a defined audience, ad platforms optimize toward the wrong people — burning budget on clicks that will never convert.',
    fix: 'Document a single ICP before launching. Interview 3–5 current customers, identify shared traits, and use that profile to set targeting parameters.',
  },
  {
    id: 'content',
    label: 'Content & Creative',
    description: 'Do you have enough compelling assets to test?',
    questions: [
      'Do you have at least 3–5 distinct ad creatives ready to test right now (images, videos, or copy variants)?',
      'Do you have customer testimonials, case studies, or social proof available to use in ads?',
      'Can your team produce new creative assets within two weeks when a campaign needs a refresh?',
      'Do you have a clear, specific value proposition that fits in a single headline or 15-second video?',
    ],
    risk: "Without a content engine, campaigns stall after the first creative set burns out — and there's nothing left to test against.",
    fix: 'Build a minimal creative library before launch: 2 static images, 1 video or UGC clip, and 3 headline variations. Establish a monthly refresh cadence.',
  },
  {
    id: 'alignment',
    label: 'Marketing & Sales Alignment',
    description: 'Is there a clear process for following up with leads?',
    questions: [
      'Does your sales team know which campaigns are currently running and what offer prospects have seen?',
      'Are new leads followed up with within 24 hours, consistently?',
      'Is there a defined handoff process — routing, ownership, and next steps — once a lead comes in?',
      'Does sales have access to the same landing pages and assets that prospects encounter in your ads?',
    ],
    risk: 'Leads that fall into an unmanaged handoff are budget wasted. Marketing can generate demand; a misaligned sales process destroys it.',
    fix: 'Map the lead handoff from form submission to first sales contact. Agree on response SLAs and equip sales with the messaging prospects already saw.',
  },
  {
    id: 'qualification',
    label: 'Lead Qualification',
    description: 'Can you distinguish inquiries from sales-ready opportunities?',
    questions: [
      'Do marketing and sales share a written definition of what counts as a "qualified lead"?',
      'Do you use any form of lead scoring, qualification questions, or disqualification criteria?',
      'Can you reliably distinguish between a Marketing Qualified Lead (MQL) and a Sales Qualified Lead (SQL)?',
      'Do you track and review lead-to-close rates by source or campaign?',
    ],
    risk: 'Without shared qualification criteria, sales wastes time on bad-fit leads while blaming marketing — and marketing has no signal to improve targeting.',
    fix: 'Define your MQL and SQL in one shared document. Add 2–3 qualifying questions to your lead form or first follow-up call to filter fit before sales engages.',
  },
  {
    id: 'reporting',
    label: 'Reporting & Attribution',
    description: 'Can you connect ad spend to pipeline and revenue?',
    questions: [
      'Do you know your current cost per lead (CPL) or cost per acquisition (CPA) by channel?',
      'Can you trace closed revenue back to the specific campaign or ad that generated the original lead?',
      'Do you have conversion tracking (pixel, tag, or server-side) properly set up and verified on your website?',
      'Do you review ad performance metrics — not just impressions and clicks, but leads and pipeline — at least weekly?',
    ],
    risk: "Without attribution, you're optimizing blind. You'll scale what feels good instead of what's actually generating revenue.",
    fix: 'Install conversion tracking before spending a dollar. Set up a simple weekly report that connects campaign spend to leads and, eventually, to closed deals.',
  },
];

type Answers = Record<string, Record<number, boolean>>;

function categoryScore(answers: Answers, sectionId: string, total: number) {
  const a = answers[sectionId] ?? {};
  return Object.values(a).filter(Boolean).length;
}

function scoreColor(score: number, max: number): 'green' | 'yellow' | 'red' {
  const pct = score / max;
  if (pct >= 0.75) return 'green';
  if (pct >= 0.5) return 'yellow';
  return 'red';
}

const colorConfig = {
  green: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
    label: 'Strong',
    icon: CheckCircle2,
  },
  yellow: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
    label: 'Needs Work',
    icon: AlertCircle,
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-700',
    label: 'At Risk',
    icon: XCircle,
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdsReadinessQuiz() {
  const [step, setStep] = useState<'intro' | number | 'results'>('intro');
  const [answers, setAnswers] = useState<Answers>({});

  const totalQuestions = sections.reduce((s, sec) => s + sec.questions.length, 0);
  const totalAnswered = Object.values(answers).reduce(
    (s, sec) => s + Object.keys(sec).length,
    0
  );

  const overallScore = sections.reduce(
    (s, sec) => s + categoryScore(answers, sec.id, sec.questions.length),
    0
  );

  const overallColor = scoreColor(overallScore, totalQuestions);

  const categoryResults = sections.map((sec) => {
    const score = categoryScore(answers, sec.id, sec.questions.length);
    const color = scoreColor(score, sec.questions.length);
    return { ...sec, score, color };
  });

  const topRisks = [...categoryResults]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  function setAnswer(sectionId: string, qIdx: number, val: boolean) {
    setAnswers((prev) => ({
      ...prev,
      [sectionId]: { ...(prev[sectionId] ?? {}), [qIdx]: val },
    }));
  }

  function sectionAnswered(sectionId: string, total: number) {
    return Object.keys(answers[sectionId] ?? {}).length === total;
  }

  const currentSection = typeof step === 'number' ? sections[step] : null;

  // ── Intro ──
  if (step === 'intro') {
    return (
      <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
        <nav className="sticky top-0 z-50 border-b border-brand-forest/10 bg-[#f7f4ef]/90 backdrop-blur-xl">
          <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-3" aria-label="EIC Agency home">
              <img src="/EIC-Logo-Black-Jade.svg" alt="EIC Agency" className="h-10 w-auto sm:h-14" />
            </Link>
            <Link href="/eic-schedule-demo" className="inline-flex items-center gap-2 rounded-full bg-brand-forest px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand-forest/15 transition-transform hover:-translate-y-0.5">
              Schedule a Call
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </nav>

        <section className="relative overflow-hidden px-5 py-20 sm:px-6 lg:px-8">
          <div className="absolute left-1/2 top-0 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-brand-orange/10 blur-3xl" />
          <div className="relative mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-forest/10 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-brand-forest shadow-sm">
              5-Minute Scorecard
            </div>
            <h1 className="text-5xl font-semibold tracking-[-0.055em] text-brand-forest sm:text-6xl lg:text-7xl">
              Are You Ready to Run Paid Ads?
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
              Find out whether your business is ready to profitably run paid ads — and identify the gaps that could waste your budget.
            </p>

            <button
              onClick={() => setStep(0)}
              className="mt-10 inline-flex items-center gap-3 rounded-full bg-brand-forest px-8 py-4 text-base font-bold text-white shadow-xl shadow-brand-forest/20 transition-transform hover:-translate-y-0.5"
            >
              Start the Scorecard
              <ArrowRight className="h-5 w-5" />
            </button>

            <div className="mx-auto mt-12 max-w-2xl rounded-[2rem] border border-brand-forest/10 bg-white p-8 shadow-sm text-left">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-orange mb-5">What this scorecard evaluates</p>
              <ul className="space-y-4">
                {sections.map((sec, i) => (
                  <li key={sec.id} className="flex items-start gap-4">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-forest/10 text-xs font-bold text-brand-forest">{i + 1}</span>
                    <div>
                      <p className="font-semibold text-brand-forest">{sec.label}</p>
                      <p className="mt-0.5 text-sm leading-6 text-slate-600">{sec.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm leading-6 text-slate-500 border-t border-brand-forest/10 pt-5">{totalQuestions} questions · Takes about 5 minutes · Results are instant</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  // ── Results ──
  if (step === 'results') {
    const overallLabel =
      overallColor === 'green' ? 'Ready to Launch' :
      overallColor === 'yellow' ? 'Almost Ready' : 'Not Yet Ready';

    const overallBg =
      overallColor === 'green' ? 'bg-emerald-500' :
      overallColor === 'yellow' ? 'bg-amber-500' : 'bg-red-500';

    return (
      <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
        <nav className="sticky top-0 z-50 border-b border-brand-forest/10 bg-[#f7f4ef]/90 backdrop-blur-xl">
          <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-3">
              <img src="/EIC-Logo-Black-Jade.svg" alt="EIC Agency" className="h-10 w-auto sm:h-14" />
            </Link>
            <Link href="/eic-schedule-demo" className="inline-flex items-center gap-2 rounded-full bg-brand-forest px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand-forest/15 transition-transform hover:-translate-y-0.5">
              Schedule a Call <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </nav>

        <section className="px-5 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-brand-orange">Your Results</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-brand-forest sm:text-5xl">
              Paid Ads Readiness Score
            </h1>

            {/* Overall score */}
            <div className="mt-8 overflow-hidden rounded-[2rem] border border-brand-forest/10 bg-white shadow-sm">
              <div className={`${overallBg} px-8 py-6 text-white`}>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.2em] opacity-80">Overall Score</p>
                    <p className="mt-1 text-5xl font-bold">{overallScore}<span className="text-2xl opacity-60">/{totalQuestions}</span></p>
                  </div>
                  <div className="rounded-2xl bg-white/20 px-6 py-3 text-center">
                    <p className="text-2xl font-bold">{overallLabel}</p>
                    <p className="mt-1 text-sm opacity-80">
                      {overallColor === 'green' && 'Your fundamentals are solid. A well-structured campaign should perform.'}
                      {overallColor === 'yellow' && 'You have a strong foundation but a few gaps to close before scaling.'}
                      {overallColor === 'red' && 'Significant gaps exist that are likely to waste budget without being addressed first.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Final CTA */}
            <div className="mt-10 rounded-[2rem] border border-brand-forest/10 bg-white p-8 shadow-sm sm:p-10">
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-brand-orange">Ready to close the gaps?</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-brand-forest">Book a Complimentary Paid Media Readiness Review</h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                Not sure how to close your readiness gaps? Book a complimentary Paid Media Readiness Review with EIC. We’ll review your results and identify what to fix before you invest more in advertising.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
                <Link
                  href="/eic-schedule-demo"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-forest px-7 py-4 font-bold text-white shadow-lg shadow-brand-forest/15 transition-transform hover:-translate-y-0.5"
                >
                  Book My Readiness Review
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <button
                  onClick={() => { setAnswers({}); setStep('intro'); }}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-forest/15 bg-white px-7 py-4 font-bold text-brand-forest shadow-sm transition-colors hover:bg-slate-50"
                >
                  Retake the Scorecard
                </button>
              </div>
            </div>

            {/* Category breakdown */}
            <h2 className="mt-10 text-2xl font-semibold tracking-[-0.035em] text-brand-forest">Score by Category</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categoryResults.map((cat) => {
                const cfg = colorConfig[cat.color];
                const Icon = cfg.icon;
                return (
                  <div key={cat.id} className={`rounded-[1.75rem] border p-6 ${cfg.bg} ${cfg.border}`}>
                    <div className="flex items-start justify-between gap-3">
                      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${cfg.text}`} />
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${cfg.badge}`}>{cfg.label}</span>
                    </div>
                    <p className={`mt-3 font-semibold ${cfg.text}`}>{cat.label}</p>
                    <p className="mt-1 text-sm text-slate-600">{cat.score} of {cat.questions.length} answered yes</p>
                  </div>
                );
              })}
            </div>

            {/* Top 3 risks */}
            <h2 className="mt-10 text-2xl font-semibold tracking-[-0.035em] text-brand-forest">Your Three Biggest Risks</h2>
            <div className="mt-4 space-y-4">
              {topRisks.map((cat, i) => (
                <div key={cat.id} className="rounded-[1.75rem] border border-brand-forest/10 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-orange/15 text-sm font-bold text-brand-orange">{i + 1}</span>
                    <p className="font-semibold text-brand-forest">{cat.label}</p>
                  </div>
                  <p className="mt-3 leading-7 text-slate-600">{cat.risk}</p>
                </div>
              ))}
            </div>

            {/* Fix before you launch action plan */}
            <div className="mt-10 overflow-hidden rounded-[2rem] border border-brand-forest/10 bg-brand-forest text-white shadow-sm">
              <div className="p-8 sm:p-10">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-orange">Fix Before You Launch</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Your Action Plan</h2>
                <p className="mt-4 leading-7 text-white/70">Based on your lowest-scoring areas, here are the highest-leverage fixes to address before investing in paid advertising.</p>
                <div className="mt-8 space-y-5">
                  {topRisks.map((cat, i) => (
                    <div key={cat.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                      <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-orange">Fix #{i + 1} — {cat.label}</p>
                      <p className="mt-3 leading-7 text-white/80">{cat.fix}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recommended next steps */}
            <h2 className="mt-10 text-2xl font-semibold tracking-[-0.035em] text-brand-forest">Recommended Next Steps</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {[
                { step: '01', title: 'Address your top 3 risks', copy: 'Use the action plan above to close your biggest gaps before launching or scaling any campaigns.' },
                { step: '02', title: 'Re-take the scorecard', copy: "Once you've made changes, run through this scorecard again to measure your progress across all five areas." },
                { step: '03', title: 'Book a Readiness Review', copy: 'Work with the EIC team to validate your setup and build a launch plan tailored to your goals and budget.' },
              ].map((item) => (
                <div key={item.step} className="rounded-[1.75rem] border border-brand-forest/10 bg-white p-6 shadow-sm">
                  <p className="text-3xl font-bold tracking-tight text-brand-orange/50">{item.step}</p>
                  <p className="mt-3 font-semibold text-brand-forest">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    );
  }

  // ── Question Section ──
  const sec = sections[step as number];
  const sectionAnswers = answers[sec.id] ?? {};
  const allAnswered = sectionAnswered(sec.id, sec.questions.length);
  const isLast = (step as number) === sections.length - 1;
  const progress = ((step as number) / sections.length) * 100;

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <nav className="sticky top-0 z-50 border-b border-brand-forest/10 bg-[#f7f4ef]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <img src="/EIC-Logo-Black-Jade.svg" alt="EIC Agency" className="h-10 w-auto sm:h-14" />
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm font-semibold text-slate-500 sm:block">Section {(step as number) + 1} of {sections.length}</span>
            <Link href="/eic-schedule-demo" className="inline-flex items-center gap-2 rounded-full bg-brand-forest px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand-forest/15 transition-transform hover:-translate-y-0.5">
              Schedule a Call <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 w-full bg-brand-forest/10">
          <div
            className="h-1 bg-brand-orange transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </nav>

      <section className="px-5 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <button
            onClick={() => setStep((step as number) === 0 ? 'intro' : (step as number) - 1)}
            className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-brand-forest"
          >
            <ArrowLeft className="h-4 w-4" />
            {(step as number) === 0 ? 'Back to start' : 'Previous section'}
          </button>

          <p className="text-sm font-bold uppercase tracking-[0.22em] text-brand-orange">
            {(step as number) + 1} of {sections.length} — {sec.label}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-brand-forest sm:text-5xl">
            {sec.label}
          </h1>
          <p className="mt-4 text-lg leading-8 text-slate-600">{sec.description}</p>

          <div className="mt-10 space-y-5">
            {sec.questions.map((q, i) => {
              const answered = sectionAnswers[i];
              return (
                <div
                  key={i}
                  className="overflow-hidden rounded-[1.75rem] border border-brand-forest/10 bg-white shadow-sm"
                >
                  <div className="p-6">
                    <p className="font-semibold leading-7 text-brand-forest">{q}</p>
                  </div>
                  <div className="flex border-t border-brand-forest/10">
                    <button
                      onClick={() => setAnswer(sec.id, i, true)}
                      className={`flex flex-1 items-center justify-center gap-2 py-4 text-sm font-bold transition-colors ${
                        answered === true
                          ? 'bg-emerald-500 text-white'
                          : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Yes
                    </button>
                    <div className="w-px bg-brand-forest/10" />
                    <button
                      onClick={() => setAnswer(sec.id, i, false)}
                      className={`flex flex-1 items-center justify-center gap-2 py-4 text-sm font-bold transition-colors ${
                        answered === false
                          ? 'bg-red-500 text-white'
                          : 'text-slate-600 hover:bg-red-50 hover:text-red-700'
                      }`}
                    >
                      <XCircle className="h-4 w-4" />
                      No
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {Object.keys(sectionAnswers).length} of {sec.questions.length} answered
            </p>
            <button
              disabled={!allAnswered}
              onClick={() => isLast ? setStep('results') : setStep((step as number) + 1)}
              className={`inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-bold text-white shadow-lg transition-all ${
                allAnswered
                  ? 'bg-brand-forest shadow-brand-forest/15 hover:-translate-y-0.5'
                  : 'cursor-not-allowed bg-slate-300 shadow-none'
              }`}
            >
              {isLast ? 'See My Results' : 'Next Section'}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
