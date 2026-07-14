'use client';

import React, { useState } from 'react';
import { DollarSign, Eye, MousePointer2, Target, Users, TrendingUp, Search as SearchIcon, LayoutGrid, Image as ImageIcon } from 'lucide-react';
import { MetaAdPreviews, GoogleAdPreviews } from '@/components/AdPreviews';
import CreativeAiInsightCard from '@/components/CreativeAiInsightCard';
import { cn, fmtNumber, fmtCurrency, fmtCompact, fmtMoneyPrecise, fmtPercent } from '@/lib/utils';
import type { CreativeAnalysis, PmaxImageCreative } from '@/services/creative-analysis-types';

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

// ─── PMax image card ─────────────────────────────────────────────────────────

const AD_GRADIENTS = [['#0B4A31','#0f766e'],['#EB541E','#b91c1c'],['#1e3a8a','#0ea5e9'],['#4c1d95','#7c3aed'],['#92400e','#f59e0b'],['#0f172a','#334155']];
function gradientFor(name: string) {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const [a, b] = AD_GRADIENTS[h % AD_GRADIENTS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

function PmaxCard({ c }: { c: PmaxImageCreative }) {
  const [broken, setBroken] = useState(false);
  const showImg = Boolean(c.imageUrl) && !broken;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col">
      <div className="relative aspect-square bg-gray-50 flex items-center justify-center" style={showImg ? undefined : { background: gradientFor(c.name) }}>
        {showImg
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={c.imageUrl} alt={c.name} className="w-full h-full object-contain" onError={() => setBroken(true)} />
          : <ImageIcon className="w-10 h-10 text-white/70" />}
        {c.type && <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider bg-black/55 text-white px-2 py-0.5 rounded-full">{c.type.replace(/_/g,' ')}</span>}
      </div>
      <div className="p-4 flex-1 flex flex-col gap-3">
        <p className="text-sm font-semibold text-brand-dark line-clamp-2" title={c.name}>{c.name}</p>
        <div className="mt-auto grid grid-cols-4 gap-2 pt-2 border-t border-gray-50 text-center">
          {[['Spend', fmtCurrency(c.spend)],['Clicks', fmtNumber(c.clicks)],['CTR', fmtPercent(c.ctr)],['CPC', c.cpc > 0 ? fmtMoneyPrecise(c.cpc) : '—']].map(([l,v]) => (
            <div key={l}><div className="text-xs font-bold text-brand-dark tabular-nums">{v}</div><div className="text-[9px] font-medium uppercase tracking-widest text-gray-400">{l}</div></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-1.5 rounded-full bg-brand-forest" />
      <Icon className="w-5 h-5 text-brand-forest" />
      <h2 className="text-2xl font-bold text-brand-dark tracking-tight">{title}</h2>
      <span className="text-sm text-gray-400 font-medium">{subtitle}</span>
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

      {data.googleSearch && data.googleSearch.length > 0 && (
        <div className="space-y-5">
          <SectionHeader icon={SearchIcon} title="Google Search Ads" subtitle="Responsive Search Ads — last 90 days" />
          <GoogleAdPreviews creatives={data.googleSearch} title={`${clientName} · Google Search Ads`} />
        </div>
      )}

      {data.googlePmax && data.googlePmax.length > 0 && (
        <div className="space-y-5">
          <SectionHeader icon={LayoutGrid} title="Performance Max" subtitle="Image assets — last 90 days" />
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {data.googlePmax.map((c) => <PmaxCard key={c.id} c={c} />)}
          </div>
        </div>
      )}
    </div>
  );
}
