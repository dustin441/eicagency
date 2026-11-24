import { summarizePageActivity, type SocialRow } from '@/lib/nsi-ytd-media';
const count = (value: number) => new Intl.NumberFormat('en-US').format(value);
export default function NsiYtdPageActivity({ row }: { row: SocialRow }) {
  if (!row.activity) return null;
  const activity = row.activity;
  const summary = summarizePageActivity(activity);
  const low = Math.min(0, ...summary.points.map(p => p.cumulative));
  const high = Math.max(0, ...summary.points.map(p => p.cumulative));
  const span = high - low || 1;
  const y = (value: number) => 30 + (high - value) / span * 200;
  const x = (index: number) => 76 + (index + 1) / summary.points.length * 710;
  const ticks = Array.from(new Set([low, 0, high]));
  const label = 'Net follower change, not total followers';
  return <section className="nsi-ytd-page-activity rounded-2xl border border-gray-100 bg-white p-6 shadow-sm" aria-label={`${row.brand} Page activity`}>
    <style>{`@media print {
      .nsi-ytd-report .nsi-ytd-page-activity { break-before: page; page-break-before: always; }
      .nsi-ytd-report .nsi-ytd-page-activity svg { height: 165px !important; min-height: 0 !important; width: 100% !important; }
      .nsi-ytd-report .nsi-ytd-page-activity > .grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
      .nsi-ytd-report .nsi-ytd-activity-trend { display: grid !important; grid-template-columns: 1.2fr 1fr !important; gap: 18px; align-items: start; break-inside: avoid !important; }
      .nsi-ytd-report .nsi-ytd-page-activity figure, .nsi-ytd-report .nsi-ytd-page-activity table { break-inside: avoid !important; page-break-inside: avoid !important; }
      .nsi-ytd-report .nsi-ytd-page-activity th, .nsi-ytd-report .nsi-ytd-page-activity td { padding: 3px !important; }
    }`}</style>
    <h2 className="text-lg font-bold text-gray-800">{row.brand} {row.platform} Page activity</h2>
    <p className="mt-2 text-sm text-gray-600">January 1-October 31, 2026 ({activity.start} to {activity.end}). Meta Business Suite daily Page activity.</p>
    <p className="mt-2 text-xs text-gray-500">Source: {activity.source}</p>
    <p className="mt-3 text-sm font-semibold">{label}</p>
    <p className="mt-1 text-sm text-gray-600">The chart tracks cumulative net follows from a relative tracking baseline of zero, not total Page followers. Declines are retained. This export does not provide opening or closing follower totals.{row.followersStartStatus === 'not-launched' ? ' January: Not launched.' : ''}</p>
    <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{[[label, summary.total], ['Total interactions', activity.interactions], ['Views', activity.views], ['Impressions', activity.impressions]].map(([title, value]) => <div key={title} className="rounded-xl border border-gray-100 p-3"><p className="text-xs text-gray-500">{title}</p><p className="mt-1 text-xl font-bold tabular-nums">{count(value as number)}</p></div>)}</div>
    <p className="mt-3 text-xs text-gray-500">Native Page activity can include paid and boosted delivery. It is not added to paid-media totals. Views and impressions are not unique people. Content CSV lifetime metrics are not summed into these reporting-period values.</p>
    <div className="nsi-ytd-activity-trend"><figure className="mt-5"><figcaption className="text-sm font-semibold">Daily cumulative {label.toLowerCase()}</figcaption>
      <svg viewBox="0 0 820 280" role="img" aria-label={`Daily cumulative ${label}. Relative zero baseline. Negative changes are preserved.`} className="mt-2 h-auto w-full" style={{ minHeight: 180 }}>
        <title>Daily cumulative net follower change, January-October 2026</title>
        <desc>Relative change from zero, not total audience. Daily points include net change and cumulative change in their titles.</desc>
        {ticks.map(value => <g key={value}><line x1="76" x2="786" y1={y(value)} y2={y(value)} stroke={value === 0 ? '#64748b' : '#e2e8f0'} data-zero-baseline={value === 0 ? 'true' : undefined} strokeDasharray={value === 0 ? '4 3' : undefined}/><text x="65" y={y(value) + 4} textAnchor="end" fontSize="12" fill="#475569">{count(value)}</text></g>)}
        <polyline points={`76,${y(0)} ${summary.points.map((p, i) => `${x(i)},${y(p.cumulative)}`).join(' ')}`} fill="none" stroke="#2563eb" strokeWidth="2"/>
        {summary.points.map((p, i) => <circle key={p.date} cx={x(i)} cy={y(p.cumulative)} r="2.5" fill="#2563eb"><title>{`${p.date}: net ${p.netFollows}, cumulative ${p.cumulative}. ${label}`}</title></circle>)}
        {summary.points.filter(p => p.date.endsWith('-01')).map(p => <text key={p.date} x={x(summary.points.indexOf(p))} y="255" textAnchor="middle" fontSize="12" fill="#475569">{new Date(`${p.date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}</text>)}
      </svg>
    </figure>
    <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><caption className="mb-2 text-left font-semibold">Monthly net follower change</caption><thead><tr><th scope="col" className="p-2 text-left">Month, 2026</th><th scope="col" className="p-2 text-right">Net follower change, not total followers</th></tr></thead><tbody>{summary.months.map(month => <tr key={month.month} className="border-t border-gray-100"><th scope="row" className="p-2 text-left font-normal">{month.month}</th><td className="p-2 text-right tabular-nums">{count(month.netFollows)}</td></tr>)}</tbody><tfoot><tr className="border-t font-bold"><th scope="row" className="p-2 text-left">January-October net change</th><td className="p-2 text-right">{count(summary.total)}</td></tr></tfoot></table></div>
    </div><details className="mt-4 nsi-ytd-screen-only print:hidden" data-page-activity-daily-history><summary className="cursor-pointer text-sm font-semibold">Inspect daily net and cumulative changes (screen only)</summary><div className="max-h-96 overflow-auto"><table className="w-full text-sm"><caption>{label}. Relative tracking baseline: zero.</caption><thead><tr><th scope="col">Date</th><th scope="col">Daily net</th><th scope="col">Cumulative net change</th></tr></thead><tbody>{summary.points.map(p => <tr key={p.date}><th scope="row">{p.date}</th><td className="text-right">{count(p.netFollows)}</td><td className="text-right">{count(p.cumulative)}</td></tr>)}</tbody></table></div></details>
  </section>;
}
