'use client';

import React, { useState } from 'react';
import {
  ChevronDown,
  Image as ImageIcon,
  Lightbulb,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';
import { fmtCurrency, fmtNumber } from '@/lib/utils';
import {
  selectCreativeLeaders,
  type CreativeDeepDiveLeader,
  type CreativeObjective,
} from '@/lib/creative-deep-dive';

export type CreativeDeepDiveInsight = {
  hasData: boolean;
  adsAnalyzed: number;
  summary: string;
  videoVsImage?: string;
  whatWorks: { point: string; evidence?: string }[];
  improvements: { point: string; why?: string }[];
  nextTests: { title: string; why?: string }[];
  nextCreativeBrief: string;
  asOf: string;
};

type ObjectiveLabels = {
  conversion: string;
  cost: string;
};

function formatInsightDate(value: string) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function safeImageUrl(value?: string) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function Brief({ insight }: { insight: CreativeDeepDiveInsight }) {
  const directions = insight.nextCreativeBrief
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, ...body] = line.split(': ');
      return { label: body.length ? label : '', body: body.length ? body.join(': ') : line };
    });

  return (
    <section className="rounded-3xl border border-brand-forest/15 bg-brand-forest/[0.04] p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-brand-forest p-2.5 text-white"><Lightbulb className="h-5 w-5" /></div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-forest">Creative Director Brief</p>
          <h2 className="text-xl font-bold text-brand-dark">What is working and what the team should make next</h2>
        </div>
      </div>

      {insight.summary ? (
        <div className="mt-4 rounded-xl border border-emerald-100 bg-white/90 p-4 sm:p-5">
          <p className="text-sm leading-6 text-gray-700">
            <span className="font-bold text-brand-dark">Brand-level thesis:</span> {insight.summary}
          </p>
        </div>
      ) : null}

      {directions.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {directions.map(({ label, body }, index) => (
            <div key={`${label}-${index}`} className="rounded-xl border border-white bg-white/80 p-4">
              {label ? <p className="text-[10px] font-bold uppercase tracking-wider text-brand-forest">{label}</p> : null}
              <p className="mt-1 text-sm leading-6 text-gray-700">{body}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-brand-forest/15 bg-white/70 p-4 text-sm text-gray-500">
          No new production brief is available in the latest analysis.
        </p>
      )}
    </section>
  );
}

function PriorityTests({ insight }: { insight: CreativeDeepDiveInsight }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <Target className="h-5 w-5 text-brand-orange" />
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-orange">Recommended action</p>
          <h2 className="text-2xl font-bold text-brand-dark">Priority Tests Next</h2>
          <p className="text-sm text-gray-500">What to make next and why it matters for the objective data available in this view.</p>
        </div>
      </div>

      {insight.nextTests.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {insight.nextTests.map((test, index) => (
            <article key={`${test.title}-${index}`} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-forest text-xs font-bold text-white">
                {index + 1}
              </div>
              <h3 className="text-base font-bold leading-6 text-brand-dark">{test.title}</h3>
              {test.why ? (
                <div className="mt-3 rounded-xl bg-orange-50/60 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-orange">Why this priority</p>
                  <p className="mt-1 text-sm leading-6 text-gray-700">{test.why}</p>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
          No new tests are currently recommended by the latest analysis.
        </div>
      )}
    </section>
  );
}

function LeaderCard({
  leader,
  rank,
  objective,
  labels,
}: {
  leader: CreativeDeepDiveLeader;
  rank: number;
  objective: CreativeObjective;
  labels: ObjectiveLabels;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = safeImageUrl(leader.imageUrl);
  const ctr = leader.impressions > 0 ? (leader.clicks / leader.impressions) * 100 : 0;
  const roas = leader.spend > 0 ? (leader.revenue ?? 0) / leader.spend : 0;
  const costPerConversion = leader.conversions > 0 ? leader.spend / leader.conversions : 0;
  const costPerEngagement = (leader.engagements ?? 0) > 0 ? leader.spend / (leader.engagements ?? 1) : 0;
  const metrics = objective === 'sales'
    ? [['ROAS', `${roas.toFixed(2)}x`], [labels.conversion, fmtNumber(leader.conversions)], ['Spend', fmtCurrency(leader.spend)]]
    : objective === 'leads'
      ? [[labels.cost, fmtCurrency(costPerConversion)], [labels.conversion, fmtNumber(leader.conversions)], ['Spend', fmtCurrency(leader.spend)]]
      : objective === 'volume'
        ? [[labels.conversion, fmtNumber(leader.conversions)], [labels.cost, fmtCurrency(costPerConversion)], ['Spend', fmtCurrency(leader.spend)]]
      : objective === 'engagement'
        ? [[labels.cost, fmtCurrency(costPerEngagement)], [labels.conversion, fmtNumber(leader.engagements ?? 0)], ['Spend', fmtCurrency(leader.spend)]]
        : [['CTR', `${ctr.toFixed(2)}%`], ['Clicks', fmtNumber(leader.clicks)], ['Spend', fmtCurrency(leader.spend)]];

  return (
    <article className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
      <div className="flex min-w-0 gap-4 p-4">
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
          {imageUrl && !imageFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={leader.name} className="h-full w-full object-cover" onError={() => setImageFailed(true)} />
          ) : (
            <ImageIcon className="h-6 w-6 text-gray-400" />
          )}
          <span className="absolute left-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-forest text-[11px] font-bold text-white shadow-sm">
            {rank}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-bold leading-5 text-brand-dark">{leader.name}</h3>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">Current relative leader</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {metrics.map(([label, value]) => (
              <div key={label}>
                <div className="text-sm font-bold tabular-nums text-brand-dark">{value}</div>
                <div className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function WorkingNow({
  insight,
  candidates,
  objective,
  labels,
  sourceLabel,
}: {
  insight: CreativeDeepDiveInsight;
  candidates: CreativeDeepDiveLeader[];
  objective: CreativeObjective;
  labels: ObjectiveLabels;
  sourceLabel: string;
}) {
  const leaders = selectCreativeLeaders(candidates, objective);
  const objectiveCopy = objective === 'sales'
    ? `${labels.conversion.toLowerCase()} ROAS`
    : objective === 'leads'
      ? `${labels.conversion.toLowerCase()} efficiency`
      : objective === 'volume'
        ? `${labels.conversion.toLowerCase()} volume`
      : objective === 'engagement'
        ? `${labels.conversion.toLowerCase()} efficiency`
        : 'CTR, then click volume';

  return (
    <section className="space-y-4 rounded-3xl border border-emerald-100 bg-emerald-50/40 p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-emerald-700 p-2.5 text-white"><Trophy className="h-5 w-5" /></div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">What is working now</p>
          <h2 className="text-xl font-bold text-brand-dark">Current leaders and repeatable signals</h2>
          <p className="mt-1 text-sm leading-6 text-gray-600">
            Relative leaders are ranked by {objectiveCopy} for this client. Use them as directional signals, not automatic scale decisions.
          </p>
        </div>
      </div>

      {leaders.length ? (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Top performers · {sourceLabel}</p>
          <div className="grid gap-3 lg:grid-cols-3">
            {leaders.map((leader, index) => (
              <LeaderCard key={leader.id} leader={leader} rank={index + 1} objective={objective} labels={labels} />
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-emerald-200 bg-white/70 p-4 text-sm text-gray-500">
          Not enough primary-outcome data to name a current leader yet.
        </p>
      )}

      {insight.whatWorks.length ? (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
            What to carry forward{insight.asOf ? ` · Latest Deep Dive as of ${formatInsightDate(insight.asOf)}` : ''}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {insight.whatWorks.map((item, index) => (
              <div key={index} className="rounded-xl border border-white bg-white/90 p-4">
                <p className="text-sm font-semibold leading-6 text-brand-dark">{item.point}</p>
                {item.evidence ? <p className="mt-1 text-xs leading-5 text-gray-500">{item.evidence}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SupportingEvidence({ insight }: { insight: CreativeDeepDiveInsight }) {
  return (
    <details className="group rounded-2xl border border-gray-100 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between p-5 text-sm font-bold text-brand-dark">
        <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand-forest" /> Creative Insights and Supporting Evidence</span>
        <ChevronDown className="h-4 w-4 text-gray-400 transition group-open:rotate-180" />
      </summary>
      <div className="space-y-4 border-t border-gray-100 p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
          {insight.adsAnalyzed > 0 ? <span>{insight.adsAnalyzed} creative{insight.adsAnalyzed === 1 ? '' : 's'} analyzed</span> : null}
          {insight.asOf ? <span>· as of {formatInsightDate(insight.asOf)}</span> : null}
        </div>
        {insight.summary ? <p className="text-sm font-semibold leading-6 text-brand-dark">{insight.summary}</p> : null}
        {insight.videoVsImage ? (
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500">Format read</p>
            <p className="text-sm leading-6 text-gray-700">{insight.videoVsImage}</p>
          </div>
        ) : null}
        {insight.improvements.length ? (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">What has not worked / evidence to address</p>
            <div className="space-y-2">
              {insight.improvements.map((item, index) => (
                <div key={index} className="rounded-xl bg-orange-50/60 p-3 text-sm leading-6 text-gray-700">
                  <span className="font-semibold text-brand-dark">{item.point}</span>
                  {item.why ? <span className="block text-gray-500">{item.why}</span> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}

export default function CreativeDeepDiveSections({
  insight,
  candidates,
  objective,
  conversionLabel,
  costLabel,
  sourceLabel = 'Current dashboard window',
}: {
  insight: CreativeDeepDiveInsight | null;
  candidates: CreativeDeepDiveLeader[];
  objective: CreativeObjective;
  conversionLabel?: string;
  costLabel?: string;
  sourceLabel?: string;
}) {
  if (!insight) return null;
  const labels = {
    conversion: conversionLabel ?? (objective === 'sales' ? 'Purchases' : objective === 'leads' ? 'Leads' : objective === 'volume' ? 'Conversions' : objective === 'engagement' ? 'Engagements' : 'Clicks'),
    cost: costLabel ?? (objective === 'leads' ? 'CPL' : objective === 'volume' ? 'Cost/Conversion' : objective === 'engagement' ? 'Cost/Engagement' : 'CPC'),
  };

  if (!insight.hasData) {
    return (
      <div className="rounded-2xl border border-brand-forest/15 bg-brand-forest/[0.03] p-5 text-sm leading-6 text-gray-500">
        {insight.summary || 'Not enough recent ad spend to analyze creatives yet. Check back after the next run.'}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Brief insight={insight} />
      <PriorityTests insight={insight} />
      <WorkingNow insight={insight} candidates={candidates} objective={objective} labels={labels} sourceLabel={sourceLabel} />
      <SupportingEvidence insight={insight} />
    </div>
  );
}
