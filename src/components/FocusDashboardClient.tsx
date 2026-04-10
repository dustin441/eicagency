'use client';

import React from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  DollarSign, MousePointer2, Eye, Target, Zap, Trophy,
  TrendingUp, ArrowUpRight, ArrowDownRight, Phone, FileText,
  BarChart2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import FilterBar from '@/components/FilterBar';
import type { FocusStats, AdSet, MetaCreative, GoogleCreative, GeoState } from '@/services/analytics';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt$(n: number) { return `$${Math.round(n).toLocaleString()}`; }
function fmtN(n: number) { return Math.round(n).toLocaleString(); }
function pct(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? '+100%' : '0%';
  const c = ((curr - prev) / prev) * 100;
  return `${c >= 0 ? '+' : ''}${c.toFixed(1)}%`;
}
function up(curr: number, prev: number) { return curr >= prev; }
function costPer(spend: number, units: number) {
  return units > 0 ? fmt$(spend / units) : '—';
}
function cpc(spend: number, clicks: number) {
  return clicks > 0 ? `$${(spend / clicks).toFixed(2)}` : '—';
}
function ctr(clicks: number, impressions: number) {
  return impressions > 0 ? `${((clicks / impressions) * 100).toFixed(2)}%` : '—';
}
function fmtDateRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const s = new Date(start + 'T12:00:00').toLocaleDateString('en-US', opts);
  const e = new Date(end   + 'T12:00:00').toLocaleDateString('en-US', opts);
  return `${s} – ${e}`;
}

const FOCUS_LABELS: Record<string, string> = {
  SMB: 'SMB Segments',
  ABM: 'ABM Focus',
  FD360: 'FD360 Campaigns',
};

// ─── Budget Pacing Bar ────────────────────────────────────────────────────────

function BudgetPacing({ d }: { d: FocusStats }) {
  const totalSpent = d.googleBudgetSpent + d.metaBudgetSpent;
  const pctUsed = d.budget > 0 ? Math.min((totalSpent / d.budget) * 100, 100) : 0;
  const remaining = Math.max(d.budget - totalSpent, 0);

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const expectedPct = (dayOfMonth / daysInMonth) * 100;
  const pacing = pctUsed - expectedPct;

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Monthly Budget</p>
          <p className="text-2xl font-bold text-brand-dark mt-0.5">{fmt$(d.budget)}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Spent</p>
          <p className="text-2xl font-bold text-brand-dark mt-0.5">{fmt$(totalSpent)}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Remaining</p>
          <p className={cn('text-2xl font-bold mt-0.5', remaining < d.budget * 0.1 ? 'text-red-500' : 'text-emerald-600')}>{fmt$(remaining)}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pacing</p>
          <p className={cn('text-2xl font-bold mt-0.5', Math.abs(pacing) < 5 ? 'text-brand-dark' : pacing > 5 ? 'text-red-500' : 'text-emerald-600')}>
            {pacing > 0 ? '+' : ''}{pacing.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pctUsed}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className={cn('h-full rounded-full', pctUsed > 95 ? 'bg-red-500' : pctUsed > 80 ? 'bg-brand-orange' : 'bg-brand-forest')}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-gray-400/60"
          style={{ left: `${expectedPct}%` }}
          title={`Expected pace: ${expectedPct.toFixed(0)}%`}
        />
      </div>
      <div className="flex justify-between mt-2">
        <span className="text-xs text-gray-400">{pctUsed.toFixed(1)}% used</span>
        <span className="text-xs text-gray-400">Day {dayOfMonth} of {daysInMonth} · Expected {expectedPct.toFixed(0)}%</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-400 font-semibold mb-1">Google</p>
          <p className="font-bold text-brand-dark">{fmt$(d.googleBudgetSpent)}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-400 font-semibold mb-1">Meta</p>
          <p className="font-bold text-brand-dark">{fmt$(d.metaBudgetSpent)}</p>
        </div>
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  name, value, change, isUp, icon: Icon, color, delay, neutral,
}: {
  name: string; value: string; change: string; isUp: boolean;
  icon: React.ComponentType<{ className?: string }>; color: string; delay: number;
  neutral?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all group"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={cn('p-2 rounded-xl bg-gray-50 group-hover:scale-110 transition-transform', color)}>
          <Icon className="w-5 h-5" />
        </div>
        {change !== '—' ? (
          <div className={cn(
            'flex items-center text-xs font-bold px-2 py-1 rounded-full',
            neutral ? 'bg-gray-100 text-gray-500' :
            isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
          )}>
            {!neutral && (isUp ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />)}
            {change}
          </div>
        ) : (
          <span className="text-xs text-gray-300 font-semibold">—</span>
        )}
      </div>
      <div className="text-2xl font-bold text-brand-dark mb-1 tabular-nums">{value}</div>
      <div className="text-xs font-medium text-gray-400 uppercase tracking-widest">{name}</div>
    </motion.div>
  );
}

