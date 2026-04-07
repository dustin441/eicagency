'use client';

import React from 'react';
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  ComposedChart,
} from 'recharts';
import {
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  MousePointer2,
  Eye,
  Target,
  Zap,
  Trophy,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import ChannelTable from '@/components/ChannelTable';
import PeriodSelector from '@/components/PeriodSelector';
import type { DashboardStats } from '@/services/analytics';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(current: number, prev: number): string {
  if (prev === 0) return current > 0 ? '+100%' : '0%';
  const change = ((current - prev) / prev) * 100;
  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
}

function trendDir(current: number, prev: number): 'up' | 'down' {
  return current >= prev ? 'up' : 'down';
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DashboardClientProps {
  initialData: DashboardStats;
  period: string;
}

const PERIOD_LABELS: Record<string, string> = {
  day: 'Today',
  week: 'Last 7 Days',
  month: 'Month to Date',
  year: 'Year to Date',
};

export default function DashboardClient({ initialData: d, period }: DashboardClientProps) {
  const ctr = d.totalImpressions > 0 ? (d.totalClicks / d.totalImpressions) * 100 : 0;
  const prevCtr = d.prevImpressions > 0 ? (d.prevClicks / d.prevImpressions) * 100 : 0;

  const stats = [
    {
      name: 'Total Spend',
      value: `$${Math.round(d.totalSpend).toLocaleString()}`,
      change: pct(d.totalSpend, d.prevSpend),
      trend: trendDir(d.totalSpend, d.prevSpend),
      color: 'text-brand-forest',
      icon: DollarSign,
      dataKey: 'spend',
    },
    {
      name: 'Clicks',
      value: d.totalClicks.toLocaleString(),
      change: pct(d.totalClicks, d.prevClicks),
      trend: trendDir(d.totalClicks, d.prevClicks),
      color: 'text-blue-600',
      icon: MousePointer2,
      dataKey: 'spend',
    },
    {
      name: 'Impressions',
      value: d.totalImpressions >= 1_000_000
        ? `${(d.totalImpressions / 1_000_000).toFixed(1)}M`
        : `${(d.totalImpressions / 1000).toFixed(0)}k`,
      change: pct(d.totalImpressions, d.prevImpressions),
      trend: trendDir(d.totalImpressions, d.prevImpressions),
      color: 'text-purple-600',
      icon: Eye,
      dataKey: 'spend',
    },
    {
      name: 'CTR',
      value: `${ctr.toFixed(2)}%`,
      change: pct(ctr, prevCtr),
      trend: trendDir(ctr, prevCtr),
      color: 'text-emerald-600',
      icon: Target,
      dataKey: 'spend',
    },
    {
      name: 'MQLs',
      value: d.totalMqls.toLocaleString(),
      change: pct(d.totalMqls, d.prevMqls),
      trend: trendDir(d.totalMqls, d.prevMqls),
      color: 'text-brand-orange',
      icon: Zap,
      dataKey: 'mql',
    },
    {
      name: 'Closed Won',
      value: d.totalWon.toLocaleString(),
      change: pct(d.totalWon, d.prevWon),
      trend: trendDir(d.totalWon, d.prevWon),
      color: 'text-brand-orange',
      icon: Trophy,
      dataKey: 'mql',
    },
  ];

  // Funnel stages with division-by-zero guards
  const sqlRate = d.totalMqls > 0 ? (d.totalSqls / d.totalMqls) * 100 : 0;
  const wonRate = d.totalSqls > 0 ? (d.totalWon / d.totalSqls) * 100 : 0;

  const funnelStages = [
    {
      label: 'Form Fills (MQL)',
      value: d.totalMqls,
      rate: '100%',
      widthPct: 100,
      color: 'bg-brand-forest/10 border-brand-forest/20 text-brand-forest',
    },
    {
      label: 'Sales Qualified (SQL)',
      value: d.totalSqls,
      rate: d.totalMqls > 0 ? `${sqlRate.toFixed(1)}%` : '—',
      widthPct: Math.min(sqlRate, 100),
      color: 'bg-blue-50 border-blue-100 text-blue-600',
    },
    {
      label: 'Closed Won',
      value: d.totalWon,
      rate: d.totalSqls > 0 ? `${wonRate.toFixed(1)}%` : '—',
      widthPct: Math.min(wonRate, 100),
      color: 'bg-brand-orange/10 border-brand-orange/20 text-brand-orange',
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">
      {/* Page Heading */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-dark tracking-tight">Overall Performance</h1>
          <p className="text-gray-500 mt-1">{PERIOD_LABELS[period] ?? 'Month to Date'} · All channels</p>
        </div>
        <PeriodSelector />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
            className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all group overflow-hidden relative"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn('p-2 rounded-xl bg-gray-50 group-hover:scale-110 transition-transform', stat.color)}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div className={cn(
                'flex items-center text-xs font-bold px-2 py-1 rounded-full',
                stat.trend === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
              )}>
                {stat.trend === 'up'
                  ? <ArrowUpRight className="w-3 h-3 mr-0.5" />
                  : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                {stat.change}
              </div>
            </div>
            <div className="text-2xl font-bold text-brand-dark mb-1 tabular-nums">{stat.value}</div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest">{stat.name}</div>

            {/* Per-metric sparkline */}
            <div className="absolute bottom-0 left-0 right-0 h-14 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={d.dailyData.slice(-14)}>
                  <Area type="monotone" dataKey={stat.dataKey} stroke="none" fill={stat.trend === 'up' ? '#10b981' : '#ef4444'} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Charts */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Spend vs Leads Combo Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xl font-bold text-brand-dark">Spend vs. Leads</h3>
              <p className="text-sm text-gray-400 font-medium">Daily media spend and lead volume — last 30 days</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-brand-forest/20 border border-brand-forest" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Spend</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-brand-orange" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Leads</span>
              </div>
            </div>
          </div>

          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={d.dailyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }}
                  dy={10}
                  interval="preserveStartEnd"
                  tickFormatter={(val) =>
                    new Date(val + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  }
                />
                <YAxis
                  yAxisId="left"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '16px',
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    padding: '12px',
                    fontSize: '13px',
                  }}
                  formatter={(value, name) => [
                    name === 'spend' ? `$${Number(value).toLocaleString()}` : Number(value).toLocaleString(),
                    name === 'spend' ? 'Spend' : 'Leads',
                  ]}
                  labelFormatter={(label) =>
                    new Date(label + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                  }
                />
                <Bar yAxisId="left" dataKey="spend" fill="#0B4A31" fillOpacity={0.12} stroke="#0B4A31" radius={[4, 4, 0, 0]} barSize={18} />
                <Line yAxisId="right" type="monotone" dataKey="mql" stroke="#EB541E" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#EB541E', strokeWidth: 2, stroke: '#fff' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Funnel Distribution */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col">
          <div className="mb-8">
            <h3 className="text-xl font-bold text-brand-dark">Funnel Distribution</h3>
            <p className="text-sm text-gray-400 font-medium">Conversion rate summary by stage</p>
          </div>

          <div className="space-y-6 flex-1">
            {funnelStages.map((stage, i) => (
              <div key={stage.label} className="group cursor-default">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm font-bold text-gray-700">{stage.label}</span>
                  <span className="text-xs font-bold text-gray-400 uppercase">{stage.rate} Rate</span>
                </div>
                <div className="h-10 w-full bg-gray-50 rounded-xl overflow-hidden border border-gray-100 group-hover:border-gray-200 transition-all">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${stage.widthPct}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.9, delay: i * 0.1, ease: 'easeOut' }}
                    className={cn('h-full border-r-2 flex items-center px-4', stage.color)}
                  >
                    <span className="text-sm font-bold tabular-nums">{stage.value.toLocaleString()}</span>
                  </motion.div>
                </div>
              </div>
            ))}
          </div>

          <button className="mt-8 w-full bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold py-4 rounded-2xl transition-all border border-gray-100 text-sm">
            Download Detailed Funnel Report
          </button>
        </div>
      </div>

      {/* Channel Breakdown Table */}
      <ChannelTable initialChannels={d.channels} />
    </div>
  );
}
