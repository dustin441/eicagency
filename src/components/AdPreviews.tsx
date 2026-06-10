'use client';

import React, { useState } from 'react';
import { LayoutGrid, Table2, ThumbsUp, MessageSquare, Share2, ArrowUpRight, ArrowDownRight, Play, X, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { MetaCreative, GoogleCreative } from '@/services/analytics';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt$(n: number) { return `$${Math.round(n).toLocaleString()}`; }
function fmtN(n: number) { return Math.round(n).toLocaleString(); }
function ctrVal(clicks: number, impr: number) { return impr > 0 ? (clicks / impr) * 100 : 0; }
function ctrFmt(clicks: number, impr: number) { return impr > 0 ? `${ctrVal(clicks, impr).toFixed(2)}%` : '—'; }
function cplVal(spend: number, leads: number) { return leads > 0 ? spend / leads : 0; }
function cpaVal(spend: number, results: number) { return results > 0 ? spend / results : 0; }
function roasVal(revenue: number, spend: number) { return spend > 0 ? revenue / spend : 0; }
function roasFmt(revenue: number, spend: number) { return spend > 0 ? `${roasVal(revenue, spend).toFixed(2)}x` : '—'; }

// Delta badge vs an average — lowerIsBetter inverts the color
function DeltaBadge({ value, avg, lowerIsBetter = false }: { value: number; avg: number; lowerIsBetter?: boolean }) {
  if (avg === 0 || value === 0) return null;
  const pct = ((value - avg) / avg) * 100;
  if (Math.abs(pct) < 1) return <span className="text-[10px] text-gray-400">≈ avg</span>;
  const isGood = lowerIsBetter ? pct < 0 : pct > 0;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[10px] font-bold',
      isGood ? 'text-emerald-600' : 'text-red-500'
    )}>
      {pct > 0
        ? <ArrowUpRight className="w-2.5 h-2.5" />
        : <ArrowDownRight className="w-2.5 h-2.5" />}
      {Math.abs(pct).toFixed(0)}% vs avg
    </span>
  );
}

// Relative performance badge — top quartile by CTR
function perfBadge(metric: number, allMetrics: number[]): 'top' | 'low' | null {
  if (allMetrics.length < 3) return null;
  const sorted = [...allMetrics].sort((a, b) => b - a);
  const topQ = sorted[Math.floor(sorted.length * 0.25)];
  const botQ = sorted[Math.floor(sorted.length * 0.75)];
  if (metric >= topQ) return 'top';
  if (metric <= botQ) return 'low';
  return null;
}

