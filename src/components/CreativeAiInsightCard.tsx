'use client';

import React from 'react';
import { Sparkles, Image as ImageIcon } from 'lucide-react';
import type { CreativeAiInsight } from '@/services/creative-ai-insights';

function fmtAsOf(asOf: string): string {
  if (!asOf) return '';
  const d = new Date(`${asOf}T00:00:00`);
  if (Number.isNaN(d.getTime())) return asOf;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// AI Creative Insight card for each client's dedicated "Ad Analysis" tab.
// Mirrors Spartaco's BrandAiInsightCard so the look stays consistent.
export default function CreativeAiInsightCard({
  insight,
  variant = 'default',
}: {
  insight: CreativeAiInsight | null;
  variant?: 'default' | 'creative-director';
}) {
  if (!insight) return null;
  const isCreativeDirector = variant === 'creative-director';

  // No qualifying creatives in the last 30 days — show a quiet placeholder
  // rather than an empty card.
  if (!insight.hasData) {
    return (
      <div className="rounded-2xl border border-brand-forest/15 bg-brand-forest/[0.03] p-5">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-forest">
          <Sparkles className="h-3.5 w-3.5" />
          AI Creative Insight
        </div>
        <p className="text-sm leading-6 text-gray-500">
          {insight.summary || 'Not enough recent ad spend to analyze creatives yet. Check back after the next run.'}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-brand-forest/15 bg-brand-forest/[0.03] p-5 space-y-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-forest">
        <Sparkles className="h-3.5 w-3.5" />
        AI Creative Insight
        {insight.adsAnalyzed > 0 && (
          <span className="font-medium normal-case tracking-normal text-gray-400">
            · {insight.adsAnalyzed} creative{insight.adsAnalyzed === 1 ? '' : 's'} analyzed
          </span>
        )}
        {insight.asOf && (
          <span className="ml-auto text-xs font-medium normal-case tracking-normal text-gray-400 shrink-0">
            as of {fmtAsOf(insight.asOf)}
          </span>
        )}
      </div>

      {insight.summary && (
        <div>
          {isCreativeDirector && (
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">Overall read</p>
          )}
          <p className="text-sm font-semibold leading-6 text-brand-dark">{insight.summary}</p>
        </div>
      )}

      {insight.videoVsImage && (
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">
            {isCreativeDirector ? "What's in market" : 'Format read'}
          </p>
          <div className="flex gap-2 text-sm leading-6 text-gray-700">
            <ImageIcon className="mt-1 h-3.5 w-3.5 shrink-0 text-brand-forest" />
            <span>{insight.videoVsImage}</span>
          </div>
        </div>
      )}

      {insight.whatWorks.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">
            {isCreativeDirector ? "What's showing relative strength" : "What's working"}
          </p>
          <div className="space-y-1.5">
            {insight.whatWorks.map((it, i) => (
              <div key={i} className="flex gap-2 text-sm leading-6 text-gray-700">
                <span className="mt-2 h-1.5 w-1.5 rounded-full shrink-0 bg-brand-forest" />
                <span className="min-w-0">
                  <span className="font-medium text-brand-dark">{it.point}</span>
                  {it.evidence ? <span className="block text-gray-500">{it.evidence}</span> : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {insight.improvements.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">
            {isCreativeDirector ? "What hasn't worked" : 'Improvements to test'}
          </p>
          <div className="space-y-1.5">
            {insight.improvements.map((it, i) => (
              <div key={i} className="flex gap-2 text-sm leading-6 text-gray-700">
                <span className="mt-2 h-1.5 w-1.5 rounded-full shrink-0 bg-brand-orange" />
                <span className="min-w-0">
                  <span className="font-medium text-brand-dark">{it.point}</span>
                  {it.why ? <span className="block text-gray-500">{it.why}</span> : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {insight.nextCreativeBrief && (
        <div className="rounded-xl bg-white border border-brand-forest/10 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-brand-forest">
            {isCreativeDirector ? 'Creative director recommendation' : 'Creative director brief'}
          </p>
          <div className="space-y-2 text-sm leading-6 text-gray-700">
            {insight.nextCreativeBrief
              .split('\n')
              .filter(Boolean)
              .map((line, i) => {
                const [label, ...rest] = line.split(': ');
                const body = rest.join(': ');
                return body ? (
                  <p key={i}>
                    <span className="font-semibold text-brand-dark">{label}:</span> <span>{body}</span>
                  </p>
                ) : (
                  <p key={i}>{line}</p>
                );
              })}
          </div>
        </div>
      )}

      {insight.nextTests.length > 0 && (
        <div className="rounded-xl bg-white border border-gray-100 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-brand-forest">
            {isCreativeDirector ? 'Creative concepts to test next' : 'Creatives to test next'}
          </p>
          <ol className="space-y-2">
            {insight.nextTests.map((t, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-6 text-gray-700">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-forest text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="font-semibold text-brand-dark">{t.title}</span>
                  {t.why ? <span className="block text-gray-500">{t.why}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
