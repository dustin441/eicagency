'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Maximize2, Minimize2, Send, Loader2,
  BarChart3, Sparkles, Play, ChevronRight,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { type TooltipContentProps } from 'recharts/types/component/Tooltip';
import { type ValueType, type NameType } from 'recharts/types/component/DefaultTooltipContent';
import { cn } from '@/lib/utils';
import type {
  CampaignRow, MetaChatCreative, GoogleChatCreative,
  BudgetPacingRow, TrendDataPoint, SegmentSummary, SpendTrendResult,
} from '@/services/chat-analytics';
import type { SpartacoSummaryRow, SpartacoCampaignRow } from '@/services/spartaco-chat-analytics';
import type { GoodGameSummaryRow, GoodGameCampaignRow, GoodGameVideoRow, GoodGameCreativeRow } from '@/services/goodgame-chat-analytics';
import type { NsiSummaryRow, NsiCampaignRow } from '@/services/nsi-chat-analytics';
import type { ArabellaeSummaryRow, ArabellaeCampaignRow } from '@/services/arabella-chat-analytics';
import type { KinseySummaryRow, KinseyCampaignRow } from '@/services/kinsey-chat-analytics';

type Mode = 'closed' | 'panel' | 'fullscreen';

// ─── Suggested prompts ────────────────────────────────────────────────────────

const KINSEY_PROMPTS = [
  { label: 'Overall ROAS', prompt: 'What is our Meta ROAS and total revenue since January?' },
  { label: 'Campaign comparison', prompt: 'Compare all campaigns by ROAS and CPA — which is most efficient?' },
  { label: 'Best creatives', prompt: 'Show me the best-performing Meta creatives ranked by revenue for the last 30 days.' },
  { label: 'Spend trend', prompt: 'Chart daily spend and purchases for the last 60 days.' },
];

const ARABELLA_PROMPTS = [
  { label: 'Overall ROAS', prompt: 'What is our blended ROAS and total revenue since launch?' },
  { label: 'Campaign comparison', prompt: 'Compare all campaigns by ROAS and CPA — which is most efficient?' },
  { label: 'Best creatives', prompt: 'Show me the best-performing Meta creatives ranked by revenue for the last 30 days.' },
  { label: 'Spend trend', prompt: 'Chart daily spend and purchases for the last 60 days.' },
];

const NSI_PROMPTS = [
  { label: 'Overall performance', prompt: 'Show me overall performance YTD — submittals, engaged sessions, and CPL by channel and audience type.' },
  { label: 'Google vs LinkedIn', prompt: 'Compare Google and LinkedIn performance for the last 90 days. Focus on submittals and CPL.' },
  { label: 'Top campaigns', prompt: 'Which campaigns have the lowest CPL for the last 60 days?' },
  { label: 'Spend trend', prompt: 'Show me the spend and submittal trend for the last 90 days.' },
];

const GOODGAME_PROMPTS = [
  { label: 'Video completion', prompt: 'Show me 75% video completion rates by campaign for the last 30 days.' },
  { label: 'Retailer comparison', prompt: 'Compare Hucks vs Circle K performance — spend, landing page views, and cost per LP view for all time.' },
  { label: 'Retargeting results', prompt: 'How is our retargeting performing? Landing page views and cost per visit for the last 60 days.' },
  { label: 'Best creatives', prompt: 'Show me the best-performing Meta creatives for the last 30 days.' },
];

const SPARTACO_PROMPTS = [
  { label: 'Brand overview', prompt: 'Give me a summary of all brands for the last 30 days — spend, leads, purchases, and ROAS.' },
  { label: 'Top Meta creatives', prompt: 'Show me the best Meta creatives across all brands for the last 30 days.' },
  { label: 'Jameson ROAS', prompt: 'What is Jameson SALES campaign ROAS this month vs last month?' },
  { label: 'Campaign efficiency', prompt: 'Which campaigns have the lowest CPL for lead gen in the last 60 days?' },
];

const PREPASS_PROMPTS = [
  { label: 'Best ABM creatives', prompt: 'Show me the best-performing ABM Meta creatives for the last 30 days, ranked by CPL.' },
  { label: 'Campaign funnel', prompt: 'Which ABM campaigns are driving the most MQLs and won deals? Show cost per MQL, SQL, and Won.' },
  { label: 'Spend trend — 30 days', prompt: 'Chart daily spend across all segments for the last 30 days.' },
  { label: 'Q2 performance', prompt: 'How did we do in Q2 this year across all segments? Give me the full summary.' },
  { label: 'Budget pacing', prompt: 'How are we tracking against budget this month for each segment?' },
  { label: 'Google vs Meta', prompt: 'Compare Google vs Meta efficiency across all segments — spend, MQLs, and cost per MQL for the last 30 days.' },
  { label: 'Top SMB campaigns', prompt: 'Show me the top SMB Google campaigns by Cost Per Won in the last 30 days.' },
];

// ─── CTA map ──────────────────────────────────────────────────────────────────

