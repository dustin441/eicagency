'use client';

import React from 'react';
import { DollarSign, Eye, MousePointer2, Target, Users, TrendingUp } from 'lucide-react';
import { MetaAdPreviews } from '@/components/AdPreviews';
import CreativeAiInsightCard from '@/components/CreativeAiInsightCard';
import { cn, fmtNumber, fmtCurrency, fmtCompact, fmtMoneyPrecise } from '@/lib/utils';
import type { CreativeAnalysis } from '@/services/creative-analysis-types';

// summary.ctr is already stored in percent units (0-100), unlike fmtPercent
// (which expects a 0-1 fraction) — format directly to avoid a x100 bug.
function fmtCtr(value: number) {
  return `${value.toFixed(2)}%`;
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-lg transition-all group">
      <div className="flex items-center justify-between mb-3">
        <div className={cn('p-2 rounded-xl bg-gray-50 group-hover:scale-110 transition-transform', color)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-2xl font-bold text-brand-dark tabular-nums mb-1">{value}</div>
      <div className="text-xs font-medium uppercase tracking-widest text-gray-400">{title}</div>
    </div>
  );
}

// One shared "Ad Analysis" client component for every single-brand, Meta-only
// client (Kinsey, Arabella, CBA, Bloom, Duro Dyne). These 5 are structurally
// identical — same card component, same single brand, same channel — so a
// single generic component replaces what would otherwise be 5 near-duplicate
// files, mirroring the Spartaco/NSI "Ad Analysis" pattern.
export default function CreativeAnalysisClient({
  clientName,
  advertiserName,
  logoUrl,
  data,
  metricMode,
  conversionLabel,
}: {
  clientName: string;
  advertiserName: string;
  logoUrl?: string;
  data: CreativeAnalysis;
  metricMode: 'leads' | 'sales';
  conversionLabel?: { conversion: string; cpa: string };
}) {
  const { creatives, summary, aiInsight } = data;
  const label = conversionLabel ?? { conversion: 'Leads', cpa: 'CPL' };

  const cards: { title: string; value: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
    { title: 'Spend', value: fmtCurrency(summary.spend), icon: DollarSign, color: 'text-indigo-700' },
    { title: 'Impressions', value: fmtCompact(summary.impressions), icon: Eye, color: 'text-slate-700' },
    { title: 'Clicks', value: fmtNumber(summary.clicks), icon: MousePointer2, color: 'text-blue-700' },
    { title: 'CTR', value: fmtCtr(summary.ctr), icon: Target, color: 'text-emerald-700' },
    { title: 'CPC', value: summary.cpc > 0 ? fmtMoneyPrecise(summary.cpc) : '—', icon: DollarSign, color: 'text-cyan-700' },
  ];
  if (metricMode === 'sales') {
    cards.push({ title: 'Purchases', value: fmtNumber(summary.sales), icon: Users, color: 'text-brand-forest' });
    cards.push({ title: 'ROAS', value: summary.roas > 0 ? `${summary.roas.toFixed(2)}x` : '—', icon: TrendingUp, color: 'text-brand-orange' });
  } else {
    cards.push({ title: label.conversion, value: fmtNumber(summary.leads), icon: Users, color: 'text-brand-forest' });
    cards.push({ title: label.cpa, value: summary.cpl > 0 ? fmtCurrency(summary.cpl) : '—', icon: TrendingUp, color: 'text-brand-orange' });
  }

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-20">
      <div>
        <h1 className="text-3xl font-bold text-brand-dark tracking-tight">{clientName} — Ad Analysis</h1>
        <p className="text-gray-500 mt-1">
          Creative-level Meta ad performance · same ad running across multiple ad sets/campaigns is merged into one card
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-4">
        {cards.map((c) => (
          <StatCard key={c.title} {...c} />
        ))}
      </div>

      {aiInsight && <CreativeAiInsightCard insight={aiInsight} />}

      <MetaAdPreviews
        creatives={creatives}
        title="Meta Ad Creatives"
        description={`Ad-level performance for ${clientName} · One card per ad name`}
        advertiserName={advertiserName}
        logoUrl={logoUrl}
        metricMode={metricMode}
        conversionLabel={label}
      />
    </div>
  );
}
