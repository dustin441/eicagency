'use client';

import React, { useState } from "react";
import Image from "next/image";
import {
  BarChart3,
  TrendingUp,
  Clock,
  Mail,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  ArrowRight,
  Sparkles,
  PieChart,
  FileSpreadsheet,
  Target,
  Zap,
  Lock,
  PhoneOff,
  Building2,
  Calendar,
  Menu,
  X,
} from "lucide-react";
import { FAQ_DATA } from "@/lib/roi-calculator-data";

export function RoiLandingHeader({ onOpenCalculator }: { onOpenCalculator: () => void }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-[#0B3C2D]/10 bg-[#f7f4ef]/95 backdrop-blur-xl transition-all">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-5 sm:px-6 lg:px-8">
        <a href="https://eic.agency/" className="flex shrink-0 items-center gap-2">
          <Image
            src="/EIC-Logo-Black-Jade.svg"
            alt="EIC Agency"
            width={176}
            height={64}
            className="h-10 w-auto sm:h-12"
          />
        </a>

        <div className="hidden items-center gap-8 text-sm font-semibold text-slate-700 md:flex">
          <a href="#how-it-works" className="transition-colors hover:text-[#0B3C2D]">
            How It Works
          </a>
          <a href="#analysis-includes" className="transition-colors hover:text-[#0B3C2D]">
            What&apos;s Included
          </a>
          <a href="#about-eic" className="transition-colors hover:text-[#0B3C2D]">
            About EIC
          </a>
          <a href="#faq" className="transition-colors hover:text-[#0B3C2D]">
            FAQ
          </a>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            onClick={onOpenCalculator}
            className="hidden items-center gap-2 rounded-full bg-[#b94708] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#f6821f]/20 transition-all hover:-translate-y-0.5 hover:bg-[#963b08] sm:inline-flex"
          >
            Calculate My ROI
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-xl p-2 text-slate-700 transition-colors hover:bg-[#0B3C2D]/10 md:hidden"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-b border-[#0B3C2D]/10 bg-[#f7f4ef] px-6 py-6 md:hidden">
          <div className="flex flex-col space-y-4 font-semibold text-slate-800">
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-[#0B3C2D]"
            >
              How It Works
            </a>
            <a
              href="#analysis-includes"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-[#0B3C2D]"
            >
              What&apos;s Included
            </a>
            <a
              href="#about-eic"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-[#0B3C2D]"
            >
              About EIC
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-[#0B3C2D]"
            >
              FAQ
            </a>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenCalculator();
              }}
              className="w-full rounded-full bg-[#b94708] py-3 text-center text-sm font-bold text-white shadow-md"
            >
              Calculate My ROI
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

export function HeroSection({ onOpenCalculator }: { onOpenCalculator: () => void }) {
  return (
    <section className="relative overflow-hidden px-5 pb-20 pt-14 sm:px-6 sm:pb-28 sm:pt-20 lg:px-8">
      <div className="absolute left-1/2 top-0 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-[#b94708]/10 blur-3xl pointer-events-none" />
      <div className="absolute right-0 top-32 h-72 w-72 rounded-full bg-[#0B3C2D]/10 blur-3xl pointer-events-none" />

      <div className="relative mx-auto max-w-5xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#0B3C2D]/15 bg-white/80 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#0B3C2D] shadow-xs backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-[#b94708] animate-pulse" />
          100% Free • No Phone Number Required
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-[#0B3C2D] sm:text-6xl lg:text-7xl">
          See What Paid Media Could Deliver for Your Clients
        </h1>

        <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-slate-700 sm:text-xl">
          Compare potential Google and Meta ad performance using your client’s budget, industry, and
          average purchase price and purchases per year. Get a free, AI-assisted 12-month planning report delivered to your inbox.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <button
            onClick={onOpenCalculator}
            className="group inline-flex items-center justify-center gap-3 rounded-full bg-[#b94708] px-8 py-4 text-lg font-bold text-white shadow-xl shadow-[#f6821f]/25 transition-all hover:-translate-y-0.5 hover:bg-[#963b08]"
          >
            Calculate My ROI
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </button>
          <a
            href="#how-it-works"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[#0B3C2D]/15 bg-white/70 px-7 py-4 text-base font-semibold text-[#0B3C2D] shadow-xs transition-colors hover:bg-white"
          >
            How it works
          </a>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 text-sm font-semibold text-slate-700 sm:grid-cols-3 sm:gap-6">
          <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-[#0B3C2D]/10 bg-white/70 px-5 py-3.5 shadow-xs">
            <Clock className="h-5 w-5 text-[#f6821f]" />
            <span>Personalized report by email</span>
          </div>
          <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-[#0B3C2D]/10 bg-white/70 px-5 py-3.5 shadow-xs">
            <PhoneOff className="h-5 w-5 text-[#f6821f]" />
            <span>No phone number requested</span>
          </div>
          <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-[#0B3C2D]/10 bg-white/70 px-5 py-3.5 shadow-xs">
            <BarChart3 className="h-5 w-5 text-[#f6821f]" />
            <span>Based on real market benchmarks</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 border-t border-[#0B3C2D]/10 bg-white/60 px-5 py-20 sm:px-6 sm:py-28 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#b94708]">
            3 Simple Steps
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0B3C2D] sm:text-5xl">
            How the ROI Calculator Works
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
            Share a few details. Explore the estimates. Plan your next move.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          <div className="relative rounded-[2rem] border border-[#0B3C2D]/10 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-[#0B3C2D]/5">
            <div className="absolute -top-5 left-8 flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B3C2D] font-extrabold text-white text-base">
              01
            </div>
            <div className="mt-3 mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0B3C2D]/5 text-[#0B3C2D]">
              <BarChart3 className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-bold text-[#0B3C2D]">Step 1: Tell Us About Your Client</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Share your client’s website, industry, monthly ad budget, average purchase price, and purchases per year.
              We use these inputs to tailor the analysis.
            </p>
          </div>

          <div className="relative rounded-[2rem] border border-[#0B3C2D]/10 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-[#0B3C2D]/5">
            <div className="absolute -top-5 left-8 flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B3C2D] font-extrabold text-white text-base">
              02
            </div>
            <div className="mt-3 mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0B3C2D]/5 text-[#0B3C2D]">
              <FileSpreadsheet className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-bold text-[#0B3C2D]">Step 2: We Build Your Analysis</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              We combine your inputs with industry benchmarks to estimate potential paid media
              outcomes and identify opportunities to investigate.
            </p>
          </div>

          <div className="relative rounded-[2rem] border border-[#0B3C2D]/10 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-[#0B3C2D]/5">
            <div className="absolute -top-5 left-8 flex h-10 w-10 items-center justify-center rounded-xl bg-[#b94708] font-extrabold text-white text-base">
              03
            </div>
            <div className="mt-3 mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#b94708]/10 text-[#f6821f]">
              <Mail className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-bold text-[#0B3C2D]">
              Step 3: Receive Your Personalized Report
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              The calculator combines market benchmark data with your information and generates an
              estimated ROI analysis. Your report is delivered by email once the analysis is complete.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AnalysisIncludesSection() {
  return (
    <section id="analysis-includes" className="scroll-mt-24 px-5 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#b94708]">
              Comprehensive Breakdown
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0B3C2D] sm:text-5xl">
              What Your ROI Analysis Includes
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              Your report provides clear financial context without inflated claims. It delivers
              objective data insights so you can plan growth with confidence.
            </p>

            <div className="mt-8 rounded-2xl border border-[#0B3C2D]/10 bg-white p-6 shadow-xs">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-6 w-6 shrink-0 text-[#0B3C2D]" />
                <div>
                  <h4 className="font-bold text-[#0B3C2D]">Grounded in Reality</h4>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    These are planning estimates, not guaranteed results. Benchmarks, your inputs,
                    sales conversion rates, and business costs all affect the outcome. Revenue
                    projections cover 12 months, not lifetime value, and are not the same as profit.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
            <div className="rounded-2xl border border-[#0B3C2D]/10 bg-white p-6 shadow-xs transition-shadow hover:shadow-md">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#b94708]/10 text-[#f6821f]">
                <TrendingUp className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-[#0B3C2D]">Estimated Potential ROI</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Estimated financial return based on projected conversion improvements and
                acquisition efficiency.
              </p>
            </div>

            <div className="rounded-2xl border border-[#0B3C2D]/10 bg-white p-6 shadow-xs transition-shadow hover:shadow-md">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B3C2D]/10 text-[#0B3C2D]">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-[#0B3C2D]">Market Benchmarks</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Side-by-side comparison with key performance indicators typical for your industry
                category.
              </p>
            </div>

            <div className="rounded-2xl border border-[#0B3C2D]/10 bg-white p-6 shadow-xs transition-shadow hover:shadow-md">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B3C2D]/10 text-[#0B3C2D]">
                <PieChart className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-[#0B3C2D]">Revenue &amp; Cost Projections</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Clear models depicting estimated gross revenue growth versus expected marketing
                expenditure.
              </p>
            </div>

            <div className="rounded-2xl border border-[#0B3C2D]/10 bg-white p-6 shadow-xs transition-shadow hover:shadow-md">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B3C2D]/10 text-[#0B3C2D]">
                <Target className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-[#0B3C2D]">Key Calculation Assumptions</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Complete transparency into the underlying math, formulas, and baseline assumptions
                applied.
              </p>
            </div>

            <div className="rounded-2xl border border-[#0B3C2D]/10 bg-white p-6 shadow-xs transition-shadow hover:shadow-md">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B3C2D]/10 text-[#0B3C2D]">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-[#0B3C2D]">Summary Opportunity Overview</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                An executive-ready summary highlighting immediate growth bottlenecks and potential
                upside.
              </p>
            </div>

            <div className="rounded-2xl border border-[#0B3C2D]/10 bg-white p-6 shadow-xs transition-shadow hover:shadow-md">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#b94708]/10 text-[#f6821f]">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-[#0B3C2D]">Actionable Insights</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Practical next steps customized to your inputs to help realize performance gains.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ReassuranceSection({ onOpenCalculator }: { onOpenCalculator: () => void }) {
  return (
    <section className="bg-[#0B3C2D] text-white px-5 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-5xl rounded-[2.5rem] bg-[#072d23] border border-white/10 p-8 sm:p-12 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-[#b94708]/10 blur-3xl pointer-events-none" />

        <div className="relative text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-[#f6821f]">
            <Lock className="h-7 w-7" />
          </div>

          <h2 className="text-3xl font-extrabold sm:text-4xl">
            100% Free • No Spam • No Phone Required
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-200 sm:text-lg">
            The ROI Calculator is completely free to use. Your information helps us create the
            analysis. We do not require your phone number.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 text-left">
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <CheckCircle2 className="h-5 w-5 text-[#f6821f] mb-2" />
              <h4 className="font-bold text-sm">No Phone Calls</h4>
              <p className="mt-1 text-xs text-slate-300">
                We don&apos;t ask for a phone number, so you won&apos;t receive unwanted sales calls.
              </p>
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <CheckCircle2 className="h-5 w-5 text-[#f6821f] mb-2" />
              <h4 className="font-bold text-sm">Delivered by Email</h4>
              <p className="mt-1 text-xs text-slate-300">
                Enter your email alongside the business details so EIC can send your completed
                report. No call is required to receive it.
              </p>
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <CheckCircle2 className="h-5 w-5 text-[#f6821f] mb-2" />
              <h4 className="font-bold text-sm">Transparent Estimates</h4>
              <p className="mt-1 text-xs text-slate-300">
                The other form fields are strictly used to make your analysis more accurate and
                relevant.
              </p>
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <button
              onClick={onOpenCalculator}
              className="inline-flex items-center justify-center gap-3 rounded-full bg-[#b94708] px-8 py-4 text-base font-bold text-white shadow-xl shadow-black/20 transition-all hover:-translate-y-0.5 hover:bg-[#963b08]"
            >
              Calculate My ROI
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AboutEicSection() {
  return (
    <section
      id="about-eic"
      className="scroll-mt-24 border-t border-[#0B3C2D]/10 bg-white px-5 py-20 sm:px-6 sm:py-28 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#b94708]">
              Trusted Market Intelligence
            </p>
            <h2 className="mt-3 text-3xl font-extrabold text-[#0B3C2D] sm:text-5xl">About EIC</h2>
            <p className="mt-6 text-base leading-relaxed text-slate-700 sm:text-lg">
              EIC is a white-label paid media partner for marketing agencies. We help you plan,
              manage, and explain your clients’ advertising performance.
            </p>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              Use this report to start a more informed client conversation. When you need support
              with Google Ads, Meta Ads, or performance reporting, our team works behind your
              agency’s brand.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-[#0B3C2D]/10 bg-[#f7f4ef] p-5">
                <Building2 className="h-6 w-6 text-[#0B3C2D] mb-2" />
                <h4 className="font-bold text-[#0B3C2D]">Market Intelligence</h4>
                <p className="mt-1 text-xs text-slate-600">
                  Real campaign performance analytics mapped across industries.
                </p>
              </div>
              <div className="rounded-2xl border border-[#0B3C2D]/10 bg-[#f7f4ef] p-5">
                <BarChart3 className="h-6 w-6 text-[#f6821f] mb-2" />
                <h4 className="font-bold text-[#0B3C2D]">Clear Insights</h4>
                <p className="mt-1 text-xs text-slate-600">
                  Transparent reporting focused on practical business outcomes.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative rounded-[2.5rem] border border-[#0B3C2D]/10 bg-[#f7f4ef] p-8 shadow-xl overflow-hidden">
              <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-[#b94708]/10 blur-2xl" />
              <h3 className="text-2xl font-bold text-[#0B3C2D] mb-4">
                Why Decision-Makers Trust EIC
              </h3>
              <ul className="space-y-4 text-sm text-slate-700">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[#f6821f] mt-0.5" />
                  <span>
                    <strong>Data-Driven Precision:</strong> Built on real performance benchmarks
                    rather than theoretical assumptions.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[#f6821f] mt-0.5" />
                  <span>
                    <strong>Actionable Clarity:</strong> Reports strip away fluff to deliver
                    executive summaries you can act on.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[#f6821f] mt-0.5" />
                  <span>
                    <strong>Zero Aggressive Sales:</strong> We let objective data speak for itself
                    so you can make informed choices.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function DemoCtaSection() {
  return (
    <section className="bg-[#0B3C2D] text-white px-5 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-5xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white">
          Schedule A Demo
        </span>

        <h2 className="mt-6 text-3xl font-extrabold sm:text-5xl">
          Want Help Turning the Estimates Into a Plan?
        </h2>

        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-slate-200">

          Book a conversation about your client’s goals and how EIC can support your agency’s paid media delivery.
        </p>

        <div className="mt-10">
          <a
            href="https://eic.agency/eic-schedule-demo"
            className="inline-flex items-center gap-3 rounded-full bg-[#b94708] px-9 py-4 text-lg font-bold text-white shadow-2xl transition-all hover:scale-105 hover:bg-[#963b08]"
          >
            <Calendar className="h-5 w-5" />
            Schedule a Demo
          </a>
        </div>
      </div>
    </section>
  );
}

export function FaqSection() {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  return (
    <section id="faq" className="scroll-mt-24 px-5 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#b94708]">
            Got Questions?
          </p>
          <h2 className="mt-3 text-3xl font-extrabold text-[#0B3C2D] sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Everything you need to know about the free ROI Calculator.
          </p>
        </div>

        <div className="mt-12 space-y-4">
          {FAQ_DATA.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-[#0B3C2D]/10 bg-white overflow-hidden shadow-xs transition-all"
              >
                <button
                  onClick={() => setActiveFaq(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between p-6 text-left font-bold text-[#0B3C2D] hover:bg-[#f7f4ef]/50"
                >
                  <span className="text-base sm:text-lg">{faq.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-[#f6821f] transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="border-t border-[#0B3C2D]/5 px-6 pb-6 pt-4 text-sm leading-relaxed text-slate-600">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
