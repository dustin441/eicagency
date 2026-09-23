'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { sections, type Answers, SCORECARD_ANSWERS_KEY } from './scorecard-data';

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdsReadinessQuiz() {
  const router = useRouter();
  const [step, setStep] = useState<'intro' | number>('intro');
  const [answers, setAnswers] = useState<Answers>({});

  const totalQuestions = sections.reduce((s, sec) => s + sec.questions.length, 0);

  function setAnswer(sectionId: string, qIdx: number, val: boolean) {
    setAnswers((prev) => ({
      ...prev,
      [sectionId]: { ...(prev[sectionId] ?? {}), [qIdx]: val },
    }));
  }

  function sectionAnswered(sectionId: string, total: number) {
    return Object.keys(answers[sectionId] ?? {}).length === total;
  }

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

            <button
              onClick={() => setStep(0)}
              className="mt-10 inline-flex items-center gap-3 rounded-full bg-brand-forest px-8 py-4 text-base font-bold text-white shadow-xl shadow-brand-forest/20 transition-transform hover:-translate-y-0.5"
            >
              Start the Scorecard
              <ArrowRight className="h-5 w-5" />
            </button>
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
              onClick={() => {
                if (isLast) {
                  try {
                    sessionStorage.setItem(SCORECARD_ANSWERS_KEY, JSON.stringify(answers));
                  } catch {}
                  router.push('/thankyou-scorecard');
                } else {
                  setStep((step as number) + 1);
                }
              }}
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
