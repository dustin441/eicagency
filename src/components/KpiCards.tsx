'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type KpiStat = {
  name: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  color: string;
  icon: LucideIcon;
};

export default function KpiCards({ stats }: { stats: KpiStat[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.name}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.06 }}
          className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className={cn('p-2 rounded-xl bg-gray-50 group-hover:scale-110 transition-transform', stat.color)}>
              <stat.icon className="w-5 h-5" />
            </div>
            {stat.trend !== 'neutral' && (
              <div className={cn(
                'flex items-center text-xs font-bold px-2 py-1 rounded-full',
                stat.trend === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
              )}>
                {stat.trend === 'up'
                  ? <ArrowUpRight className="w-3 h-3 mr-0.5" />
                  : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                {stat.change}
              </div>
            )}
          </div>
          <div className="text-2xl font-bold text-brand-dark mb-1 tabular-nums">{stat.value}</div>
          <div className="text-xs font-medium text-gray-400 uppercase tracking-widest leading-tight">{stat.name}</div>
        </motion.div>
      ))}
    </div>
  );
}
