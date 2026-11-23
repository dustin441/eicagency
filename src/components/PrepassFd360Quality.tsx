import { fmtNumber } from '@/lib/utils';
import type { Fd360Quality } from '@/services/prepass-segment-report';

const money = (n: number | null) => (n == null ? '—' : `$${Math.round(n).toLocaleString('en-US')}`);
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((100 * n) / d)}%` : '—');

// FD360 leads move into HubSpot, so MQL, SQL and won are not visible. Cost per lead is the main number.
// Quality is read from Marketo's own Disqualified status, using only leads at least 14 days old so each had time to be reviewed.
export default function PrepassFd360Quality({ q, spend, compQ, compSpend }: { q: Fd360Quality | null; spend: number; compQ?: Fd360Quality | null; compSpend?: number }) {
  if (!q || q.leads === 0) return null;
  const cpl = q.leads > 0 && spend > 0 ? spend / q.leads : null;
  const rate = q.matured_leads >= 10 ? 1 - q.matured_disqualified / q.matured_leads : null;
  const qualifiedEst = rate != null ? q.leads * rate : null;
  const cpq = qualifiedEst && spend > 0 ? spend / qualifiedEst : null;
  const prevCpl = compQ && compQ.leads > 0 && compSpend && compSpend > 0 ? compSpend / compQ.leads : null;
  const tiles: { label: string; value: string; note?: string }[] = [
    { label: 'Leads', value: fmtNumber(q.leads) },
    { label: 'Cost per lead', value: money(cpl), note: prevCpl != null ? `${money(prevCpl)} in the comparison period` : undefined },
    { label: 'Not disqualified', value: rate != null ? `${Math.round(rate * 100)}%` : '—', note: rate != null ? `of ${fmtNumber(q.matured_leads)} leads at least 14 days old` : 'Too few leads old enough to judge' },
    { label: 'Cost per not-disqualified lead', value: money(cpq), note: 'Estimate: spend divided by leads times the rate on the left' },
  ];
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-gray-950">FD360 lead quality</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
        FD360 leads are passed to HubSpot, so MQL, SQL and closed won are not visible here. Cost per lead is the main number. Quality comes from Marketo&apos;s own Disqualified status, so it is the best read on lead quality we have.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => (
          <article key={t.label} className="rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t.label}</p>
            <p className="mt-1 text-2xl font-semibold text-gray-950">{t.value}</p>
            {t.note && <p className="mt-1 text-xs leading-5 text-gray-500">{t.note}</p>}
          </article>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-gray-500">
        Of {fmtNumber(q.leads)} leads: {fmtNumber(q.disqualified)} disqualified ({pct(q.disqualified, q.leads)}), {fmtNumber(q.still_open)} still open, {fmtNumber(q.advanced)} moved forward, {fmtNumber(q.won)} closed won in Marketo. Open leads may still be disqualified later, so the not-disqualified rate can only fall.
      </p>
    </section>
  );
}
