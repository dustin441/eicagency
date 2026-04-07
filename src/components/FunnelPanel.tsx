'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type FunnelStage = {
  label: string;
  value: number;
  ratePct: number;
  rateLabel: string;
  color: string;
};

export default function FunnelPanel({ stages }: { stages: FunnelStage[] }) {
  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col">
      <div className="mb-8">
        <h3 className="text-xl font-bold text-brand-dark">Funnel Distribution</h3>
        <p className="text-sm text-gray-400 font-medium">Conversion rate summary by stage</p>
      </div>

      <div className="space-y-6 flex-1">
        {stages.map((stage, i) => (
          <div key={stage.label} className="group cursor-default">
            <div className="flex justify-between items-end mb-2">
              <span className="text-sm font-bold text-gray-700">{stage.label}</span>
              <span className="text-xs font-bold text-gray-400 uppercase">{stage.rateLabel} Rate</span>
            </div>
            <div className="h-10 w-full bg-gray-50 rounded-xl overflow-hidden border border-gray-100 group-hover:border-gray-200 transition-all">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${stage.ratePct}%` }}
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
  );
}
