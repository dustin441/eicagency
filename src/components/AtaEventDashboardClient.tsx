'use client';

import React, { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarDays, DollarSign, Eye, MousePointer2, Target } from 'lucide-react';
import { ATA_EVENT_ANALYSIS, ATA_GROUNDTRUTH_DAILY_SNAPSHOT, type AtaAnalysisPhase } from '@/lib/prepass-ata-analysis';
import { cn } from '@/lib/utils';
import type { AtaEventDashboardData } from '@/services/prepass-ata-event';

function money(value: number) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function preciseMoney(value: number) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function whole(value: number) {
  return Math.round(value).toLocaleString('en-US');
}

function ratio(numerator: number, denominator: number, multiplier = 1) {
  return denominator > 0 ? (numerator / denominator) * multiplier : null;
}

type TrendMetric = 'spend' | 'impressions' | 'clicks' | 'conversions';
type TrendChannel = 'all' | 'Google' | 'Meta' | 'LinkedIn' | 'GroundTruth';

const TREND_METRICS: Array<{ value: TrendMetric; label: string }> = [
  { value: 'spend', label: 'Spend' },
  { value: 'impressions', label: 'Impressions' },
  { value: 'clicks', label: 'Clicks' },
  { value: 'conversions', label: 'Conversions' },
];

const TREND_CHANNELS: Array<{ value: TrendChannel; label: string }> = [
  { value: 'all', label: 'All channels' },
  { value: 'Google', label: 'Google Ads' },
  { value: 'Meta', label: 'Meta Ads' },
  { value: 'LinkedIn', label: 'LinkedIn Ads' },
  { value: 'GroundTruth', label: 'GroundTruth' },
];

