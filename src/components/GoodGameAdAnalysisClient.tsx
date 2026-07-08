'use client';

import React from 'react';
import { DollarSign, Eye, MousePointer2, Target, ShoppingCart, TrendingUp } from 'lucide-react';
import FilterBar from '@/components/FilterBar';
import { MetaAdPreviews } from '@/components/AdPreviews';
import { cn, fmtNumber, fmtCurrency, fmtPercent, fmtCompact, fmtMoneyPrecise } from '@/lib/utils';
import {
  GOODGAME_OBJECTIVE_LABELS,
  type GoodGameAdAnalysisBlock,
  type GoodGameAdAnalysisData,
} from '@/services/goodgame-ad-analysis';

// ─── KPI strip ──────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  isNorthStar = false,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  isNorthStar?: boolean;
}) {
  return (
    <div
      className={cn(
        'bg-white p-5 rounded-3xl border shadow-sm hover:shadow-lg transition-all group',
        isNorthStar ? 'border-brand-forest/25 ring-1 ring-brand-forest/10 bg-brand-forest/5' : 'border-gray-100'
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={cn('p-2 rounded-xl bg-gray-50 group-hover:scale-110 transition-transform', color)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-2xl font-bold text-brand-dark tabular-nums mb-1">{value}</div>
      <div className="flex items-center gap-2">
        <span className={cn('text-xs font-medium uppercase tracking-widest', isNorthStar ? 'text-brand-forest' : 'text-gray-400')}>
          {title}
        </span>
        {isNorthStar && (
          <span className="text-[9px] font-bold uppercase tracking-widest text-brand-forest bg-brand-forest/10 px-1.5 py-0.5 rounded-full">
            North Star
          </span>
        )}
      </div>
    </div>
  );
}

function KpiStrip({ block }: { block: GoodGameAdAnalysisBlock }) {
  const s = block.summary;
  const isSales = block.objective === 'Sales';
  const cards = [
    { title: 'Spend', value: fmtCurrency(s.spend), icon: DollarSign, color: 'text-indigo-700' },
    { title: 'Impressions', value: fmtCompact(s.impressions), icon: Eye, color: 'text-slate-700' },
    { title: 'Clicks', value: fmtNumber(s.clicks), icon: MousePointer2, color: 'text-blue-700' },
    { title: 'CTR', value: fmtPercent(s.ctr), icon: Target, color: 'text-emerald-700' },
    { title: 'CPC', value: s.cpc > 0 ? fmtMoneyPrecise(s.cpc) : '—', icon: DollarSign, color: 'text-cyan-700' },
    isSales
      ? { title: 'ROAS', value: s.roas > 0 ? `${s.roas.toFixed(2)}x` : '—', icon: TrendingUp, color: 'text-brand-forest', isNorthStar: true }
      : { title: 'Purchases', value: fmtNumber(s.purchases), icon: ShoppingCart, color: 'text-brand-orange' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((c) => (
        <StatCard key={c.title} {...c} />
      ))}
    </div>
  );
}

// ─── Per-objective block ────────────────────────────────────────────────────

function ObjectiveBlock({ block }: { block: GoodGameAdAnalysisBlock }) {
  const label = GOODGAME_OBJECTIVE_LABELS[block.objective];
  const isSales = block.objective === 'Sales';

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-8 w-1.5 rounded-full bg-brand-forest" />
        <h2 className="text-2xl font-bold text-brand-dark tracking-tight">{label}</h2>
        <span className="text-sm text-gray-400 font-medium">{block.ads.length} ads</span>
      </div>

      <KpiStrip block={block} />

      <MetaAdPreviews
        creatives={block.ads}
        title={`${label} — Ad Creatives`}
        description="Ad-level performance, grouped by Ad Name · Video ads open in Facebook Ad Library"
        advertiserName="Good Game"
        metricMode={isSales ? 'sales' : 'leads'}
        salesCac={isSales}
        conversionLabel={{ conversion: 'Purchases', cpa: 'Cost/Purchase' }}
      />
    </section>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function GoodGameAdAnalysisClient({ data }: { data: GoodGameAdAnalysisData }) {
  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-dark tracking-tight">Good Game — Ad Analysis</h1>
          <p className="text-gray-500 mt-1">
            Every Meta ad grouped by Ad Name, split by campaign objective: Traffic, Location, Engagement (Views &amp; Comments) and Sales
          </p>
        </div>

        <FilterBar showChannel={false} />
      </div>

      {data.blocks.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-gray-200 bg-white px-8 py-10 text-center">
          <p className="text-sm text-gray-400">No ads found for this period. Try a wider date range.</p>
        </div>
      ) : (
        data.blocks.map((block) => <ObjectiveBlock key={block.objective} block={block} />)
      )}
    </div>
  );
}
