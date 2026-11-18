import { aggregateEmailRows, customerEmailRows, emailCount, emailRate, type EmailCampaignRow, type EmailSnapshot } from '@/lib/nsi-ytd-email';

const th = 'px-3 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400';
const td = 'px-2 py-3 text-right text-xs tabular-nums';
function CampaignTable({ rows }: { rows: EmailCampaignRow[] }) {
  return <div className="nsi-ytd-email-table mt-4 overflow-x-auto rounded-xl border border-gray-100 focus-visible:outline-2 focus-visible:outline-brand-forest" role="region" aria-label="Campaign-associated email sends" tabIndex={0}>
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">Campaign-associated email sends, January 1 through October 31, 2026. Native campaign-group counts and rates.</caption>
      <thead className="border-b border-gray-100 bg-white"><tr><th scope="col" className={`${th} text-left`}>Product campaign</th>{['Sent', 'Delivered', 'Opens', 'Open rate', 'Clicks', 'Click rate', 'Unsubscribe rate'].map(label => <th scope="col" key={label} className={th}>{label}</th>)}</tr></thead>
      <tbody className="divide-y divide-gray-100">{rows.map(row => {
        const metrics = row.current!;
        return <tr key={row.guid} className="align-top hover:bg-gray-50/60">
          <th scope="row" className="nsi-ytd-email-label max-w-52 break-words px-2 py-3 text-xs font-semibold text-brand-dark">{metrics.campaign_name}{row.name === 'CON-CON-MCH' && <span className="mt-1 block text-[10px] font-normal text-gray-500">Email sends do not establish a paid-media launch</span>}</th>
          <td className={td}>{emailCount(metrics.total_sent)}</td><td className={td}>{emailCount(metrics.total_delivered)}</td><td className={td}>{emailCount(metrics.unique_opened)}</td><td className={td}>{emailRate(metrics.unique_open_rate)}</td><td className={td}>{emailCount(metrics.unique_clicked)}</td><td className={td}>{emailRate(metrics.unique_click_rate)}</td><td className={td}>{emailRate(metrics.unsubscribe_rate)}</td>
        </tr>;
      })}{!rows.length && <tr><td colSpan={8} className="p-4 text-sm text-gray-500">No qualifying current-year product campaign sends were returned.</td></tr>}</tbody>
    </table>
  </div>;
}

/** Standalone protected-snapshot presentation, independent of the financial-family selector. */
export default function NsiYtdEmailSection({ data: snapshot }: { data: EmailSnapshot }) {
  const rows = customerEmailRows(snapshot.rows);
  const current = aggregateEmailRows(rows, 'current');
  return <section className="nsi-ytd-email-section rounded-2xl border border-gray-100 bg-white p-6 shadow-sm" aria-labelledby="nsi-ytd-email-title">
    <h2 id="nsi-ytd-email-title" className="text-sm font-extrabold uppercase tracking-widest text-gray-500">Campaign-associated email performance</h2>
    <p className="mt-1 text-sm leading-relaxed text-gray-600">Jan-Oct 2026 sends associated with selected contractor and end-user product campaigns. Known internal EZL and other campaign scopes are excluded from both the headline and table. These are campaign-associated sends, not a verified customer-only audience. A draft asset alone does not establish a send. This section is independent of financial-family selection.</p>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">{[{ label: 'Sent', value: current.sent }, { label: 'Delivered', value: current.delivered }].map(card => <div key={card.label} className="rounded-xl border border-gray-100 bg-gray-50/60 p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{card.label}</p><p className="mt-2 text-2xl font-black text-brand-forest tabular-nums">{emailCount(card.value)}</p><p className="mt-2 text-[11px] text-gray-500">Sum of the selected campaign groups below, not unique people.</p></div>)}</div>
    <p className="mt-4 text-xs leading-relaxed text-gray-600">Sent and delivered are native message counts. Opens and clicks are native campaign-group unique counts, not deduplicated people across campaigns, qualified leads or paid-media attribution. Campaign-level scope does not independently verify each recipient or distinguish every automated follow-up.</p>
    <p className="mt-2 text-xs leading-relaxed text-gray-500">Open rate is native unique opens / delivered; click rate is native unique clicks / delivered, not click-to-open. Unsubscribe rate is the native HubSpot campaign-group rate, not reconstructed without its underlying count and denominator. Native rates are preserved, never averaged. Missing metrics are N/A, not zero. No prior-year comparison is imposed on a changing campaign mix.</p>
    <CampaignTable rows={rows} />
    <details className="nsi-ytd-appendix mt-3 text-xs text-gray-500"><summary className="cursor-pointer font-semibold">Source scope and reconciliation</summary><p className="mt-2 leading-relaxed">Only the protected native campaign-group snapshot is used. Portal-wide controls and overlapping asset cohorts have different scopes and are not forced to reconcile here. Prior-year-only groups are omitted. <a href="https://app.hubspot.com/email/20940542/analyze?rangeType=CUSTOM&startDate=20260101&endDate=20261031" target="_blank" rel="noreferrer" className="underline">Open native HubSpot email reporting</a>.</p></details>
    <p className="mt-4 break-words text-[11px] leading-relaxed text-gray-500">Source: HubSpot native campaign-grouped report, {snapshot.periods.current.startDate} to {snapshot.periods.current.endDate}. Extracted {snapshot.extractedAt}. These selected campaign groups are not the whole portal or a recipient-level customer audit.</p>
  </section>;
}
