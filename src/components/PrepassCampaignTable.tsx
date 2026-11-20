'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

export type CampaignTableRow = {
  label: string;
  fromSegment: string | null; // set when the campaign belongs to a different segment
  own: boolean;
  spend: number | null;
  leads: number;
  mql: number;
  sql: number;
  won: number;
  matched: number;
  costPerLead: number | null;
  costPerMql: number | null;
  costPerSql: number | null;
  costPerWon: number | null;
  platformLeads: number | null;
  pageEvents: number;
  taggedPct: number | null;
  warn: boolean;
};

type ColKey = 'spend' | 'leads' | 'mql' | 'sql' | 'won' | 'matched' | 'costPerLead' | 'costPerMql' | 'costPerSql' | 'costPerWon' | 'platformLeads' | 'taggedPct';
type Col = { key: ColKey; label: string; money?: boolean; pct?: boolean; dflt: boolean };

const COLS: Col[] = [
  { key: 'spend', label: 'Spend', money: true, dflt: true },
  { key: 'leads', label: 'Leads', dflt: true },
  { key: 'mql', label: 'MQL', dflt: true },
  { key: 'sql', label: 'SQL', dflt: true },
  { key: 'won', label: 'Won', dflt: true },
  { key: 'matched', label: 'Of which matched', dflt: true },
  { key: 'costPerLead', label: 'Cost per lead', money: true, dflt: false },
  { key: 'costPerMql', label: 'Cost per MQL', money: true, dflt: true },
  { key: 'costPerSql', label: 'Cost per SQL', money: true, dflt: false },
  { key: 'costPerWon', label: 'Cost per won', money: true, dflt: true },
  { key: 'platformLeads', label: 'Platform leads', dflt: true },
  { key: 'taggedPct', label: 'Tagged in Marketo', pct: true, dflt: true },
];

const fmt = (c: Col, v: number | null) => {
  if (v == null) return '—';
  if (c.money) return `$${Math.round(v).toLocaleString('en-US')}`;
  if (c.pct) return `${Math.round(v * 100)}%`;
  return Math.round(v).toLocaleString('en-US');
};

export default function PrepassCampaignTable({ rows }: { rows: CampaignTableRow[] }) {
  const [q, setQ] = useState('');
  const [onlySpend, setOnlySpend] = useState(false);
  const [onlyWon, setOnlyWon] = useState(false);
  const [sort, setSort] = useState<{ key: ColKey | 'label'; dir: 1 | -1 }>({ key: 'spend', dir: -1 });
  const [shown, setShown] = useState<Set<ColKey>>(new Set(COLS.filter((c) => c.dflt).map((c) => c.key)));

  const view = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const f = rows.filter((r) => (!needle || r.label.toLowerCase().includes(needle)) && (!onlySpend || (r.spend ?? 0) > 0) && (!onlyWon || r.won > 0));
    const val = (r: CampaignTableRow) => (sort.key === 'label' ? r.label.toLowerCase() : (r[sort.key] as number | null) ?? -Infinity);
    return [...f].sort((a, b) => {
      const x = val(a), y = val(b);
      return x < y ? -sort.dir : x > y ? sort.dir : 0;
    });
  }, [rows, q, onlySpend, onlyWon, sort]);

  const cols = COLS.filter((c) => shown.has(c.key));
  const toggleSort = (key: ColKey | 'label') => setSort((s) => (s.key === key ? { key, dir: (-s.dir) as 1 | -1 } : { key, dir: key === 'label' ? 1 : -1 }));
  const arrow = (key: string) => (sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : '');
  const thCls = 'cursor-pointer select-none whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500';

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search campaigns" className="w-56 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-forest/20" />
        <label className="inline-flex items-center gap-1.5 text-gray-600"><input type="checkbox" checked={onlySpend} onChange={(e) => setOnlySpend(e.target.checked)} /> With spend</label>
        <label className="inline-flex items-center gap-1.5 text-gray-600"><input type="checkbox" checked={onlyWon} onChange={(e) => setOnlyWon(e.target.checked)} /> With wins</label>
        <details className="relative ml-auto">
          <summary className="cursor-pointer list-none rounded-lg border border-gray-200 px-3 py-1.5 font-semibold text-gray-700 hover:bg-gray-50">Columns</summary>
          <div className="absolute right-0 z-10 mt-1 w-52 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
            {COLS.map((c) => (
              <label key={c.key} className="flex items-center gap-2 py-1 text-sm text-gray-700">
                <input type="checkbox" checked={shown.has(c.key)} onChange={() => setShown((s) => { const n = new Set(s); if (n.has(c.key)) n.delete(c.key); else n.add(c.key); return n; })} />
                {c.label}
              </label>
            ))}
          </div>
        </details>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className={cn(thCls, 'text-left')} onClick={() => toggleSort('label')}>Campaign{arrow('label')}</th>
              {cols.map((c) => <th key={c.key} className={cn(thCls, 'text-right')} onClick={() => toggleSort(c.key)}>{c.label}{arrow(c.key)}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {view.map((r) => (
              <tr key={r.label}>
                <td className="px-3 py-2 text-left text-sm font-semibold text-gray-950">
                  {r.label}
                  {!r.own && r.fromSegment && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">from a {r.fromSegment} campaign</span>}
                </td>
                {cols.map((c) => {
                  let v = r[c.key] as number | null;
                  if (c.key === 'platformLeads' && (v == null || v <= 0) && r.pageEvents > 0) {
                    return <td key={c.key} className="px-3 py-2 text-right text-sm tabular-nums text-gray-700">{`${r.pageEvents.toLocaleString('en-US')} page events`}</td>;
                  }
                  if (c.key === 'matched' && v === 0) v = null;
                  return <td key={c.key} className={cn('px-3 py-2 text-right text-sm tabular-nums text-gray-700', c.key === 'taggedPct' && r.warn && 'bg-amber-50 text-amber-900')}>{fmt(c, v)}</td>;
                })}
              </tr>
            ))}
            {view.length === 0 && <tr><td colSpan={cols.length + 1} className="px-3 py-6 text-center text-sm text-gray-500">No campaigns match.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-500">{view.length} of {rows.length} campaigns. Click a column heading to sort.</p>
    </div>
  );
}
