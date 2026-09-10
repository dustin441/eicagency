import type { Metadata } from 'next';
import RoiCalculatorLanding from '@/components/roi-calculator/RoiCalculatorLanding';

export const metadata: Metadata = {
  title: 'Free ROI Calculator',
  description:
    "Use EIC's free ROI Calculator to estimate your potential return using market benchmark data and receive an AI-assisted planning report by email.",
  alternates: { canonical: '/roicalculator' },
  openGraph: {
    title: 'Free ROI Calculator | EIC',
    description:
      "Use EIC's free ROI Calculator to estimate your potential return using market benchmark data and receive an AI-assisted planning report by email.",
    url: 'https://eic.agency/roicalculator',
    type: 'website',
  },
};

export default function RoiCalculatorPage() {
  return <RoiCalculatorLanding />;
}