// ─── Cost Efficiency Row ───────────────────────────────────────────────────────

function CostEfficiency({ d }: { d: FocusStats }) {
  const metrics = [
    { label: 'Cost Per Lead',    value: costPer(d.totalSpend, d.platformConversions), sub: `${fmtN(d.platformConversions)} leads` },
    { label: 'Cost Per MQL',     value: costPer(d.totalSpend, d.totalMqls),           sub: `${fmtN(d.totalMqls)} MQLs` },
    { label: 'Cost Per SQL',     value: costPer(d.totalSpend, d.totalSqls),           sub: `${fmtN(d.totalSqls)} SQLs` },
    { label: 'Cost Per Won',     value: costPer(d.totalSpend, d.totalWon),            sub: `${fmtN(d.totalWon)} won` },
  ];

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
      <h3 className="text-base font-bold text-brand-dark mb-4">Cost Efficiency</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="bg-gray-50 rounded-2xl p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{m.label}</p>
            <p className="text-2xl font-bold text-brand-dark tabular-nums">{m.value}</p>
            <p className="text-xs text-gray-400 mt-1">{m.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Platform Card ────────────────────────────────────────────────────────────

function PlatformCard({
  name, spend, clicks, impressions, conversions, mqls, sqls, won, color, delay,
}: {
  name: string; spend: number; clicks: number; impressions: number;
  conversions: number; mqls: number; sqls: number; won: number;
  color: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6"
    >
      <div className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold mb-5', color)}>
        {name}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Spend',       value: fmt$(spend) },
          { label: 'Leads',       value: fmtN(conversions) },
          { label: 'MQLs',        value: fmtN(mqls) },
          { label: 'SQLs',        value: fmtN(sqls) },
          { label: 'Won',         value: fmtN(won) },
          { label: 'Clicks',      value: fmtN(clicks) },
          { label: 'CPC',         value: cpc(spend, clicks) },
          { label: 'CTR',         value: ctr(clicks, impressions) },
          { label: 'CPL',         value: costPer(spend, conversions) },
          { label: 'CP-MQL',      value: costPer(spend, mqls) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 font-semibold mb-0.5">{label}</p>
            <p className="font-bold text-brand-dark text-sm tabular-nums">{value}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Funnel ───────────────────────────────────────────────────────────────────

function FunnelPanel({ d }: { d: FocusStats }) {
  const sqlRate = d.totalMqls > 0 ? (d.totalSqls / d.totalMqls) * 100 : 0;
  const wonRate = d.totalSqls > 0 ? (d.totalWon / d.totalSqls) * 100 : 0;

  const stages = [
    {
      label: 'MQLs', value: d.totalMqls, rate: '100%', pct: 100,
      sub: [
        { icon: Phone, label: 'Call', value: d.callMqls, color: 'text-blue-500' },
        { icon: FileText, label: 'Form', value: d.enrollmentMqls, color: 'text-purple-500' },
      ],
      color: 'bg-brand-forest/10 border-brand-forest/20 text-brand-forest',
    },
    {
      label: 'SQLs', value: d.totalSqls, rate: d.totalMqls > 0 ? `${sqlRate.toFixed(1)}%` : '—', pct: Math.min(sqlRate, 100),
      sub: [
        { icon: Phone, label: 'Call', value: d.callSqls, color: 'text-blue-500' },
        { icon: FileText, label: 'Form', value: d.enrollmentSqls, color: 'text-purple-500' },
      ],
      color: 'bg-blue-50 border-blue-100 text-blue-600',
    },
    {
      label: 'Closed Won', value: d.totalWon, rate: d.totalSqls > 0 ? `${wonRate.toFixed(1)}%` : '—', pct: Math.min(wonRate, 100),
      sub: [
        { icon: Phone, label: 'Call', value: d.callWon, color: 'text-blue-500' },
        { icon: FileText, label: 'Form', value: d.enrollmentWon, color: 'text-purple-500' },
      ],
      color: 'bg-brand-orange/10 border-brand-orange/20 text-brand-orange',
    },
  ];

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
      <h3 className="text-xl font-bold text-brand-dark mb-1">Funnel Distribution</h3>
      <p className="text-sm text-gray-400 font-medium mb-8">Conversion by stage · Call vs Form breakdown</p>
      <div className="space-y-6">
        {stages.map((stage, i) => (
          <div key={stage.label}>
            <div className="flex justify-between items-end mb-2">
              <span className="text-sm font-bold text-gray-700">{stage.label}</span>
              <span className="text-xs font-bold text-gray-400 uppercase">{stage.rate} Rate</span>
            </div>
            <div className="h-10 w-full bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${stage.pct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, delay: i * 0.1, ease: 'easeOut' }}
                className={cn('h-full border-r-2 flex items-center px-4', stage.color)}
              >
                <span className="text-sm font-bold tabular-nums">{fmtN(stage.value)}</span>
              </motion.div>
            </div>
            <div className="flex gap-4 mt-2 pl-1">
              {stage.sub.map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <Icon className={cn('w-3 h-3', color)} />
                  <span className="text-xs text-gray-400">{label}: <strong className="text-gray-600">{fmtN(value)}</strong></span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Campaign Table ───────────────────────────────────────────────────────────

function CampaignTable({ campaigns }: { campaigns: FocusStats['campaigns'] }) {
  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-8 border-b border-gray-50">
        <h3 className="text-xl font-bold text-brand-dark">Campaign Performance</h3>
        <p className="text-sm text-gray-400 font-medium mt-1">Sorted by spend · Current period</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {['Campaign', 'Platform', 'Spend', 'Impressions', 'Clicks', 'CTR', 'Leads', 'MQLs', 'SQLs', 'CPL', 'CP-MQL', 'Won'].map((h) => (
                <th key={h} className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr><td colSpan={12} className="px-6 py-12 text-center text-gray-400">No campaign data for this period</td></tr>
            ) : campaigns.map((c, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4 font-medium text-brand-dark max-w-xs">
                  <span className="line-clamp-1 block" title={c.name}>{c.name}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-bold',
                    c.platform === 'Google' ? 'bg-blue-50 text-blue-600' :
                    c.platform === 'Meta' ? 'bg-indigo-50 text-indigo-600' :
                    'bg-gray-100 text-gray-500'
                  )}>
                    {c.platform}
                  </span>
                </td>
                <td className="px-6 py-4 font-bold text-brand-dark tabular-nums">{fmt$(c.spend)}</td>
                <td className="px-6 py-4 text-gray-600 tabular-nums">
                  {c.impressions >= 1_000_000 ? `${(c.impressions / 1_000_000).toFixed(1)}M` : `${(c.impressions / 1000).toFixed(0)}k`}
                </td>
                <td className="px-6 py-4 text-gray-600 tabular-nums">{fmtN(c.clicks)}</td>
                <td className="px-6 py-4 text-gray-600 tabular-nums">{ctr(c.clicks, c.impressions)}</td>
                <td className="px-6 py-4 text-gray-600 tabular-nums">{fmtN(c.conversions)}</td>
                <td className="px-6 py-4 font-semibold text-brand-forest tabular-nums">{fmtN(c.mqls)}</td>
                <td className="px-6 py-4 text-gray-600 tabular-nums">{fmtN(c.sqls)}</td>
                <td className="px-6 py-4 text-gray-600 tabular-nums">{costPer(c.spend, c.conversions)}</td>
                <td className="px-6 py-4 text-gray-600 tabular-nums">{costPer(c.spend, c.mqls)}</td>
                <td className="px-6 py-4 font-semibold text-brand-orange tabular-nums">{fmtN(c.won)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Adsets Table ────────────────────────────────────────────────────────────

function AdsetsTable({ adsets }: { adsets: AdSet[] }) {
  if (adsets.length === 0) return null;
  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-8 border-b border-gray-50">
        <h3 className="text-xl font-bold text-brand-dark">Meta Ad Sets</h3>
        <p className="text-sm text-gray-400 font-medium mt-1">Ad set breakdown · Sorted by spend</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {['Ad Set', 'Campaign', 'Spend', 'Impressions', 'Clicks', 'CTR', 'Leads', 'CPL'].map(h => (
                <th key={h} className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {adsets.map((a, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4 font-medium text-brand-dark max-w-xs"><span className="line-clamp-1 block" title={a.name}>{a.name}</span></td>
                <td className="px-6 py-4 text-gray-500 max-w-xs"><span className="line-clamp-1 block text-xs" title={a.campaign}>{a.campaign}</span></td>
                <td className="px-6 py-4 font-bold text-brand-dark tabular-nums">{fmt$(a.spend)}</td>
                <td className="px-6 py-4 text-gray-600 tabular-nums">{a.impressions >= 1_000_000 ? `${(a.impressions / 1_000_000).toFixed(1)}M` : `${(a.impressions / 1000).toFixed(0)}k`}</td>
                <td className="px-6 py-4 text-gray-600 tabular-nums">{fmtN(a.clicks)}</td>
                <td className="px-6 py-4 text-gray-600 tabular-nums">{ctr(a.clicks, a.impressions)}</td>
                <td className="px-6 py-4 font-semibold text-brand-forest tabular-nums">{fmtN(a.leads)}</td>
                <td className="px-6 py-4 text-gray-600 tabular-nums">{costPer(a.spend, a.leads)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Meta Creatives Table ─────────────────────────────────────────────────────

function MetaCreativesTable({ creatives }: { creatives: MetaCreative[] }) {
  if (creatives.length === 0) return null;
  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-8 border-b border-gray-50">
        <h3 className="text-xl font-bold text-brand-dark">Meta Ad Creatives</h3>
        <p className="text-sm text-gray-400 font-medium mt-1">Ad-level performance · Sorted by spend</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {['Ad Name', 'Headline', 'Ad Set', 'Spend', 'Clicks', 'Leads', 'CPL'].map(h => (
                <th key={h} className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {creatives.map((c, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4 font-medium text-brand-dark max-w-[180px]"><span className="line-clamp-1 block" title={c.name}>{c.name}</span></td>
                <td className="px-6 py-4 text-gray-600 max-w-[200px]"><span className="line-clamp-1 block text-xs" title={c.headline}>{c.headline || '—'}</span></td>
                <td className="px-6 py-4 text-gray-500 max-w-[160px]"><span className="line-clamp-1 block text-xs" title={c.adset}>{c.adset}</span></td>
                <td className="px-6 py-4 font-bold text-brand-dark tabular-nums">{fmt$(c.spend)}</td>
                <td className="px-6 py-4 text-gray-600 tabular-nums">{fmtN(c.clicks)}</td>
                <td className="px-6 py-4 font-semibold text-brand-forest tabular-nums">{fmtN(c.leads)}</td>
                <td className="px-6 py-4 text-gray-600 tabular-nums">{costPer(c.spend, c.leads)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Google Search Creatives Table ────────────────────────────────────────────

function GoogleCreativesTable({ creatives }: { creatives: GoogleCreative[] }) {
  if (creatives.length === 0) return null;
  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-8 border-b border-gray-50">
        <h3 className="text-xl font-bold text-brand-dark">Google Search Ads</h3>
        <p className="text-sm text-gray-400 font-medium mt-1">Responsive search ad performance · Sorted by spend</p>
      </div>
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
                <td className="px-6 py-4 text-gray-600 tabular-nums">{ctr(c.clicks, c.impressions)}</td>
                <td className="px-6 py-4 font-semibold text-brand-forest tabular-nums">{fmtN(c.results)}</td>
                <td className="px-6 py-4 text-gray-600 tabular-nums">{costPer(c.spend, c.results)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Geo Table ────────────────────────────────────────────────────────────────

function GeoTable({ states }: { states: GeoState[] }) {
  if (states.length === 0) return null;
  const maxSpend = states[0]?.spend ?? 1;
  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
      <h3 className="text-xl font-bold text-brand-dark mb-1">Geographic Performance</h3>
      <p className="text-sm text-gray-400 font-medium mb-6">Google Ads spend by state · Top {states.length}</p>
      <div className="space-y-3">
        {states.map((s, i) => (
          <div key={s.state} className="flex items-center gap-4">
            <span className="text-xs font-bold text-gray-400 w-4 tabular-nums">{i + 1}</span>
            <span className="text-sm font-semibold text-brand-dark w-32 shrink-0">{s.state}</span>
            <div className="flex-1 h-6 bg-gray-50 rounded-lg overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${(s.spend / maxSpend) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.04, ease: 'easeOut' }}
                className="h-full bg-brand-forest/15 border-r-2 border-brand-forest/40 rounded-lg"
              />
            </div>
            <span className="text-sm font-bold text-brand-dark tabular-nums w-20 text-right">{fmt$(s.spend)}</span>
            <span className="text-xs text-gray-400 tabular-nums w-20 text-right">{fmtN(s.clicks)} clicks</span>
            <span className="text-xs text-gray-400 tabular-nums w-24 text-right">{s.conversions.toFixed(1)} conv.</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FocusDashboardClient({ data: d }: { data: FocusStats }) {
  const { start, end } = d.filterParams;
  const totalCtr = d.totalImpressions > 0 ? (d.totalClicks / d.totalImpressions) * 100 : 0;
  const prevCtr  = d.prevImpressions  > 0 ? (d.prevClicks  / d.prevImpressions)  * 100 : 0;

  const kpis = [
    { name: 'Total Spend',   value: fmt$(d.totalSpend),   change: pct(d.totalSpend, d.prevSpend),       isUp: up(d.totalSpend, d.prevSpend),       icon: DollarSign,    color: 'text-brand-forest' },
    {
      name: 'Impressions',
      value: d.totalImpressions >= 1_000_000 ? `${(d.totalImpressions / 1_000_000).toFixed(1)}M` : `${(d.totalImpressions / 1000).toFixed(0)}k`,
      change: pct(d.totalImpressions, d.prevImpressions), isUp: up(d.totalImpressions, d.prevImpressions), icon: Eye, color: 'text-purple-600',
    },
    { name: 'Clicks',        value: fmtN(d.totalClicks),  change: pct(d.totalClicks, d.prevClicks),     isUp: up(d.totalClicks, d.prevClicks),     icon: MousePointer2, color: 'text-blue-600' },
    { name: 'CTR',           value: `${totalCtr.toFixed(2)}%`, change: pct(totalCtr, prevCtr),          isUp: up(totalCtr, prevCtr),               icon: Target,        color: 'text-emerald-600' },
    { name: 'Leads',         value: fmtN(d.platformConversions), change: pct(d.platformConversions, d.prevConversions), isUp: up(d.platformConversions, d.prevConversions), icon: BarChart2, color: 'text-cyan-600' },
    { name: 'MQLs',          value: fmtN(d.totalMqls),    change: pct(d.totalMqls, d.prevMqls),        isUp: up(d.totalMqls, d.prevMqls),         icon: Zap,           color: 'text-brand-orange' },
    { name: 'SQLs',          value: fmtN(d.totalSqls),    change: '—',                                  isUp: true, neutral: true,                 icon: TrendingUp,    color: 'text-blue-600' },
    { name: 'Closed Won',    value: fmtN(d.totalWon),     change: pct(d.totalWon, d.prevWon),          isUp: up(d.totalWon, d.prevWon),           icon: Trophy,        color: 'text-brand-orange' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-dark tracking-tight">{FOCUS_LABELS[d.focus] ?? d.focus}</h1>
          <p className="text-gray-500 mt-1">{fmtDateRange(start, end)} · Filtered by focus segment</p>
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar />

      {/* Budget Pacing */}
      <BudgetPacing d={d} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        {kpis.map((k, i) => <KpiCard key={k.name} {...k} delay={i * 0.05} />)}
      </div>

      {/* Cost Efficiency */}
      <CostEfficiency d={d} />

      {/* Trend Chart + Funnel */}
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold text-brand-dark">Spend vs. MQLs</h3>
              <p className="text-sm text-gray-400 font-medium">{fmtDateRange(start, end)}</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-brand-forest/20 border border-brand-forest" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Spend</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-brand-orange" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">MQLs</span>
              </div>
            </div>
          </div>
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={d.dailyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }} dy={10}
                  interval="preserveStartEnd"
                  tickFormatter={(v) => new Date(v + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px', fontSize: '13px' }}
                  formatter={(value, name) => [name === 'spend' ? `$${Number(value).toLocaleString()}` : Number(value).toLocaleString(), name === 'spend' ? 'Spend' : 'MQLs']}
                  labelFormatter={(label) => new Date(label + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                />
                <Bar yAxisId="left" dataKey="spend" fill="#0B4A31" fillOpacity={0.12} stroke="#0B4A31" radius={[4, 4, 0, 0]} barSize={16} />
                <Line yAxisId="right" type="monotone" dataKey="mql" stroke="#EB541E" strokeWidth={3} dot={false}
                  activeDot={{ r: 6, fill: '#EB541E', strokeWidth: 2, stroke: '#fff' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <FunnelPanel d={d} />
      </div>

      {/* Platform Comparison */}
      <div>
        <h3 className="text-lg font-bold text-brand-dark mb-4">Platform Breakdown</h3>
        <div className="grid lg:grid-cols-2 gap-6">
          <PlatformCard name="Google Ads"
            spend={d.googleSpend} clicks={d.googleClicks} impressions={d.googleImpressions}
            conversions={d.googleConversions} mqls={d.googleMqls} sqls={0} won={d.googleWon}
            color="bg-blue-50 text-blue-700" delay={0} />
          <PlatformCard name="Meta Ads"
            spend={d.metaSpend} clicks={d.metaClicks} impressions={d.metaImpressions}
            conversions={d.metaConversions} mqls={d.metaMqls} sqls={0} won={d.metaWon}
            color="bg-indigo-50 text-indigo-700" delay={0.1} />
        </div>
      </div>

      {/* Campaign Table */}
      <CampaignTable campaigns={d.campaigns} />

      {/* Ad Sets */}
      <AdsetsTable adsets={d.adsets} />

      {/* Meta Creatives */}
      <MetaCreativesTable creatives={d.metaCreatives} />

      {/* Google Search Creatives */}
      <GoogleCreativesTable creatives={d.googleCreatives} />

      {/* Geographic Performance */}
      <GeoTable states={d.geoStates} />
    </div>
  );
}
