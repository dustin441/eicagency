'use client';

import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Eye,
  MousePointer2,
  ShoppingCart,
  Target,
  TrendingUp,
} from 'lucide-react';
import SpartacoFilterBar from '@/components/SpartacoFilterBar';
import SpartacoMetaAdsSection from '@/components/SpartacoMetaAdsSection';
import { cn } from '@/lib/utils';
import type {
  SpartacoBreakdownRow,
  SpartacoChartPoint,
  SpartacoDashboardData,
  SpartacoMode,
} from '@/services/spartaco-analytics';

function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? '+100.0%' : '0.0%';
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}



function fmtNumber(value: number) {
  return Math.round(value).toLocaleString();
}

function fmtCompact(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toString();
}

function fmtCurrency(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}

function fmtMoneyPrecise(value: number) {
  return `$${value.toFixed(2)}`;
}

function fmtPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function kpiLabel(mode: SpartacoMode, kind: 'primary' | 'secondary' | 'efficiency' | 'value') {
  if (mode === 'LEAD') {
    if (kind === 'primary') return 'Conversions';
    if (kind === 'secondary') return 'Cost Per Lead';
    if (kind === 'value') return 'Cost';
    return 'CPC';
  }
  if (mode === 'SALES') {
    if (kind === 'primary') return 'Purchases';
    if (kind === 'secondary') return 'ROAS';
    if (kind === 'value') return 'Revenue';
    return 'AOV';
  }
  // ALL mode
  if (kind === 'primary') return 'Purchases';
  if (kind === 'secondary') return 'ROAS';
  if (kind === 'value') return 'Revenue';
  return 'Total Spend';
}

function metricValue(mode: SpartacoMode, kind: 'primary' | 'secondary' | 'efficiency' | 'value', summary: SpartacoDashboardData['summary']) {
  if (mode === 'LEAD') {
    if (kind === 'primary') return fmtNumber(summary.conversions);
    if (kind === 'secondary') return summary.cpl > 0 ? fmtMoneyPrecise(summary.cpl) : '—';
    if (kind === 'value') return fmtCurrency(summary.cost);
    return summary.cpc > 0 ? fmtMoneyPrecise(summary.cpc) : '—';
  }
  if (mode === 'SALES') {
    if (kind === 'primary') return fmtNumber(summary.purchases);
    if (kind === 'secondary') return summary.roas > 0 ? `${summary.roas.toFixed(2)}x` : '—';
    if (kind === 'value') return fmtCurrency(summary.revenue);
    return summary.purchases > 0 ? fmtMoneyPrecise(summary.revenue / summary.purchases) : '—';
  }
  // ALL mode
  if (kind === 'primary') return fmtNumber(summary.purchases);
  if (kind === 'secondary') return summary.roas > 0 ? `${summary.roas.toFixed(2)}x` : '—';
  if (kind === 'value') return fmtCurrency(summary.revenue);
  return fmtCurrency(summary.cost);
}

function metricDelta(mode: SpartacoMode, kind: 'primary' | 'secondary' | 'efficiency' | 'value', current: SpartacoDashboardData['summary'], previous: SpartacoDashboardData['summary']) {
  if (mode === 'LEAD') {
    if (kind === 'primary') return { text: pctChange(current.conversions, previous.conversions), lowerIsBetter: false, current: current.conversions, previous: previous.conversions };
    if (kind === 'secondary') return { text: pctChange(current.cpl, previous.cpl), lowerIsBetter: true, current: current.cpl, previous: previous.cpl };
    if (kind === 'value') return { text: pctChange(current.cost, previous.cost), lowerIsBetter: true, current: current.cost, previous: previous.cost };
    return { text: pctChange(current.cpc, previous.cpc), lowerIsBetter: true, current: current.cpc, previous: previous.cpc };
  }
  if (mode === 'SALES') {
    if (kind === 'primary') return { text: pctChange(current.purchases, previous.purchases), lowerIsBetter: false, current: current.purchases, previous: previous.purchases };
    if (kind === 'secondary') return { text: pctChange(current.roas, previous.roas), lowerIsBetter: false, current: current.roas, previous: previous.roas };
    if (kind === 'value') return { text: pctChange(current.revenue, previous.revenue), lowerIsBetter: false, current: current.revenue, previous: previous.revenue };
    return {
      text: pctChange(current.purchases > 0 ? current.revenue / current.purchases : 0, previous.purchases > 0 ? previous.revenue / previous.purchases : 0),
      lowerIsBetter: false,
      current: current.purchases > 0 ? current.revenue / current.purchases : 0,
      previous: previous.purchases > 0 ? previous.revenue / previous.purchases : 0,
    };
  }
  // ALL mode
  if (kind === 'primary') return { text: pctChange(current.purchases, previous.purchases), lowerIsBetter: false, current: current.purchases, previous: previous.purchases };
  if (kind === 'secondary') return { text: pctChange(current.roas, previous.roas), lowerIsBetter: false, current: current.roas, previous: previous.roas };
  if (kind === 'value') return { text: pctChange(current.revenue, previous.revenue), lowerIsBetter: false, current: current.revenue, previous: previous.revenue };
  return { text: pctChange(current.cost, previous.cost), lowerIsBetter: true, current: current.cost, previous: previous.cost };
}