const CTA_LABELS: Record<string, string> = {
  LEARN_MORE: 'Learn More', SIGN_UP: 'Sign Up', DOWNLOAD: 'Download',
  GET_QUOTE: 'Get a Quote', CONTACT_US: 'Contact Us', GET_STARTED: 'Get Started',
  APPLY_NOW: 'Apply Now', BOOK_NOW: 'Book Now', WATCH_MORE: 'Watch More',
};
function ctaLabel(raw: string) {
  return CTA_LABELS[raw] ?? (raw?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Learn More');
}

// ─── Ad gradient ──────────────────────────────────────────────────────────────

const AD_GRADIENTS: [string, string][] = [
  ['#EDE9FE', '#C4B5FD'], ['#E0F2FE', '#7DD3FC'], ['#D1FAE5', '#6EE7B7'],
  ['#FEF3C7', '#FCD34D'], ['#FFE4E6', '#FDA4AF'], ['#E0E7FF', '#A5B4FC'],
];
function adGradient(name: string): [string, string] {
  if (!name) return AD_GRADIENTS[0];
  const idx = (name.charCodeAt(0) + (name.charCodeAt(name.length - 1) || 0)) % AD_GRADIENTS.length;
  return AD_GRADIENTS[idx] ?? AD_GRADIENTS[0];
}

// ─── Dollar formatter ──────────────────────────────────────────────────────────

function fmtDollars(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v).toLocaleString()}`;
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Trend Chart ──────────────────────────────────────────────────────────────

type TrendMetric = 'mqls' | 'leads' | 'sqls' | 'won' | 'clicks';
const TREND_METRICS: { key: TrendMetric; label: string; color: string }[] = [
  { key: 'mqls',   label: 'MQLs',   color: '#EB541E' },
  { key: 'leads',  label: 'Leads',  color: '#6366F1' },
  { key: 'sqls',   label: 'SQLs',   color: '#0EA5E9' },
  { key: 'won',    label: 'Won',    color: '#10B981' },
  { key: 'clicks', label: 'Clicks', color: '#F59E0B' },
];

function TrendChart({
  data,
  size,
}: {
  data: TrendDataPoint[];
  size: 'compact' | 'full';
}) {
  const [activeMetric, setActiveMetric] = useState<TrendMetric | null>(() => {
    const hasMqls = data.some((d) => d.mqls > 0);
    const hasLeads = data.some((d) => d.leads > 0);
    if (hasMqls) return 'mqls';
    if (hasLeads) return 'leads';
    return null;
  });

  if (!data.length) {
    return <p className="text-xs text-gray-400 italic">No trend data for that period.</p>;
  }

  const height = size === 'full' ? 300 : 180;

  // Thin out X-axis labels so they don't crowd
  const labelEvery = Math.ceil(data.length / (size === 'full' ? 10 : 6));

  const customTooltip = ({ active, payload, label }: TooltipContentProps<ValueType, NameType>) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2.5 text-xs">
        <p className="font-semibold text-gray-700 mb-1.5">{label ? fmtDate(String(label)) : ''}</p>
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-2 mb-0.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="text-gray-500">{p.name}:</span>
            <span className="font-semibold text-gray-800">
              {p.name === 'Spend'
                ? fmtDollars(Number(p.value ?? 0))
                : Number(p.value ?? 0).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full">
      {/* Metric toggles — only in full mode */}
      {size === 'full' && (
        <div className="flex flex-wrap gap-2 mb-4">
          {TREND_METRICS.map((m) => {
            const hasData = data.some((d) => d[m.key] > 0);
            if (!hasData) return null;
            return (
              <button
                key={m.key}
                onClick={() => setActiveMetric(activeMetric === m.key ? null : m.key)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                  activeMetric === m.key
                    ? 'text-white border-transparent'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300',
                )}
                style={activeMetric === m.key ? { background: m.color, borderColor: m.color } : {}}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: m.color }} />
                {m.label}
              </button>
            );
          })}
          {activeMetric && (
            <button
              onClick={() => setActiveMetric(null)}
              className="px-2.5 py-1 rounded-full text-xs text-gray-400 border border-gray-200 hover:border-gray-300 bg-white"
            >
              Spend only
            </button>
          )}
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v, i) => (i % labelEvery === 0 ? fmtDate(v) : '')}
            interval={0}
          />
          <YAxis
            yAxisId="spend"
            orientation="left"
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={fmtDollars}
            width={48}
          />
          {activeMetric && (
            <YAxis
              yAxisId="metric"
              orientation="right"
              tick={{ fontSize: 10, fill: '#9CA3AF' }}
              tickLine={false}
              axisLine={false}
              width={32}
            />
          )}
          <Tooltip content={customTooltip} />
          {size === 'full' && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />}

          <Bar
            yAxisId="spend"
            dataKey="spend"
            name="Spend"
            fill="#0B4A31"
            radius={[3, 3, 0, 0]}
            maxBarSize={size === 'full' ? 20 : 12}
          />

          {activeMetric && (() => {
            const m = TREND_METRICS.find((x) => x.key === activeMetric);
            if (!m) return null;
            return (
              <Line
                yAxisId="metric"
                type="monotone"
                dataKey={m.key}
                name={m.label}
                stroke={m.color}
                strokeWidth={2}
                dot={data.length <= 14 ? { r: 3, fill: m.color } : false}
                activeDot={{ r: 4 }}
              />
            );
          })()}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Compact metric toggle buttons */}
      {size === 'compact' && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {TREND_METRICS.map((m) => {
            const hasData = data.some((d) => d[m.key] > 0);
            if (!hasData) return null;
            return (
              <button
                key={m.key}
                onClick={() => setActiveMetric(activeMetric === m.key ? null : m.key)}
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all',
                  activeMetric === m.key
                    ? 'text-white border-transparent'
                    : 'bg-white text-gray-500 border-gray-200',
                )}
                style={activeMetric === m.key ? { background: m.color, borderColor: m.color } : {}}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Segment Summary Card ─────────────────────────────────────────────────────

function SegmentSummaryCard({ summary, size }: { summary: SegmentSummary; size: 'compact' | 'full' }) {
  const periodLabel = `${fmtDate(summary.startDate)} – ${fmtDate(summary.endDate)}`;
  const focusLabel = summary.focus === 'all' ? 'All Segments' : summary.focus;
  const platformLabel = summary.platform === 'all' ? 'All Platforms' : summary.platform;

  const kpis = [
    { label: 'Spend',       value: fmtDollars(summary.spend),                             highlight: false },
    { label: 'Leads',       value: summary.leads.toLocaleString(),                         highlight: false },
    { label: 'MQLs',        value: summary.mqls.toLocaleString(),                          highlight: false },
    { label: 'SQLs',        value: summary.sqls.toLocaleString(),                          highlight: false },
    { label: 'Won',         value: summary.won.toLocaleString(),                           highlight: false },
    { label: 'CPL',         value: summary.cpl != null ? fmtDollars(summary.cpl) : '—',   highlight: false },
    { label: 'Cost/MQL',    value: summary.costPerMql != null ? fmtDollars(summary.costPerMql) : '—', highlight: false },
    { label: 'Cost/SQL',    value: summary.costPerSql != null ? fmtDollars(summary.costPerSql) : '—', highlight: false },
    { label: 'Cost/Won',    value: summary.costPerWon != null ? fmtDollars(summary.costPerWon) : '—', highlight: true },
    { label: 'CTR',         value: summary.ctr != null ? `${summary.ctr.toFixed(2)}%` : '—',          highlight: false },
    { label: 'CPC',         value: summary.cpc != null ? fmtDollars(summary.cpc) : '—',               highlight: false },
    { label: 'Impressions', value: summary.impressions >= 1000
        ? `${(summary.impressions / 1000).toFixed(1)}K`
        : summary.impressions.toLocaleString(),
      highlight: false },
  ];

  const cols = size === 'full' ? 4 : 3;

  return (
    <div className="w-full bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 pt-3 pb-2.5 border-b border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-gray-900">{focusLabel} · {platformLabel}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{periodLabel}</p>
        </div>
        <span className="text-[10px] bg-brand-forest/10 text-brand-forest font-semibold px-2 py-1 rounded-full">
          Summary
        </span>
      </div>
      <div className={`grid grid-cols-${cols} divide-x divide-y divide-gray-100`}>
        {kpis.map(({ label, value, highlight }) => (
          <div
            key={label}
            className={cn('px-3 py-2.5 text-center', highlight && 'bg-emerald-50/60')}
          >
            <p className={cn('text-sm font-bold', highlight ? 'text-brand-forest' : 'text-gray-800')}>
              {value}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
            {highlight && (
              <p className="text-[9px] text-emerald-600 font-semibold mt-0.5">North Star</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Meta Creative Card ───────────────────────────────────────────────────────

function MetaCard({ ad, rank, size }: { ad: MetaChatCreative; rank: number; size: 'compact' | 'full' }) {
  const [videoOpen, setVideoOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [from, to] = adGradient(ad.adName || ad.headline);
  const hasImage = Boolean(
    !imgError &&
    ad.finalCreativeLink &&
    !ad.finalCreativeLink.includes('null') &&
    ad.finalCreativeLink.startsWith('http'),
  );

  if (size === 'compact') {
    return (
      <div className="flex items-center gap-3 py-2.5 px-3 bg-gray-50 rounded-xl border border-gray-100">
        <div className="relative shrink-0 w-12 h-12 rounded-lg overflow-hidden">
          {hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ad.finalCreativeLink} alt="" className="w-full h-full object-cover" onError={() => setImgError(true)} />
          ) : (
            <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }} />
          )}
          {ad.isVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Play className="w-3.5 h-3.5 text-white fill-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-bold text-brand-forest bg-brand-forest/10 px-1.5 py-0.5 rounded">
              #{rank}
            </span>
            {rank === 1 && <span className="text-[10px] text-amber-600 font-semibold">Top Performer</span>}
          </div>
          <p className="text-xs font-semibold text-gray-800 truncate">{ad.headline || '(no headline)'}</p>
          <div className="flex items-center gap-2.5 mt-0.5">
            {ad.roas != null ? (
              <>
                <span className="text-[11px] font-bold text-brand-forest">{ad.roas.toFixed(2)}x ROAS</span>
                <span className="text-[11px] text-gray-500">${Math.round(ad.revenue ?? 0).toLocaleString()} rev</span>
              </>
            ) : (
              <>
                <span className="text-[11px] font-bold text-brand-forest">
                  {ad.cpl != null ? `$${ad.cpl.toFixed(2)}` : '—'} CPL
                </span>
                <span className="text-[11px] text-gray-500">{ad.leads} leads</span>
              </>
            )}
            <span className="text-[11px] text-gray-400">
              {ad.ctr != null ? `${ad.ctr.toFixed(1)}%` : '—'} CTR
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[380px] shrink-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-gray-50">
        <span className={cn(
          'text-xs font-bold px-2.5 py-1 rounded-full',
          rank === 1 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500',
        )}>
          #{rank}{rank === 1 ? ' · Top Performer' : ''}
        </span>
        <span className="text-[10px] text-gray-400 truncate max-w-[200px]">{ad.campaign}</span>
      </div>
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
        <div className="w-9 h-9 rounded-full bg-brand-forest flex items-center justify-center shrink-0">
          <span className="text-white text-[10px] font-bold">
            {ad.brand ? ad.brand.slice(0, 3).toUpperCase() : 'PRE'}
          </span>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900 leading-tight">{ad.brand ?? 'PrePass'}</p>
          <p className="text-[11px] text-gray-400 leading-tight">Sponsored</p>
        </div>
      </div>
      {ad.primaryText && (
        <div className="px-4 pb-2 text-[13px] text-gray-700 leading-relaxed">
          {ad.primaryText.length > 125 ? `${ad.primaryText.slice(0, 125)}…` : ad.primaryText}
        </div>
      )}
      <div
        className="relative w-full overflow-hidden cursor-pointer"
        style={{ background: `linear-gradient(135deg, ${from}, ${to})`, aspectRatio: '1.91' }}
        onClick={() => ad.isVideo && ad.videoUrl && setVideoOpen(true)}
      >
        {hasImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.finalCreativeLink} alt={ad.headline} className="w-full h-full object-cover" onError={() => setImgError(true)} />
        )}
        {ad.isVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-black/40 backdrop-blur-sm rounded-full w-14 h-14 flex items-center justify-center">
              <Play className="w-6 h-6 text-white fill-white ml-0.5" />
            </div>
          </div>
        )}
      </div>
      {videoOpen && ad.videoUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-6"
          onClick={() => setVideoOpen(false)}
        >
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              className="absolute -top-10 right-0 text-white/70 hover:text-white"
              onClick={() => setVideoOpen(false)}
            >
              <X className="w-6 h-6" />
            </button>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={ad.videoUrl} controls autoPlay className="w-full rounded-xl" />
          </div>
        </div>
      )}
      <div className="px-4 pt-2.5 pb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-snug">
            {ad.headline || '(no headline)'}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">{ad.brand ?? 'PrePass'}</p>
        </div>
        <button className="shrink-0 bg-[#1877F2] text-white text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap">
          {ctaLabel(ad.ctaType)}
        </button>
      </div>
      <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-[11px] text-gray-400">
        <span>👍 Like</span><span>💬 Comment</span><span>↗ Share</span>
      </div>
      <div className="grid grid-cols-4 border-t border-gray-100 bg-gray-50">
        {(ad.roas != null
          ? [
              { label: 'ROAS',      value: `${ad.roas.toFixed(2)}x` },
              { label: 'Revenue',   value: `$${Math.round(ad.revenue ?? 0).toLocaleString()}` },
              { label: 'CPA',       value: ad.cpa != null ? `$${ad.cpa.toFixed(2)}` : '—' },
              { label: 'Spend',     value: `$${Math.round(ad.spend).toLocaleString()}` },
            ]
          : [
              { label: 'CPL',   value: ad.cpl != null ? `$${ad.cpl.toFixed(2)}` : '—' },
              { label: 'Leads', value: ad.leads.toString() },
              { label: 'CTR',   value: ad.ctr != null ? `${ad.ctr.toFixed(1)}%` : '—' },
              { label: 'Spend', value: `$${Math.round(ad.spend).toLocaleString()}` },
            ]
        ).map(({ label, value }) => (
          <div key={label} className="py-3 text-center border-r border-gray-100 last:border-r-0">
            <p className="text-sm font-bold text-gray-800">{value}</p>
            <p className="text-[10px] text-gray-400">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Google Search Card ────────────────────────────────────────────────────────

function GoogleCard({ ad, rank, size }: { ad: GoogleChatCreative; rank: number; size: 'compact' | 'full' }) {
  if (size === 'compact') {
    return (
      <div className="py-2.5 px-3 bg-gray-50 rounded-xl border border-gray-100">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">#{rank}</span>
          <span className="text-[10px] text-gray-400 truncate">{ad.campaign}</span>
        </div>
        <p className="text-xs font-semibold text-[#1a0dab] truncate">
          {[ad.headline1, ad.headline2].filter(Boolean).join(' | ')}
        </p>
        <p className="text-[11px] text-gray-500 truncate mt-0.5">{ad.description}</p>
        <div className="flex items-center gap-2.5 mt-1">
          <span className="text-[11px] font-bold text-brand-forest">{ad.results} results</span>
          <span className="text-[11px] text-gray-400">
            {ad.ctr != null ? `${ad.ctr.toFixed(1)}% CTR` : ''}
          </span>
          <span className="text-[11px] text-gray-400">${Math.round(ad.cost).toLocaleString()}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[380px] shrink-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-gray-50 flex items-center justify-between">
        <span className={cn(
          'text-xs font-bold px-2.5 py-1 rounded-full',
          rank === 1 ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500',
        )}>
          #{rank}
        </span>
        <span className="text-[10px] text-gray-400 truncate max-w-[200px]">{ad.campaign}</span>
      </div>
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[10px] border border-[#70757a] text-[#70757a] px-1 py-0.5 rounded-sm">Ad</span>
          <span className="text-[12px] text-[#202124]">prepass.com</span>
        </div>
        <p className="text-[18px] text-[#1a0dab] font-normal leading-snug mb-1.5">
          {[ad.headline1, ad.headline2].filter(Boolean).join(' | ')}
        </p>
        <p className="text-[13px] text-[#4d5156] leading-relaxed">{ad.description}</p>
        <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-gray-100">
          {[
            { label: 'Results', value: ad.results.toString() },
            { label: 'Clicks',  value: ad.clicks.toLocaleString() },
            { label: 'CTR',     value: ad.ctr != null ? `${ad.ctr.toFixed(1)}%` : '—' },
            { label: 'Spend',   value: `$${Math.round(ad.cost).toLocaleString()}` },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-sm font-bold text-gray-800">{value}</p>
              <p className="text-[10px] text-gray-400">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Campaign Performance Table ───────────────────────────────────────────────

function CampaignTable({ campaigns }: { campaigns: CampaignRow[] }) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Campaign</th>
            <th className="text-right px-3 py-2.5 font-semibold text-gray-500">Spend</th>
            <th className="text-right px-3 py-2.5 font-semibold text-gray-500">MQLs</th>
            <th className="text-right px-3 py-2.5 font-semibold text-gray-500">Won</th>
            <th className="text-right px-3 py-2.5 font-semibold text-gray-500 text-brand-forest">Cost/Won</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.slice(0, 15).map((r, i) => (
            <tr key={i} className={cn(
              'border-b border-gray-50 hover:bg-gray-50 transition-colors',
              i === 0 && r.costPerWon != null && 'bg-emerald-50/40',
            )}>
              <td className="px-3 py-2.5 max-w-[200px]">
                <p className="font-medium text-gray-800 truncate">{r.campaign}</p>
                <span className="text-[10px] text-gray-400">{r.platform}</span>
              </td>
              <td className="px-3 py-2.5 text-right text-gray-600">
                ${Math.round(r.spend).toLocaleString()}
              </td>
              <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{r.mqls}</td>
              <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{r.won}</td>
              <td className={cn(
                'px-3 py-2.5 text-right font-bold',
                r.costPerWon != null ? 'text-brand-forest' : 'text-gray-300',
              )}>
                {r.costPerWon != null ? `$${Math.round(r.costPerWon).toLocaleString()}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Budget Pacing Cards ──────────────────────────────────────────────────────

