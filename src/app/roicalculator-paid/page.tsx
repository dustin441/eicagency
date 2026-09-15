import type { Metadata } from 'next';
import RoiCalculatorLanding from '@/components/roi-calculator/RoiCalculatorLanding';

export const metadata: Metadata = {
  title: 'Free ROI Calculator',
  description:
    "Use EIC's free ROI Calculator to estimate your potential return using market benchmark data and receive an AI-assisted planning report by email.",
  alternates: { canonical: '/roicalculator' },
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Free ROI Calculator | EIC',
    description:
      "Use EIC's free ROI Calculator to estimate your potential return using market benchmark data and receive an AI-assisted planning report by email.",
    url: 'https://eic.agency/roicalculator-paid',
    type: 'website',
  },
};

export default function PaidRoiCalculatorPage() {
  return <RoiCalculatorLanding navigation="paid" />;
}