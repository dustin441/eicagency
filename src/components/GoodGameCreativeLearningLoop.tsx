'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  ChevronDown,
  CircleDot,
  Clock3,
  ExternalLink,
  Gauge,
  Image as ImageIcon,
  Lightbulb,
  Target,
  Trophy,
  X,
} from 'lucide-react';
import CreativeAiInsightCard from '@/components/CreativeAiInsightCard';
import { fmtCurrency, fmtNumber } from '@/lib/utils';
import type { CreativeAiInsight } from '@/services/creative-ai-insights';
import type { MetaCreative } from '@/services/analytics';
import type {
  CreativeTestMetrics,
  CreativeTestStatus,
  GoodGameCreativeTest,
} from '@/services/goodgame-creative-learning';
import { setGoodGameCreativeTestStatus } from '@/app/dashboard/goodgame/creatives/actions';

const STATUS_LABELS: Record<CreativeTestStatus, string> = {
  recommended: 'Recommended',
  approved: 'Approved',
  in_production: 'In production',
  launched: 'Launched',
  evaluating: 'Evaluating',
  concluded: 'Concluded',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

const STATUS_STYLES: Record<CreativeTestStatus, string> = {
  recommended: 'bg-amber-50 text-amber-800 border-amber-200',
  approved: 'bg-blue-50 text-blue-800 border-blue-200',
  in_production: 'bg-violet-50 text-violet-800 border-violet-200',
  launched: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  evaluating: 'bg-teal-50 text-teal-800 border-teal-200',
  concluded: 'bg-slate-100 text-slate-800 border-slate-200',
  declined: 'bg-rose-50 text-rose-800 border-rose-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
};

function TestStatus({ status }: { status: CreativeTestStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function CreativeReference({ test }: { test: GoodGameCreativeTest }) {
  const [imageFailed, setImageFailed] = useState(false);
  const preview = test.previews[0];
  if (!preview) return null;
  return (
    <a
      href={preview.url || preview.imageUrl || '#'}
      target="_blank"
      rel="noreferrer"
      className="group flex min-w-0 items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-2 transition hover:border-brand-forest/25 hover:bg-white"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-200">
        {preview.imageUrl && !imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview.imageUrl}
            alt={preview.name}
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <ImageIcon className="h-5 w-5 text-gray-400" />
        )}
      </div>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Current reference</span>
        <span className="block truncate text-xs font-semibold text-brand-dark">{preview.name}</span>
      </span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-400 group-hover:text-brand-forest" />
    </a>
  );
}

function MetricGrid({ metrics, label }: { metrics: CreativeTestMetrics; label: string }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
      <div className="grid grid-cols-4 gap-2">
        {[
          ['Spend', fmtCurrency(metrics.spend)],
          ['Purchases', fmtNumber(metrics.purchases)],
          ['ROAS', `${metrics.roas.toFixed(2)}x`],
          ['Days live', fmtNumber(metrics.daysLive)],
        ].map(([metric, value]) => (
          <div key={metric} className="rounded-lg bg-gray-50 px-2 py-2 text-center">
            <div className="text-sm font-bold tabular-nums text-brand-dark">{value}</div>
            <div className="text-[9px] font-medium uppercase tracking-wider text-gray-400">{metric}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewActions({ test }: { test: GoodGameCreativeTest }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');

  function move(nextStatus: CreativeTestStatus) {
    startTransition(async () => {
      const result = await setGoodGameCreativeTestStatus(test.id, nextStatus);
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-2 border-t border-gray-100 pt-3">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => move('approved')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-forest px-3 py-2 text-xs font-bold text-white transition hover:bg-brand-forest/90 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" /> Approve test
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => move('declined')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 transition hover:border-rose-200 hover:text-rose-700 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" /> Decline
        </button>
      </div>
      {message ? <p className="text-xs text-gray-500">{message}</p> : null}
    </div>
  );
}

function TestCard({
  test,
  rank,
  canEdit,
  showMetrics = false,
}: {
  test: GoodGameCreativeTest;
  rank?: number;
  canEdit: boolean;
  showMetrics?: boolean;
}) {
  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {rank ? (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-forest text-xs font-bold text-white">
            {rank}
          </span>
        ) : null}
        <TestStatus status={test.status} />
        {test.priorityScore !== null ? (
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-gray-500">
            <Gauge className="h-3.5 w-3.5" /> Priority {Math.round(test.priorityScore)}
          </span>
        ) : null}
      </div>

      <h3 className="text-base font-bold leading-6 text-brand-dark">{test.title}</h3>
      <p className="mt-2 text-sm leading-6 text-gray-600">{test.hypothesis}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-brand-forest/[0.04] p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-forest">Variable being isolated</p>
          <p className="mt-1 text-xs leading-5 text-gray-700">{test.primaryVariable}</p>
        </div>
        <div className="rounded-xl bg-orange-50/60 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-orange">Why this priority</p>
          <p className="mt-1 text-xs leading-5 text-gray-700">{test.priorityReason}</p>
        </div>
      </div>

      <div className="mt-4">
        <CreativeReference test={test} />
      </div>

      {showMetrics && test.currentMetrics ? (
        <div className="mt-4 space-y-3">
          <MetricGrid metrics={test.currentMetrics} label="Test performance" />
          {test.controlMetrics ? <MetricGrid metrics={test.controlMetrics} label="Control performance" /> : null}
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
            <Clock3 className="h-3.5 w-3.5" /> {test.evidenceLabel}
          </div>
        </div>
      ) : null}

      {canEdit && test.status === 'recommended' ? <ReviewActions test={test} /> : null}
    </article>
  );
}

function CreativeDirection({ brief, insight }: { brief: string; insight: CreativeAiInsight }) {
  const directions = brief
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, ...rest] = line.split(': ');
      return { line, label, body: rest.join(': ') };
    });
  const productionPlan = directions.find((item) => item.label.toLowerCase() === 'production plan');
  const detailedDirections = productionPlan
    ? directions.filter((item) => item !== productionPlan)
    : directions;
  const winningThesis = insight.whatWorks[0]?.point || insight.summary;
  const overallDirection = productionPlan?.body || directions[0]?.body || directions[0]?.line;

  return (
    <section className="rounded-3xl border border-brand-forest/15 bg-brand-forest/[0.04] p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-brand-forest p-2.5 text-white"><Lightbulb className="h-5 w-5" /></div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-forest">Creative Director Brief</p>
          <h2 className="text-xl font-bold text-brand-dark">What is working and what the team should make next</h2>
        </div>
      </div>

      <div className="mt-4 space-y-3 rounded-xl border border-emerald-100 bg-white/90 p-4 sm:p-5">
        <p className="text-sm leading-6 text-gray-700">
          <span className="font-bold text-brand-dark">Brand-level thesis:</span> {winningThesis}
        </p>
        {overallDirection ? (
          <p className="text-sm leading-6 text-gray-700">
            <span className="font-bold text-brand-dark">Overall direction:</span> {overallDirection}
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {detailedDirections.map(({ line, label, body }, index) => (
          <div key={`${label}-${index}`} className="rounded-xl border border-white bg-white/80 p-4">
            {body ? <p className="text-[10px] font-bold uppercase tracking-wider text-brand-forest">{label}</p> : null}
            <p className="mt-1 text-sm leading-6 text-gray-700">{body || line}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function creativeRoas(creative: MetaCreative) {
  return creative.spend > 0 ? (creative.revenue ?? 0) / creative.spend : 0;
}

function creativeCtr(creative: MetaCreative) {
  return creative.impressions > 0 ? (creative.clicks / creative.impressions) * 100 : 0;
}

function formatInsightDate(value: string) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function selectRelativeLeaders(creatives: MetaCreative[]) {
  const totalSpend = creatives.reduce((sum, creative) => sum + creative.spend, 0);
  const totalPurchases = creatives.reduce((sum, creative) => sum + (creative.sales ?? 0), 0);
  const accountCostPerPurchase = totalPurchases > 0 ? totalSpend / totalPurchases : 100;
  const minimumSpend = accountCostPerPurchase * 2;

  return creatives
    .filter((creative) => (creative.sales ?? 0) >= 3 || creative.spend >= minimumSpend)
    .sort((a, b) => {
      const roasDifference = creativeRoas(b) - creativeRoas(a);
      return Math.abs(roasDifference) > 0.001 ? roasDifference : (b.sales ?? 0) - (a.sales ?? 0);
    })
    .slice(0, 3);
}

function LeaderCard({ creative, rank }: { creative: MetaCreative; rank: number }) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = creative.permanentImageUrl || creative.finalCreativeLink;
  const previewUrl = creative.previewUrl || creative.destinationUrl || '#';

  return (
    <a
      href={previewUrl}
      target="_blank"
      rel="noreferrer"
      className="group overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm transition hover:border-brand-forest/30 hover:shadow-md"
    >
      <div className="flex min-w-0 gap-4 p-4">
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
          {imageUrl && !imageFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={creative.name}
              className="h-full w-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <ImageIcon className="h-6 w-6 text-gray-400" />
          )}
          <span className="absolute left-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-forest text-[11px] font-bold text-white shadow-sm">
            {rank}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className="line-clamp-2 text-sm font-bold leading-5 text-brand-dark">{creative.name}</h3>
            <ExternalLink className="ml-auto mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400 group-hover:text-brand-forest" />
          </div>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            Current relative leader
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              ['ROAS', `${creativeRoas(creative).toFixed(2)}x`],
              ['Purchases', fmtNumber(creative.sales ?? 0)],
              ['Spend', fmtCurrency(creative.spend)],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="text-sm font-bold tabular-nums text-brand-dark">{value}</div>
                <div className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">{label}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-gray-500">CTR {creativeCtr(creative).toFixed(2)}%</p>
        </div>
      </div>
    </a>
  );
}

function WhatsWorkingNow({ insight, creatives }: { insight: CreativeAiInsight; creatives: MetaCreative[] }) {
  const leaders = selectRelativeLeaders(creatives);
  if (!leaders.length && !insight.whatWorks.length) return null;

  return (
    <section className="space-y-4 rounded-3xl border border-emerald-100 bg-emerald-50/40 p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-emerald-700 p-2.5 text-white"><Trophy className="h-5 w-5" /></div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">What is working now</p>
          <h2 className="text-xl font-bold text-brand-dark">Current leaders and repeatable signals</h2>
          <p className="mt-1 text-sm leading-6 text-gray-600">
            These are the strongest purchase ROAS signals in the current cohort. They are relative leaders, not confirmed scale winners. No concept has earned an Expand verdict yet.
          </p>
        </div>
      </div>

      {leaders.length ? (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Top performers · Current dashboard window</p>
          <div className="grid gap-3 lg:grid-cols-3">
            {leaders.map((creative, index) => <LeaderCard key={`${creative.name}-${index}`} creative={creative} rank={index + 1} />)}
          </div>
        </div>
      ) : null}

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

export default function GoodGameCreativeLearningLoop({
  insight,
  creatives,
  tests,
  canEdit,
}: {
  insight: CreativeAiInsight | null;
  creatives: MetaCreative[];
  tests: GoodGameCreativeTest[];
  canEdit: boolean;
}) {
  const activeTests = tests.filter((test) => ['launched', 'evaluating', 'concluded'].includes(test.status));
  const priorityTests = tests.filter((test) => ['recommended', 'approved', 'in_production'].includes(test.status));
  const supportingInsight = insight ? { ...insight, whatWorks: [], nextCreativeBrief: '', nextTests: [] } : null;

  return (
    <div className="space-y-8">
      {insight?.nextCreativeBrief ? <CreativeDirection brief={insight.nextCreativeBrief} insight={insight} /> : null}

      {insight ? <WhatsWorkingNow insight={insight} creatives={creatives} /> : null}

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <CircleDot className="h-5 w-5 text-brand-forest" />
          <div>
            <h2 className="text-2xl font-bold text-brand-dark">Active Tests and Results</h2>
            <p className="text-sm text-gray-500">Purchase ROAS is the decision metric. CTR and CPC remain diagnostic.</p>
          </div>
        </div>
        {activeTests.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {activeTests.map((test) => <TestCard key={test.id} test={test} canEdit={canEdit} showMetrics />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
            No tests are live yet. {priorityTests.length} Cycle 0 recommendation{priorityTests.length === 1 ? '' : 's'} are ready for review.
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <Target className="h-5 w-5 text-brand-orange" />
          <div>
            <h2 className="text-2xl font-bold text-brand-dark">Priority Tests Next</h2>
            <p className="text-sm text-gray-500">Ranked by expected purchase impact, speed to signal, confidence, and production effort.</p>
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {priorityTests.map((test, index) => (
            <TestCard key={test.id} test={test} rank={index + 1} canEdit={canEdit} />
          ))}
        </div>
      </section>

      {supportingInsight ? (
        <details className="group rounded-2xl border border-gray-100 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between p-5 text-sm font-bold text-brand-dark">
            Creative Insights and Supporting Evidence
            <ChevronDown className="h-4 w-4 text-gray-400 transition group-open:rotate-180" />
          </summary>
          <div className="border-t border-gray-100 p-5">
            <CreativeAiInsightCard
              insight={supportingInsight}
              variant="creative-director"
              heading="Creative Insights"
              hideActionSections
            />
          </div>
        </details>
      ) : null}
    </div>
  );
}