function BudgetPacingCards({ rows }: { rows: BudgetPacingRow[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 w-full">
      {rows.map((r) => {
        const over = r.pctUsed > 100;
        return (
          <div key={r.focus} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-gray-800">{r.focus}</span>
              <span className={cn('text-sm font-bold', over ? 'text-red-600' : 'text-brand-forest')}>
                {r.pctUsed.toFixed(0)}% used
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div
                className={cn('h-full rounded-full', over ? 'bg-red-400' : 'bg-brand-forest')}
                style={{ width: `${Math.min(r.pctUsed, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-gray-500 mb-1">
              <span>${Math.round(r.totalSpent).toLocaleString()} spent</span>
              <span>${Math.round(r.budget).toLocaleString()} budget</span>
            </div>
            <div className="flex gap-3 text-[11px] text-gray-400">
              <span>Google ${Math.round(r.googleSpent).toLocaleString()}</span>
              <span>·</span>
              <span>Meta ${Math.round(r.metaSpent).toLocaleString()}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tool Result Renderer ──────────────────────────────────────────────────────

function ToolResult({ toolName, result, size }: {
  toolName: string;
  result: unknown;
  size: 'compact' | 'full';
}) {
  if (toolName === 'getMetaCreativePerformance') {
    const creatives = result as (MetaChatCreative | GoodGameCreativeRow)[];
    if (!creatives?.length) {
      return <p className="text-xs text-gray-400 italic">No creative data found for that filter.</p>;
    }
    // Good Game creatives have `views75`; standard creatives have `leads`
    if ('views75' in (creatives[0] ?? {})) {
      return (
        <div className={cn('flex gap-4', size === 'full' ? 'flex-row flex-wrap' : 'flex-col')}>
          {(creatives as GoodGameCreativeRow[]).map((ad, i) => <GoodGameCreativeCard key={i} ad={ad} rank={i + 1} size={size} />)}
        </div>
      );
    }
    return (
      <div className={cn('flex gap-4', size === 'full' ? 'flex-row flex-wrap' : 'flex-col')}>
        {(creatives as MetaChatCreative[]).map((ad, i) => <MetaCard key={i} ad={ad} rank={i + 1} size={size} />)}
      </div>
    );
  }
  if (toolName === 'getGoogleCreativePerformance') {
    const creatives = result as GoogleChatCreative[];
    if (!creatives?.length) {
      return <p className="text-xs text-gray-400 italic">No Google creative data found.</p>;
    }
    return (
      <div className={cn('flex gap-4', size === 'full' ? 'flex-row flex-wrap' : 'flex-col')}>
        {creatives.map((ad, i) => <GoogleCard key={i} ad={ad} rank={i + 1} size={size} />)}
      </div>
    );
  }
  if (toolName === 'getSummary') {
    const rows = result as (SpartacoSummaryRow | GoodGameSummaryRow)[];
    if (!rows?.length) return <p className="text-xs text-gray-400 italic">No data found for that filter.</p>;
    // Duck-type on the unique field per client
    const first = rows[0] ?? {};
    if ('phase'        in first) return <GoodGameSummaryCards rows={rows as GoodGameSummaryRow[]} />;
    if ('submittals'   in first) return <NsiSummaryCards rows={rows as unknown as NsiSummaryRow[]} />;
    if ('campaignType' in first) return <ArabellaeSummaryCards rows={rows as unknown as ArabellaeSummaryRow[]} />;
    if ('adChannel'    in first) return <KinseySummaryCards rows={rows as unknown as KinseySummaryRow[]} />;
    return <SpartacoSummaryCards rows={rows as SpartacoSummaryRow[]} />;
  }
  if (toolName === 'getVideoPerformance') {
    const rows = result as GoodGameVideoRow[];
    return <GoodGameVideoTable rows={rows} />;
  }
  if (toolName === 'getCampaignPerformance') {
    const campaigns = result as (CampaignRow | SpartacoCampaignRow)[];
    if (!campaigns?.length) {
      return <p className="text-xs text-gray-400 italic">No campaign data found.</p>;
    }
    // Spartaco campaigns have a `brand` field; PrePass campaigns have `mqls`
    const first = campaigns[0] ?? {};
    if ('phase'        in first) return <GoodGameCampaignTable campaigns={campaigns as unknown as GoodGameCampaignRow[]} />;
    if ('submittals'   in first) return <NsiCampaignTable campaigns={campaigns as unknown as NsiCampaignRow[]} />;
    if ('campaignType' in first) return <ArabellaeCampaignTable campaigns={campaigns as unknown as ArabellaeCampaignRow[]} />;
    if ('adChannel'    in first) return <KinseyCampaignTable campaigns={campaigns as unknown as KinseyCampaignRow[]} />;
    if ('brand'        in first) return <SpartacoCampaignTable campaigns={campaigns as SpartacoCampaignRow[]} />;
    return <CampaignTable campaigns={campaigns as CampaignRow[]} />;
  }
  if (toolName === 'getBudgetPacing') {
    const rows = result as BudgetPacingRow[];
    if (!rows?.length) {
      return <p className="text-xs text-gray-400 italic">No budget data found.</p>;
    }
    return <BudgetPacingCards rows={rows} />;
  }
  if (toolName === 'getSpendTrend') {
    const trendResult = result as SpendTrendResult;
    if (!trendResult?.data?.length) {
      return <p className="text-xs text-gray-400 italic">No trend data for that period.</p>;
    }
    const focusLabel = trendResult.focus === 'all' ? 'All Segments' : trendResult.focus;
    const platformLabel = trendResult.platform === 'all' ? '' : ` · ${trendResult.platform}`;
    const periodLabel = `${fmtDate(trendResult.startDate)} – ${fmtDate(trendResult.endDate)}`;
    return (
      <div className="w-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 pt-3 pb-2.5 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-bold text-gray-900">{focusLabel}{platformLabel}</p>
          <p className="text-[11px] text-gray-400">{periodLabel}</p>
        </div>
        <div className="p-4">
          <TrendChart data={trendResult.data} size={size} />
        </div>
      </div>
    );
  }
  if (toolName === 'getSegmentSummary') {
    const summary = result as SegmentSummary;
    if (!summary) {
      return <p className="text-xs text-gray-400 italic">No summary data found.</p>;
    }
    return <SegmentSummaryCard summary={summary} size={size} />;
  }
  return null;
}

// ─── Spartaco Summary Cards ───────────────────────────────────────────────────

function SpartacoSummaryCards({ rows }: { rows: SpartacoSummaryRow[] }) {
  if (!rows?.length) {
    return <p className="text-xs text-gray-400 italic">No data found for that filter.</p>;
  }

  const hasSales = rows.some((r) => r.purchases > 0);

  return (
    <div className="w-full space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-bold text-gray-900">{r.brand} · {r.channel}</span>
            <span className="text-[10px] bg-brand-forest/10 text-brand-forest font-semibold px-2 py-1 rounded-full">
              ${Math.round(r.spend).toLocaleString()} spend
            </span>
          </div>
          <div className="grid grid-cols-4 divide-x divide-y divide-gray-100">
            {(hasSales ? [
              { label: 'ROAS',      value: r.roas != null ? `${r.roas.toFixed(2)}x` : '—', highlight: true as const },
              { label: 'Revenue',   value: fmtDollars(r.revenue),                           highlight: false as const },
              { label: 'Purchases', value: r.purchases.toLocaleString(),                    highlight: false as const },
              { label: 'CPA',       value: r.cpa != null ? fmtDollars(r.cpa) : '—',        highlight: false as const },
              { label: 'Leads',     value: r.leads.toLocaleString(),                         highlight: false as const },
              { label: 'CPL',       value: r.cpl != null ? fmtDollars(r.cpl) : '—',        highlight: false as const },
              { label: 'CTR',       value: r.ctr != null ? `${r.ctr.toFixed(2)}%` : '—',   highlight: false as const },
              { label: 'Clicks',    value: r.clicks.toLocaleString(),                        highlight: false as const },
            ] : [
              { label: 'Leads',  value: r.leads.toLocaleString(),                          highlight: false as const },
              { label: 'CPL',    value: r.cpl != null ? fmtDollars(r.cpl) : '—',          highlight: true as const },
              { label: 'CTR',    value: r.ctr != null ? `${r.ctr.toFixed(2)}%` : '—',     highlight: false as const },
              { label: 'Clicks', value: r.clicks.toLocaleString(),                          highlight: false as const },
            ]).map(({ label, value, highlight }) => (
              <div key={label} className={cn('px-3 py-2.5 text-center', highlight && 'bg-emerald-50/60')}>
                <p className={cn('text-sm font-bold', highlight ? 'text-brand-forest' : 'text-gray-800')}>{value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Spartaco Campaign Table ──────────────────────────────────────────────────

function SpartacoCampaignTable({ campaigns }: { campaigns: SpartacoCampaignRow[] }) {
  const hasSales = campaigns.some((c) => c.purchases > 0);
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Campaign</th>
            <th className="text-right px-3 py-2.5 font-semibold text-gray-500">Spend</th>
            <th className="text-right px-3 py-2.5 font-semibold text-gray-500">Leads</th>
            {hasSales && <th className="text-right px-3 py-2.5 font-semibold text-gray-500">Purchases</th>}
            {hasSales && <th className="text-right px-3 py-2.5 font-semibold text-brand-forest">ROAS</th>}
            {!hasSales && <th className="text-right px-3 py-2.5 font-semibold text-brand-forest">CPL</th>}
          </tr>
        </thead>
        <tbody>
          {campaigns.slice(0, 20).map((r, i) => (
            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
              <td className="px-3 py-2.5 max-w-[200px]">
                <p className="font-medium text-gray-800 truncate">{r.campaign}</p>
                <span className="text-[10px] text-gray-400">{r.brand} · {r.channel}</span>
              </td>
              <td className="px-3 py-2.5 text-right text-gray-600">${Math.round(r.spend).toLocaleString()}</td>
              <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{r.leads}</td>
              {hasSales && <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{r.purchases}</td>}
              {hasSales && (
                <td className="px-3 py-2.5 text-right font-bold text-brand-forest">
                  {r.roas != null ? `${r.roas.toFixed(2)}x` : '—'}
                </td>
              )}
              {!hasSales && (
                <td className="px-3 py-2.5 text-right font-bold text-brand-forest">
                  {r.cpl != null ? fmtDollars(r.cpl) : '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Good Game Summary Cards ──────────────────────────────────────────────────

function GoodGameSummaryCards({ rows }: { rows: GoodGameSummaryRow[] }) {
  if (!rows?.length) return <p className="text-xs text-gray-400 italic">No data found.</p>;
  return (
    <div className="w-full space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cn(
                'text-[10px] font-bold px-2 py-0.5 rounded-full',
                r.phase === 'Awareness' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700',
              )}>{r.phase}</span>
              <span className="text-sm font-bold text-gray-900">{r.retailer} · {r.channel}</span>
            </div>
            <span className="text-[10px] bg-brand-forest/10 text-brand-forest font-semibold px-2 py-1 rounded-full">
              ${Math.round(r.spend).toLocaleString()} spend
            </span>
          </div>
          <div className="grid grid-cols-4 divide-x divide-y divide-gray-100">
            {[
              { label: 'Impressions', value: r.impressions >= 1000 ? `${(r.impressions / 1000).toFixed(0)}K` : String(r.impressions) },
              { label: 'CPM',         value: r.cpm != null ? `$${r.cpm.toFixed(2)}` : '—' },
              { label: 'LP Views',    value: r.landingPageViews >= 1000 ? `${(r.landingPageViews / 1000).toFixed(1)}K` : String(Math.round(r.landingPageViews)), highlight: true },
              { label: '$/LP View',   value: r.costPerLpView != null ? `$${r.costPerLpView.toFixed(2)}` : '—', highlight: true },
            ].map(({ label, value, highlight }) => (
              <div key={label} className={cn('px-3 py-2.5 text-center', highlight && 'bg-emerald-50/60')}>
                <p className={cn('text-sm font-bold', highlight ? 'text-brand-forest' : 'text-gray-800')}>{value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Good Game Campaign Table ─────────────────────────────────────────────────

function GoodGameCampaignTable({ campaigns }: { campaigns: GoodGameCampaignRow[] }) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Campaign</th>
            <th className="text-right px-3 py-2.5 font-semibold text-gray-500">Spend</th>
            <th className="text-right px-3 py-2.5 font-semibold text-gray-500">Impressions</th>
            <th className="text-right px-3 py-2.5 font-semibold text-brand-forest">LP Views</th>
            <th className="text-right px-3 py-2.5 font-semibold text-brand-forest">$/LP View</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.slice(0, 20).map((r, i) => (
            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
              <td className="px-3 py-2.5 max-w-[220px]">
                <p className="font-medium text-gray-800 truncate">{r.campaign}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={cn(
                    'text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                    r.phase === 'Awareness' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700',
                  )}>{r.phase}</span>
                  <span className="text-[10px] text-gray-400">{r.retailer} · {r.channel}</span>
                </div>
              </td>
              <td className="px-3 py-2.5 text-right text-gray-600">${Math.round(r.spend).toLocaleString()}</td>
              <td className="px-3 py-2.5 text-right text-gray-600">
                {r.impressions >= 1000 ? `${(r.impressions / 1000).toFixed(0)}K` : r.impressions}
              </td>
              <td className="px-3 py-2.5 text-right font-bold text-brand-forest">{Math.round(r.landingPageViews).toLocaleString()}</td>
              <td className="px-3 py-2.5 text-right font-bold text-brand-forest">
                {r.costPerLpView != null ? `$${r.costPerLpView.toFixed(2)}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Good Game Video Performance Table ───────────────────────────────────────

function GoodGameVideoTable({ rows }: { rows: GoodGameVideoRow[] }) {
  if (!rows?.length) return <p className="text-xs text-gray-400 italic">No video data found.</p>;
  return (
    <div className="w-full space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-800 truncate">{r.campaign}</p>
              <p className="text-[10px] text-gray-400">{r.retailer} · ${Math.round(r.spend).toLocaleString()} spend</p>
            </div>
            <div className="shrink-0 ml-3 text-right">
              <p className={cn(
                'text-sm font-bold',
                r.completionRate75 != null && r.completionRate75 >= 15 ? 'text-brand-forest'
                  : r.completionRate75 != null && r.completionRate75 >= 8 ? 'text-amber-600'
                  : 'text-gray-600',
              )}>
                {r.completionRate75 != null ? `${r.completionRate75.toFixed(1)}%` : '—'}
              </p>
              <p className="text-[10px] text-gray-400">75% rate</p>
            </div>
          </div>
          <div className="grid grid-cols-5 divide-x divide-gray-100 bg-gray-50">
            {[
              { label: '25%',   value: r.views25.toLocaleString() },
              { label: '50%',   value: r.views50.toLocaleString() },
              { label: '75%',   value: r.views75.toLocaleString(), highlight: true },
              { label: '100%',  value: r.views100.toLocaleString() },
              { label: '$/75%', value: r.costPer75View != null ? `$${r.costPer75View.toFixed(3)}` : '—' },
            ].map(({ label, value, highlight }) => (
              <div key={label} className={cn('py-2.5 text-center', highlight && 'bg-brand-forest/5')}>
                <p className={cn('text-xs font-bold', highlight ? 'text-brand-forest' : 'text-gray-700')}>{value}</p>
                <p className="text-[9px] text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Good Game Creative Card ──────────────────────────────────────────────────

function GoodGameCreativeCard({ ad, rank, size }: { ad: GoodGameCreativeRow; rank: number; size: 'compact' | 'full' }) {
  const [videoOpen, setVideoOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [from, to] = adGradient(ad.adName || ad.headline);
  const hasImage = Boolean(!imgError && ad.finalCreativeLink && !ad.finalCreativeLink.includes('null') && ad.finalCreativeLink.startsWith('http'));

  if (size === 'compact') {
    return (
      <div className="flex items-center gap-3 py-2.5 px-3 bg-gray-50 rounded-xl border border-gray-100">
        <div className="relative shrink-0 w-12 h-12 rounded-lg overflow-hidden">
          {hasImage
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={ad.finalCreativeLink} alt="" className="w-full h-full object-cover" onError={() => setImgError(true)} />
            : <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }} />}
          {ad.isVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Play className="w-3.5 h-3.5 text-white fill-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-bold text-brand-forest bg-brand-forest/10 px-1.5 py-0.5 rounded">#{rank}</span>
            {rank === 1 && <span className="text-[10px] text-amber-600 font-semibold">Top Performer</span>}
          </div>
          <p className="text-xs font-semibold text-gray-800 truncate">{ad.headline || ad.adName || '(no headline)'}</p>
          <div className="flex items-center gap-2.5 mt-0.5">
            {ad.completionRate75 != null
              ? <span className="text-[11px] font-bold text-brand-forest">{ad.completionRate75.toFixed(1)}% @75%</span>
              : <span className="text-[11px] font-bold text-brand-forest">{ad.landingPageViews} LP views</span>}
            <span className="text-[11px] text-gray-400">{ad.ctr != null ? `${ad.ctr.toFixed(1)}%` : '—'} CTR</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[380px] shrink-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-gray-50">
        <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', rank === 1 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500')}>
          #{rank}{rank === 1 ? ' · Top Performer' : ''}
        </span>
        <span className="text-[10px] text-gray-400 truncate max-w-[200px]">{ad.campaign}</span>
      </div>
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
        <div className="w-9 h-9 rounded-full bg-brand-forest flex items-center justify-center shrink-0">
          <span className="text-white text-[10px] font-bold">GG</span>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900 leading-tight">Good Game</p>
          <p className="text-[11px] text-gray-400 leading-tight">Sponsored · 🌐</p>
        </div>
      </div>
      {ad.primaryText && (
        <div className="px-4 pb-2 text-[13px] text-gray-700 leading-relaxed">
          {ad.primaryText.length > 125 ? `${ad.primaryText.slice(0, 125)}…` : ad.primaryText}
        </div>
      )}
      <div
        className="relative w-full overflow-hidden cursor-pointer"
        style={{ background: `linear-gradient(135deg, ${from}, ${to})`, aspectRatio: '1.91' }}
        onClick={() => ad.isVideo && ad.videoUrl && setVideoOpen(true)}
      >
        {hasImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.finalCreativeLink} alt={ad.headline} className="w-full h-full object-cover" onError={() => setImgError(true)} />
        )}
        {ad.isVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-black/40 backdrop-blur-sm rounded-full w-14 h-14 flex items-center justify-center">
              <Play className="w-6 h-6 text-white fill-white ml-0.5" />
            </div>
          </div>
        )}
      </div>
      {videoOpen && ad.videoUrl && (
        <div className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-6" onClick={() => setVideoOpen(false)}>
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <button className="absolute -top-10 right-0 text-white/70 hover:text-white" onClick={() => setVideoOpen(false)}>
              <X className="w-6 h-6" />
            </button>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={ad.videoUrl} controls autoPlay className="w-full rounded-xl" />
          </div>
        </div>
      )}
      <div className="px-4 pt-2.5 pb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-snug">{ad.headline || '(no headline)'}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">goodgame.com</p>
        </div>
        <button className="shrink-0 bg-[#1877F2] text-white text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap">
          {ad.ctaType || 'Learn More'}
        </button>
      </div>
      <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-[11px] text-gray-400">
        <span>👍 Like</span><span>💬 Comment</span><span>↗ Share</span>
      </div>
      <div className="grid grid-cols-4 border-t border-gray-100 bg-gray-50">
        {[
          { label: ad.completionRate75 != null ? '75% Rate' : 'LP Views',
            value: ad.completionRate75 != null ? `${ad.completionRate75.toFixed(1)}%` : String(Math.round(ad.landingPageViews)) },
          { label: '75% Views', value: ad.views75.toLocaleString() },
          { label: 'CTR',       value: ad.ctr != null ? `${ad.ctr.toFixed(1)}%` : '—' },
          { label: 'Spend',     value: `$${Math.round(ad.spend).toLocaleString()}` },
        ].map(({ label, value }) => (
          <div key={label} className="py-3 text-center border-r border-gray-100 last:border-r-0">
            <p className="text-sm font-bold text-gray-800">{value}</p>
            <p className="text-[10px] text-gray-400">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Arabella Summary Cards ───────────────────────────────────────────────────

function ArabellaeSummaryCards({ rows }: { rows: ArabellaeSummaryRow[] }) {
  if (!rows?.length) return <p className="text-xs text-gray-400 italic">No data found.</p>;
  return (
    <div className="w-full space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900">{r.campaignType}</span>
              <span className="text-[10px] text-gray-400">Meta</span>
            </div>
            <span className="text-[10px] bg-brand-forest/10 text-brand-forest font-semibold px-2 py-1 rounded-full">
              ${Math.round(r.spend).toLocaleString()} spend
            </span>
          </div>
          <div className="grid grid-cols-4 divide-x divide-y divide-gray-100">
            {[
              { label: 'ROAS',      value: r.roas != null ? `${r.roas.toFixed(2)}x` : '—',        highlight: true },
              { label: 'Revenue',   value: fmtDollars(r.revenue),                                  highlight: true },
              { label: 'Purchases', value: r.purchases.toFixed(0),                                 highlight: false },
              { label: 'CPA',       value: r.cpa != null ? fmtDollars(r.cpa) : '—',               highlight: false },
              { label: 'Clicks',    value: r.clicks.toLocaleString(),                              highlight: false },
              { label: 'CTR',       value: r.ctr != null ? `${r.ctr.toFixed(2)}%` : '—',          highlight: false },
              { label: 'CPC',       value: r.cpc != null ? fmtDollars(r.cpc) : '—',               highlight: false },
              { label: 'Impressions', value: r.impressions >= 1000 ? `${(r.impressions / 1000).toFixed(0)}K` : String(r.impressions), highlight: false },
            ].map(({ label, value, highlight }) => (
              <div key={label} className={cn('px-3 py-2.5 text-center', highlight && 'bg-emerald-50/60')}>
                <p className={cn('text-sm font-bold', highlight ? 'text-brand-forest' : 'text-gray-800')}>{value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Arabella Campaign Table ──────────────────────────────────────────────────

function ArabellaeCampaignTable({ campaigns }: { campaigns: ArabellaeCampaignRow[] }) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Campaign</th>
            <th className="text-right px-3 py-2.5 font-semibold text-gray-500">Spend</th>
            <th className="text-right px-3 py-2.5 font-semibold text-brand-forest">ROAS</th>
            <th className="text-right px-3 py-2.5 font-semibold text-brand-forest">Revenue</th>
            <th className="text-right px-3 py-2.5 font-semibold text-gray-500">Purchases</th>
            <th className="text-right px-3 py-2.5 font-semibold text-gray-500">CPA</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((r, i) => (
            <tr key={i} className={cn('border-b border-gray-50 hover:bg-gray-50 transition-colors', i === 0 && r.roas != null && 'bg-emerald-50/30')}>
              <td className="px-3 py-2.5 max-w-[220px]">
                <p className="font-medium text-gray-800 truncate">{r.campaign}</p>
                <span className={cn(
                  'text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                  r.campaignType === 'Sales' ? 'bg-emerald-100 text-emerald-700'
                    : r.campaignType === 'Engagement' ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-500',
                )}>{r.campaignType}</span>
              </td>
              <td className="px-3 py-2.5 text-right text-gray-600">${Math.round(r.spend).toLocaleString()}</td>
              <td className="px-3 py-2.5 text-right font-bold text-brand-forest">
                {r.roas != null ? `${r.roas.toFixed(2)}x` : '—'}
              </td>
              <td className="px-3 py-2.5 text-right font-bold text-brand-forest">{fmtDollars(r.revenue)}</td>
              <td className="px-3 py-2.5 text-right text-gray-600">{r.purchases.toFixed(0)}</td>
              <td className="px-3 py-2.5 text-right text-gray-600">
                {r.cpa != null ? fmtDollars(r.cpa) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Kinsey Summary Cards ─────────────────────────────────────────────────────

function KinseySummaryCards({ rows }: { rows: KinseySummaryRow[] }) {
  if (!rows?.length) return <p className="text-xs text-gray-400 italic">No data found.</p>;
  return (
    <div className="w-full space-y-2">
      {rows.map((r, i) => {
        const isGoogle = r.adChannel === 'Google';
        return (
          <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900">{r.adChannel}</span>
              <span className="text-[10px] bg-brand-forest/10 text-brand-forest font-semibold px-2 py-1 rounded-full">
                ${Math.round(r.spend).toLocaleString()} spend
              </span>
            </div>
            <div className="grid grid-cols-4 divide-x divide-y divide-gray-100">
              {(isGoogle ? [
                { label: 'Conversions', value: r.conversions.toLocaleString(),                            highlight: true },
                { label: 'Clicks',      value: r.clicks.toLocaleString(),                                 highlight: false },
                { label: 'CTR',         value: r.ctr != null ? `${r.ctr.toFixed(2)}%` : '—',              highlight: false },
                { label: 'CPC',         value: r.cpc != null ? fmtDollars(r.cpc) : '—',                  highlight: false },
              ] : [
                { label: 'ROAS',        value: r.roas != null ? `${r.roas.toFixed(2)}x` : '—',            highlight: true },
                { label: 'Revenue',     value: fmtDollars(r.revenue),                                     highlight: true },
                { label: 'Purchases',   value: r.purchases.toFixed(0),                                    highlight: false },
                { label: 'CPA',         value: r.cpa != null ? fmtDollars(r.cpa) : '—',                  highlight: false },
                { label: 'Clicks',      value: r.clicks.toLocaleString(),                                 highlight: false },
                { label: 'CTR',         value: r.ctr != null ? `${r.ctr.toFixed(2)}%` : '—',              highlight: false },
                { label: 'CPC',         value: r.cpc != null ? fmtDollars(r.cpc) : '—',                  highlight: false },
                { label: 'Impressions', value: r.impressions >= 1000 ? `${(r.impressions / 1000).toFixed(0)}K` : String(r.impressions), highlight: false },
              ]).map(({ label, value, highlight }) => (
                <div key={label} className={cn('px-3 py-2.5 text-center', highlight && 'bg-emerald-50/60')}>
                  <p className={cn('text-sm font-bold', highlight ? 'text-brand-forest' : 'text-gray-800')}>{value}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Kinsey Campaign Table ────────────────────────────────────────────────────

function KinseyCampaignTable({ campaigns }: { campaigns: KinseyCampaignRow[] }) {
  const hasMeta = campaigns.some((c) => c.adChannel === 'Meta');
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Campaign</th>
            <th className="text-right px-3 py-2.5 font-semibold text-gray-500">Spend</th>
            {hasMeta && <th className="text-right px-3 py-2.5 font-semibold text-brand-forest">ROAS</th>}
            {hasMeta && <th className="text-right px-3 py-2.5 font-semibold text-brand-forest">Revenue</th>}
            {hasMeta && <th className="text-right px-3 py-2.5 font-semibold text-gray-500">Purchases</th>}
            <th className="text-right px-3 py-2.5 font-semibold text-gray-500">Conv.</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((r, i) => (
            <tr key={i} className={cn('border-b border-gray-50 hover:bg-gray-50 transition-colors', i === 0 && r.roas != null && 'bg-emerald-50/30')}>
              <td className="px-3 py-2.5 max-w-[200px]">
                <p className="font-medium text-gray-800 truncate">{r.campaign}</p>
                <span className="text-[10px] text-gray-400">{r.adChannel}</span>
              </td>
              <td className="px-3 py-2.5 text-right text-gray-600">${Math.round(r.spend).toLocaleString()}</td>
              {hasMeta && <td className="px-3 py-2.5 text-right font-bold text-brand-forest">{r.roas != null ? `${r.roas.toFixed(2)}x` : '—'}</td>}
              {hasMeta && <td className="px-3 py-2.5 text-right font-bold text-brand-forest">{r.revenue > 0 ? fmtDollars(r.revenue) : '—'}</td>}
              {hasMeta && <td className="px-3 py-2.5 text-right text-gray-600">{r.purchases > 0 ? r.purchases.toFixed(0) : '—'}</td>}
              <td className="px-3 py-2.5 text-right text-gray-600">{r.conversions > 0 ? r.conversions : (r.purchases > 0 ? r.purchases.toFixed(0) : '—')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── NSI Summary Cards ────────────────────────────────────────────────────────

function NsiSummaryCards({ rows }: { rows: NsiSummaryRow[] }) {
  if (!rows?.length) return <p className="text-xs text-gray-400 italic">No data found.</p>;
  return (
    <div className="w-full space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-gray-900">{r.channel}</span>
              <span className={cn(
                'text-[10px] font-bold px-2 py-0.5 rounded-full',
                r.audienceType === 'Contractor' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700',
              )}>{r.audienceType}</span>
              {r.torpedo && r.torpedo !== 'Untagged' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{r.torpedo}</span>
              )}
            </div>
            <span className="text-[10px] bg-brand-forest/10 text-brand-forest font-semibold px-2 py-1 rounded-full">
              ${Math.round(r.spend).toLocaleString()} spend
            </span>
          </div>
          <div className="grid grid-cols-4 divide-x divide-y divide-gray-100">
            {[
              { label: 'Submittals',    value: r.submittals.toFixed(0),                                     highlight: true },
              { label: 'CPL',           value: r.cpl != null ? fmtDollars(r.cpl) : '—',                    highlight: true },
              { label: 'Eng. Sessions', value: r.engagedSessions.toLocaleString(),                          highlight: false },
              { label: '$/Eng. Sess.',  value: r.costPerEngSession != null ? fmtDollars(r.costPerEngSession) : '—', highlight: false },
              { label: 'Clicks',        value: r.clicks.toLocaleString(),                                   highlight: false },
              { label: 'CTR',           value: r.ctr != null ? `${r.ctr.toFixed(2)}%` : '—',               highlight: false },
              { label: 'CPC',           value: r.cpc != null ? fmtDollars(r.cpc) : '—',                    highlight: false },
              { label: 'Impressions',   value: r.impressions >= 1000 ? `${(r.impressions / 1000).toFixed(0)}K` : String(r.impressions), highlight: false },
            ].map(({ label, value, highlight }) => (
              <div key={label} className={cn('px-3 py-2.5 text-center', highlight && 'bg-emerald-50/60')}>
                <p className={cn('text-sm font-bold', highlight ? 'text-brand-forest' : 'text-gray-800')}>{value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── NSI Campaign Table ───────────────────────────────────────────────────────

function NsiCampaignTable({ campaigns }: { campaigns: NsiCampaignRow[] }) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Campaign</th>
            <th className="text-right px-3 py-2.5 font-semibold text-gray-500">Spend</th>
            <th className="text-right px-3 py-2.5 font-semibold text-brand-forest">Submittals</th>
            <th className="text-right px-3 py-2.5 font-semibold text-brand-forest">CPL</th>
            <th className="text-right px-3 py-2.5 font-semibold text-gray-500">Eng. Sess.</th>
            <th className="text-right px-3 py-2.5 font-semibold text-gray-500">$/Eng.</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.slice(0, 25).map((r, i) => (
            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
              <td className="px-3 py-2.5 max-w-[220px]">
                <p className="font-medium text-gray-800 truncate">{r.campaign}</p>
                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                  <span className="text-[10px] text-gray-400">{r.channel}</span>
                  <span className={cn(
                    'text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                    r.audienceType === 'Contractor' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700',
                  )}>{r.audienceType}</span>
                  {r.torpedo && r.torpedo !== 'Untagged' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{r.torpedo}</span>
                  )}
                  {r.subCampaign && r.subCampaign !== 'Untagged' && (
                    <span className="text-[9px] text-gray-400 font-mono">{r.subCampaign}</span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2.5 text-right text-gray-600">${Math.round(r.spend).toLocaleString()}</td>
              <td className="px-3 py-2.5 text-right font-bold text-brand-forest">{r.submittals.toFixed(0)}</td>
              <td className="px-3 py-2.5 text-right font-bold text-brand-forest">
                {r.cpl != null ? fmtDollars(r.cpl) : '—'}
              </td>
              <td className="px-3 py-2.5 text-right text-gray-600">{r.engagedSessions.toLocaleString()}</td>
              <td className="px-3 py-2.5 text-right text-gray-600">
                {r.costPerEngSession != null ? fmtDollars(r.costPerEngSession) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tool label map ───────────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  getMetaCreativePerformance: 'Meta creatives',
  getGoogleCreativePerformance: 'Google ads',
  getCampaignPerformance: 'campaign data',
  getBudgetPacing: 'budget pacing',
  getSpendTrend: 'spend trend',
  getSegmentSummary: 'segment summary',
  getSummary: 'performance data',
  getVideoPerformance: 'video completion data',
};

const FULLSCREEN_TITLES: Record<string, string> = {
  getMetaCreativePerformance: 'Meta Creatives',
  getGoogleCreativePerformance: 'Google Search Ads',
  getCampaignPerformance: 'Campaign Performance',
  getBudgetPacing: 'Budget Pacing',
  getSpendTrend: 'Spend Trend',
  getSegmentSummary: 'Segment Summary',
  getSummary: 'Performance Summary',
  getVideoPerformance: 'Video Completion Funnel',
};

// ─── Loading dots ─────────────────────────────────────────────────────────────

function LoadingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2.5 bg-white border border-gray-200 rounded-2xl rounded-bl-sm w-fit shadow-sm">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 bg-brand-forest rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

// ─── Main ChatPanel ────────────────────────────────────────────────────────────

export default function ChatPanel({ clientId }: { clientId: string }) {
  const [mode, setMode] = useState<Mode>('closed');
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const apiEndpoint = clientId === 'spartaco' ? '/api/chat/spartaco'
    : clientId === 'goodgame' ? '/api/chat/goodgame'
    : clientId === 'nsi' ? '/api/chat/nsi'
    : clientId === 'arabella' ? '/api/chat/arabella'
    : clientId === 'kinsey' ? '/api/chat/kinsey'
    : '/api/chat';
  const transport = useMemo(() => new DefaultChatTransport({ api: apiEndpoint }), [apiEndpoint]);
  const { messages, sendMessage, status } = useChat({ transport });
  const isStreaming = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  useEffect(() => {
    if (mode !== 'closed') setTimeout(() => inputRef.current?.focus(), 100);
  }, [mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mode !== 'closed') setMode('closed');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  const submit = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    sendMessage({ parts: [{ type: 'text', text }] });
  }, [input, isStreaming, sendMessage]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  if (!['prepass', 'spartaco', 'goodgame', 'nsi', 'arabella', 'kinsey'].includes(clientId)) return null;

  // AI SDK v6: static tools produce type='tool-${name}', dynamic tools produce type='dynamic-tool'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function resolveToolPart(p: any): { toolName: string; state: string; output: unknown } | null {
    if (!p?.type) return null;
    if (p.type === 'dynamic-tool') return { toolName: p.toolName, state: p.state, output: p.output };
    if (p.type.startsWith('tool-')) return { toolName: p.type.slice(5), state: p.state, output: p.output };
    return null;
  }

  // Collect all completed tool results from the most recent assistant message.
  // This lets the fullscreen panel show multiple charts when Claude calls a tool
  // several times in one turn (e.g. one trend chart per segment).
  type ToolResultEntry = { toolName: string; result: unknown };
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');
  const lastTurnResults: ToolResultEntry[] = (lastAssistantMsg?.parts ?? [])
    .map(resolveToolPart)
    .filter((p): p is { toolName: string; state: string; output: unknown } => p?.state === 'output-available')
    .map((p) => ({ toolName: p.toolName, result: p.output }));

  // ─── Chat thread ─────────────────────────────────────────────────────────────

  const chatThread = (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-brand-forest" />
              <p className="text-sm font-semibold text-gray-700">
                {clientId === 'spartaco' ? 'Ask about Spartaco performance'
                  : clientId === 'goodgame' ? 'Ask about Good Game performance'
                  : clientId === 'nsi' ? 'Ask about NSI performance'
                  : clientId === 'arabella' ? 'Ask about Arabella performance'
                  : clientId === 'kinsey' ? 'Ask about Kinsey Designs performance'
                  : 'Ask about PrePass performance'}
              </p>
            </div>
            {(clientId === 'spartaco' ? SPARTACO_PROMPTS
              : clientId === 'goodgame' ? GOODGAME_PROMPTS
              : clientId === 'nsi' ? NSI_PROMPTS
              : clientId === 'arabella' ? ARABELLA_PROMPTS
              : clientId === 'kinsey' ? KINSEY_PROMPTS
              : PREPASS_PROMPTS).map((p) => (
              <button
                key={p.label}
                onClick={() => sendMessage({ parts: [{ type: 'text', text: p.prompt }] })}
                className="w-full text-left px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-brand-forest/30 transition-all text-xs font-medium text-gray-700 flex items-center justify-between group shadow-sm"
              >
                <span>{p.label}</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-forest transition-colors shrink-0" />
              </button>
            ))}
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn('flex flex-col gap-2', message.role === 'user' ? 'items-end' : 'items-start')}
            >
              {(message.parts ?? []).map((part, pidx) => {
                if (part.type === 'text' && part.text) {
                  const isUser = message.role === 'user';
                  return (
                    <div
                      key={pidx}
                      className={cn(
                        'max-w-[90%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                        isUser
                          ? 'bg-brand-forest text-white rounded-br-sm'
                          : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm',
                      )}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{part.text}</p>
                      ) : (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                            strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                            em: ({ children }) => <em className="italic">{children}</em>,
                            h1: ({ children }) => <p className="font-bold mb-1 mt-2">{children}</p>,
                            h2: ({ children }) => <p className="font-bold mb-1 mt-2">{children}</p>,
                            h3: ({ children }) => <p className="font-semibold mb-1 mt-2">{children}</p>,
                            ul: ({ children }) => <ul className="my-1.5 space-y-1 ml-1">{children}</ul>,
                            ol: ({ children }) => <ol className="my-1.5 space-y-1 ml-4 list-decimal">{children}</ol>,
                            li: ({ children }) => <li className="flex gap-1.5"><span className="text-brand-forest/50 shrink-0 mt-0.5 select-none">•</span><span className="min-w-0">{children}</span></li>,
                            table: ({ children }) => (
                              <div className="overflow-x-auto my-2">
                                <table className="w-full text-[11px] border-collapse border border-gray-100 rounded-lg overflow-hidden">{children}</table>
                              </div>
                            ),
                            thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
                            th: ({ children }) => <th className="px-2 py-1.5 text-left font-semibold text-gray-500 border border-gray-100 whitespace-nowrap">{children}</th>,
                            td: ({ children }) => <td className="px-2 py-1.5 border border-gray-100 text-gray-700">{children}</td>,
                            hr: () => <hr className="my-2 border-gray-100" />,
                            code: ({ children }) => <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px] font-mono">{children}</code>,
                            a: ({ href, children }) => <a href={href ?? '#'} className="text-brand-forest underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                            blockquote: ({ children }) => <blockquote className="border-l-2 border-brand-forest/30 pl-3 my-1.5 text-gray-600 italic">{children}</blockquote>,
                          }}
                        >
                          {part.text}
                        </ReactMarkdown>
                      )}
                    </div>
                  );
                }
                const toolPart = resolveToolPart(part);
                if (toolPart) {
                  if (toolPart.state === 'input-streaming' || toolPart.state === 'input-available') {
                    return (
                      <div key={pidx} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl text-xs text-gray-500 border border-gray-100">
                        <Loader2 className="w-3 h-3 animate-spin text-brand-forest shrink-0" />
                        <span>Fetching {TOOL_LABELS[toolPart.toolName] ?? 'data'}…</span>
                      </div>
                    );
                  }
                  if (toolPart.state === 'output-available') {
                    return (
                      <div key={pidx} className="w-full">
                        <ToolResult toolName={toolPart.toolName} result={toolPart.output} size="compact" />
                      </div>
                    );
                  }
                }
                return null;
              })}
            </div>
          ))
        )}
        {isStreaming && messages.at(-1)?.role === 'user' && <LoadingDots />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-gray-100 shrink-0">
        <div className="flex items-end gap-2 bg-gray-50 rounded-2xl border border-gray-200 px-3 py-2 focus-within:border-brand-forest/40 focus-within:ring-2 focus-within:ring-brand-forest/10 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
            placeholder="Ask about campaigns, creatives, trends, any time period…"
            rows={1}
            disabled={isStreaming}
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 resize-none focus:outline-none leading-relaxed"
            style={{ minHeight: '20px', maxHeight: '120px' }}
          />
          <button
            onClick={submit}
            disabled={!input.trim() || isStreaming}
            className="shrink-0 w-8 h-8 rounded-xl bg-brand-forest text-white flex items-center justify-center hover:bg-brand-forest/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            {isStreaming
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Floating launch button */}
      <AnimatePresence>
        {mode === 'closed' && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            onClick={() => setMode('panel')}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-brand-forest text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center"
            title="Open AI assistant"
            data-pdf-hidden="true"
          >
            <Sparkles className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel mode */}
      <AnimatePresence>
        {mode === 'panel' && (
          <motion.div
            key="panel"
            initial={{ x: 440, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 440, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 w-[420px] z-50 bg-white border-l border-gray-200 shadow-2xl flex flex-col"
            data-pdf-hidden="true"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-brand-forest flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    {clientId === 'spartaco' ? 'Spartaco AI'
                      : clientId === 'goodgame' ? 'Good Game AI'
                      : clientId === 'nsi' ? 'NSI AI'
                      : clientId === 'arabella' ? 'Arabella AI'
                      : clientId === 'kinsey' ? 'Kinsey AI'
                      : 'PrePass AI'}
                  </p>
                  <p className="text-[10px] text-gray-400">Marketing intelligence</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMode('fullscreen')}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                  title="Expand to full screen"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setMode('closed')}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {chatThread}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen mode */}
      <AnimatePresence>
        {mode === 'fullscreen' && (
          <motion.div
            key="fullscreen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[100] bg-[#F9FAFB] flex flex-col"
            data-pdf-hidden="true"
          >
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-forest flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    {clientId === 'spartaco' ? 'Spartaco AI'
                      : clientId === 'goodgame' ? 'Good Game AI'
                      : clientId === 'nsi' ? 'NSI AI'
                      : clientId === 'arabella' ? 'Arabella AI'
                      : clientId === 'kinsey' ? 'Kinsey AI'
                      : 'PrePass AI'} — Creative Intelligence
                  </p>
                  <p className="text-xs text-gray-400">Powered by Claude · EIC Agency</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMode('panel')}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                  title="Shrink to panel"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setMode('closed')}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Left: chat thread */}
              <div className="w-[380px] shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
                {chatThread}
              </div>

              {/* Right: full-size results — all tool calls from the last assistant turn */}
              <div className="flex-1 overflow-y-auto p-6">
                {lastTurnResults.length > 0 ? (
                  <div className="space-y-8">
                    {lastTurnResults.map((r, i) => (
                      <div key={i}>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                          {FULLSCREEN_TITLES[r.toolName] ?? 'Results'}
                        </p>
                        <ToolResult toolName={r.toolName} result={r.result} size="full" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center select-none">
                    <BarChart3 className="w-16 h-16 text-gray-200 mb-4" />
                    <p className="text-lg font-semibold text-gray-300">Results appear here</p>
                    <p className="text-sm text-gray-300 mt-1 max-w-xs">
                      Ask about campaigns, creatives, trends, or any time period →
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
