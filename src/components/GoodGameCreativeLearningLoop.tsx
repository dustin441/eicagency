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
  MessageSquare,
  Share2,
  Target,
  ThumbsUp,
  Trophy,
  X,
} from 'lucide-react';
import CreativeAiInsightCard from '@/components/CreativeAiInsightCard';
import { fmtCurrency, fmtNumber } from '@/lib/utils';
import type { CreativeAiInsight } from '@/services/creative-ai-insights';
import type { MetaCreative } from '@/services/analytics';
import { resolveMetaImageUrl } from '@/lib/creative-deep-dive';
import type {
  CreativeTestMetrics,
  CreativeTestStatus,
  GoodGameCreativeTest,
} from '@/services/goodgame-creative-learning';
import { setGoodGameCreativeTestStatus } from '@/app/dashboard/goodgame/creatives/actions';
import {
  concisePresentationCopy,
  creativeDisplayName,
  normalizePresentationCopy,
  safeExternalUrl,
} from '@/lib/creative-presentation';

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

function CreativePreviewModal({
  creative,
  imageUrl,
  label,
  onClose,
}: {
  creative: MetaCreative | null;
  imageUrl: string | null;
  label: string;
  onClose: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const c = creative;
  const src = c
    ? safeExternalUrl(resolveMetaImageUrl(c)) ?? imageUrl
    : imageUrl;
  const pageName = c?.pageName && c.pageName !== 'null' && c.pageName !== 'undefined' ? c.pageName : 'Good Game';
  const profileImg = safeExternalUrl(c?.pageProfileImageUrl ?? '');
  const bodyText = c?.primaryText && c.primaryText !== 'null' && c.primaryText !== 'undefined' ? c.primaryText : null;
  const headline = c?.headline && c.headline !== 'null' && c.headline !== 'undefined' ? c.headline : null;
  const domain = (() => { try { return new URL(c?.destinationUrl ?? '').hostname.replace(/^www\./, ''); } catch { return ''; } })();
  const ctaText = (() => { const t = c?.ctaType; if (!t || t === 'null' || t === 'undefined') return 'Learn More'; return t.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()); })();
  const roas = c && c.spend > 0 ? ((c.revenue ?? 0) / c.spend).toFixed(2) : null;
  const imprStr = c ? (c.impressions >= 1_000_000 ? `${(c.impressions / 1_000_000).toFixed(1)}M` : c.impressions >= 1_000 ? `${(c.impressions / 1_000).toFixed(0)}K` : String(c.impressions)) : null;
  const ctrStr = c && c.impressions > 0 ? `${((c.clicks / c.impressions) * 100).toFixed(2)}%` : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/30 p-1 text-white hover:bg-black/50"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Scrollable content */}
        <div className="max-h-[88vh] overflow-y-auto">
          {/* Ad header */}
          <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-3">
            {profileImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profileImg} alt={pageName} className="h-9 w-9 shrink-0 rounded-full border border-gray-200 bg-white object-cover" />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0B4A31]">
                <span className="text-[11px] font-bold text-white">{pageName.slice(0, 3).toUpperCase()}</span>
              </div>
            )}
            <div>
              <p className="text-sm font-bold leading-tight text-gray-900">{pageName}</p>
              <p className="text-[11px] leading-tight text-gray-400">Sponsored · 🌐</p>
            </div>
          </div>

          {/* Primary text */}
          {bodyText ? (
            <div className="px-4 pb-2 pt-3 text-sm leading-relaxed text-gray-800">
              {bodyText.length > 160 ? `${bodyText.slice(0, 160)}…` : bodyText}
            </div>
          ) : null}

          {/* Creative image */}
          <div className="relative w-full bg-gray-100">
            {src && !imgError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={label}
                className="block w-full"
                style={{ maxHeight: '320px', objectFit: 'contain' }}
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center">
                <ImageIcon className="h-10 w-10 text-gray-300" />
              </div>
            )}
          </div>

          {/* Headline + CTA */}
          <div className="flex items-center gap-3 border-t border-gray-100 bg-gray-50 px-4 py-3">
            <div className="min-w-0 flex-1">
              {headline ? <p className="line-clamp-1 text-sm font-bold text-gray-900">{headline}</p> : null}
              {domain ? <p className="mt-0.5 text-[11px] text-gray-400">{domain}</p> : null}
            </div>
            <button
              type="button"
              className="shrink-0 rounded-md px-3.5 py-2 text-xs font-bold text-white whitespace-nowrap"
              style={{ backgroundColor: '#1877F2' }}
            >
              {ctaText}
            </button>
          </div>

          {/* Engagement bar */}
          <div className="flex items-center justify-around border-t border-gray-100 px-4 py-1.5">
            {([
              { Icon: ThumbsUp, label: 'Like' },
              { Icon: MessageSquare, label: 'Comment' },
              { Icon: Share2, label: 'Share' },
            ] as { Icon: React.ComponentType<{ className?: string }>; label: string }[]).map(({ Icon, label: l }) => (
              <button key={l} type="button" className="flex items-center gap-1.5 py-1 text-xs font-medium text-gray-400">
                <Icon className="h-3.5 w-3.5" /> {l}
              </button>
            ))}
          </div>

          {/* Metrics */}
          {c ? (
            <div className="grid grid-cols-4 divide-x divide-gray-100 border-t border-gray-100">
              {([
                ['Spend', `$${Math.round(c.spend).toLocaleString()}`],
                ['Impr.', imprStr ?? '—'],
                ['CTR', ctrStr ?? '—'],
                ['ROAS', roas ? `${roas}x` : '—'],
              ] as [string, string][]).map(([l, v]) => (
                <div key={l} className="flex flex-col items-center py-2.5 px-1">
                  <span className="text-sm font-bold tabular-nums text-[#0f172a]">{v}</span>
                  <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-gray-400">{l}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CreativeReference({ test, creatives }: { test: GoodGameCreativeTest; creatives: MetaCreative[] }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const preview = test.previews[0];
  if (!preview) return null;
  const imageUrl = safeExternalUrl(preview.imageUrl);
  const label = creativeDisplayName(preview.name);
  const normalizeForMatch = (s: string) =>
    s.normalize('NFC').toLowerCase().trim()
      .replace(/[\u2018\u2019\u201A\u201B\u02BC]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
      .replace(/\s+/g, ' ')
      .replace(/^["']+|["']+$/g, '')
      .trim();
  const matchedCreative = creatives.find((c) => normalizeForMatch(c.name) === normalizeForMatch(preview.name)) ?? null;
  const className = 'relative flex min-w-0 items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-2 text-left transition hover:border-brand-forest/25 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-forest/40';
  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={className}
        data-creative-reference="true"
      >
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-200 sm:h-20 sm:w-20">
          {imageUrl && !imageFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={label}
              className="h-full w-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <ImageIcon className="h-5 w-5 text-gray-400" />
          )}
        </div>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-brand-forest">Visual reference · click to preview</span>
          <span className="block text-sm font-semibold leading-5 text-brand-dark">{label}</span>
          <span className="mt-1 block truncate text-[11px] text-gray-400" title={preview.name}>Platform name: {preview.name}</span>
        </span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-400" />
      </button>
      {modalOpen ? (
        <CreativePreviewModal
          creative={matchedCreative}
          imageUrl={imageUrl}
          label={label}
          onClose={() => setModalOpen(false)}
        />
      ) : null}
    </>
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
  creatives = [],
}: {
  test: GoodGameCreativeTest;
  rank?: number;
  canEdit: boolean;
  showMetrics?: boolean;
  creatives?: MetaCreative[];
}) {
  const action = concisePresentationCopy(test.hypothesis, 170);
  const why = concisePresentationCopy(test.priorityReason, 150);
  const normalizedHypothesis = normalizePresentationCopy(test.hypothesis);
  const normalizedReason = normalizePresentationCopy(test.priorityReason);
  const hasProductionDetail = action !== normalizedHypothesis
    || why !== normalizedReason
    || Boolean(test.creativeFormat || test.ownerName);

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
      {action ? (
        <p className="mt-2 text-sm leading-6 text-gray-700">
          <span className="font-bold text-brand-dark">Action:</span> {action}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-brand-forest/[0.04] p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-forest">Variable being isolated</p>
          <p className="mt-1 text-xs leading-5 text-gray-700">{test.primaryVariable}</p>
        </div>
        <div className="rounded-xl bg-orange-50/60 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-orange">Why this priority</p>
          <p className="mt-1 text-xs leading-5 text-gray-700">{why}</p>
        </div>
      </div>

      <div className="mt-4">
        <CreativeReference test={test} creatives={creatives} />
      </div>

      {hasProductionDetail ? (
        <details className="group mt-4 rounded-xl border border-gray-100 bg-gray-50/70">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-bold text-brand-dark">
            Production details
            <ChevronDown className="h-3.5 w-3.5 text-gray-400 transition group-open:rotate-180" />
          </summary>
          <div className="space-y-2 border-t border-gray-100 px-3 py-3 text-xs leading-5 text-gray-600">
            {normalizedHypothesis ? <p><span className="font-semibold text-brand-dark">Full test brief:</span> {normalizedHypothesis}</p> : null}
            {normalizedReason ? <p><span className="font-semibold text-brand-dark">Full rationale:</span> {normalizedReason}</p> : null}
            {test.creativeFormat ? <p><span className="font-semibold text-brand-dark">Format:</span> {test.creativeFormat}</p> : null}
            {test.ownerName ? <p><span className="font-semibold text-brand-dark">Owner:</span> {test.ownerName}</p> : null}
          </div>
        </details>
      ) : null}

      {showMetrics ? (
        <div className="mt-4 space-y-3">
          {test.currentMetrics ? <MetricGrid metrics={test.currentMetrics} label="Test performance" /> : null}
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

function renderBulletBody(text: string) {
  const hasEnumerated = /\(\d+\)/.test(text);
  const items = hasEnumerated
    ? text.split(/(?=\(\d+\))/).map((s) => s.replace(/^\(\d+\)\s*/, '').trim()).filter(Boolean)
    : text.split(';').map((s) => s.trim()).filter(Boolean);
  if (items.length <= 1) {
    return <p className="mt-1 text-sm leading-6 text-gray-700">{text}</p>;
  }
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm leading-5 text-gray-700">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-forest" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
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
  const winningThesis = insight.whatWorks[0]?.point || insight.summary;
  const directionSource = productionPlan?.body || directions[0]?.body || directions[0]?.line || '';
  const directionSentences = directionSource.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((sentence) => sentence.trim()) ?? [];
  const overallDirectionSource = directionSentences.length > 2
    ? `${directionSentences[0]} ${directionSentences[directionSentences.length - 1]}`
    : directionSource;
  const overallDirection = concisePresentationCopy(overallDirectionSource, 220);
  const compactThesis = concisePresentationCopy(winningThesis, 180);
  const compactDirections = directions.map(({ line, label, body }) => {
    const fullBody = normalizePresentationCopy(body || line);
    return { label, fullBody, compactBody: concisePresentationCopy(fullBody, 180) };
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

      <div className="mt-4 space-y-3 rounded-xl border border-emerald-100 bg-white/90 p-4 sm:p-5">
        <p className="text-sm leading-6 text-gray-700">
          <span className="font-bold text-brand-dark">Brand-level thesis:</span> {compactThesis}
        </p>
        {overallDirection ? (
          <p className="text-sm leading-6 text-gray-700">
            <span className="font-bold text-brand-dark">Overall direction:</span> {overallDirection}
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {compactDirections.map(({ label, compactBody, fullBody }, index) => {
          const isTruncated = compactBody !== fullBody;
          return (
            <div key={`${label}-${index}`} className="rounded-xl border border-white bg-white/80 p-4">
              {label ? <p className="text-[10px] font-bold uppercase tracking-wider text-brand-forest">{label}</p> : null}
              <p className="mt-1 text-sm leading-6 text-gray-700">{compactBody}</p>
              {isTruncated ? (
                <details className="mt-2 border-t border-gray-50 pt-2">
                  <summary className="cursor-pointer list-none text-[11px] font-bold text-brand-forest">View full</summary>
                  <div className="mt-2">{renderBulletBody(fullBody)}</div>
                </details>
              ) : null}
            </div>
          );
        })}
      </div>

      <details className="group mt-4 rounded-xl border border-brand-forest/10 bg-white/80">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-bold text-brand-dark">
          Creative Director Brief
          <ChevronDown className="h-4 w-4 text-gray-400 transition group-open:rotate-180" />
        </summary>
        <div className="space-y-3 border-t border-brand-forest/10 px-4 py-4 text-sm leading-6 text-gray-700">
          {compactDirections.map(({ label, fullBody }, index) => (
            <p key={`${label}-full-${index}`}>
              {label ? <span className="font-semibold text-brand-dark">{label}: </span> : null}
              {fullBody}
            </p>
          ))}
        </div>
      </details>
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
  const [modalOpen, setModalOpen] = useState(false);
  const imageUrl = safeExternalUrl(resolveMetaImageUrl(creative));
  const displayName = creativeDisplayName(creative.name, creative.headline);
  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="group/leader w-full overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm transition hover:border-brand-forest/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-forest/40"
      >
        <div className="flex min-w-0 gap-4 p-4">
          <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
            {imageUrl && !imageFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={displayName}
                className="h-full w-full object-cover transition-transform duration-200 group-hover/leader:scale-105"
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
              <div className="min-w-0">
                <h3 className="line-clamp-2 text-sm font-bold leading-5 text-brand-dark">{displayName}</h3>
                {displayName !== creative.name ? (
                  <p className="mt-0.5 truncate text-[10px] text-gray-400" title={creative.name}>Platform name: {creative.name}</p>
                ) : null}
              </div>
              <ExternalLink className="ml-auto mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400 group-hover/leader:text-brand-forest" />
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
      </button>
      {modalOpen ? (
        <CreativePreviewModal
          creative={creative}
          imageUrl={imageUrl}
          label={displayName}
          onClose={() => setModalOpen(false)}
        />
      ) : null}
    </>
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
            {insight.whatWorks.map((item, index) => {
              const point = concisePresentationCopy(item.point, 150);
              const evidence = concisePresentationCopy(item.evidence ?? '', 180);
              const fullPoint = normalizePresentationCopy(item.point);
              const fullEvidence = normalizePresentationCopy(item.evidence ?? '');
              const hasMore = point !== fullPoint || evidence !== fullEvidence;
              return (
                <div key={index} className="rounded-xl border border-white bg-white/90 p-4">
                  <p className="text-sm font-semibold leading-6 text-brand-dark">{point}</p>
                  {evidence ? <p className="mt-1 text-xs leading-5 text-gray-500">{evidence}</p> : null}
                  {hasMore ? (
                    <details className="mt-3 border-t border-gray-100 pt-2">
                      <summary className="cursor-pointer list-none text-[11px] font-bold text-brand-forest">View full evidence</summary>
                      <div className="mt-2 space-y-1 text-xs leading-5 text-gray-500">
                        {fullPoint ? <p>{fullPoint}</p> : null}
                        {fullEvidence ? <p>{fullEvidence}</p> : null}
                      </div>
                    </details>
                  ) : null}
                </div>
              );
            })}
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

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <Target className="h-5 w-5 text-brand-orange" />
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-orange">Recommended action</p>
            <h2 className="text-2xl font-bold text-brand-dark">Priority Tests Next</h2>
            <p className="text-sm text-gray-500">What to make next, why it matters, and the current creative reference.</p>
          </div>
        </div>
        {priorityTests.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {priorityTests.map((test, index) => (
              <TestCard key={test.id} test={test} rank={index + 1} canEdit={canEdit} creatives={creatives} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
            No new tests are currently awaiting review.
          </div>
        )}
      </section>

      {activeTests.length ? (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <CircleDot className="h-5 w-5 text-brand-forest" />
            <div>
              <h2 className="text-2xl font-bold text-brand-dark">Active Tests and Results</h2>
              <p className="text-sm text-gray-500">Purchase ROAS is the decision metric. CTR and CPC remain diagnostic.</p>
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {activeTests.map((test) => <TestCard key={test.id} test={test} canEdit={canEdit} showMetrics creatives={creatives} />)}
          </div>
        </section>
      ) : null}

      {insight ? <WhatsWorkingNow insight={insight} creatives={creatives} /> : null}

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
