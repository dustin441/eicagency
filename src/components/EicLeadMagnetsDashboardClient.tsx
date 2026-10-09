'use client';

import React from 'react';
import FilterBar from '@/components/FilterBar';
import { MetaAdPreviews } from '@/components/AdPreviews';
import type { EicAgencyDashboardData } from '@/services/eicagency-analytics';
import type { EicLeadMagnetId } from '@/lib/eicagency-lead-magnets';

export type EicLeadMagnetDashboardItem = {
  id: EicLeadMagnetId;
  label: string;
  campaignNames: readonly string[];
  data: EicAgencyDashboardData;
};

function fmtMoney(value: number) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtNumber(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function KpiCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      {note && <p className="mt-1 text-xs text-gray-400">{note}</p>}
    </div>
  );
}

function LeadMagnetSummary({ leadMagnet }: { leadMagnet: EicLeadMagnetDashboardItem }) {
  const { summary, dataFreshness } = leadMagnet.data;
  const hasPerformance = summary.spend > 0 || summary.impressions > 0 || summary.clicks > 0 || summary.leads > 0;

  return (
    <article className="rounded-[2rem] border border-gray-100 bg-gray-50/70 p-5 lg:p-6">
      <div className="flex flex-col gap-2 border-b border-gray-200 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-gray-900">{leadMagnet.label}</h2>
          <span className="rounded-full bg-brand-forest/10 px-3 py-1 text-xs font-bold text-brand-forest">Meta</span>
        </div>
        <p className="text-sm text-gray-500">{leadMagnet.campaignNames.join(', ')}</p>
        <p className="text-xs text-gray-400">
          Performance through {dataFreshness.paidMediaThrough ?? 'not available'} · Creative detail through {dataFreshness.metaAdsThrough ?? 'not available'}
        </p>
      </div>

      {hasPerformance ? (
        <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-3">
          <KpiCard label="Spend" value={fmtMoney(summary.spend)} />
          <KpiCard label="Impressions" value={fmtNumber(summary.impressions)} />
          <KpiCard label="Clicks" value={fmtNumber(summary.clicks)} />
          <KpiCard label="CTR" value={fmtPercent(summary.ctr)} />
          <KpiCard label="Leads" value={fmtNumber(summary.leads)} />
          <KpiCard label="CPL" value={summary.leads > 0 ? fmtMoney(summary.cpl) : '—'} />
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-8 text-center text-sm text-gray-500">
          No performance data is available for this campaign in the selected period.
        </div>
      )}
    </article>
  );
}

export default function EicLeadMagnetsDashboardClient({
  leadMagnets,
}: {
  leadMagnets: EicLeadMagnetDashboardItem[];
}) {
  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-orange">EIC Agency</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Lead Magnets</h1>
        <p className="mt-1 text-sm text-gray-500">
          ROI Calculator and Scoreboard performance, separated by exact campaign name.
        </p>
      </header>

      <FilterBar />

      <section aria-label="Lead magnet performance comparison" className="grid gap-5 xl:grid-cols-2">
        {leadMagnets.map((leadMagnet) => (
          <LeadMagnetSummary key={leadMagnet.id} leadMagnet={leadMagnet} />
        ))}
      </section>

      <div className="space-y-10">
        {leadMagnets.map((leadMagnet) => (
          <section key={`${leadMagnet.id}-ads`} className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{leadMagnet.label} Ads</h2>
              <p className="mt-1 text-sm text-gray-500">
                Creative and ad-level performance from {leadMagnet.campaignNames.join(', ')}.
              </p>
            </div>

            {leadMagnet.data.metaCreatives.length > 0 ? (
              <MetaAdPreviews
                creatives={leadMagnet.data.metaCreatives}
                title={`${leadMagnet.label} Meta Ads`}
                description="Ad-level performance and available creative previews · Selected period"
                advertiserName="EIC Agency"
              />
            ) : (
              <div className="rounded-[2rem] border border-dashed border-gray-200 bg-white px-6 py-10 text-center text-sm text-gray-500">
                No ad creatives are available for this campaign in the selected period.
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
