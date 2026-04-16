'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ProductDashboardData } from '@/services/spartaco-product-analytics';
import SpartacoFilterBar from './SpartacoFilterBar';
import ProductBreakdownTable from './ProductBreakdownTable';
import TrafficBreakdownTable from './TrafficBreakdownTable';
import ProductTrendChart from './ProductTrendChart';
import {
  fmtNumber,
  fmtCurrency,
  fmtCompact,
  fmtPercent,
} from '@/lib/utils';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  Mail,
  MousePointer2,
  Share2,
  BarChart2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Compact metric card ───────────────────────────────────────────────────────

interface MetricCardProps {
  title: string;
  value: string;
  current: number;
  previous: number;
  inverted?: boolean; // lower = better (e.g. CPL, Avg Position)
}

function MetricCard({ title, value, current, previous, inverted = false }: MetricCardProps) {
  const pct = previous > 0 ? ((current - previous) / Math.abs(previous)) * 100 : null;
  const isGood = pct === null ? null : inverted ? pct < 0 : pct > 0;
  const showDelta = pct !== null && Math.abs(pct) >= 0.5;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 flex-1 min-w-[120px] shadow-sm hover:shadow-md transition-all">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 leading-tight">{title}</p>
      <p className="text-lg font-black text-brand-dark tracking-tight leading-none">{value}</p>
      <p className={cn(
        'text-[11px] font-bold mt-1.5',
        !showDelta ? 'text-gray-300' : isGood ? 'text-emerald-600' : 'text-rose-600'
      )}>
        {showDelta && pct !== null ? `${pct > 0 ? '↑' : '↓'}${Math.abs(pct).toFixed(1)}%` : '—'}
      </p>
    </div>
  );
}

// ─── Section wrapper ───────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  icon: LucideIcon;
  iconColor: string;
  children: React.ReactNode;
}

