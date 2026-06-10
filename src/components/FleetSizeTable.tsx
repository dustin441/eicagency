'use client';

import React from 'react';
import type { FleetBandStat } from '@/services/analytics';

const fmt$ = (n: number) => `$${Math.round(n).toLocaleString()}`;
const fmtN = (n: number) => Math.round(n).toLocaleString();

// PrePass ABM: leads + cost per lead by fleet-size band.
// Cost/Lead = total ABM investment / leads in the band (more leads => lower cost/lead).
export default function FleetSizeTable({
  data,
  title = 'Fleet Size Breakdown',
  subtitle,
}: {
  data: FleetBandStat[];
  title?: string;
  subtitle?: string;
}) {
  if (!data || data.length === 0) return null;
  const totalLeads = data.reduce((a, d) => a + d.leads, 0);

  return (
    <div className="w-full bg-white border border-gray-100 shadow-sm rounded-[2.5rem] overflow-hidden">
      <div className="p-8 border-b border-gray-100">
        <h3 className="text-xl font-bold text-brand-dark">{title}</h3>
        <p className="text-sm text-gray-400 font-medium mt-0.5">
          {subtitle ?? `Leads & cost per lead by fleet size · ${fmtN(totalLeads)} attributed leads · Cost/Lead = total ABM investment ÷ leads in band`}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Fleet Size', 'Leads', '% of Leads', 'Cost/Lead'].map(h => (
                <th key={h} className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.map(d => (
              <tr key={d.band} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4 font-bold text-brand-dark whitespace-nowrap">{d.band}</td>
                <td className="px-6 py-4 tabular-nums font-medium">{fmtN(d.leads)}</td>
                <td className="px-6 py-4 tabular-nums text-gray-500">
                  {totalLeads > 0 ? `${((d.leads / totalLeads) * 100).toFixed(1)}%` : '—'}
                </td>
                <td className="px-6 py-4 tabular-nums font-semibold text-brand-forest">
                  {d.cost > 0 ? fmt$(d.cost) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-gray-100 bg-gray-50">
            <tr>
              <td className="px-6 py-4 font-bold text-brand-dark">Total</td>
              <td className="px-6 py-4 tabular-nums font-bold">{fmtN(totalLeads)}</td>
              <td className="px-6 py-4 tabular-nums text-gray-500">100%</td>
              <td className="px-6 py-4 text-gray-300">—</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
