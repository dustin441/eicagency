'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import {
  sections,
  type Answers,
  categoryScore,
  scoreColor,
  colorConfig,
  SCORECARD_ANSWERS_KEY,
} from '../eic-ads-ready-scorecard/scorecard-data';

export default function ScorecardThankYouPage() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const raw = sessionStorage.getItem(SCORECARD_ANSWERS_KEY);
        setAnswers(raw ? (JSON.parse(raw) as Answers) : null);
      } catch {
        setAnswers(null);
      }
      setLoaded(true);
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (loaded && !answers) {
      router.replace('/eic-ads-ready-scorecard');
    }
  }, [loaded, answers, router]);

  if (!loaded || !answers) {
    return <main className="min-h-screen bg-[#f7f4ef]" />;
  }

  const totalQuestions = sections.reduce((s, sec) => s + sec.questions.length, 0);

  const overallScore = sections.reduce(
    (s, sec) => s + categoryScore(answers, sec.id),
    0
  );

  const overallColor = scoreColor(overallScore, totalQuestions);

  const categoryResults = sections.map((sec) => {
    const score = categoryScore(answers, sec.id);
    const color = scoreColor(score, sec.questions.length);
    return { ...sec, score, color };
  });

  const topRisks = [...categoryResults]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

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

          {/* Final CTA */}
          <div className="mt-10 rounded-[2rem] border border-brand-forest/10 bg-white p-8 shadow-sm sm:p-10">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-brand-orange">Ready to close the gaps?</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-brand-forest">Book a Complimentary Paid Media Readiness Review</h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              Not sure how to close your readiness gaps? Book a complimentary Paid Media Readiness Review with EIC. We&apos;ll review your results and identify what to fix before you invest more in advertising.
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
                onClick={() => {
                  try {
                    sessionStorage.removeItem(SCORECARD_ANSWERS_KEY);
                  } catch {}
                  router.push('/eic-ads-ready-scorecard');
                }}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-forest/15 bg-white px-7 py-4 font-bold text-brand-forest shadow-sm transition-colors hover:bg-slate-50"
              >
                Retake the Scorecard
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