function KpiSection({ title, icon: Icon, iconColor, children }: SectionProps) {
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        <div className={cn('p-2 rounded-xl', iconColor)}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <span className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">{title}</span>
      </div>
      <div className="flex flex-wrap gap-3">
        {children}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ProductPerformanceClient({ data }: { data: ProductDashboardData }) {
  const {
    summary, previousSummary,
    productRows, previousProductRows,
    channelGroupRows, sourceMediumRows,
    timeSeries, timeSeriesGrain,
  } = data;

  // ── Derived metrics ──
  const adRoas         = summary.ad_cost > 0          ? summary.ad_revenue / summary.ad_cost                         : 0;
  const prevAdRoas     = previousSummary.ad_cost > 0   ? previousSummary.ad_revenue / previousSummary.ad_cost         : 0;
  const adCpl          = summary.ad_conversions > 0    ? summary.ad_cost / summary.ad_conversions                     : 0;
  const prevAdCpl      = previousSummary.ad_conversions > 0 ? previousSummary.ad_cost / previousSummary.ad_conversions : 0;

  const emailOpenRate  = summary.email_total_sent > 0  ? summary.email_opens  / summary.email_total_sent              : 0;
  const prevEmailOpen  = previousSummary.email_total_sent > 0 ? previousSummary.email_opens / previousSummary.email_total_sent : 0;
  const emailClickRate = summary.email_total_sent > 0  ? summary.email_clicks / summary.email_total_sent              : 0;
  const prevEmailClick = previousSummary.email_total_sent > 0 ? previousSummary.email_clicks / previousSummary.email_total_sent : 0;

  const gscCtr         = summary.gsc_impressions > 0   ? summary.gsc_clicks / summary.gsc_impressions                 : 0;
  const prevGscCtr     = previousSummary.gsc_impressions > 0 ? previousSummary.gsc_clicks / previousSummary.gsc_impressions : 0;

  const socialEngRate  = summary.social_impressions > 0 ? summary.social_engagement / summary.social_impressions      : 0;
  const prevSocialEng  = previousSummary.social_impressions > 0 ? previousSummary.social_engagement / previousSummary.social_impressions : 0;

  const dateRange = `${data.filterParams.start} – ${data.filterParams.end}`;

  return (
    <div className="space-y-10 pb-20">
      <SpartacoFilterBar
        mode="ALL"
        currentTab="products"
        initialParams={data.filterParams}
        options={{
          brands: data.filterOptions.brands,
          products: data.filterOptions.products,
          channelGroups: data.filterOptions.channelGroups,
          sourceMediums: data.filterOptions.sourceMediums,
          channels: [],
          campaigns: [],
          focuses: [],
        }}
      />

      {/* ── KPI Sections ── */}
      <div className="space-y-6">

        {/* Paid Media */}
        <KpiSection title="Paid Media" icon={DollarSign} iconColor="bg-indigo-500">
          <MetricCard title="Impressions"   value={fmtCompact(summary.ad_impressions)}   current={summary.ad_impressions}  previous={previousSummary.ad_impressions} />
          <MetricCard title="Clicks"        value={fmtNumber(summary.ad_clicks)}          current={summary.ad_clicks}       previous={previousSummary.ad_clicks} />
          <MetricCard title="Ad Spend"      value={fmtCurrency(summary.ad_cost)}          current={summary.ad_cost}         previous={previousSummary.ad_cost} inverted />
          <MetricCard title="Leads"         value={fmtNumber(summary.ad_conversions)}     current={summary.ad_conversions}  previous={previousSummary.ad_conversions} />
          <MetricCard title="CPL"           value={adCpl > 0 ? fmtCurrency(adCpl) : '—'} current={adCpl}                   previous={prevAdCpl}                inverted />
          <MetricCard title="Purchases"     value={fmtNumber(summary.ad_purchases)}       current={summary.ad_purchases}    previous={previousSummary.ad_purchases} />
          <MetricCard title="Ad Revenue"    value={fmtCurrency(summary.ad_revenue)}       current={summary.ad_revenue}      previous={previousSummary.ad_revenue} />
          <MetricCard title="ROAS"          value={adRoas > 0 ? `${adRoas.toFixed(2)}x` : '—'} current={adRoas}            previous={prevAdRoas} />
        </KpiSection>

        {/* Website */}
        <KpiSection title="Website (GA4)" icon={Users} iconColor="bg-blue-500">
          <MetricCard title="Sessions"         value={fmtCompact(summary.ga4_sessions)}         current={summary.ga4_sessions}         previous={previousSummary.ga4_sessions} />
          <MetricCard title="Engaged Sessions" value={fmtCompact(summary.ga4_engaged_sessions)} current={summary.ga4_engaged_sessions} previous={previousSummary.ga4_engaged_sessions} />
        </KpiSection>

        {/* Email */}
        <KpiSection title="Email" icon={Mail} iconColor="bg-violet-500">
          <MetricCard title="Total Sent"  value={fmtNumber(summary.email_total_sent)} current={summary.email_total_sent} previous={previousSummary.email_total_sent} />
          <MetricCard title="Open Rate"   value={fmtPercent(emailOpenRate)}            current={emailOpenRate}             previous={prevEmailOpen} />
          <MetricCard title="Click Rate"  value={fmtPercent(emailClickRate)}           current={emailClickRate}            previous={prevEmailClick} />
        </KpiSection>

        {/* Search */}
        <KpiSection title="Search (GSC)" icon={MousePointer2} iconColor="bg-orange-500">
          <MetricCard title="GSC Impressions"   value={fmtCompact(summary.gsc_impressions)}    current={summary.gsc_impressions}     previous={previousSummary.gsc_impressions} />
          <MetricCard title="GSC Clicks"        value={fmtNumber(summary.gsc_clicks)}           current={summary.gsc_clicks}          previous={previousSummary.gsc_clicks} />
          <MetricCard title="GSC CTR"           value={fmtPercent(gscCtr)}                      current={gscCtr}                      previous={prevGscCtr} />
          <MetricCard
            title="Avg Position"
            value={summary.gsc_avg_position > 0 ? summary.gsc_avg_position.toFixed(1) : '—'}
            current={summary.gsc_avg_position}
            previous={previousSummary.gsc_avg_position}
            inverted
          />
          <MetricCard title="Keywords Ranked"  value={fmtNumber(summary.gsc_keywords_ranked)} current={summary.gsc_keywords_ranked} previous={previousSummary.gsc_keywords_ranked} />
        </KpiSection>

        {/* Social */}
        <KpiSection title="Social" icon={Share2} iconColor="bg-purple-500">
          <MetricCard title="Post Count"      value={fmtNumber(summary.social_post_count)}   current={summary.social_post_count}   previous={previousSummary.social_post_count} />
          <MetricCard title="Impressions"     value={fmtCompact(summary.social_impressions)} current={summary.social_impressions}  previous={previousSummary.social_impressions} />
          <MetricCard title="Interactions"    value={fmtNumber(summary.social_interactions)} current={summary.social_interactions} previous={previousSummary.social_interactions} />
          <MetricCard title="Engagement"      value={fmtNumber(summary.social_engagement)}   current={summary.social_engagement}   previous={previousSummary.social_engagement} />
          <MetricCard title="Engagement Rate" value={fmtPercent(socialEngRate)}              current={socialEngRate}               previous={prevSocialEng} />
        </KpiSection>

      </div>

      {/* ── Trend Chart ── */}
      <ProductTrendChart data={timeSeries} grain={timeSeriesGrain} dateRange={dateRange} />

      {/* ── Tables ── */}
      <ProductBreakdownTable rows={productRows} previousRows={previousProductRows} />
      <TrafficBreakdownTable channelGroupRows={channelGroupRows} sourceMediumRows={sourceMediumRows} />
    </div>
  );
}
