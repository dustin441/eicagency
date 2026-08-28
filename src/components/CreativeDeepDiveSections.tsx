'use client';

import React, { useState } from 'react';
import {
  ChevronDown,
  ExternalLink,
  FileText,
  Gauge,
  Image as ImageIcon,
  Lightbulb,
  Play,
  ShoppingBag,
  Sparkles,
  Target,
  Trophy,
  X,
} from 'lucide-react';
import { fmtCurrency, fmtNumber } from '@/lib/utils';
import {
  concisePresentationCopy,
  creativeDisplayName,
  normalizePresentationCopy,
  safeExternalUrl,
} from '@/lib/creative-presentation';
import {
  findCreativeReference,
  isTrustedYoutubeEmbedUrl,
  selectCreativeLeaders,
  type CreativeDeepDiveLeader,
  type CreativeObjective,
} from '@/lib/creative-deep-dive';

export type CreativeDeepDiveTest = {
  title: string;
  why?: string;
  action?: string;
  primaryVariable?: string;
  creativeFormat?: string;
  referenceCreativeId?: string;
  referenceCreativeName?: string;
  priorityScore?: number | null;
};

export type CreativeDeepDiveInsight = {
  hasData: boolean;
  adsAnalyzed: number;
  summary: string;
  videoVsImage?: string;
  whatWorks: { point: string; evidence?: string }[];
  improvements: { point: string; why?: string }[];
  nextTests: CreativeDeepDiveTest[];
  nextCreativeBrief: string;
  asOf: string;
};

type ObjectiveLabels = {
  conversion: string;
  cost: string;
};

function CreativeMediaThumbnail({ creative, className = 'h-full w-full' }: { creative: CreativeDeepDiveLeader; className?: string }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = safeExternalUrl(creative.imageUrl);
  const textOnly = creative.previewKind === 'search' || creative.previewKind === 'text';

  if (creative.previewKind === 'catalog') {
    return (
      <span className="flex flex-col items-center justify-center gap-1 text-brand-forest">
        <ShoppingBag className="h-5 w-5" />
        <span className="text-[9px] font-bold uppercase tracking-wider">Catalog</span>
      </span>
    );
  }

  if (textOnly || !imageUrl || failed) {
    return <FileText className="h-5 w-5 text-gray-400" />;
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={creative.name}
        className={`${className} ${creative.lowResolutionPreview ? 'object-contain p-2' : 'object-cover'}`}
        onError={() => setFailed(true)}
      />
      {creative.previewKind === 'video' ? (
        <span className="absolute inset-0 flex items-center justify-center bg-black/15"><Play className="h-6 w-6 fill-white text-white drop-shadow" /></span>
      ) : null}
    </>
  );
}

