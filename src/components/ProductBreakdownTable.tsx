import React from 'react';
import { ProductPerformanceRow } from '@/services/spartaco-product-analytics';
import { fmtNumber, fmtCurrency, fmtPercent, fmtMoneyPrecise } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface ProductBreakdownTableProps {
  rows: ProductPerformanceRow[];
}

export default function ProductBreakdownTable({ rows }: ProductBreakdownTableProps) {
  return (
    <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
      <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-brand-dark">Product Breakdown</h3>
          <p className="text-sm text-gray-500 mt-1">Cross-channel performance aggregation by product line</p>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1200px]">
          <thead>
            <tr className="bg-slate-50/50 text-[11px] uppercase tracking-wider font-bold text-gray-500">
              <th className="px-6 py-4 border-b border-gray-100 sticky left-0 bg-slate-50/50 z-10 w-[200px]">Product</th>
              
              {/* PAID MEDIA GROUP */}
              <th className="px-6 py-4 border-b border-gray-100 bg-emerald-50/30 text-emerald-800 text-center" colSpan={3}>Paid Media</th>
              
              {/* GOOGLE ANALYTICS GROUP */}
              <th className="px-6 py-4 border-b border-gray-100 bg-blue-50/30 text-blue-800 text-center" colSpan={2}>Google Analytics</th>
              
              {/* SEARCH & SOCIAL GROUP */}
              <th className="px-6 py-4 border-b border-gray-100 bg-orange-50/30 text-orange-800 text-center">Search</th>
              <th className="px-6 py-4 border-b border-gray-100 bg-purple-50/30 text-purple-800 text-center">Social</th>
              <th className="px-6 py-4 border-b border-gray-100 bg-indigo-50/30 text-indigo-800 text-center">Email</th>
            </tr>
            <tr className="bg-slate-50/50 text-[10px] uppercase tracking-widest font-extrabold text-gray-400">
              <th className="px-6 py-3 border-b border-gray-100 sticky left-0 bg-slate-50/50 z-10">Name</th>
              
              {/* Ads */}
              <th className="px-6 py-3 border-b border-gray-100 text-right">Spend</th>
              <th className="px-6 py-3 border-b border-gray-100 text-right">Revenue</th>
              <th className="px-6 py-3 border-b border-gray-100 text-right">ROAS</th>
              
              {/* GA4 */}
              <th className="px-6 py-3 border-b border-gray-100 text-right">Sessions</th>
              <th className="px-6 py-3 border-b border-gray-100 text-right">Eng. Rate</th>
              
              {/* GSC */}
              <th className="px-6 py-3 border-b border-gray-100 text-right">GSC Clicks</th>
              
              {/* Social */}
              <th className="px-6 py-3 border-b border-gray-100 text-right">Engagement</th>

              {/* Email */}
              <th className="px-6 py-3 border-b border-gray-100 text-right">Opens</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row) => {
              const roas = row.ad_cost > 0 ? row.ad_revenue / row.ad_cost : 0;
              const engRate = row.ga4_sessions > 0 ? row.ga4_engaged_sessions / row.ga4_sessions : 0;
              
              return (
                <tr key={row.product} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-5 font-bold text-brand-dark sticky left-0 bg-white group-hover:bg-gray-50/50 z-10 border-r border-gray-50">
                    {row.product}
                  </td>
                  
                  {/* Ads */}
                  <td className="px-6 py-5 text-right tabular-nums font-medium">{fmtCurrency(row.ad_cost)}</td>
                  <td className="px-6 py-5 text-right tabular-nums font-bold text-emerald-700">{fmtCurrency(row.ad_revenue)}</td>
                  <td className="px-6 py-5 text-right tabular-nums">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs font-bold",
                      roas >= 2 ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
                    )}>
                      {roas.toFixed(2)}x
                    </span>
                  </td>
                  
                  {/* GA4 */}
                  <td className="px-6 py-5 text-right tabular-nums font-semibold text-blue-900">{fmtNumber(row.ga4_sessions)}</td>
                  <td className="px-6 py-5 text-right tabular-nums text-gray-500">{fmtPercent(engRate)}</td>
                  
                  {/* GSC */}
                  <td className="px-6 py-5 text-right tabular-nums font-medium text-orange-700">{fmtNumber(row.gsc_clicks)}</td>
                  
                  {/* Social */}
                  <td className="px-6 py-5 text-right tabular-nums font-medium text-purple-700">{fmtNumber(row.social_engagement)}</td>

                  {/* Email */}
                  <td className="px-6 py-5 text-right tabular-nums font-medium text-indigo-700">{fmtNumber(row.email_opens)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
