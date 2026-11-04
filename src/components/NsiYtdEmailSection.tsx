import { aggregateEmailRows, emailChangeLabel, emailCount, emailRate, partitionEmailRows, type EmailCampaignRow, type EmailSnapshot } from '@/lib/nsi-ytd-email';

const th = 'px-2 py-3 text-right text-[10px] font-bold text-gray-500';
const td = 'px-2 py-3 text-right text-xs tabular-nums';
function CampaignTable({ rows, historical = false }: { rows: EmailCampaignRow[]; historical?: boolean }) {
  return <div className="nsi-ytd-email-table mt-4 overflow-x-auto rounded-xl border border-gray-100 focus-visible:outline-2 focus-visible:outline-brand-forest" role="region" aria-label={historical ? 'Historical-only product campaign email activity' : 'Product campaign email activity'} tabIndex={0}>
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">Native HubSpot campaign-group activity, January 1 through October 31. Sent is shown for both years; delivered, opens, rates and clicks are {historical ? '2025' : '2026'}.</caption>
      <thead className="bg-gray-50"><tr><th scope="col" className={`${th} text-left`}>Product campaign</th>{['Sent 2026', 'Sent 2025', 'Send change', `Delivered ${historical ? '2025' : '2026'}`, 'Opens', 'Open rate', 'Clicks', 'Click rate', 'Unsubscribe rate'].map(label => <th scope="col" key={label} className={th}>{label}</th>)}</tr></thead>
      <tbody className="divide-y divide-gray-100">{rows.map(row => {
        const metrics = historical ? row.previous : row.current;
        return <tr key={row.guid} className="align-top hover:bg-gray-50/60">
          <th scope="row" className="nsi-ytd-email-label max-w-52 break-words px-2 py-3 text-xs font-semibold text-brand-dark">
            {metrics?.campaign_name ?? row.name}
            {!row.previous && <span className="mt-1 block text-[10px] font-normal text-gray-500">Prior group not returned</span>}
            {historical && <span className="mt-1 block text-[10px] font-normal text-gray-500">Current group not returned</span>}
            {row.name === 'CCF-END-EZL' && <span className="mt-1 block text-[10px] font-normal text-amber-800">Internal-associated activity</span>}
            {row.name === 'CON-CON-MCH' && <span className="mt-1 block text-[10px] font-normal text-gray-500">Email activity does not establish a paid-media launch</span>}
          </th>
          <td className={td}>{emailCount(row.current?.total_sent ?? null)}</td><td className={td}>{emailCount(row.previous?.total_sent ?? null)}</td><td className={td}>{emailChangeLabel(row.current?.total_sent ?? null, row.previous?.total_sent ?? null)}</td>
          <td className={td}>{emailCount(metrics?.total_delivered ?? null)}</td><td className={td}>{emailCount(metrics?.unique_opened ?? null)}</td><td className={td}>{emailRate(metrics?.unique_open_rate ?? null)}</td><td className={td}>{emailCount(metrics?.unique_clicked ?? null)}</td><td className={td}>{emailRate(metrics?.unique_click_rate ?? null)}</td><td className={td}>{emailRate(metrics?.unsubscribe_rate ?? null)}</td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}

/** Standalone snapshot section. Deliberately independent of the financial-family selector. */
export default function NsiYtdEmailSection({ data: snapshot }: { data: EmailSnapshot }) {
  const rows: EmailCampaignRow[] = snapshot.rows;
  const groups = partitionEmailRows(rows);
  const current = aggregateEmailRows(rows, 'current');
  const previous = aggregateEmailRows(rows, 'previous');
  return <section className="nsi-ytd-email-section rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="nsi-ytd-email-title">
    <h2 id="nsi-ytd-email-title" className="text-lg font-extrabold tracking-tight text-brand-dark">Campaign email performance</h2>
    <p className="mt-1 text-sm leading-relaxed text-gray-600">HubSpot email activity associated with product campaigns, Jan-Oct 2026 vs Jan-Oct 2025. Exact CCF-, CON- and NEL- campaign groups only, not the whole portal. This section always shows all selected product campaigns, independently of financial-family selection.</p>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">{[{ label: 'Sent', current: current.sent, previous: previous.sent }, { label: 'Delivered', current: current.delivered, previous: previous.delivered }].map(card => <div key={card.label} className="rounded-xl border border-gray-100 bg-gray-50/60 p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{card.label}</p><p className="mt-2 text-2xl font-black text-brand-forest tabular-nums">{emailCount(card.current)}</p><p className="mt-2 text-xs text-gray-600">2025: {emailCount(card.previous)} · {emailChangeLabel(card.current, card.previous)} change</p><p className="mt-1 text-[11px] text-gray-500">Sum of returned native campaign groups; different campaign mix.</p></div>)}</div>
    <p className="mt-4 text-xs leading-relaxed text-gray-600">Groups may include internal, sales/rep, test and automated follow-up activity. EZL is specifically flagged internal-associated, not verified external outreach. Opens and clicks are native campaign-group counts, not deduplicated people or qualified leads. Do not add them across campaigns as unique audience totals or treat them as paid-media attribution.</p>
    <p className="mt-2 text-xs leading-relaxed text-gray-500">Current table: 2026 metrics, with 2025 sent for context. Open rate is native opens / delivered. Click rate is native clicks / delivered, distinct from click-to-open. Native rates are preserved, not averaged. Missing groups are N/A, not zero; send change requires a positive prior baseline. Campaign mix changed, so totals are not a like-for-like cohort comparison.</p>
    <CampaignTable rows={groups.current} />
    <details className="nsi-ytd-email-history mt-4 rounded-xl border border-gray-100">
      <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-brand-forest">Historical-only campaign groups ({groups.historical.length})</summary>
      <div className="px-3 pb-3"><p className="text-xs text-gray-500">These groups were returned only in 2025. Their delivered, opens, clicks and rates below are 2025 metrics; absence in 2026 is not a verified zero.</p><CampaignTable rows={groups.historical} historical /></div>
    </details>
    <details className="mt-3 text-xs text-gray-500"><summary className="cursor-pointer font-semibold">Source scope and reconciliation</summary><p className="mt-2 leading-relaxed">The separate portal-wide 2025 email-list control differs from its overview; that discrepancy is unresolved. Opens and clicks also differ between some portal-level report views. Those other-scope totals and current metadata remapping are not used here. The native grouped campaign rows were checked independently and have not been adjusted to force portal-wide reconciliation. <a href="https://app.hubspot.com/email/20940542/analyze?rangeType=CUSTOM&startDate=20260101&endDate=20261031" target="_blank" rel="noreferrer" className="underline">Open native HubSpot email reporting</a>.</p></details>
    <p className="mt-4 break-words text-[11px] leading-relaxed text-gray-500">Source: HubSpot native campaign-grouped report, {snapshot.periods.current.startDate} to {snapshot.periods.current.endDate}, compared with {snapshot.periods.previous.startDate} to {snapshot.periods.previous.endDate}. Extracted {snapshot.extractedAt}. Native grouped rows are not interchangeable with overlapping campaign-filtered asset cohorts or current campaign metadata. Separate portal-wide email-list controls remain outside this section.</p>
  </section>;
}
