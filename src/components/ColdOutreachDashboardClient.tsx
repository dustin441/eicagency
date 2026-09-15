'use client';

import FilterBar from '@/components/FilterBar';
import type { EicInstantlyPerformance } from '@/services/instantly-analytics';

function fmtN(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtPct(value: number) {
  return `${value.toFixed(2)}%`;
}

export default function ColdOutreachDashboardClient({ data }: { data: EicInstantlyPerformance }) {
  if (!data.available) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cold Outreach Performance</h1>
          <p className="mt-1 text-sm text-gray-500">Instantly email performance and monthly targets</p>
        </div>
        <FilterBar showChannel={false} />
        <section className="rounded-[2.5rem] border border-amber-100 bg-amber-50/60 p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">Instantly</p>
          <h2 className="mt-2 text-xl font-bold text-gray-900">Cold outreach data is unavailable</h2>
          <p className="mt-2 text-sm text-amber-800">{data.error}</p>
        </section>
      </div>
    );
  }

  const { summary, campaigns, monthlyGoal } = data;
  const sendProgress = Math.min(monthlyGoal.sendProgress, 100);
  const sendOnTarget = monthlyGoal.projectedSends >= monthlyGoal.sendTarget;
  const replyOnTarget = monthlyGoal.replyRate >= monthlyGoal.replyRateTarget;
  const metricCards = [
    ['Sends', fmtN(summary.sends)],
    ['Unique Opens', fmtN(summary.opens)],
    ['Unique Clicks', fmtN(summary.clicks)],
    ['Open Rate', fmtPct(summary.openRate)],
    ['Click Rate', fmtPct(summary.clickRate)],
    ['Reply Rate', fmtPct(summary.replyRate)],
    ['Positive Reply Rate', fmtPct(summary.positiveReplyRate)],
  ];
  const monthLabel = new Date(`${monthlyGoal.monthStart}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cold Outreach Performance</h1>
        <p className="mt-1 text-sm text-gray-500">Instantly email performance and monthly targets</p>
      </div>

      <FilterBar showChannel={false} />

      <section className="space-y-4">
        <div className="rounded-[2.5rem] border border-gray-100 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-orange">Instantly</p>
              <h2 className="mt-2 text-xl font-bold text-[#0f172a]">Overall Performance</h2>
              <p className="mt-1 text-sm font-medium text-gray-400">
                {data.periodStart} to {data.periodEnd} · Unique engagement metrics
              </p>
            </div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:w-[520px]">
              <div className="rounded-2xl bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{monthLabel} sends</p>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${sendOnTarget ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {sendOnTarget ? 'On pace' : 'Below pace'}
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {fmtN(monthlyGoal.sends)} <span className="text-sm font-medium text-gray-400">/ {fmtN(monthlyGoal.sendTarget)}</span>
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full rounded-full bg-brand-forest" style={{ width: `${sendProgress}%` }} />
                </div>
                <p className="mt-2 text-xs text-gray-500">{fmtN(monthlyGoal.projectedSends)} projected this month</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Monthly reply rate</p>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${replyOnTarget ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {replyOnTarget ? 'At target' : 'Below target'}
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-900">{fmtPct(monthlyGoal.replyRate)}</p>
                <p className="mt-3 text-xs text-gray-500">Goal: {fmtPct(monthlyGoal.replyRateTarget)} · Data through {monthlyGoal.dataThrough}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {metricCards.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
                <p className="mt-2 text-xl font-bold text-gray-900">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-gray-400">
            Rates use unique opens, clicks, human replies, and Instantly opportunities divided by {fmtN(summary.contacts)} unique contacts reached. Positive replies depend on replies being marked with a positive opportunity status in Instantly.
          </p>
        </div>

        <div className="overflow-hidden rounded-[2.5rem] border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-50 p-8">
            <h3 className="text-xl font-bold text-[#0f172a]">Campaign Performance</h3>
            <p className="mt-1 text-sm font-medium text-gray-400">Campaigns with sends in the selected period</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Campaign</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Sends</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Opens</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Clicks</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Open Rate</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Click Rate</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Reply Rate</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Positive Reply Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {campaigns.map(row => (
                  <tr key={row.campaignId || row.campaignName} className="transition-colors hover:bg-gray-50">
                    <td className="min-w-72 px-6 py-4 font-medium text-gray-900">{row.campaignName}</td>
                    <td className="px-4 py-4 text-right font-semibold text-gray-700">{fmtN(row.sends)}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{fmtN(row.opens)}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{fmtN(row.clicks)}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{fmtPct(row.openRate)}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{fmtPct(row.clickRate)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-gray-700">{fmtPct(row.replyRate)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-gray-700">{fmtPct(row.positiveReplyRate)}</td>
                  </tr>
                ))}
                {campaigns.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-gray-400">No Instantly campaigns sent email in this period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
