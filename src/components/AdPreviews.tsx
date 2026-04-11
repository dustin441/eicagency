'use client';

import React, { useState } from 'react';
import { LayoutGrid, Table2, Image as ImageIcon, ThumbsUp, MessageSquare, Share2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { MetaCreative, GoogleCreative } from '@/services/analytics';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt$(n: number) { return `$${Math.round(n).toLocaleString()}`; }
function fmtN(n: number) { return Math.round(n).toLocaleString(); }
function ctrFmt(clicks: number, impr: number) {
  return impr > 0 ? `${((clicks / impr) * 100).toFixed(2)}%` : '—';
}
function cpl(spend: number, leads: number) {
  return leads > 0 ? fmt$(spend / leads) : '—';
}
function cpa(spend: number, results: number) {
  return results > 0 ? fmt$(spend / results) : '—';
}

// Relative performance badge — top quartile by CTR gets "Top Performer"
function perfBadge(metric: number, allMetrics: number[]) {
  if (allMetrics.length < 2) return null;
  const sorted = [...allMetrics].sort((a, b) => b - a);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  if (metric >= q1) return 'top';
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  if (metric <= q3) return 'low';
  return null;
}

// ─── Meta Ad Preview Card ─────────────────────────────────────────────────────

function MetaAdCard({ ad, badge }: { ad: MetaCreative; badge: 'top' | 'low' | null }) {
  // Gradient index based on ad name for variety
  const gradients = [
    'from-violet-100 to-purple-200',
    'from-sky-100 to-blue-200',
    'from-emerald-100 to-teal-200',
    'from-orange-100 to-amber-200',
    'from-rose-100 to-pink-200',
    'from-indigo-100 to-violet-200',
  ];
  const gradientIdx = ad.name.charCodeAt(0) % gradients.length;
  const gradient = gradients[gradientIdx];

  const ctrVal = ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col hover:shadow-lg transition-shadow"
    >
      {/* Ad header — Facebook/Instagram page line */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-brand-forest flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-[11px] tracking-tight">EIC</span>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight">EIC Agency</p>
            <p className="text-[11px] text-gray-400 leading-tight">Sponsored · 🌐</p>
          </div>
        </div>
        {badge && (
          <span className={cn(
            'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
            badge === 'top' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-400'
          )}>
            {badge === 'top' ? '★ Top' : 'Low'}
          </span>
        )}
      </div>

      {/* Primary text (body copy) */}
      {ad.primaryText ? (
        <div className="px-4 py-3 text-sm text-gray-700 leading-relaxed border-b border-gray-50">
          {ad.primaryText.length > 150 ? `${ad.primaryText.slice(0, 150)}…` : ad.primaryText}
        </div>
      ) : null}

      {/* Creative image placeholder */}
      <div className={cn('bg-gradient-to-br aspect-video flex items-center justify-center relative overflow-hidden', gradient)}>
        <ImageIcon className="w-10 h-10 text-white/40" />
        {/* Ad name watermark */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent px-3 py-2">
          <p className="text-white text-[11px] font-medium line-clamp-1 opacity-90">{ad.name}</p>
        </div>
      </div>

      {/* Headline + CTA row */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-t border-gray-100">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 line-clamp-1">{ad.headline || ad.name}</p>
          <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">{ad.campaign}</p>
        </div>
        <button className="shrink-0 bg-[#1877F2] hover:bg-[#1877F2]/90 text-white text-xs font-bold px-3.5 py-2 rounded-md transition-colors">
          Learn More
        </button>
      </div>

      {/* Engagement bar */}
      <div className="flex items-center justify-around px-4 py-2 border-t border-gray-100">
        <button className="flex items-center gap-1.5 text-gray-400 hover:text-blue-600 transition-colors text-xs font-medium py-1">
          <ThumbsUp className="w-3.5 h-3.5" /> Like
        </button>
        <button className="flex items-center gap-1.5 text-gray-400 hover:text-blue-600 transition-colors text-xs font-medium py-1">
          <MessageSquare className="w-3.5 h-3.5" /> Comment
        </button>
        <button className="flex items-center gap-1.5 text-gray-400 hover:text-blue-600 transition-colors text-xs font-medium py-1">
          <Share2 className="w-3.5 h-3.5" /> Share
        </button>
      </div>

      {/* Performance metrics */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100 bg-gray-50/50">
        <div className="flex flex-col items-center py-2.5">
          <span className="text-sm font-bold text-brand-dark tabular-nums">{fmt$(ad.spend)}</span>
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Spend</span>
        </div>
        <div className="flex flex-col items-center py-2.5">
          <span className="text-sm font-bold text-brand-forest tabular-nums">{fmtN(ad.leads)}</span>
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Leads</span>
        </div>
        <div className="flex flex-col items-center py-2.5">
          <span className="text-sm font-bold text-brand-dark tabular-nums">{cpl(ad.spend, ad.leads)}</span>
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">CPL</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Google Search Ad Preview Card ────────────────────────────────────────────

function GoogleAdCard({ ad, badge }: { ad: GoogleCreative; badge: 'top' | 'low' | null }) {
  const ctrVal = ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col hover:shadow-lg transition-shadow"
    >
      {/* SERP result mockup */}
      <div className="p-5 flex-1">
        {/* URL line */}
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
              <span className="text-[8px] font-bold text-gray-500">E</span>
            </div>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-xs text-gray-700 font-medium">EIC Agency</span>
            <span className="text-[11px] text-gray-400">https://eicagency.com</span>
          </div>
          {badge && (
            <span className={cn(
              'ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
              badge === 'top' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-400'
            )}>
              {badge === 'top' ? '★ Top' : 'Low'}
            </span>
          )}
        </div>

        {/* Ad label + headline */}
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-[10px] font-bold border border-[#1a7f37] text-[#1a7f37] px-1 py-px rounded leading-none shrink-0">Ad</span>
          <h3 className="text-base text-[#1558d6] leading-snug font-normal hover:underline cursor-pointer line-clamp-2">
            {ad.headline}
          </h3>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 leading-snug line-clamp-2">
          {ad.description || '—'}
        </p>

        {/* Sitelink pills (decorative) */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {['Learn More', 'Get Started', 'Contact Us', 'Pricing'].map(link => (
            <span key={link} className="text-[11px] text-[#1558d6] hover:underline cursor-pointer border border-gray-200 rounded-full px-2.5 py-1">
              {link}
            </span>
          ))}
        </div>
      </div>

      {/* Campaign label */}
      <div className="px-5 pb-3">
        <span className="text-[11px] text-gray-400 font-medium line-clamp-1">{ad.campaign}</span>
      </div>

      {/* Performance metrics */}
      <div className="grid grid-cols-4 divide-x divide-gray-100 border-t border-gray-100 bg-gray-50/50">
        <div className="flex flex-col items-center py-2.5">
          <span className="text-sm font-bold text-brand-dark tabular-nums">{fmt$(ad.spend)}</span>
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Spend</span>
        </div>
        <div className="flex flex-col items-center py-2.5">
          <span className="text-sm font-bold text-brand-dark tabular-nums">{fmtN(ad.clicks)}</span>
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Clicks</span>
        </div>
        <div className="flex flex-col items-center py-2.5">
          <span className="text-sm font-bold text-brand-dark tabular-nums">{ctrFmt(ad.clicks, ad.impressions)}</span>
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">CTR</span>
        </div>
        <div className="flex flex-col items-center py-2.5">
          <span className="text-sm font-bold text-brand-forest tabular-nums">{cpa(ad.spend, ad.results)}</span>
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">CPA</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Meta Ad Previews Section ─────────────────────────────────────────────────

export function MetaAdPreviews({ creatives }: { creatives: MetaCreative[] }) {
  const [view, setView] = useState<'cards' | 'table'>('cards');
  if (creatives.length === 0) return null;

  const ctrs = creatives.map(c => c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0);

  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-8 border-b border-gray-50 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-brand-dark">Meta Ad Creatives</h3>
          <p className="text-sm text-gray-400 font-medium mt-1">Ad-level performance · Sorted by spend</p>
        </div>
        <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
          <button
            onClick={() => setView('cards')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all', view === 'cards' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-400 hover:text-gray-600')}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Preview
          </button>
          <button
            onClick={() => setView('table')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all', view === 'table' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-400 hover:text-gray-600')}
          >
            <Table2 className="w-3.5 h-3.5" /> Table
          </button>
        </div>
      </div>

      {view === 'cards' ? (
        <div className="p-8 grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {creatives.slice(0, 12).map((ad, i) => (
            <MetaAdCard key={i} ad={ad} badge={perfBadge(ctrs[i], ctrs)} />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Ad Name', 'Headline', 'Primary Text', 'Ad Set', 'Spend', 'Clicks', 'Leads', 'CTR', 'CPL'].map(h => (
                  <th key={h} className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {creatives.map((c, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-brand-dark max-w-[160px]"><span className="line-clamp-1 block" title={c.name}>{c.name}</span></td>
                  <td className="px-6 py-4 text-gray-600 max-w-[180px]"><span className="line-clamp-1 block text-xs" title={c.headline}>{c.headline || '—'}</span></td>
                  <td className="px-6 py-4 text-gray-500 max-w-[200px]"><span className="line-clamp-1 block text-xs" title={c.primaryText}>{c.primaryText || '—'}</span></td>
                  <td className="px-6 py-4 text-gray-500 max-w-[140px]"><span className="line-clamp-1 block text-xs" title={c.adset}>{c.adset}</span></td>
                  <td className="px-6 py-4 font-bold text-brand-dark tabular-nums">{fmt$(c.spend)}</td>
                  <td className="px-6 py-4 text-gray-600 tabular-nums">{fmtN(c.clicks)}</td>
                  <td className="px-6 py-4 font-semibold text-brand-forest tabular-nums">{fmtN(c.leads)}</td>
                  <td className="px-6 py-4 text-gray-600 tabular-nums">{ctrFmt(c.clicks, c.impressions)}</td>
                  <td className="px-6 py-4 text-gray-600 tabular-nums">{cpl(c.spend, c.leads)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Google Ad Previews Section ───────────────────────────────────────────────

export function GoogleAdPreviews({ creatives }: { creatives: GoogleCreative[] }) {
  const [view, setView] = useState<'cards' | 'table'>('cards');
  if (creatives.length === 0) return null;

  const ctrs = creatives.map(c => c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0);

  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-8 border-b border-gray-50 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-brand-dark">Google Search Ads</h3>
          <p className="text-sm text-gray-400 font-medium mt-1">Responsive search ad performance · Sorted by spend</p>
        </div>
        <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
          <button
            onClick={() => setView('cards')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all', view === 'cards' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-400 hover:text-gray-600')}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Preview
          </button>
          <button
            onClick={() => setView('table')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all', view === 'table' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-400 hover:text-gray-600')}
          >
            <Table2 className="w-3.5 h-3.5" /> Table
          </button>
        </div>
      </div>

      {view === 'cards' ? (
        <div className="p-8 grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {creatives.slice(0, 12).map((ad, i) => (
            <GoogleAdCard key={i} ad={ad} badge={perfBadge(ctrs[i], ctrs)} />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Headline', 'Description', 'Campaign', 'Spend', 'Clicks', 'Impressions', 'CTR', 'Conversions', 'CPA'].map(h => (
                  <th key={h} className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {creatives.map((c, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-brand-dark max-w-[200px]"><span className="line-clamp-1 block text-xs" title={c.headline}>{c.headline}</span></td>
                  <td className="px-6 py-4 text-gray-500 max-w-[200px]"><span className="line-clamp-1 block text-xs" title={c.description}>{c.description || '—'}</span></td>
                  <td className="px-6 py-4 text-gray-500 max-w-[160px]"><span className="line-clamp-1 block text-xs" title={c.campaign}>{c.campaign}</span></td>
                  <td className="px-6 py-4 font-bold text-brand-dark tabular-nums">{fmt$(c.spend)}</td>
                  <td className="px-6 py-4 text-gray-600 tabular-nums">{fmtN(c.clicks)}</td>
                  <td className="px-6 py-4 text-gray-600 tabular-nums">{c.impressions >= 1_000_000 ? `${(c.impressions / 1_000_000).toFixed(1)}M` : `${(c.impressions / 1000).toFixed(0)}k`}</td>
                  <td className="px-6 py-4 text-gray-600 tabular-nums">{ctrFmt(c.clicks, c.impressions)}</td>
                  <td className="px-6 py-4 font-semibold text-brand-forest tabular-nums">{fmtN(c.results)}</td>
                  <td className="px-6 py-4 text-gray-600 tabular-nums">{cpa(c.spend, c.results)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