function formatInsightDate(value: string) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderBulletBody(text: string) {
  const hasEnumerated = /\(\d+\)/.test(text);
  const items = hasEnumerated
    ? text.split(/(?=\(\d+\))/).map((item) => item.replace(/^\(\d+\)\s*/, '').trim()).filter(Boolean)
    : text.split(';').map((item) => item.trim()).filter(Boolean);
  if (items.length <= 1) return <p className="mt-1 text-sm leading-6 text-gray-700">{text}</p>;
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2 text-sm leading-5 text-gray-700">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-forest" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function CreativePreviewModal({
  creative,
  objective,
  labels,
  sourceLabel,
  onClose,
}: {
  creative: CreativeDeepDiveLeader;
  objective: CreativeObjective;
  labels: ObjectiveLabels;
  sourceLabel: string;
  onClose: () => void;
}) {
  const [mediaFailed, setMediaFailed] = useState(false);
  const imageUrl = safeExternalUrl(creative.imageUrl);
  const videoUrl = safeExternalUrl(creative.videoUrl);
  const externalPreviewUrl = safeExternalUrl(creative.externalPreviewUrl);
  const previewKind = creative.previewKind ?? (videoUrl ? 'video' : 'image');
  const ctr = creative.impressions > 0 ? (creative.clicks / creative.impressions) * 100 : 0;
  const roas = creative.spend > 0 ? (creative.revenue ?? 0) / creative.spend : 0;
  const costPerConversion = creative.conversions > 0 ? creative.spend / creative.conversions : 0;
  const costPerEngagement = (creative.engagements ?? 0) > 0
    ? creative.spend / (creative.engagements ?? 1)
    : 0;
  const objectiveMetrics = objective === 'sales'
    ? [['Spend', fmtCurrency(creative.spend)], [labels.conversion, fmtNumber(creative.conversions)], ['ROAS', `${roas.toFixed(2)}x`]]
    : objective === 'engagement'
      ? [['Spend', fmtCurrency(creative.spend)], [labels.conversion, fmtNumber(creative.engagements ?? 0)], [labels.cost, fmtCurrency(costPerEngagement)]]
      : objective === 'traffic'
        ? [['Spend', fmtCurrency(creative.spend)], ['Clicks', fmtNumber(creative.clicks)], ['CTR', `${ctr.toFixed(2)}%`]]
        : [['Spend', fmtCurrency(creative.spend)], [labels.conversion, fmtNumber(creative.conversions)], [labels.cost, fmtCurrency(costPerConversion)]];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute right-3 top-3 z-10 rounded-full bg-black/30 p-1 text-white hover:bg-black/50" aria-label="Close preview">
          <X className="h-4 w-4" />
        </button>
        <div className="max-h-[88vh] overflow-y-auto">
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-bold leading-tight text-gray-900">{creativeDisplayName(creative.platformName || creative.name, creative.headline || creative.name)}</p>
            <p className="text-[11px] leading-tight text-gray-400">{sourceLabel}</p>
          </div>
          {creative.primaryText && previewKind !== 'search' && previewKind !== 'text' ? (
            <p className="px-4 pb-2 pt-3 text-sm leading-relaxed text-gray-800">{concisePresentationCopy(creative.primaryText, 220)}</p>
          ) : null}
          <div className="relative flex min-h-56 w-full items-center justify-center bg-gray-100">
            {previewKind === 'catalog' ? (
              <div className="m-5 flex w-full flex-col items-center rounded-2xl border border-emerald-100 bg-white px-6 py-10 text-center shadow-sm">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-forest/10 text-brand-forest"><ShoppingBag className="h-7 w-7" /></span>
                <p className="mt-3 text-sm font-bold uppercase tracking-wider text-brand-dark">Catalog</p>
                <p className="mt-1 max-w-xs text-xs leading-5 text-gray-500">Catalog ads do not generate a fixed preview.</p>
              </div>
            ) : previewKind === 'video' && videoUrl && !mediaFailed ? (
              isTrustedYoutubeEmbedUrl(videoUrl) ? (
                <iframe src={videoUrl} title={creative.name} className="aspect-video w-full" sandbox="allow-scripts allow-same-origin allow-presentation" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              ) : (
                <video src={videoUrl} poster={imageUrl ?? undefined} controls playsInline preload="metadata" className="block max-h-[420px] w-full bg-black object-contain" onError={() => setMediaFailed(true)} />
              )
            ) : previewKind === 'search' ? (
              <div className="m-5 w-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs text-gray-500">Sponsored · {creative.platformName || 'Google Search'}</p>
                <p className="mt-2 text-xl font-medium leading-7 text-blue-700">{creative.headline || creative.name}</p>
                {creative.primaryText ? <p className="mt-2 text-sm leading-6 text-gray-700">{creative.primaryText}</p> : null}
              </div>
            ) : previewKind === 'text' ? (
              <div className="m-5 w-full rounded-xl border border-emerald-100 bg-white p-6 text-center shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-forest">Performance Max text asset</p>
                <p className="mt-3 text-xl font-semibold leading-7 text-brand-dark">{creative.headline || creative.name}</p>
                {creative.primaryText ? <p className="mt-2 text-xs text-gray-500">{creative.primaryText}</p> : null}
              </div>
            ) : imageUrl && !mediaFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={creative.name} className={`block max-h-[360px] object-contain ${creative.lowResolutionPreview ? 'h-16 w-16' : 'w-full'}`} onError={() => setMediaFailed(true)} />
            ) : (
              <ImageIcon className="h-10 w-10 text-gray-300" />
            )}
          </div>
          {creative.lowResolutionPreview && previewKind !== 'catalog' ? (
            <p className="border-t border-gray-100 bg-amber-50 px-4 py-2 text-[11px] leading-4 text-amber-800">Dynamic catalog ad: Meta supplies a viewer-specific product image, so the source only exposes a small catalog thumbnail here.</p>
          ) : null}
          {externalPreviewUrl ? (
            <a href={externalPreviewUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 border-t border-gray-100 px-4 py-2.5 text-xs font-bold text-brand-forest hover:bg-gray-50">Open native ad preview <ExternalLink className="h-3.5 w-3.5" /></a>
          ) : null}
          <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100">
            {objectiveMetrics.map(([label, value]) => (
              <div key={label} className="flex flex-col items-center px-1 py-3">
                <span className="text-sm font-bold tabular-nums text-brand-dark">{value}</span>
                <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-gray-400">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Brief({ insight, showFullBriefDisclosure }: { insight: CreativeDeepDiveInsight; showFullBriefDisclosure: boolean }) {
  const directions = insight.nextCreativeBrief
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, ...rest] = line.split(': ');
      return { line, label: rest.length ? label : '', body: rest.length ? rest.join(': ') : line };
    });
  const productionPlan = directions.find((item) => ['production plan', 'overall direction'].includes(item.label.toLowerCase()));
  const winningThesis = insight.whatWorks[0]?.point || insight.summary;
  const directionSource = productionPlan?.body || directions[0]?.body || directions[0]?.line || '';
  const sentences = directionSource.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((sentence) => sentence.trim()) ?? [];
  const overallSource = sentences.length > 2 ? `${sentences[0]} ${sentences[sentences.length - 1]}` : directionSource;
  const compactThesis = concisePresentationCopy(winningThesis, 180);
  const overallDirection = concisePresentationCopy(overallSource, 220);
  const compactDirections = directions.map(({ label, body, line }) => {
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
        {compactThesis ? <p className="text-sm leading-6 text-gray-700"><span className="font-bold text-brand-dark">Brand-level thesis:</span> {compactThesis}</p> : null}
        {overallDirection ? <p className="text-sm leading-6 text-gray-700"><span className="font-bold text-brand-dark">Overall direction:</span> {overallDirection}</p> : null}
      </div>

      {compactDirections.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {compactDirections.map(({ label, compactBody, fullBody }, index) => (
            <div key={`${label}-${index}`} className="rounded-xl border border-white bg-white/80 p-4">
              {label ? <p className="text-[10px] font-bold uppercase tracking-wider text-brand-forest">{label}</p> : null}
              <p className="mt-1 text-sm leading-6 text-gray-700">{compactBody}</p>
              {compactBody !== fullBody ? (
                <details className="mt-2 border-t border-gray-50 pt-2">
                  <summary className="cursor-pointer list-none text-[11px] font-bold text-brand-forest">View full</summary>
                  <div className="mt-2">{renderBulletBody(fullBody)}</div>
                </details>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {showFullBriefDisclosure && compactDirections.length ? (
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
      ) : null}

    </section>
  );
}

function PriorityTests({
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
  const [preview, setPreview] = useState<CreativeDeepDiveLeader | null>(null);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <Target className="h-5 w-5 text-brand-orange" />
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-orange">Recommended action</p>
          <h2 className="text-2xl font-bold text-brand-dark">Priority Tests Next</h2>
          <p className="text-sm text-gray-500">What to make next, why it matters, and the current creative reference.</p>
        </div>
      </div>

      {insight.nextTests.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {insight.nextTests.map((test, index) => {
            const action = concisePresentationCopy(test.action || test.title, 170);
            const fullAction = normalizePresentationCopy(test.action || test.title);
            const why = concisePresentationCopy(test.why ?? '', 150);
            const fullWhy = normalizePresentationCopy(test.why ?? '');
            const reference = findCreativeReference(test, candidates);
            const variable = test.primaryVariable || 'Creative concept and execution';
            const hasProductionDetail = action !== fullAction || why !== fullWhy || Boolean(test.creativeFormat);
            return (
              <article key={`${test.title}-${index}`} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-forest text-xs font-bold text-white">{index + 1}</span>
                  <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-800">Recommended</span>
                  {test.priorityScore !== null && test.priorityScore !== undefined ? (
                    <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-gray-500"><Gauge className="h-3.5 w-3.5" /> Priority {Math.round(test.priorityScore)}</span>
                  ) : null}
                </div>
                <h3 className="text-base font-bold leading-6 text-brand-dark">{test.title}</h3>
                {action ? <p className="mt-2 text-sm leading-6 text-gray-700"><span className="font-bold text-brand-dark">Action:</span> {action}</p> : null}

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-brand-forest/[0.04] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-forest">Variable being isolated</p>
                    <p className="mt-1 text-xs leading-5 text-gray-700">{variable}</p>
                  </div>
                  <div className="rounded-xl bg-orange-50/60 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-orange">Why this priority</p>
                    <p className="mt-1 text-xs leading-5 text-gray-700">{why || 'Tests the strongest current creative signal against the client objective.'}</p>
                  </div>
                </div>

                {reference ? (
                  <button type="button" onClick={() => setPreview(reference)} className="relative mt-4 flex w-full min-w-0 items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-2 text-left transition hover:border-brand-forest/25 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-forest/40" data-creative-reference="true">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-200 sm:h-20 sm:w-20">
                      <CreativeMediaThumbnail creative={reference} />
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-brand-forest">Creative reference · click to preview</span>
                      <span className="block text-sm font-semibold leading-5 text-brand-dark">{creativeDisplayName(reference.platformName || reference.name, reference.headline || reference.name)}</span>
                      {reference.platformName ? <span className="mt-1 block truncate text-[11px] text-gray-400">Platform name: {reference.platformName}</span> : null}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  </button>
                ) : null}

                {hasProductionDetail ? (
                  <details className="group mt-4 rounded-xl border border-gray-100 bg-gray-50/70">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-bold text-brand-dark">
                      Production details
                      <ChevronDown className="h-3.5 w-3.5 text-gray-400 transition group-open:rotate-180" />
                    </summary>
                    <div className="space-y-2 border-t border-gray-100 px-3 py-3 text-xs leading-5 text-gray-600">
                      {fullAction ? <p><span className="font-semibold text-brand-dark">Full test brief:</span> {fullAction}</p> : null}
                      {fullWhy ? <p><span className="font-semibold text-brand-dark">Full rationale:</span> {fullWhy}</p> : null}
                      {test.creativeFormat ? <p><span className="font-semibold text-brand-dark">Format:</span> {test.creativeFormat}</p> : null}
                    </div>
                  </details>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">No new tests are currently recommended by the latest analysis.</div>
      )}
      {preview ? <CreativePreviewModal creative={preview} objective={objective} labels={labels} sourceLabel={sourceLabel} onClose={() => setPreview(null)} /> : null}
    </section>
  );
}

function LeaderCard({
  leader,
  rank,
  objective,
  labels,
  sourceLabel,
}: {
  leader: CreativeDeepDiveLeader;
  rank: number;
  objective: CreativeObjective;
  labels: ObjectiveLabels;
  sourceLabel: string;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
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
    <>
      <button type="button" onClick={() => setPreviewOpen(true)} className="group/leader w-full overflow-hidden rounded-2xl border border-emerald-100 bg-white text-left shadow-sm transition hover:border-brand-forest/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-forest/40">
        <div className="flex min-w-0 gap-4 p-4">
          <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
            <CreativeMediaThumbnail creative={leader} className="h-full w-full transition-transform duration-200 group-hover/leader:scale-105" />
            <span className="absolute left-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-forest text-[11px] font-bold text-white shadow-sm">{rank}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <div className="min-w-0">
                <h3 className="line-clamp-2 text-sm font-bold leading-5 text-brand-dark">{creativeDisplayName(leader.platformName || leader.name, leader.headline || leader.name)}</h3>
                {leader.platformName && leader.platformName !== leader.name ? <p className="mt-0.5 truncate text-[10px] text-gray-400">Platform name: {leader.platformName}</p> : null}
              </div>
              <ExternalLink className="ml-auto mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400 group-hover/leader:text-brand-forest" />
            </div>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">Current relative leader</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {metrics.map(([label, value]) => <div key={label}><div className="text-sm font-bold tabular-nums text-brand-dark">{value}</div><div className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">{label}</div></div>)}
            </div>
            {objective !== 'traffic' ? <p className="mt-2 text-[11px] text-gray-500">CTR {ctr.toFixed(2)}%</p> : null}
          </div>
        </div>
      </button>
      {previewOpen ? <CreativePreviewModal creative={leader} objective={objective} labels={labels} sourceLabel={sourceLabel} onClose={() => setPreviewOpen(false)} /> : null}
    </>
  );
}

function WorkingNow({
  insight,
  candidates,
  objective,
  labels,
  sourceLabel,
  showLeaderCards,
}: {
  insight: CreativeDeepDiveInsight;
  candidates: CreativeDeepDiveLeader[];
  objective: CreativeObjective;
  labels: ObjectiveLabels;
  sourceLabel: string;
  showLeaderCards: boolean;
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
        <div className="rounded-xl bg-emerald-700 p-2.5 text-white">{showLeaderCards ? <Trophy className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}</div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">{showLeaderCards ? 'What is working now' : 'Creative signals'}</p>
          <h2 className="text-xl font-bold text-brand-dark">{showLeaderCards ? 'Current leaders and repeatable signals' : 'What to carry forward'}</h2>
          {showLeaderCards ? <p className="mt-1 text-sm leading-6 text-gray-600">Relative leaders are ranked by {objectiveCopy} for this client. Use them as directional signals, not automatic scale decisions.</p> : null}
        </div>
      </div>

      {showLeaderCards && (leaders.length ? (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Top performers · {sourceLabel}</p>
          <div className="grid gap-3 lg:grid-cols-3">
            {leaders.map((leader, index) => <LeaderCard key={leader.id} leader={leader} rank={index + 1} objective={objective} labels={labels} sourceLabel={sourceLabel} />)}
          </div>
        </div>
      ) : <p className="rounded-xl border border-dashed border-emerald-200 bg-white/70 p-4 text-sm text-gray-500">Not enough primary-outcome data to name a current leader yet.</p>)}

      {insight.whatWorks.length ? (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">{showLeaderCards ? 'What to carry forward' : 'Evidence behind these signals'}{insight.asOf ? ` · Latest Deep Dive as of ${formatInsightDate(insight.asOf)}` : ''}</p>
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
                      <div className="mt-2 space-y-1 text-xs leading-5 text-gray-500">{fullPoint ? <p>{fullPoint}</p> : null}{fullEvidence ? <p>{fullEvidence}</p> : null}</div>
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
        {insight.summary ? <p className="text-sm font-semibold leading-6 text-brand-dark">{concisePresentationCopy(insight.summary, 240)}</p> : null}
        {insight.videoVsImage ? <div><p className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500">Format read</p><p className="text-sm leading-6 text-gray-700">{concisePresentationCopy(insight.videoVsImage, 240)}</p></div> : null}
        {insight.improvements.length ? (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">What has not worked / evidence to address</p>
            <div className="space-y-2">
              {insight.improvements.map((item, index) => {
                const point = concisePresentationCopy(item.point, 170);
                const why = concisePresentationCopy(item.why ?? '', 180);
                const fullPoint = normalizePresentationCopy(item.point);
                const fullWhy = normalizePresentationCopy(item.why ?? '');
                const hasMore = point !== fullPoint || why !== fullWhy;
                return (
                  <div key={index} className="rounded-xl bg-orange-50/60 p-3 text-sm leading-6 text-gray-700">
                    <span className="font-semibold text-brand-dark">{point}</span>
                    {why ? <span className="block text-gray-500">{why}</span> : null}
                    {hasMore ? <details className="mt-2 border-t border-orange-100 pt-2"><summary className="cursor-pointer list-none text-[11px] font-bold text-brand-forest">View full evidence</summary><div className="mt-2 space-y-1 text-xs leading-5 text-gray-500"><p>{fullPoint}</p>{fullWhy ? <p>{fullWhy}</p> : null}</div></details> : null}
                  </div>
                );
              })}
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
  referenceCandidates,
  objective,
  conversionLabel,
  costLabel,
  showLeaderCards = true,
  showFullBriefDisclosure = false,
  sourceLabel = 'Current dashboard window',
}: {
  insight: CreativeDeepDiveInsight | null;
  candidates: CreativeDeepDiveLeader[];
  referenceCandidates?: CreativeDeepDiveLeader[];
  objective: CreativeObjective;
  conversionLabel?: string;
  costLabel?: string;
  showLeaderCards?: boolean;
  showFullBriefDisclosure?: boolean;
  sourceLabel?: string;
}) {
  if (!insight) return null;
  const labels = {
    conversion: conversionLabel ?? (objective === 'sales' ? 'Purchases' : objective === 'leads' ? 'Leads' : objective === 'volume' ? 'Conversions' : objective === 'engagement' ? 'Engagements' : 'Clicks'),
    cost: costLabel ?? (objective === 'leads' ? 'CPL' : objective === 'volume' ? 'Cost/Conversion' : objective === 'engagement' ? 'Cost/Engagement' : 'CPC'),
  };

  if (!insight.hasData) {
    return <div className="rounded-2xl border border-brand-forest/15 bg-brand-forest/[0.03] p-5 text-sm leading-6 text-gray-500">{insight.summary || 'Not enough recent ad spend to analyze creatives yet. Check back after the next run.'}</div>;
  }

  return (
    <div className="space-y-8">
      <Brief insight={insight} showFullBriefDisclosure={showFullBriefDisclosure} />
      <PriorityTests insight={insight} candidates={referenceCandidates ?? candidates} objective={objective} labels={labels} sourceLabel={sourceLabel} />
      <WorkingNow insight={insight} candidates={candidates} objective={objective} labels={labels} sourceLabel={sourceLabel} showLeaderCards={showLeaderCards} />
      <SupportingEvidence insight={insight} />
    </div>
  );
}
