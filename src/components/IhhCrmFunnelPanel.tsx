'use client';

import { motion } from 'framer-motion';
import { ChevronDown, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IhhCrmFunnel } from '@/services/ihh-crm-funnel';

function fmtN(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

const STAGE_STYLE: Record<string, string> = {
  lead: 'bg-purple-50 border-purple-200 text-purple-700',
  appointment: 'bg-brand-forest/10 border-brand-forest/20 text-brand-forest',
  closerScheduled: 'bg-blue-50 border-blue-200 text-blue-600',
  closedWon: 'bg-brand-forest/15 border-brand-forest/40 text-brand-forest',
};

export default function IhhCrmFunnelPanel({ funnel }: { funnel: IhhCrmFunnel }) {
  const topVal = funnel.stages[0]?.value || 1;

  const stages = funnel.stages.map(stage => ({
    ...stage,
    widthPct: Math.min((stage.value / topVal) * 100, 100),
    isNorthStar: stage.key === 'closedWon',
    color: STAGE_STYLE[stage.key],
  }));

  const connectors = [
    { rate: funnel.leadToAppointmentRate, avgDays: funnel.avgDaysLeadToAppointment, toLabel: 'Appointment' },
    { rate: funnel.appointmentToCloserRate, avgDays: funnel.avgDaysAppointmentToCloser, toLabel: 'Closer Scheduled' },
    { rate: funnel.closerToWonRate, avgDays: funnel.avgDaysCloserToWon, toLabel: 'Close' },
  ];

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
      <h3 className="text-xl font-bold text-brand-dark mb-1">Funnel Distribution</h3>
      <p className="text-sm text-gray-400 font-medium mb-6">CRM conversion rate &amp; time to deal by stage</p>

      <div className="space-y-0">
        {stages.map((stage, i) => (
          <div key={stage.key}>
            <div className={cn(stage.isNorthStar && 'rounded-2xl bg-brand-forest/5 p-3 -mx-3 border border-brand-forest/15')}>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <span className={cn('text-sm font-bold', stage.isNorthStar ? 'text-brand-forest' : 'text-gray-700')}>{stage.label}</span>
                  {stage.isNorthStar && <span className="text-[10px] font-bold uppercase tracking-widest text-brand-forest bg-brand-forest/10 px-2 py-0.5 rounded-full">North Star</span>}
                </div>
                <span className="text-base font-bold text-brand-dark tabular-nums">{fmtN(stage.value)}</span>
              </div>
              <div className="h-9 w-full bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${stage.widthPct}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.9, delay: i * 0.1, ease: 'easeOut' }}
                  className={cn('h-full border-r-2 rounded-xl', stage.color)}
                />
              </div>
            </div>

            {i < stages.length - 1 && (() => {
              const conn = connectors[i];
              return (
                <div className="flex items-center gap-2 py-2 pl-2">
                  <ChevronDown className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                      {conn.rate !== null ? `${conn.rate.toFixed(1)}%` : '—'} converted
                    </span>
                    {conn.avgDays !== null && (
                      <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                        <Clock className="w-3 h-3" />
                        avg {conn.avgDays.toFixed(1)}d to {conn.toLabel}
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}
