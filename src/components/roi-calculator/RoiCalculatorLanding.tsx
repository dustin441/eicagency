'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  RoiLandingHeader,
  HeroSection,
  HowItWorksSection,
  AnalysisIncludesSection,
  ReassuranceSection,
  AboutEicSection,
  DemoCtaSection,
  FaqSection,
} from '@/components/roi-calculator/RoiLandingSections';
import { CalculatorFormModal } from '@/components/roi-calculator/CalculatorFormModal';

export default function RoiCalculatorLanding() {
  const [modalOpen, setModalOpen] = useState(false);
  const openCalculator = () => setModalOpen(true);

  return (
    <div className="min-h-screen bg-[#f7f4ef] font-sans text-slate-900 selection:bg-[#f6821f]/20 selection:text-[#0B3C2D]">
      <RoiLandingHeader onOpenCalculator={openCalculator} />
      <main>
        <HeroSection onOpenCalculator={openCalculator} />
        <HowItWorksSection />
        <AnalysisIncludesSection />
        <ReassuranceSection onOpenCalculator={openCalculator} />
        <AboutEicSection />
        <DemoCtaSection />
        <FaqSection />
      </main>

      <footer className="border-t border-[#0B3C2D]/10 bg-[#f7f4ef] px-5 py-12 text-xs text-slate-600 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-3">
            <Image src="/EIC-Logo-Black-Jade.svg" alt="EIC Logo" width={176} height={64} className="h-8 w-auto" />
            <span>© {new Date().getFullYear()} EIC Agency. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6 font-medium">
            <a href="/privacy" className="hover:text-[#0B3C2D]">Privacy Policy</a>

            <a href="/about-us" className="hover:text-[#0B3C2D]">About Us</a>
          </div>
        </div>
      </footer>

      <CalculatorFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
