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
  TrendingUp,
  Wallet,
} from 'lucide-react';
import FilterBar from '@/components/FilterBar';
import { MetaAdPreviews } from '@/components/AdPreviews';
import {
  cn,
  fmtNumber,
  fmtCurrency,
  fmtPercent,
  fmtCompact,
  fmtMoneyPrecise,
  pctChange,
} from '@/lib/utils';
import type {
  GoodGameSalesBreakdownRow,
  GoodGameSalesChartPoint,
  GoodGameSalesDashboardData,
} from '@/services/goodgame-sales-analytics';

// ─── KPI Card ──────────────────────────────────────────────────────────────────

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
  goal,
  goalFmt,
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
  goal?: number;
  goalFmt?: (v: number) => string;
}) {
  const isPositive = lowerIsBetter ? current <= previous : current >= previous;
  const onTrack = goal !== undefined ? (lowerIsBetter ? current <= goal : current >= goal) : null;
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
      {goal !== undefined && goalFmt && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-1">
          <span className="text-xs text-gray-600">Goal: {goalFmt(goal)}</span>
          <span className={cn(
            'text-xs font-bold px-1.5 py-0.5 rounded-full',
            onTrack ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'
          )}>
            {onTrack ? '✓ On Track' : '✗ Off Track'}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Chart Card ─────────────────────────────────────────────────────────────────

function ChartCard({
  title,
  data,
  barKey,
  lineKey,
  barLabel,
  lineLabel,
}: {
  title: string;
  data: GoodGameSalesChartPoint[];
  barKey: keyof GoodGameSalesChartPoint;
  lineKey: keyof GoodGameSalesChartPoint;
  barLabel: string;
  lineLabel: string;
}) {
  const isMoney = (key: keyof GoodGameSalesChartPoint) => key === 'spend' || key === 'revenue';
  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className="px-8 py-6 border-b border-gray-50">
        <h3 className="text-xl font-bold text-brand-dark">{title}</h3>
        <p className="text-sm text-gray-400 font-medium mt-0.5">{barLabel} vs {lineLabel}</p>
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
                  return [isMoney(barKey) ? fmtMoneyPrecise(numericValue) : fmtNumber(numericValue), barLabel];
                }
                return [
                  lineKey === 'roas'
                    ? `${numericValue.toFixed(2)}x`
                    : isMoney(lineKey)
                      ? fmtMoneyPrecise(numericValue)
                      : fmtNumber(numericValue),
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

// ─── Breakdown Table ────────────────────────────────────────────────────────────

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
  subtitle,
  rows,
  columns,
}: {
  title: string;
  subtitle: string;
  rows: GoodGameSalesBreakdownRow[];
  columns: 'channel' | 'campaign';
}) {
  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-8 border-b border-gray-50">
        <h3 className="text-xl font-bold text-brand-dark">{title}</h3>
        <p className="text-sm text-gray-400 font-medium mt-0.5">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {columns === 'campaign' && <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">campaign_name</th>}
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">ad_channel</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">impressions</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">% Δ</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">clicks</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">% Δ</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">CTR</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">CPC</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">cost</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">% Δ</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap text-brand-forest">purchases</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">% Δ</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap text-brand-forest">revenue</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap text-brand-forest">ROAS</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">% Δ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const ctr = row.impressions > 0 ? row.clicks / row.impressions : 0;
              const cpc = row.clicks > 0 ? row.cost / row.clicks : 0;
              const prevCpc = row.prevClicks > 0 ? row.prevCost / row.prevClicks : 0;
              const roas = row.cost > 0 ? row.revenue / row.cost : 0;
              const prevRoas = row.prevCost > 0 ? row.prevRevenue / row.prevCost : 0;
              const primaryLabel = row.label.split('||')[0];
              return (
                <tr key={`${title}-${row.label}`} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors text-brand-dark">
                  {columns === 'campaign' && <td className="px-6 py-4 max-w-[280px] font-medium"><span className="line-clamp-2 block">{primaryLabel}</span></td>}
                  <td className="px-6 py-4">{columns === 'channel' ? primaryLabel : row.secondaryLabel}</td>
                  <td className="px-6 py-4 tabular-nums font-semibold">{fmtNumber(row.impressions)}</td>
                  <td className="px-6 py-4">{cellDelta(row.impressions, row.prevImpressions)}</td>
                  <td className="px-6 py-4 tabular-nums font-semibold">{fmtNumber(row.clicks)}</td>
                  <td className="px-6 py-4">{cellDelta(row.clicks, row.prevClicks)}</td>
                  <td className="px-6 py-4 tabular-nums text-gray-600">{fmtPercent(ctr)}</td>
                  <td className="px-6 py-4 tabular-nums text-gray-600">{cpc > 0 ? fmtMoneyPrecise(cpc) : '—'}</td>
                  <td className="px-6 py-4 tabular-nums font-semibold">{fmtCurrency(row.cost)}</td>
                  <td className="px-6 py-4 text-xs">{cellDelta(row.cost, row.prevCost, true)}</td>
                  <td className="px-6 py-4 tabular-nums font-bold text-brand-forest">{fmtNumber(row.purchases)}</td>
                  <td className="px-6 py-4 text-xs">{cellDelta(row.purchases, row.prevPurchases)}</td>
                  <td className="px-6 py-4 tabular-nums font-bold text-brand-forest">{fmtCurrency(row.revenue)}</td>
                  <td className="px-6 py-4 tabular-nums font-bold text-brand-forest">{roas > 0 ? `${roas.toFixed(2)}x` : '—'}</td>
                  <td className="px-6 py-4 text-xs">{cellDelta(roas, prevRoas)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={15} className="px-6 py-10 text-center text-gray-400">
                  No sales data for the selected period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────────

export default function GoodGameSalesDashboardClient({ data }: { data: GoodGameSalesDashboardData }) {
  const { summary, previousSummary } = data;

  const coreKpis = [
    {
      title: 'Impressions',
      value: fmtCompact(summary.impressions),
      delta: pctChange(summary.impressions, previousSummary.impressions),
      current: summary.impressions,
      previous: previousSummary.impressions,
      icon: Eye,
      color: 'text-slate-700',
    },
    {
      title: 'Clicks',
      value: fmtNumber(summary.clicks),
      delta: pctChange(summary.clicks, previousSummary.clicks),
      current: summary.clicks,
      previous: previousSummary.clicks,
      icon: MousePointer2,
      color: 'text-blue-700',
    },
    {
      title: 'Investment',
      value: fmtCurrency(summary.cost),
      delta: pctChange(summary.cost, previousSummary.cost),
      current: summary.cost,
      previous: previousSummary.cost,
      icon: Wallet,
      color: 'text-emerald-700',
    },
    {
      title: 'Revenue',
      value: fmtCurrency(summary.revenue),
      delta: pctChange(summary.revenue, previousSummary.revenue),
      current: summary.revenue,
      previous: previousSummary.revenue,
      icon: DollarSign,
      color: 'text-indigo-700',
    },
    {
      title: 'Purchases',
      value: fmtNumber(summary.purchases),
      delta: pctChange(summary.purchases, previousSummary.purchases),
      current: summary.purchases,
      previous: previousSummary.purchases,
      icon: ShoppingCart,
      color: 'text-brand-orange',
    },
    {
      title: 'ROAS',
      value: summary.roas > 0 ? `${summary.roas.toFixed(2)}x` : '—',
      delta: pctChange(summary.roas, previousSummary.roas),
      current: summary.roas,
      previous: previousSummary.roas,
      icon: TrendingUp,
      color: 'text-brand-forest',
      isNorthStar: true,
      goal: 5,
      goalFmt: (v: number) => `${v}x`,
    },
    {
      title: 'AOV',
      value: summary.aov > 0 ? fmtMoneyPrecise(summary.aov) : '—',
      delta: pctChange(summary.aov, previousSummary.aov),
      current: summary.aov,
      previous: previousSummary.aov,
      icon: ShoppingCart,
      color: 'text-cyan-700',
    },
  ];

  const charts: {
    title: string;
    data: GoodGameSalesChartPoint[];
    barKey: keyof GoodGameSalesChartPoint;
    lineKey: keyof GoodGameSalesChartPoint;
    barLabel: string;
    lineLabel: string;
  }[] = [
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
          <h1 className="text-3xl font-bold text-brand-dark tracking-tight">Good Game Media Report - eCommerce</h1>
          <p className="text-gray-500 mt-1">Sales campaigns · Meta + Google · Purchases & Revenue</p>
        </div>

        <FilterBar
          channelOptions={[
            { value: 'all', label: 'All Channels' },
            { value: 'Google', label: 'Google Ads' },
            { value: 'Meta', label: 'Meta Ads' },
          ]}
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
            barKey={chart.barKey}
            lineKey={chart.lineKey}
            barLabel={chart.barLabel}
            lineLabel={chart.lineLabel}
          />
        ))}
      </div>

      <BreakdownTable title="Ad Channel Performance" subtitle="Sales performance by channel" rows={data.channelRows} columns="channel" />
      <BreakdownTable title="Campaign Performance" subtitle="Sales performance by campaign" rows={data.campaignRows} columns="campaign" />

      {/* Meta Ad Creatives — Sales campaigns only (CTR · Sales · CAC · ROAS) */}
      {data.metaCreatives.length > 0 && (
        <MetaAdPreviews
          creatives={data.metaCreatives}
          title="Meta Ad Creatives — Sales"
          description="Ad-level performance for [SALES] campaigns · One card per ad · Video ads open in Facebook Ad Library"
          advertiserName="Good Game"
          metricMode="sales"
          salesCac
        />
      )}
    </div>
  );
}