function KpiCard({
  title,
  value,
  delta,
  lowerIsBetter = false,
  current,
  previous,
  icon: Icon,
  color,
  isNorthStar = false,
}: {
  title: string;
  value: string;
  delta: string;
  lowerIsBetter?: boolean;
  current: number;
  previous: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  isNorthStar?: boolean;
}) {
  const isPositive = lowerIsBetter ? current <= previous : current >= previous;
  return (
    <div className={cn(
      'bg-white p-6 rounded-3xl border shadow-sm hover:shadow-xl transition-all group overflow-hidden relative',
      isNorthStar ? 'border-brand-forest/25 ring-1 ring-brand-forest/10 bg-brand-forest/5' : 'border-gray-100'
    )}>
      <div className="flex items-center justify-between mb-4">
        <div className={cn('p-2 rounded-xl bg-gray-50 group-hover:scale-110 transition-transform', color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className={cn(
          'flex items-center text-xs font-bold px-2 py-1 rounded-full',
          isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
        )}>
          {isPositive ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
          {delta}
        </div>
      </div>
      <div className="flex items-center gap-2 mb-1">
        <div className="text-2xl font-bold text-brand-dark tabular-nums">{value}</div>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn('text-xs font-medium uppercase tracking-widest', isNorthStar ? 'text-brand-forest' : 'text-gray-400')}>{title}</span>
        {isNorthStar && <span className="text-[9px] font-bold uppercase tracking-widest text-brand-forest bg-brand-forest/10 px-1.5 py-0.5 rounded-full">North Star</span>}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  data,
  barKey,
  lineKey,
  barLabel,
  lineLabel,
}: {
  title: string;
  data: SpartacoChartPoint[];
  barKey: keyof SpartacoChartPoint;
  lineKey: keyof SpartacoChartPoint;
  barLabel: string;
  lineLabel: string;
}) {
  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-brand-dark">{title}</h3>
          <p className="text-sm text-gray-400 font-medium mt-0.5">Toggle metrics with keys</p>
        </div>
      </div>
      <div className="p-5 h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(value, name) => {
                const numericValue = typeof value === 'number' ? value : Number(value) || 0;
                if (name === barKey) {
                  return [
                    `${name === 'spend' || name === 'revenue' || name === 'cpl' || name === 'cpa' ? fmtMoneyPrecise(numericValue) : fmtNumber(numericValue)}`,
                    barLabel,
                  ];
                }
                return [
                  `${name === 'spend' || name === 'revenue' || name === 'cpl' || name === 'cpa' ? fmtMoneyPrecise(numericValue) : name === 'roas' ? `${numericValue.toFixed(2)}x` : fmtNumber(numericValue)}`,
                  lineLabel,
                ];
              }}
            />
            <Bar yAxisId="left" dataKey={barKey} fill="#0B4A31" radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey={lineKey} stroke="#0f172a" strokeWidth={3} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function cellDelta(current: number, previous: number, lowerIsBetter = false) {
  if (!previous) return <span className="text-gray-400">-</span>;
  const pct = ((current - previous) / previous) * 100;
  const good = lowerIsBetter ? pct < 0 : pct >= 0;
  return (
    <span className={good ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'}>
      {pct >= 0 ? '+' : ''}
      {pct.toFixed(1)}%
    </span>
  );
}

function BreakdownTable({
  title,
  mode,
  rows,
  columns,
}: {
  title: string;
  mode: SpartacoMode;
  rows: SpartacoBreakdownRow[];
  columns: 'brand' | 'product' | 'channel' | 'campaign';
}) {
  const isLead = mode === 'LEAD';
  const isAll = mode === 'ALL';
  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-8 border-b border-gray-50">
        <h3 className="text-xl font-bold text-brand-dark">{title}</h3>
        <p className="text-sm text-gray-400 font-medium mt-0.5">Global performance by {columns}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {columns === 'channel' && <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">brand</th>}
              {columns === 'campaign' && <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">brand</th>}
              {(columns === 'brand' || columns === 'product') && <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{columns === 'brand' ? 'brand' : 'focus'}</th>}
              {(columns === 'channel' || columns === 'campaign') && <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">ad_channel</th>}
              {columns === 'campaign' && <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">campaign_name</th>}
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">impressions</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">% Δ</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">clicks</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">% Δ</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">CTR</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">% Δ</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">CPC</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">% Δ</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">cost</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">% Δ</th>
              {(isLead || isAll) && (
                <>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap text-emerald-700">conversions</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">% Δ</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap text-emerald-700">CPL</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">% Δ</th>
                </>
              )}
              {(!isLead || isAll) && (
                <>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap text-brand-forest">purchases</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">% Δ</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap text-brand-forest">revenue</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap text-brand-forest">ROAS</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">% Δ</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
              const prevCtr = row.prevImpressions > 0 ? (row.prevClicks / row.prevImpressions) * 100 : 0;
              const cpc = row.clicks > 0 ? row.cost / row.clicks : 0;
              const prevCpc = row.prevClicks > 0 ? row.prevCost / row.prevClicks : 0;
              
              const cpl = row.conversions > 0 ? row.cost / row.conversions : 0;
              const prevCpl = row.prevConversions > 0 ? row.prevCost / row.prevConversions : 0;
              const roas = row.cost > 0 ? row.revenue / row.cost : 0;
              const prevRoas = row.prevCost > 0 ? row.prevRevenue / row.prevCost : 0;
              const primaryLabel = row.label.split('||')[0];
              return (
                <tr key={`${title}-${row.label}`} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors text-brand-dark">
                  {columns === 'channel' && <td className="px-6 py-4 font-medium">{primaryLabel}</td>}
                  {columns === 'campaign' && <td className="px-6 py-4 font-medium">{primaryLabel}</td>}
                  {(columns === 'brand' || columns === 'product') && <td className="px-6 py-4 font-medium">{primaryLabel}</td>}
                  {(columns === 'channel' || columns === 'campaign') && <td className="px-6 py-4">{row.secondaryLabel}</td>}
                  {columns === 'campaign' && <td className="px-6 py-4 max-w-[280px] text-gray-500"><span className="line-clamp-2 block">{row.tertiaryLabel}</span></td>}
                  <td className="px-6 py-4 tabular-nums font-semibold">{fmtNumber(row.impressions)}</td>
                  <td className="px-6 py-4">{cellDelta(row.impressions, row.prevImpressions)}</td>
                  <td className="px-6 py-4 tabular-nums font-semibold">{fmtNumber(row.clicks)}</td>
                  <td className="px-6 py-4">{cellDelta(row.clicks, row.prevClicks)}</td>
                  <td className="px-6 py-4 tabular-nums text-gray-600">{fmtPercent(ctr)}</td>
                  <td className="px-6 py-4">{cellDelta(ctr, prevCtr)}</td>
                  <td className="px-6 py-4 tabular-nums text-gray-600">{cpc > 0 ? fmtMoneyPrecise(cpc) : '—'}</td>
                  <td className="px-6 py-4">{cellDelta(cpc, prevCpc, true)}</td>
                  <td className="px-6 py-4 tabular-nums font-semibold">{fmtCurrency(row.cost)}</td>
                  <td className="px-6 py-4 text-xs">{cellDelta(row.cost, row.prevCost, true)}</td>
                  
                  {(isLead || isAll) && (
                    <>
                      <td className="px-6 py-4 tabular-nums font-bold text-emerald-800">{fmtNumber(row.conversions)}</td>
                      <td className="px-6 py-4 text-xs">{cellDelta(row.conversions, row.prevConversions)}</td>
                      <td className="px-6 py-4 tabular-nums font-bold text-emerald-800">{cpl > 0 ? fmtMoneyPrecise(cpl) : '—'}</td>
                      <td className="px-6 py-4 text-xs">{cellDelta(cpl, prevCpl, true)}</td>
                    </>
                  )}

                  {(!isLead || isAll) && (
                    <>
                      <td className="px-6 py-4 tabular-nums font-bold text-brand-forest">{fmtNumber(row.purchases)}</td>
                      <td className="px-6 py-4 text-xs">{cellDelta(row.purchases, row.prevPurchases)}</td>
                      <td className="px-6 py-4 tabular-nums font-bold text-brand-forest">{fmtCurrency(row.revenue)}</td>
                      <td className="px-6 py-4 tabular-nums font-bold text-brand-forest">{roas > 0 ? `${roas.toFixed(2)}x` : '—'}</td>
                      <td className="px-6 py-4 text-xs">{cellDelta(roas, prevRoas)}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SpartacoDashboardClient({ data }: { data: SpartacoDashboardData }) {
  const isLead = data.mode === 'LEAD';
  const isAll = data.mode === 'ALL';
  const title = isAll 
    ? 'Spartaco Media Report - Overview' 
    : isLead 
      ? 'Spartaco Media Report - Leads' 
      : 'Spartaco Media Report - eCommerce';

  const coreKpis = [
    {
      title: 'Impressions',
      value: fmtCompact(data.summary.impressions),
      delta: pctChange(data.summary.impressions, data.previousSummary.impressions),
      current: data.summary.impressions,
      previous: data.previousSummary.impressions,
      icon: Eye,
      color: 'text-slate-700',
    },
    {
      title: 'Clicks',
      value: fmtNumber(data.summary.clicks),
      delta: pctChange(data.summary.clicks, data.previousSummary.clicks),
      current: data.summary.clicks,
      previous: data.previousSummary.clicks,
      icon: MousePointer2,
      color: 'text-blue-700',
    },
    {
      title: 'CTR',
      value: fmtPercent(data.summary.ctr),
      delta: pctChange(data.summary.ctr, data.previousSummary.ctr),
      current: data.summary.ctr,
      previous: data.previousSummary.ctr,
      icon: Target,
      color: 'text-emerald-700',
    },
    {
      title: isAll ? 'Total Cost' : kpiLabel(data.mode, 'value'),
      value: metricValue(data.mode, 'value', data.summary),
      delta: metricDelta(data.mode, 'value', data.summary, data.previousSummary).text,
      current: metricDelta(data.mode, 'value', data.summary, data.previousSummary).current,
      previous: metricDelta(data.mode, 'value', data.summary, data.previousSummary).previous,
      lowerIsBetter: metricDelta(data.mode, 'value', data.summary, data.previousSummary).lowerIsBetter,
      icon: DollarSign,
      color: 'text-indigo-700',
    },
    {
      title: isAll ? 'Conversions' : kpiLabel(data.mode, 'primary'),
      value: isAll ? fmtNumber(data.summary.conversions) : metricValue(data.mode, 'primary', data.summary),
      delta: isAll ? pctChange(data.summary.conversions, data.previousSummary.conversions) : metricDelta(data.mode, 'primary', data.summary, data.previousSummary).text,
      current: isAll ? data.summary.conversions : metricDelta(data.mode, 'primary', data.summary, data.previousSummary).current,
      previous: isAll ? data.previousSummary.conversions : metricDelta(data.mode, 'primary', data.summary, data.previousSummary).previous,
      lowerIsBetter: false,
      icon: isAll ? Target : (isLead ? Target : ShoppingCart),
      color: 'text-brand-orange',
    },
    {
      title: isAll ? 'Purchases' : kpiLabel(data.mode, 'secondary'),
      value: isAll ? fmtNumber(data.summary.purchases) : metricValue(data.mode, 'secondary', data.summary),
      delta: isAll ? pctChange(data.summary.purchases, data.previousSummary.purchases) : metricDelta(data.mode, 'secondary', data.summary, data.previousSummary).text,
      current: isAll ? data.summary.purchases : metricDelta(data.mode, 'secondary', data.summary, data.previousSummary).current,
      previous: isAll ? data.previousSummary.purchases : metricDelta(data.mode, 'secondary', data.summary, data.previousSummary).previous,
      lowerIsBetter: isAll ? false : metricDelta(data.mode, 'secondary', data.summary, data.previousSummary).lowerIsBetter,
      icon: isAll ? ShoppingCart : TrendingUp,
      color: 'text-brand-forest',
      isNorthStar: true,
    },
    {
      title: isAll ? 'ROAS' : kpiLabel(data.mode, 'efficiency'),
      value: isAll ? `${data.summary.roas.toFixed(2)}x` : metricValue(data.mode, 'efficiency', data.summary),
      delta: isAll ? pctChange(data.summary.roas, data.previousSummary.roas) : metricDelta(data.mode, 'efficiency', data.summary, data.previousSummary).text,
      current: isAll ? data.summary.roas : metricDelta(data.mode, 'efficiency', data.summary, data.previousSummary).current,
      previous: isAll ? data.previousSummary.roas : metricDelta(data.mode, 'efficiency', data.summary, data.previousSummary).previous,
      lowerIsBetter: false,
      icon: isAll ? TrendingUp : (isLead ? DollarSign : ShoppingCart),
      color: 'text-cyan-700',
    },
  ];

  const charts = isLead
    ? [
        { title: 'Cost & Conversions', data: data.daily, barKey: 'conversions', lineKey: 'spend', barLabel: 'conversions', lineLabel: 'cost' },
        { title: 'Conversions & Cost Per Conversion', data: data.daily, barKey: 'conversions', lineKey: 'cpl', barLabel: 'conversions', lineLabel: 'CPL' },
        { title: 'Clicks & Cost by Week', data: data.weekly, barKey: 'spend', lineKey: 'clicks', barLabel: 'cost', lineLabel: 'clicks' },
        { title: 'Leads & Cost Per Lead By Week', data: data.weekly, barKey: 'cpl', lineKey: 'conversions', barLabel: 'CPL', lineLabel: 'conversions' },
        { title: 'Clicks & Cost - Month', data: data.monthly, barKey: 'spend', lineKey: 'clicks', barLabel: 'cost', lineLabel: 'clicks' },
        { title: 'Leads & Cost Per Lead By Month', data: data.monthly, barKey: 'cpl', lineKey: 'conversions', barLabel: 'CPL', lineLabel: 'conversions' },
      ]
    : [
        { title: 'Cost & Purchases', data: data.daily, barKey: 'purchases', lineKey: 'spend', barLabel: 'purchases', lineLabel: 'cost' },
        { title: 'Revenue & ROAS', data: data.daily, barKey: 'revenue', lineKey: 'roas', barLabel: 'revenue', lineLabel: 'ROAS' },
        { title: 'Clicks & Cost by Week', data: data.weekly, barKey: 'spend', lineKey: 'clicks', barLabel: 'cost', lineLabel: 'clicks' },
        { title: 'Purchases & ROAS By Week', data: data.weekly, barKey: 'revenue', lineKey: 'purchases', barLabel: 'revenue', lineLabel: 'purchases' },
        { title: 'Revenue & Cost - Month', data: data.monthly, barKey: 'revenue', lineKey: 'spend', barLabel: 'revenue', lineLabel: 'cost' },
        { title: 'Purchases & ROAS By Month', data: data.monthly, barKey: 'revenue', lineKey: 'roas', barLabel: 'revenue', lineLabel: 'ROAS' },
      ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-dark tracking-tight">{title}</h1>
          <p className="text-gray-500 mt-1">Paid Media Performance Overview</p>
        </div>

        <SpartacoFilterBar 
          mode={data.mode} 
          options={data.filterOptions} 
          initialParams={data.filterParams} 
          currentTab={isAll ? 'all' : (isLead ? 'leads' : 'ecommerce')}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {coreKpis.map((kpi) => (
          <KpiCard key={kpi.title} {...kpi} />
        ))}
      </div>

      <div className="grid xl:grid-cols-2 gap-6">
        {charts.map((chart) => (
          <ChartCard
            key={chart.title}
            title={chart.title}
            data={chart.data}
            barKey={chart.barKey as keyof SpartacoChartPoint}
            lineKey={chart.lineKey as keyof SpartacoChartPoint}
            barLabel={chart.barLabel}
            lineLabel={chart.lineLabel}
          />
        ))}
      </div>

      <BreakdownTable title="Brand Performance" mode={data.mode} rows={data.brandRows} columns="brand" />
      <BreakdownTable title="Product Performance" mode={data.mode} rows={data.productRows} columns="product" />
      <BreakdownTable title="Ad Channel Performance" mode={data.mode} rows={data.channelRows} columns="channel" />
      <BreakdownTable title="Campaign Performance" mode={data.mode} rows={data.campaignRows} columns="campaign" />

      {Object.entries(data.metaAdsByBrand).map(([brand, ads]) => (
        <SpartacoMetaAdsSection key={brand} brand={brand} mode={data.mode} ads={ads} />
      ))}
    </div>
  );
}
