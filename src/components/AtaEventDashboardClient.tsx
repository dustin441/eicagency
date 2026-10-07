'use client';

import React, { useState, useTransition } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarDays, DollarSign, Eye, MousePointer2, Pencil, Target, TrendingUp } from 'lucide-react';
import FilterBar from '@/components/FilterBar';
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

function change(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 'New activity' : 'No change';
  const value = ((current - previous) / previous) * 100;
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}% vs prior period`;
}

function BudgetEditor({
  current,
  updateBudget,
}: {
  current: number;
  updateBudget: (focus: string, budget: number) => Promise<{ error?: string }>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(current));
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setValue(String(current)); setError(''); setEditing(true); }}
        className="ml-2 text-gray-400 transition-colors hover:text-brand-forest"
        title="Edit ATA event budget"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    );
  }

  const save = () => {
    const budget = Number(value.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(budget) || budget <= 0) {
      setError('Enter a valid budget');
      return;
    }
    startTransition(async () => {
      const result = await updateBudget('ATA', budget);
      if (result.error) setError(result.error);
      else setEditing(false);
    });
  };

  return (
    <span className="ml-2 inline-flex flex-wrap items-center gap-1 align-middle">
      <input
        value={value}
        onChange={event => setValue(event.target.value)}
        inputMode="decimal"
        className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-forest/20"
        autoFocus
      />
      <button type="button" onClick={save} disabled={pending} className="rounded-lg bg-brand-forest px-2 py-1 text-xs font-bold text-white disabled:opacity-50">
        {pending ? 'Saving…' : 'Save'}
      </button>
      <button type="button" onClick={() => setEditing(false)} className="text-xs font-semibold text-gray-400 hover:text-gray-600">Cancel</button>
      {error && <span className="text-xs font-semibold text-red-500">{error}</span>}
    </span>
  );
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
  isAdmin,
  updateBudget,
}: {
  data: AtaEventDashboardData;
  isAdmin: boolean;
  updateBudget?: (focus: string, budget: number) => Promise<{ error?: string }>;
}) {
  const usedPercent = data.budget > 0 ? (data.monthlySpend / data.budget) * 100 : 0;
  const expectedPercent = data.budget > 0 ? (data.expectedSpend / data.budget) * 100 : 0;
  const paceDelta = data.monthlySpend - data.expectedSpend;
  const isAhead = paceDelta > 0;
  const clickThroughRate = data.totalImpressions > 0 ? (data.totalClicks / data.totalImpressions) * 100 : 0;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-brand-orange">
            <CalendarDays className="h-3.5 w-3.5" /> ATA MCE 2026
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-brand-dark">ATA Event Performance</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
            Performance and pacing for event campaigns funded from the October ABM allocation across Google, Meta, and LinkedIn.
            The separate $6,000 GroundTruth plan billed to EIC is excluded from this $9,000 pacing budget.
          </p>
        </div>
        <FilterBar
          showChannel
          channelOptions={[
            { value: 'all', label: 'All Channels' },
            { value: 'Google', label: 'Google Ads' },
            { value: 'Meta', label: 'Meta Ads' },
            { value: 'LinkedIn', label: 'LinkedIn Ads' },
          ]}
        />
      </div>

      <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Budget Pacing</p>
            <p className="mt-1 text-sm font-semibold text-gray-500">
              {data.budgetMonth} · {data.completedDays} completed days of {data.daysInMonth} · through {data.budgetCutoff}
            </p>
            <p className="mt-1 text-xs text-gray-400">All ATA normal-channel campaigns, independent of the selected date and channel filters</p>
          </div>
          <div className={cn('rounded-full px-3 py-1.5 text-sm font-bold', isAhead ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')}>
            {money(Math.abs(paceDelta))} {isAhead ? 'ahead of pace' : 'behind pace'}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Normal-channel budget</p>
            <p className="mt-1 flex items-center text-xl font-bold tabular-nums text-brand-dark">
              {money(data.budget)}
              {isAdmin && updateBudget && <BudgetEditor current={data.budget} updateBudget={updateBudget} />}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Spent through cutoff</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-brand-dark">{preciseMoney(data.monthlySpend)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Remaining</p>
            <p className={cn('mt-1 text-xl font-bold tabular-nums', data.remainingBudget < 0 ? 'text-red-500' : 'text-emerald-600')}>
              {preciseMoney(data.remainingBudget)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Expected through cutoff</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-brand-dark">{preciseMoney(data.expectedSpend)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Needed per remaining day</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-brand-dark">{preciseMoney(data.dailyNeeded)}</p>
            <p className="mt-0.5 text-xs text-gray-400">{data.remainingDays} full days remain</p>
          </div>
        </div>

        <div className="mt-6">
          <div className="relative h-3 overflow-visible rounded-full bg-gray-100">
            <div className={cn('h-full rounded-full', usedPercent > 100 ? 'bg-red-500' : 'bg-brand-forest')} style={{ width: `${Math.min(100, Math.max(0, usedPercent))}%` }} />
            <div className="absolute -top-1 h-5 w-0.5 rounded-full bg-gray-400" style={{ left: `${Math.min(100, Math.max(0, expectedPercent))}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-gray-400">
            <span>{usedPercent.toFixed(1)}% used</span>
            <span>On-pace marker: {expectedPercent.toFixed(1)}%</span>
            <span>Google {preciseMoney(data.platformSpend.Google)} · Meta {preciseMoney(data.platformSpend.Meta)} · LinkedIn {preciseMoney(data.platformSpend.LinkedIn)}</span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Spend" value={preciseMoney(data.totalSpend)} detail={change(data.totalSpend, data.previousSpend)} icon={DollarSign} />
        <KpiCard label="Impressions" value={whole(data.totalImpressions)} detail={change(data.totalImpressions, data.previousImpressions)} icon={Eye} />
        <KpiCard label="Clicks" value={whole(data.totalClicks)} detail={`${change(data.totalClicks, data.previousClicks)} · ${clickThroughRate.toFixed(2)}% CTR`} icon={MousePointer2} />
        <KpiCard label="Platform conversions" value={whole(data.totalConversions)} detail={change(data.totalConversions, data.previousConversions)} icon={Target} />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Marketo MQL" value={whole(data.totalMqls)} detail="Event-campaign attribution in the selected period" icon={TrendingUp} />
        <KpiCard label="Marketo SQL" value={whole(data.totalSqls)} detail="Preserves actual lifecycle progression" icon={TrendingUp} />
        <KpiCard label="Closed Won" value={whole(data.totalWon)} detail="No platform conversion is relabeled as Won" icon={TrendingUp} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-brand-dark">Spend trend</h2>
              <p className="mt-1 text-xs text-gray-400">Selected period and channel filter</p>
            </div>
            <p className="text-xs text-gray-400">Latest source date: {data.sourceLatestDate ?? 'No event rows yet'}</p>
          </div>
          {data.daily.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ataSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0B4A31" stopOpacity={0.32} />
                      <stop offset="95%" stopColor="#0B4A31" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef0f2" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={value => value.slice(5)} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={value => `$${value}`} />
                  <Tooltip formatter={(value) => preciseMoney(Number(value ?? 0))} labelFormatter={label => `Date: ${label}`} />
                  <Area type="monotone" dataKey="spend" stroke="#0B4A31" fill="url(#ataSpend)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-72 items-center justify-center rounded-2xl bg-gray-50 text-sm text-gray-400">No event delivery in this selection yet.</div>
          )}
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-brand-dark">Campaign performance</h2>
          <p className="mt-1 text-xs text-gray-400">Google uses verified campaign IDs. Meta and LinkedIn appear when event-prefixed source rows arrive.</p>
          <div className="mt-5 space-y-3">
            {data.campaigns.map(campaign => (
              <div key={`${campaign.platform}-${campaign.campaignId}`} className="rounded-2xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-brand-dark">{campaign.channel}</p>
                    <p className="mt-0.5 text-xs text-gray-400">{campaign.platform} · ID {campaign.campaignId}</p>
                  </div>
                  <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide', campaign.dataAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                    {campaign.status}
                  </span>
                </div>
                {campaign.dataAvailable ? (
                  <div className="mt-4 grid grid-cols-4 gap-3 text-center">
                    <div><p className="text-[10px] uppercase text-gray-400">Spend</p><p className="mt-1 text-sm font-bold tabular-nums">{preciseMoney(campaign.spend)}</p></div>
                    <div><p className="text-[10px] uppercase text-gray-400">Impr.</p><p className="mt-1 text-sm font-bold tabular-nums">{whole(campaign.impressions)}</p></div>
                    <div><p className="text-[10px] uppercase text-gray-400">Clicks</p><p className="mt-1 text-sm font-bold tabular-nums">{whole(campaign.clicks)}</p></div>
                    <div><p className="text-[10px] uppercase text-gray-400">Conv.</p><p className="mt-1 text-sm font-bold tabular-nums">{whole(campaign.conversions)}</p></div>
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                    This verified campaign has no dashboard row in the selected period. Metrics remain unavailable, not zero, until ingestion lands.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