function AnalysisTable({ phase }: { phase: AtaAnalysisPhase }) {
  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-orange">{phase.label}</p>
        <h2 className="mt-1 text-xl font-bold text-brand-dark">{phase.dates}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1080px] w-full text-left text-xs">
          <thead className="border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-400">
            <tr>
              <th className="pb-3 pr-4">Platform / campaign</th><th className="pb-3 pr-3 text-right">Spend</th>
              <th className="pb-3 pr-3 text-right">Impr.</th><th className="pb-3 pr-3 text-right">Clicks</th>
              <th className="pb-3 pr-3 text-right">CTR</th><th className="pb-3 pr-3 text-right">CPC</th>
              <th className="pb-3 pr-3 text-right">CPM</th><th className="pb-3 pr-3 text-right">Conv.</th>
              <th className="pb-3 pr-3 text-right">CPL</th><th className="pb-3 pr-3 text-right">Reach</th>
              <th className="pb-3 text-right">Freq.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {phase.rows.map(row => {
              const ctr = ratio(row.clicks, row.impressions, 100);
              const cpc = ratio(row.spend, row.clicks);
              const cpm = ratio(row.spend, row.impressions, 1000);
              const cpl = ratio(row.spend, row.conversions);
              return (
                <tr key={`${phase.id}-${row.platform}-${row.campaignId}`}>
                  <td className="py-3 pr-4"><p className="font-bold text-brand-dark">{row.platform}</p><p className="mt-0.5 max-w-md text-gray-500">{row.campaignName}</p></td>
                  <td className="py-3 pr-3 text-right font-semibold">{preciseMoney(row.spend)}</td>
                  <td className="py-3 pr-3 text-right">{whole(row.impressions)}</td><td className="py-3 pr-3 text-right">{whole(row.clicks)}</td>
                  <td className="py-3 pr-3 text-right">{ctr === null ? '—' : `${ctr.toFixed(2)}%`}</td>
                  <td className="py-3 pr-3 text-right">{cpc === null ? '—' : preciseMoney(cpc)}</td>
                  <td className="py-3 pr-3 text-right">{cpm === null ? '—' : preciseMoney(cpm)}</td>
                  <td className="py-3 pr-3 text-right font-semibold">{row.conversions.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                  <td className="py-3 pr-3 text-right">{cpl === null || row.spend === 0 ? '—' : preciseMoney(cpl)}</td>
                  <td className="py-3 pr-3 text-right">{row.reach === null ? '—' : whole(row.reach)}</td>
                  <td className="py-3 text-right">{row.frequency === null ? '—' : row.frequency.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {phase.observations.map(observation => <p key={observation} className="rounded-2xl bg-gray-50 p-4 text-xs leading-5 text-gray-600">{observation}</p>)}
      </div>
    </section>
  );
}

function change(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 'New activity' : 'No change';
  const value = ((current - previous) / previous) * 100;
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}% vs prior period`;
}

function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-forest/10 text-brand-forest">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-brand-dark">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{detail}</p>
    </div>
  );
}

export default function AtaEventDashboardClient({
  data,
}: {
  data: AtaEventDashboardData;
}) {
  const totalUsedPercent = data.totalBudget > 0 ? (data.totalMonthlySpend / data.totalBudget) * 100 : 0;
  const totalExpectedPercent = data.totalBudget > 0 ? (data.totalExpectedSpend / data.totalBudget) * 100 : 0;
  const normalUsedPercent = data.normalBudget > 0 ? (data.normalMonthlySpend / data.normalBudget) * 100 : 0;
  const normalPaceDelta = data.normalMonthlySpend - data.normalExpectedSpend;
  const groundTruthUsedPercent = data.groundTruth.spendAvailable && data.groundTruth.budget > 0
    ? ((data.groundTruth.spend ?? 0) / data.groundTruth.budget) * 100
    : 0;
  const allChannelSpend = data.totalSpend + (data.groundTruth.spend ?? 0);
  const allChannelImpressions = data.totalImpressions + (data.groundTruth.impressions ?? 0);
  const allChannelClicks = data.totalClicks + (data.groundTruth.clicks ?? 0);
  const clickThroughRate = allChannelImpressions > 0 ? (allChannelClicks / allChannelImpressions) * 100 : 0;
  const allChannelDetail = data.groundTruth.spendAvailable
    ? 'Includes the fixed GroundTruth delivery snapshot'
    : 'GroundTruth delivery is not yet available';
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('spend');
  const [trendChannel, setTrendChannel] = useState<TrendChannel>('all');
  const trendData = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const row of data.daily) {
      if (trendChannel === 'GroundTruth' || (trendChannel !== 'all' && row.platform !== trendChannel)) continue;
      byDate.set(row.date, (byDate.get(row.date) ?? 0) + row[trendMetric]);
    }
    if (trendChannel === 'all' || trendChannel === 'GroundTruth') {
      for (const row of ATA_GROUNDTRUTH_DAILY_SNAPSHOT) {
        byDate.set(row.date, (byDate.get(row.date) ?? 0) + row[trendMetric]);
      }
    }
    return [...byDate.entries()]
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data.daily, trendChannel, trendMetric]);
  const trendMetricLabel = TREND_METRICS.find(option => option.value === trendMetric)?.label ?? 'Metric';

  return (
    <div className="space-y-6 pb-10">
      <div>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-brand-orange">
          <CalendarDays className="h-3.5 w-3.5" /> ATA MCE 2026
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-brand-dark">ATA Event Performance</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
          Performance and pacing for the full $15,000 ATA event plan: $9,000 across Google, Meta, and LinkedIn,
          plus a dedicated $6,000 GroundTruth allocation billed to EIC.
        </p>
      </div>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border border-brand-forest/15 bg-brand-forest/[0.04] p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-forest">Key conclusion</p>
          <h2 className="mt-2 text-xl font-bold text-brand-dark">Charlotte traffic increased during ATA MCE</h2>
          <p className="mt-3 text-sm leading-6 text-gray-600">{ATA_EVENT_ANALYSIS.ga4.conclusion}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Organic Search</p><p className="mt-1 text-2xl font-bold text-brand-forest">+{ATA_EVENT_ANALYSIS.ga4.organicSearch.liftVsSameWeekdaysPct.toFixed(0)}%</p><p className="text-xs text-gray-500">30 sessions vs 20 expected for the same weekdays</p></div>
            <div className="rounded-2xl bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Direct</p><p className="mt-1 text-2xl font-bold text-brand-forest">+{ATA_EVENT_ANALYSIS.ga4.direct.liftVsSameWeekdaysPct.toFixed(0)}%</p><p className="text-xs text-gray-500">43 sessions vs 21 expected for the same weekdays</p></div>
          </div>
        </div>
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">What worked / what did not</p>
          <ul className="mt-4 space-y-3 text-sm leading-5 text-gray-600">
            {ATA_EVENT_ANALYSIS.highlights.map(highlight => <li key={highlight} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-orange" />{highlight}</li>)}
          </ul>
          <p className="mt-4 text-[11px] text-gray-400">Native-platform snapshot collected {ATA_EVENT_ANALYSIS.collectedAt}. GA4 property timezone: America/Phoenix.</p>
        </div>
      </section>



      <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Total Event Pacing</p>
            <p className="mt-1 text-sm font-semibold text-gray-500">
              {data.budgetMonth} · $9,000 normal channels + $6,000 GroundTruth · through {data.budgetCutoff}
            </p>
            <p className="mt-1 text-xs text-gray-400">Fixed event plan; pacing is independent of the trend chart controls</p>
          </div>
          {data.totalPaceDelta !== null ? (
            <div className={cn('rounded-full px-3 py-1.5 text-sm font-bold', data.totalPaceDelta > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')}>
              {money(Math.abs(data.totalPaceDelta))} {data.totalPaceDelta > 0 ? 'ahead of pace' : 'behind pace'}
            </div>
          ) : (
            <div className="rounded-full bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-700">GroundTruth spend awaiting source</div>
          )}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total event budget</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-brand-dark">{money(data.totalBudget)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Recorded event spend</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-brand-dark">{preciseMoney(data.totalMonthlySpend)}</p>
            {!data.totalSpendComplete && <p className="mt-0.5 text-xs font-semibold text-amber-700">Normal channels only until GroundTruth data is loaded</p>}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Remaining</p>
            <p className={cn('mt-1 text-xl font-bold tabular-nums', data.totalRemainingBudget !== null && data.totalRemainingBudget < 0 ? 'text-red-500' : 'text-emerald-600')}>
              {data.totalRemainingBudget === null ? 'Unavailable' : preciseMoney(data.totalRemainingBudget)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Expected through cutoff</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-brand-dark">{preciseMoney(data.totalExpectedSpend)}</p>
          </div>
        </div>

        <div className="mt-6">
          <div className="relative h-3 overflow-visible rounded-full bg-gray-100">
            <div className={cn('h-full rounded-full', totalUsedPercent > 100 ? 'bg-red-500' : 'bg-brand-forest')} style={{ width: `${Math.min(100, Math.max(0, totalUsedPercent))}%` }} />
            <div className="absolute -top-1 h-5 w-0.5 rounded-full bg-gray-400" style={{ left: `${Math.min(100, Math.max(0, totalExpectedPercent))}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-gray-400">
            <span>{totalUsedPercent.toFixed(1)}% recorded</span>
            <span>On-pace marker: {totalExpectedPercent.toFixed(1)}%</span>
            <span>GroundTruth is included in both the $15,000 budget and total spend when a snapshot is available.</span>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-brand-dark">Performance trend</h2>
            <p className="mt-1 text-xs text-gray-400">ATA event window: Oct 5–20, 2026</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Metric
              <select value={trendMetric} onChange={event => setTrendMetric(event.target.value as TrendMetric)} className="min-w-36 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-forest/20">
                {TREND_METRICS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Channel
              <select value={trendChannel} onChange={event => setTrendChannel(event.target.value as TrendChannel)} className="min-w-40 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-forest/20">
                {TREND_CHANNELS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>
        </div>
        {trendData.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs><linearGradient id="ataTrend" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0B4A31" stopOpacity={0.32} /><stop offset="95%" stopColor="#0B4A31" stopOpacity={0.03} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f2" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={value => value.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={value => trendMetric === 'spend' ? `$${value}` : whole(Number(value))} />
                <Tooltip formatter={value => [trendMetric === 'spend' ? preciseMoney(Number(value ?? 0)) : whole(Number(value ?? 0)), trendMetricLabel]} labelFormatter={label => `Date: ${label}`} />
                <Area type="monotone" dataKey="value" name={trendMetricLabel} stroke="#0B4A31" fill="url(#ataTrend)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-72 items-center justify-center rounded-2xl bg-gray-50 text-sm text-gray-400">No delivery for this channel.</div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Normal-channel pacing</p>
              <p className="mt-1 text-sm text-gray-500">Google, Meta, and LinkedIn across October</p>
            </div>
            <span className={cn('rounded-full px-3 py-1 text-xs font-bold', normalPaceDelta > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')}>
              {money(Math.abs(normalPaceDelta))} {normalPaceDelta > 0 ? 'ahead' : 'behind'}
            </span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Budget</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-brand-dark">{money(data.normalBudget)}</p>
            </div>
            <div><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Spent</p><p className="mt-1 text-xl font-bold tabular-nums">{preciseMoney(data.normalMonthlySpend)}</p></div>
            <div><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Remaining</p><p className={cn('mt-1 text-xl font-bold tabular-nums', data.normalRemainingBudget < 0 ? 'text-red-500' : 'text-emerald-600')}>{preciseMoney(data.normalRemainingBudget)}</p></div>
            <div><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Needed per day</p><p className="mt-1 text-xl font-bold tabular-nums">{preciseMoney(data.normalDailyNeeded)}</p></div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-brand-forest" style={{ width: `${Math.min(100, Math.max(0, normalUsedPercent))}%` }} /></div>
          <p className="mt-2 text-xs text-gray-400">Google {preciseMoney(data.platformSpend.Google)} · Meta {preciseMoney(data.platformSpend.Meta)} · LinkedIn {preciseMoney(data.platformSpend.LinkedIn)}</p>
        </div>

        <div className="rounded-3xl border border-brand-orange/20 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-orange">GroundTruth pacing</p>
              <p className="mt-1 text-sm text-gray-500">Dedicated flight {data.groundTruth.flightStart} through {data.groundTruth.flightEnd}</p>
            </div>
            <span className={cn('rounded-full px-3 py-1 text-xs font-bold', data.groundTruth.spendAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
              {data.groundTruth.spendAvailable ? `Updated ${data.groundTruth.sourceLatestDate}` : 'Awaiting delivery snapshot'}
            </span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Budget</p><p className="mt-1 text-xl font-bold tabular-nums text-brand-dark">{money(data.groundTruth.budget)}</p></div>
            <div><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Spent</p><p className="mt-1 text-xl font-bold tabular-nums">{data.groundTruth.spend === null ? 'Unavailable' : preciseMoney(data.groundTruth.spend)}</p></div>
            <div><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Remaining</p><p className="mt-1 text-xl font-bold tabular-nums text-emerald-600">{data.groundTruth.remainingBudget === null ? 'Unavailable' : preciseMoney(data.groundTruth.remainingBudget)}</p></div>
            <div><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Needed per flight day</p><p className="mt-1 text-xl font-bold tabular-nums">{data.groundTruth.dailyNeeded === null ? 'Unavailable' : preciseMoney(data.groundTruth.dailyNeeded)}</p></div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-brand-orange" style={{ width: `${Math.min(100, Math.max(0, groundTruthUsedPercent))}%` }} /></div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-gray-400">
            <span>{data.groundTruth.completedDays} completed flight days · {data.groundTruth.remainingDays} remain</span>
            {data.groundTruth.spendAvailable
              ? <span>Reach {whole(data.groundTruth.reach ?? 0)} · Impressions {whole(data.groundTruth.impressions ?? 0)} · Clicks {whole(data.groundTruth.clicks ?? 0)}</span>
              : <span>Spend is not shown as $0 without a verified GroundTruth snapshot.</span>}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="All-channel spend" value={preciseMoney(allChannelSpend)} detail={allChannelDetail} icon={DollarSign} />
        <KpiCard label="All-channel impressions" value={whole(allChannelImpressions)} detail={allChannelDetail} icon={Eye} />
        <KpiCard label="All-channel clicks" value={whole(allChannelClicks)} detail={`${allChannelDetail} · ${clickThroughRate.toFixed(2)}% CTR`} icon={MousePointer2} />
        <KpiCard label="Platform conversions" value={whole(data.totalConversions)} detail={change(data.totalConversions, data.previousConversions)} icon={Target} />
      </section>

      {ATA_EVENT_ANALYSIS.phases.map(phase => <AnalysisTable key={phase.id} phase={phase} />)}

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-widest text-gray-400">Google detail</p><p className="mt-3 text-sm leading-6 text-gray-600">{ATA_EVENT_ANALYSIS.detail.google.preEvent}</p><p className="mt-3 text-xs leading-5 text-gray-400">{ATA_EVENT_ANALYSIS.detail.google.caveat}</p></div>
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-widest text-gray-400">Meta detail</p><p className="mt-3 text-sm leading-6 text-gray-600">{ATA_EVENT_ANALYSIS.detail.meta.preEvent}</p><p className="mt-3 text-sm leading-6 text-gray-600">{ATA_EVENT_ANALYSIS.detail.meta.duringEvent}</p></div>
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-widest text-gray-400">LinkedIn detail</p><p className="mt-3 text-sm leading-6 text-gray-600">{ATA_EVENT_ANALYSIS.detail.linkedin.preEvent}</p><p className="mt-3 text-sm leading-6 text-gray-600">{ATA_EVENT_ANALYSIS.detail.linkedin.duringEvent}</p></div>
      </section>

      <section className="rounded-3xl border border-brand-orange/20 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-orange">GroundTruth results</p>
        <h2 className="mt-2 text-lg font-bold text-brand-dark">DOOH and Mobile delivery</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-gray-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total spend</p><p className="mt-1 text-xl font-bold text-brand-dark">{preciseMoney(ATA_EVENT_ANALYSIS.groundTruth.totalSpend)}</p></div>
          <div className="rounded-2xl bg-gray-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Impressions</p><p className="mt-1 text-xl font-bold text-brand-dark">{whole(ATA_EVENT_ANALYSIS.groundTruth.totalImpressions)}</p></div>
          <div className="rounded-2xl bg-gray-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Mobile clicks</p><p className="mt-1 text-xl font-bold text-brand-dark">{whole(ATA_EVENT_ANALYSIS.groundTruth.totalClicks)}</p></div>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-xs">
            <thead className="border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-400"><tr><th className="pb-3 pr-4">Ad group</th><th className="pb-3 pr-3">Channel</th><th className="pb-3 pr-3">Dates</th><th className="pb-3 pr-3 text-right">Spend</th><th className="pb-3 pr-3 text-right">Impressions</th><th className="pb-3 pr-3 text-right">Clicks</th><th className="pb-3 pr-3 text-right">CTR</th><th className="pb-3 pr-3 text-right">Reach</th><th className="pb-3 text-right">Screens</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {ATA_EVENT_ANALYSIS.groundTruth.rows.map(row => {
                const ctr = row.clicks === null ? null : ratio(row.clicks, row.impressions, 100);
                return <tr key={row.adGroupId}><td className="py-3 pr-4 font-semibold text-brand-dark">{row.adGroupName}</td><td className="py-3 pr-3">{row.channel}</td><td className="py-3 pr-3 whitespace-nowrap">{row.start === row.end ? row.start : `${row.start} – ${row.end}`}</td><td className="py-3 pr-3 text-right">{preciseMoney(row.spend)}</td><td className="py-3 pr-3 text-right">{whole(row.impressions)}</td><td className="py-3 pr-3 text-right">{row.clicks === null ? '—' : whole(row.clicks)}</td><td className="py-3 pr-3 text-right">{ctr === null ? '—' : `${ctr.toFixed(2)}%`}</td><td className="py-3 pr-3 text-right">{row.reach === null ? '—' : whole(row.reach)}</td><td className="py-3 text-right">{row.screens === null ? '—' : whole(row.screens)}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[11px] leading-5 text-gray-400">{ATA_EVENT_ANALYSIS.groundTruth.note}</p>
      </section>







    </div>
  );
}