// Meta CTA type → human-readable label
const CTA_LABELS: Record<string, string> = {
  LEARN_MORE: 'Learn More',
  SIGN_UP: 'Sign Up',
  GET_QUOTE: 'Get a Quote',
  CONTACT_US: 'Contact Us',
  APPLY_NOW: 'Apply Now',
  BOOK_NOW: 'Book Now',
  BOOK_TRAVEL: 'Book Now',
  DOWNLOAD: 'Download',
  GET_STARTED: 'Get Started',
  SHOP_NOW: 'Shop Now',
  SUBSCRIBE: 'Subscribe',
  WATCH_MORE: 'Watch More',
  LISTEN_NOW: 'Listen Now',
  GET_OFFER: 'Get Offer',
  BUY_NOW: 'Buy Now',
  SEE_MORE: 'See More',
  OPEN_LINK: 'Open Link',
};
function ctaLabel(raw: string) {
  if (!raw || raw === 'null' || raw === 'undefined') return 'Learn More';
  return CTA_LABELS[raw] ?? raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// CSS gradient backgrounds — inline styles, never dynamic Tailwind classes
const AD_GRADIENTS = [
  { from: '#EDE9FE', to: '#C4B5FD', accent: '#7C3AED' }, // violet
  { from: '#E0F2FE', to: '#7DD3FC', accent: '#0284C7' }, // sky
  { from: '#D1FAE5', to: '#6EE7B7', accent: '#059669' }, // emerald
  { from: '#FEF3C7', to: '#FCD34D', accent: '#D97706' }, // amber
  { from: '#FFE4E6', to: '#FDA4AF', accent: '#E11D48' }, // rose
  { from: '#E0E7FF', to: '#A5B4FC', accent: '#4F46E5' }, // indigo
  { from: '#F0FDF4', to: '#86EFAC', accent: '#16A34A' }, // green
  { from: '#FFF7ED', to: '#FDBA74', accent: '#EA580C' }, // orange
];

function adGradient(name: string) {
  if (!name) return AD_GRADIENTS[0];
  const idx = (name.charCodeAt(0) + name.charCodeAt(name.length - 1)) % AD_GRADIENTS.length;
  return AD_GRADIENTS[idx] ?? AD_GRADIENTS[0];
}

// ─── Meta Ad Preview Card ─────────────────────────────────────────────────────

interface MetaAdCardProps {
  ad: MetaCreative;
  badge: 'top' | 'low' | null;
  avgCpl: number;
  avgRoas?: number;
  avgCtr: number;
  totalSpend: number;
  onPlay: (ad: MetaCreative) => void;
  advertiserName?: string;
  logoUrl?: string;
  metricMode?: 'leads' | 'sales';
  conversionLabel?: { conversion: string; cpa: string };
}

function MetaAdCard({ ad, badge, avgCpl, avgRoas = 0, avgCtr, totalSpend, onPlay, advertiserName = 'EIC Agency', logoUrl, metricMode = 'leads', conversionLabel = { conversion: 'Leads', cpa: 'CPL' } }: MetaAdCardProps) {
  const g = adGradient(ad.name);
  const adCtr = ctrVal(ad.clicks, ad.impressions);
  const adCpl = cplVal(ad.spend, ad.leads);
  const sales = ad.sales ?? ad.leads;
  const revenue = ad.revenue ?? 0;
  const adRoas = roasVal(revenue, ad.spend);
  const spendPct = totalSpend > 0 ? ((ad.spend / totalSpend) * 100).toFixed(1) : '0';
  const hasImage = Boolean(ad.finalCreativeLink && ad.finalCreativeLink !== 'null' && ad.finalCreativeLink !== 'undefined');
  const hasDestination = Boolean(ad.destinationUrl && ad.destinationUrl !== 'null' && ad.destinationUrl !== 'undefined' && ad.destinationUrl !== 'http://fb.me/');
  const displayName = ad.pageName && ad.pageName !== 'null' && ad.pageName !== 'undefined' ? ad.pageName : advertiserName;
  const profileImageUrl = ad.pageProfileImageUrl && ad.pageProfileImageUrl !== 'null' && ad.pageProfileImageUrl !== 'undefined'
    ? ad.pageProfileImageUrl
    : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col hover:shadow-lg transition-shadow"
    >
      {/* Ad header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          {profileImageUrl || logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={profileImageUrl || logoUrl}
              alt={displayName}
              className="w-9 h-9 rounded-full object-cover border border-gray-200 shrink-0 bg-white"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#0B4A31] flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-[11px] tracking-tight">{displayName.slice(0, 3).toUpperCase()}</span>
            </div>
          )}
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight">{displayName}</p>
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
        <div className="px-4 pt-3 pb-2 text-sm text-gray-800 leading-relaxed">
          {ad.primaryText.length > 160 ? `${ad.primaryText.slice(0, 160)}…` : ad.primaryText}
        </div>
      ) : null}

      {/* Creative image — natural aspect ratio, no forced crop */}
      <div className="w-full relative overflow-hidden bg-[#f0f0f0]">
        {hasImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ad.finalCreativeLink}
              alt={ad.headline || ad.name}
              className="w-full h-auto block"
              style={{ maxHeight: '360px', objectFit: 'contain' }}
            />
            {/* Video play button overlay */}
            {ad.isVideo && (
              <button
                onClick={() => onPlay(ad)}
                className="absolute inset-0 flex items-center justify-center group"
              >
                <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center group-hover:bg-black/70 transition-all group-hover:scale-110">
                  <Play className="w-7 h-7 text-white ml-1" fill="white" />
                </div>
              </button>
            )}
          </>
        ) : (
          <>
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(135deg, ${g.from} 0%, ${g.to} 100%)` }}
            />
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: `radial-gradient(circle at 30% 50%, ${g.accent} 0%, transparent 50%), radial-gradient(circle at 80% 20%, ${g.accent} 0%, transparent 40%)`,
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl px-5 py-3 max-w-[80%]">
                <p className="text-center font-semibold text-sm line-clamp-2" style={{ color: g.accent }}>
                  {ad.headline && ad.headline !== 'null' && ad.headline !== 'undefined' ? ad.headline : ad.primaryText.slice(0, 80) || ad.name}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Headline + CTA row */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-t border-gray-100">
        <div className="flex-1 min-w-0">
          {ad.headline && ad.headline !== 'null' && ad.headline !== 'undefined' && (
            <p className="text-sm font-bold text-gray-900 line-clamp-1">{ad.headline}</p>
          )}
          <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">{(() => { try { return new URL(ad.destinationUrl).hostname.replace(/^www\./, ''); } catch { return ad.destinationUrl || ''; } })()}</p>
        </div>
        {hasDestination ? (
          <a
            href={ad.destinationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-white text-xs font-bold px-3.5 py-2 rounded-md transition-colors hover:opacity-90 whitespace-nowrap"
            style={{ backgroundColor: '#1877F2' }}
          >
            {ctaLabel(ad.ctaType)}
          </a>
        ) : (
          <button
            className="shrink-0 text-white text-xs font-bold px-3.5 py-2 rounded-md whitespace-nowrap"
            style={{ backgroundColor: '#1877F2' }}
          >
            {ctaLabel(ad.ctaType)}
          </button>
        )}
      </div>

      {/* Engagement bar */}
      <div className="flex items-center justify-around px-4 py-1.5 border-t border-gray-100">
        {[
          { icon: ThumbsUp, label: 'Like' },
          { icon: MessageSquare, label: 'Comment' },
          { icon: Share2, label: 'Share' },
        ].map(({ icon: Icon, label }) => (
          <button key={label} className="flex items-center gap-1.5 text-gray-400 text-xs font-medium py-1 hover:text-[#1877F2] transition-colors">
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {metricMode === 'sales' ? (
        <div className="grid grid-cols-4 divide-x divide-gray-100 border-t border-gray-100">
          <div className="flex flex-col items-center py-2.5 px-1">
            <span className="text-sm font-bold text-[#0f172a] tabular-nums">{fmt$(ad.spend)}</span>
            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Spend</span>
            <span className="text-[10px] text-gray-400 mt-0.5">{spendPct}% of total</span>
          </div>
          <div className="flex flex-col items-center py-2.5 px-1">
            <span className="text-sm font-bold text-[#0f172a] tabular-nums">
              {ad.impressions >= 1_000_000 ? `${(ad.impressions / 1_000_000).toFixed(1)}M` : ad.impressions >= 1_000 ? `${(ad.impressions / 1_000).toFixed(0)}K` : fmtN(ad.impressions)}
            </span>
            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Impr.</span>
          </div>
          <div className="flex flex-col items-center py-2.5 px-1">
            <span className="text-sm font-bold text-[#0f172a] tabular-nums">{ctrFmt(ad.clicks, ad.impressions)}</span>
            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">CTR</span>
            {adCtr > 0 && <DeltaBadge value={adCtr} avg={avgCtr} />}
          </div>
          <div className="flex flex-col items-center py-2.5 px-1">
            <span className="text-sm font-bold text-[#0B4A31] tabular-nums">{roasFmt(revenue, ad.spend)}</span>
            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">ROAS</span>
            {adRoas > 0 && <DeltaBadge value={adRoas} avg={avgRoas} />}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-4 divide-x divide-gray-100 border-t border-gray-100">
          <div className="flex flex-col items-center py-2.5 px-1">
            <span className="text-sm font-bold text-[#0f172a] tabular-nums">{fmt$(ad.spend)}</span>
            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Spend</span>
            <span className="text-[10px] text-gray-400 mt-0.5">{spendPct}% of total</span>
          </div>
          <div className="flex flex-col items-center py-2.5 px-1">
            <span className="text-sm font-bold text-[#0f172a] tabular-nums">
              {ad.impressions >= 1_000_000 ? `${(ad.impressions / 1_000_000).toFixed(1)}M` : ad.impressions >= 1_000 ? `${(ad.impressions / 1_000).toFixed(0)}K` : fmtN(ad.impressions)}
            </span>
            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Impr.</span>
          </div>
          <div className="flex flex-col items-center py-2.5 px-1">
            <span className="text-sm font-bold text-[#0f172a] tabular-nums">{fmtN(ad.leads)}</span>
            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">{conversionLabel.conversion}</span>
          </div>
          <div className="flex flex-col items-center py-2.5 px-1">
            <span className="text-sm font-bold text-[#0f172a] tabular-nums">{adCpl > 0 ? fmt$(adCpl) : '—'}</span>
            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">{conversionLabel.cpa}</span>
            {adCpl > 0 && <DeltaBadge value={adCpl} avg={avgCpl} lowerIsBetter />}
          </div>
        </div>
      )}

      {/* Campaign / Ad set attribution */}
      {(ad.campaign || ad.adset) && (
        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 space-y-0.5">
          {ad.campaign && (
            <p className="text-[10px] text-gray-400 leading-snug truncate">
              <span className="font-semibold text-gray-500">Campaign:</span> {ad.campaign}
            </p>
          )}
          {ad.adset && ad.adset !== 'null' && ad.adset !== 'undefined' && (
            <p className="text-[10px] text-gray-400 leading-snug truncate">
              <span className="font-semibold text-gray-500">Ad Set:</span> {ad.adset}
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─── Google Search Ad Preview Card ────────────────────────────────────────────

interface GoogleAdCardProps {
  ad: GoogleCreative;
  badge: 'top' | 'low' | null;
  avgCpa: number;
  avgCtr: number;
  totalSpend: number;
}

function GoogleAdCard({ ad, badge, avgCpa, avgCtr, totalSpend }: GoogleAdCardProps) {
  const adCtr = ctrVal(ad.clicks, ad.impressions);
  const adCpa = cpaVal(ad.spend, ad.results);
  const spendPct = totalSpend > 0 ? ((ad.spend / totalSpend) * 100).toFixed(1) : '0';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col hover:shadow-lg transition-shadow"
    >
      {/* SERP result mockup */}
      <div className="p-5 flex-1">
        {/* Favicon + URL */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center bg-white overflow-hidden shrink-0">
              <div className="w-4 h-4 rounded-full bg-[#0B4A31] flex items-center justify-center">
                <span className="text-white font-black text-[7px]">E</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-800 leading-none">EIC Agency</p>
              <p className="text-[10px] text-gray-400 leading-none mt-0.5">https://eicagency.com</p>
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

        {/* Ad badge + headline */}
        <div className="flex items-start gap-2 mb-1.5">
          <span className="shrink-0 mt-0.5 text-[10px] font-bold border border-[#1a7f37] text-[#1a7f37] px-1.5 py-px rounded leading-none">Ad</span>
          <h3 className="text-[15px] text-[#1558d6] leading-snug font-normal hover:underline cursor-pointer line-clamp-2">
            {ad.headline}
          </h3>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 leading-snug line-clamp-3 mb-3">
          {ad.description || 'Click to learn more about EIC Agency\'s performance marketing solutions.'}
        </p>

        {/* Sitelink pills */}
        <div className="flex gap-1.5 flex-wrap">
          {['Get a Free Audit', 'Our Services', 'Case Studies', 'Contact Us'].map(link => (
            <span key={link} className="text-[11px] text-[#1558d6] border border-gray-200 rounded-full px-2.5 py-0.5 hover:bg-gray-50 cursor-pointer">
              {link}
            </span>
          ))}
        </div>
      </div>

      {/* Campaign label */}
      <div className="px-5 pb-3 border-t border-gray-50 pt-2">
        <span className="text-[11px] text-gray-400 font-medium line-clamp-1">{ad.campaign}</span>
      </div>

      {/* Performance metrics with comparison */}
      <div className="grid grid-cols-4 divide-x divide-gray-100 border-t border-gray-100">
        <div className="flex flex-col items-center py-2.5 px-1">
          <span className="text-sm font-bold text-[#0f172a] tabular-nums">{fmt$(ad.spend)}</span>
          <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Spend</span>
          <span className="text-[10px] text-gray-400 mt-0.5">{spendPct}% of total</span>
        </div>
        <div className="flex flex-col items-center py-2.5 px-1">
          <span className="text-sm font-bold text-[#0f172a] tabular-nums">{fmtN(ad.clicks)}</span>
          <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Clicks</span>
          <span className="text-[10px] text-gray-400 mt-0.5">
            {ad.impressions >= 1_000_000 ? `${(ad.impressions / 1_000_000).toFixed(1)}M` : `${(ad.impressions / 1000).toFixed(0)}k`} impr
          </span>
        </div>
        <div className="flex flex-col items-center py-2.5 px-1">
          <span className="text-sm font-bold text-[#0f172a] tabular-nums">{ctrFmt(ad.clicks, ad.impressions)}</span>
          <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">CTR</span>
          <DeltaBadge value={adCtr} avg={avgCtr} />
        </div>
        <div className="flex flex-col items-center py-2.5 px-1">
          <span className="text-sm font-bold text-[#0B4A31] tabular-nums">{adCpa > 0 ? fmt$(adCpa) : '—'}</span>
          <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">CPA</span>
          <DeltaBadge value={adCpa} avg={avgCpa} lowerIsBetter />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Meta Ad Previews Section ─────────────────────────────────────────────────

type MetaSortKey = 'spend' | 'leads' | 'cpl' | 'ctr' | 'roas';

const META_SORT_OPTIONS_LEADS: { value: MetaSortKey; label: string }[] = [
  { value: 'spend', label: 'Spend' },
  { value: 'leads', label: 'Leads' },
  { value: 'cpl',   label: 'CPL' },
  { value: 'ctr',   label: 'CTR' },
];
const META_SORT_OPTIONS_SALES: { value: MetaSortKey; label: string }[] = [
  { value: 'spend', label: 'Spend' },
  { value: 'roas',  label: 'ROAS' },
  { value: 'ctr',   label: 'CTR' },
];

function sortMetaCreatives(creatives: MetaCreative[], sortBy: MetaSortKey): MetaCreative[] {
  return [...creatives].sort((a, b) => {
    switch (sortBy) {
      case 'leads': return b.leads - a.leads;
      case 'cpl': {
        const ca = cplVal(a.spend, a.leads);
        const cb = cplVal(b.spend, b.leads);
        if (ca === 0) return 1;
        if (cb === 0) return -1;
        return ca - cb;
      }
      case 'ctr': return ctrVal(b.clicks, b.impressions) - ctrVal(a.clicks, a.impressions);
      case 'roas': return roasVal(b.revenue ?? 0, b.spend) - roasVal(a.revenue ?? 0, a.spend);
      default: return b.spend - a.spend;
    }
  });
}

export function MetaAdPreviews({
  creatives,
  title = 'Meta Ad Creatives',
  description,
  advertiserName = 'EIC Agency',
  logoUrl,
  metricMode = 'leads',
  conversionLabel = { conversion: 'Leads', cpa: 'CPL' },
}: {
  creatives: MetaCreative[];
  title?: string;
  description?: string;
  advertiserName?: string;
  logoUrl?: string;
  metricMode?: 'leads' | 'sales';
  conversionLabel?: { conversion: string; cpa: string };
}) {
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [playingAd, setPlayingAd] = useState<MetaCreative | null>(null);
  const [sortBy, setSortBy] = useState<MetaSortKey>('spend');
  if (creatives.length === 0) return null;

  const sortOptions = metricMode === 'sales' ? META_SORT_OPTIONS_SALES : [
    { value: 'spend' as MetaSortKey, label: 'Spend' },
    { value: 'leads' as MetaSortKey, label: conversionLabel.conversion },
    { value: 'cpl' as MetaSortKey, label: conversionLabel.cpa },
    { value: 'ctr' as MetaSortKey, label: 'CTR' },
  ];
  const sortedCreatives = sortMetaCreatives(creatives, sortBy);

  const ctrs = creatives.map(c => ctrVal(c.clicks, c.impressions));
  const avgCtr = ctrs.reduce((a, b) => a + b, 0) / (ctrs.filter(v => v > 0).length || 1);

  const cpls = creatives.map(c => cplVal(c.spend, c.leads));
  const avgCpl = cpls.filter(v => v > 0).reduce((a, b) => a + b, 0) / (cpls.filter(v => v > 0).length || 1);
  const roases = creatives.map(c => roasVal(c.revenue ?? 0, c.spend));
  const avgRoas = roases.filter(v => v > 0).reduce((a, b) => a + b, 0) / (roases.filter(v => v > 0).length || 1);

  const totalSpend = creatives.reduce((a, c) => a + c.spend, 0);

  return (
    <>
      {/* Video lightbox modal */}
      {playingAd && (
        <div
          className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4"
          onClick={() => setPlayingAd(null)}
        >
          <div
            className="relative w-full max-w-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setPlayingAd(null)}
              className="absolute -top-10 right-0 flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors"
            >
              <X className="w-4 h-4" /> Close
            </button>

            {/* Video player — inline MP4 if available, styled external-link player otherwise */}
            <div className="rounded-2xl overflow-hidden bg-black">
              {playingAd.videoUrl && playingAd.videoUrl !== 'null' && playingAd.videoUrl !== 'undefined' && playingAd.videoUrl !== '' ? (
                <video
                  src={playingAd.videoUrl}
                  controls
                  autoPlay
                  playsInline
                  className="w-full"
                  style={{ maxHeight: '70vh' }}
                >
                  Your browser does not support video playback.
                </video>
              ) : playingAd.isVideo && playingAd.previewUrl && playingAd.previewUrl !== 'null' && playingAd.previewUrl !== '' ? (
                /* Video ad without inline MP4 — show thumbnail with play overlay + external link */
                <a
                  href={playingAd.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative block group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={playingAd.finalCreativeLink}
                    alt={playingAd.headline || playingAd.name}
                    className="w-full object-contain"
                    style={{ maxHeight: '60vh' }}
                  />
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/50 group-hover:bg-black/60 transition-colors flex flex-col items-center justify-center gap-3">
                    <div className="w-20 h-20 rounded-full bg-white/20 border-2 border-white/60 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Play className="w-9 h-9 text-white ml-1" fill="white" />
                    </div>
                    <span className="flex items-center gap-1.5 bg-[#1877F2] text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg">
                      <ExternalLink className="w-4 h-4" /> Watch Ad on Facebook
                    </span>
                  </div>
                </a>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={playingAd.finalCreativeLink}
                  alt={playingAd.headline || playingAd.name}
                  className="w-full object-contain"
                  style={{ maxHeight: '70vh' }}
                />
              )}
            </div>

            {/* Footer */}
            <div className="mt-4 flex items-center justify-between px-1">
              <div>
                <p className="text-white font-semibold text-sm">{playingAd.headline || playingAd.name}</p>
                <p className="text-white/50 text-xs mt-0.5">{playingAd.campaign}</p>
              </div>
              <div className="flex items-center gap-2">
                {playingAd.videoId && playingAd.videoId !== 'null' && playingAd.videoId !== 'undefined' && (
                  <a
                    href={`https://www.facebook.com/watch/?v=${playingAd.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[#1877F2] text-xs font-bold bg-white px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Watch on Facebook
                  </a>
                )}
                {/* External-link fallback already embedded in the player overlay for previewUrl-only videos */}
                {(!playingAd.isVideo || !playingAd.previewUrl || playingAd.previewUrl === 'null' || playingAd.previewUrl === '') &&
                  (!playingAd.videoId || playingAd.videoId === 'null' || playingAd.videoId === 'undefined') &&
                  playingAd.previewUrl && playingAd.previewUrl !== 'null' && playingAd.previewUrl !== '' && (
                  <a
                    href={playingAd.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[#1877F2] text-xs font-bold bg-white px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View Ad on Facebook
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-8 border-b border-gray-50">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-[#0f172a]">{title}</h3>
            <p className="text-sm text-gray-400 font-medium mt-1">
              {description ?? `Ad-level performance · Sorted by ${sortOptions.find(o => o.value === sortBy)?.label ?? sortBy}`} ·{' '}
              <span className="text-emerald-600 font-semibold">Avg CTR {avgCtr.toFixed(2)}%</span>
              {metricMode === 'sales'
                ? avgRoas > 0 && <> · <span className="text-[#0B4A31] font-semibold">Avg ROAS {avgRoas.toFixed(2)}x</span></>
                : avgCpl > 0 && <> · <span className="text-[#0B4A31] font-semibold">Avg {conversionLabel.cpa} ${Math.round(avgCpl).toLocaleString()}</span></>}
            </p>
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              <span className="text-xs text-gray-400 font-medium mr-0.5">Sort by</span>
              {sortOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSortBy(opt.value)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-bold border transition-all',
                    sortBy === opt.value
                      ? 'bg-brand-forest text-white border-brand-forest'
                      : 'text-gray-500 border-gray-200 hover:border-brand-forest/40 hover:text-brand-forest',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1 shrink-0">
            <button
              onClick={() => setView('cards')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all', view === 'cards' ? 'bg-white text-[#0f172a] shadow-sm' : 'text-gray-400 hover:text-gray-600')}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Preview
            </button>
            <button
              onClick={() => setView('table')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all', view === 'table' ? 'bg-white text-[#0f172a] shadow-sm' : 'text-gray-400 hover:text-gray-600')}
            >
              <Table2 className="w-3.5 h-3.5" /> Table
            </button>
          </div>
        </div>
      </div>

      {view === 'cards' ? (
        <div className="p-8 grid sm:grid-cols-2 gap-6">
          {sortedCreatives.slice(0, 12).map((ad, i) => (
            <MetaAdCard
              key={i}
              ad={ad}
              badge={perfBadge(ctrVal(ad.clicks, ad.impressions), ctrs)}
              avgCpl={avgCpl}
              avgRoas={avgRoas}
              avgCtr={avgCtr}
              totalSpend={totalSpend}
              onPlay={setPlayingAd}
              advertiserName={advertiserName}
              logoUrl={logoUrl}
              metricMode={metricMode}
              conversionLabel={conversionLabel}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {(metricMode === 'sales'
                  ? ['Ad Name', 'Headline', 'Primary Text', 'Ad Set', 'Spend', 'Impressions', 'CTR', 'ROAS']
                  : ['Ad Name', 'Headline', 'Primary Text', 'Ad Set', 'Spend', 'Clicks', conversionLabel.conversion, 'CTR', conversionLabel.cpa]
                ).map(h => (
                  <th key={h} className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedCreatives.map((c, i) => {
                const adCtr = ctrVal(c.clicks, c.impressions);
                const adCpl = cplVal(c.spend, c.leads);
                const sales = c.sales ?? c.leads;
                const revenue = c.revenue ?? 0;
                return (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-[#0f172a] max-w-[160px]"><span className="line-clamp-1 block" title={c.name}>{c.name}</span></td>
                    <td className="px-6 py-4 text-gray-600 max-w-[180px]"><span className="line-clamp-1 block text-xs" title={c.headline}>{c.headline || '—'}</span></td>
                    <td className="px-6 py-4 text-gray-500 max-w-[200px]"><span className="line-clamp-1 block text-xs" title={c.primaryText}>{c.primaryText || '—'}</span></td>
                    <td className="px-6 py-4 text-gray-500 max-w-[140px]"><span className="line-clamp-1 block text-xs">{c.adset}</span></td>
                    <td className="px-6 py-4 font-bold text-[#0f172a] tabular-nums">
                      {fmt$(c.spend)}
                      <span className="ml-1 text-[10px] text-gray-400 font-normal">{totalSpend > 0 ? `${((c.spend / totalSpend) * 100).toFixed(0)}%` : ''}</span>
                    </td>
                    {metricMode === 'sales' ? (
                      <>
                        <td className="px-6 py-4 text-gray-600 tabular-nums">
                          {c.impressions >= 1_000_000 ? `${(c.impressions / 1_000_000).toFixed(1)}M` : c.impressions >= 1_000 ? `${(c.impressions / 1_000).toFixed(0)}K` : c.impressions.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 tabular-nums">
                          <span className={adCtr >= avgCtr ? 'text-emerald-600 font-semibold' : 'text-gray-600'}>{ctrFmt(c.clicks, c.impressions)}</span>
                        </td>
                        <td className="px-6 py-4 tabular-nums">
                          <span className={roasVal(revenue, c.spend) >= avgRoas ? 'text-emerald-600 font-semibold' : 'text-gray-600'}>{roasFmt(revenue, c.spend)}</span>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 text-gray-600 tabular-nums">{Math.round(c.clicks).toLocaleString()}</td>
                        <td className="px-6 py-4 font-semibold text-[#0B4A31] tabular-nums">{Math.round(c.leads).toLocaleString()}</td>
                        <td className="px-6 py-4 tabular-nums">
                          <span className={adCtr >= avgCtr ? 'text-emerald-600 font-semibold' : 'text-gray-600'}>{adCtr.toFixed(2)}%</span>
                        </td>
                        <td className="px-6 py-4 tabular-nums">
                          <span className={adCpl > 0 && adCpl <= avgCpl ? 'text-emerald-600 font-semibold' : 'text-gray-600'}>{adCpl > 0 ? fmt$(adCpl) : '—'}</span>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </>
  );
}

// ─── Google Ad Previews Section ───────────────────────────────────────────────

export function GoogleAdPreviews({ creatives }: { creatives: GoogleCreative[] }) {
  const [view, setView] = useState<'cards' | 'table'>('cards');
  if (creatives.length === 0) return null;

  const ctrs = creatives.map(c => ctrVal(c.clicks, c.impressions));
  const avgCtr = ctrs.reduce((a, b) => a + b, 0) / (ctrs.filter(v => v > 0).length || 1);

  const cpas = creatives.map(c => cpaVal(c.spend, c.results));
  const avgCpa = cpas.filter(v => v > 0).reduce((a, b) => a + b, 0) / (cpas.filter(v => v > 0).length || 1);

  const totalSpend = creatives.reduce((a, c) => a + c.spend, 0);

  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-8 border-b border-gray-50 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-[#0f172a]">Google Search Ads</h3>
          <p className="text-sm text-gray-400 font-medium mt-1">
            Responsive search ad performance · Sorted by spend ·{' '}
            <span className="text-emerald-600 font-semibold">Avg CTR {avgCtr.toFixed(2)}%</span>
            {avgCpa > 0 && <> · <span className="text-[#0B4A31] font-semibold">Avg CPA ${Math.round(avgCpa).toLocaleString()}</span></>}
          </p>
        </div>
        <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
          <button
            onClick={() => setView('cards')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all', view === 'cards' ? 'bg-white text-[#0f172a] shadow-sm' : 'text-gray-400 hover:text-gray-600')}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Preview
          </button>
          <button
            onClick={() => setView('table')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all', view === 'table' ? 'bg-white text-[#0f172a] shadow-sm' : 'text-gray-400 hover:text-gray-600')}
          >
            <Table2 className="w-3.5 h-3.5" /> Table
          </button>
        </div>
      </div>

      {view === 'cards' ? (
        <div className="p-8 grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {creatives.slice(0, 12).map((ad, i) => (
            <GoogleAdCard
              key={i}
              ad={ad}
              badge={perfBadge(ctrs[i], ctrs)}
              avgCpa={avgCpa}
              avgCtr={avgCtr}
              totalSpend={totalSpend}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Headline', 'Description', 'Campaign', 'Spend', 'Clicks', 'Impressions', 'CTR', 'Conv.', 'CPA'].map(h => (
                  <th key={h} className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {creatives.map((c, i) => {
                const adCtr = ctrVal(c.clicks, c.impressions);
                const adCpa = cpaVal(c.spend, c.results);
                return (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-[#0f172a] max-w-[200px]"><span className="line-clamp-1 block text-xs" title={c.headline}>{c.headline}</span></td>
                    <td className="px-6 py-4 text-gray-500 max-w-[200px]"><span className="line-clamp-1 block text-xs" title={c.description}>{c.description || '—'}</span></td>
                    <td className="px-6 py-4 text-gray-500 max-w-[160px]"><span className="line-clamp-1 block text-xs">{c.campaign}</span></td>
                    <td className="px-6 py-4 font-bold text-[#0f172a] tabular-nums">
                      {fmt$(c.spend)}
                      <span className="ml-1 text-[10px] text-gray-400 font-normal">{totalSpend > 0 ? `${((c.spend / totalSpend) * 100).toFixed(0)}%` : ''}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 tabular-nums">{Math.round(c.clicks).toLocaleString()}</td>
                    <td className="px-6 py-4 text-gray-600 tabular-nums">{c.impressions >= 1_000_000 ? `${(c.impressions / 1_000_000).toFixed(1)}M` : `${(c.impressions / 1000).toFixed(0)}k`}</td>
                    <td className="px-6 py-4 tabular-nums">
                      <span className={adCtr >= avgCtr ? 'text-emerald-600 font-semibold' : 'text-gray-600'}>{adCtr.toFixed(2)}%</span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-[#0B4A31] tabular-nums">{Math.round(c.results).toLocaleString()}</td>
                    <td className="px-6 py-4 tabular-nums">
                      <span className={adCpa > 0 && adCpa <= avgCpa ? 'text-emerald-600 font-semibold' : 'text-gray-600'}>{adCpa > 0 ? fmt$(adCpa) : '—'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
