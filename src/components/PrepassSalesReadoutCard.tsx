'use client';

import { useActionState } from 'react';
import { cn } from '@/lib/utils';
import type { SalesNote, SalesReadout } from '@/services/prepass-sales-overview';
import { addSalesNote, type SalesNoteState } from '@/app/dashboard/reporting-v2/sales-overview/actions';

const KIND_LABEL: Record<SalesNote['kind'], string> = { test: 'Test', change: 'Change', note: 'Note' };
const KIND_STYLE: Record<SalesNote['kind'], string> = {
  test: 'bg-amber-50 text-amber-800 border-amber-200',
  change: 'bg-blue-50 text-blue-800 border-blue-200',
  note: 'bg-gray-50 text-gray-700 border-gray-200',
};

function monthLabel(start: string) {
  const d = new Date(`${start}T00:00:00`);
  return Number.isNaN(d.getTime()) ? start : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function dayLabel(v: string) {
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Bullets({ items, dot }: { items: string[]; dot: string }) {
  return (
    <ul className="space-y-2">
      {items.map((t, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm leading-6 text-gray-700">
          <span className={cn('mt-2 h-1.5 w-1.5 shrink-0 rounded-full', dot)} />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function Column({ title, items, tone, dot }: { title: string; items: string[]; tone: string; dot: string }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden">
      <div className={cn('border-b px-4 py-2 text-xs font-bold uppercase tracking-wide', tone)}>{title}</div>
      <div className="p-4"><Bullets items={items} dot={dot} /></div>
    </div>
  );
}

function NoteForm() {
  const [state, action, pending] = useActionState<SalesNoteState, FormData>(addSalesNote, { ok: false, message: '' });
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="space-y-3">
      <textarea
        name="body"
        required
        maxLength={2000}
        rows={3}
        placeholder="What did you test or change? For example: moved Meta budget to Google, paused the Tolls list, started a new landing page."
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm leading-6 text-gray-900 placeholder:text-gray-400 focus:border-brand-forest focus:outline-none focus:ring-1 focus:ring-brand-forest"
      />
      <div className="flex flex-wrap items-center gap-3">
        <select name="kind" defaultValue="test" className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
          <option value="test">Test</option>
          <option value="change">Change</option>
          <option value="note">Note</option>
        </select>
        <input type="date" name="note_date" defaultValue={today} required className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700" />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {pending ? 'Saving...' : 'Add to log'}
        </button>
        {state.message && (
          <span role="status" className={cn('text-sm', state.ok ? 'text-emerald-700' : 'text-red-700')}>{state.message}</span>
        )}
      </div>
    </form>
  );
}

export default function PrepassSalesReadoutCard({
  readout,
  notes,
  canEdit,
}: {
  readout: SalesReadout | null;
  notes: SalesNote[];
  canEdit: boolean;
}) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-950">Monthly readout: what is working, what is not, what to do next</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            Written from the data warehouse each month and shaped by what the team logs below.
            {readout ? ` Latest: ${monthLabel(readout.month_start)}, written ${dayLabel(readout.generated_at.slice(0, 10))}.` : ''}
          </p>
        </div>
      </div>

      {readout ? (
        <>
          <div className="mt-4 rounded-xl bg-gray-50 p-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">The short version</p>
            <Bullets items={readout.summary} dot="bg-brand-forest" />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Column title="Working" items={readout.working} tone="bg-emerald-50 border-emerald-100 text-emerald-800" dot="bg-emerald-500" />
            <Column title="Not working" items={readout.not_working} tone="bg-red-50 border-red-100 text-red-800" dot="bg-red-500" />
            <Column title="What we tested and changed" items={readout.tested} tone="bg-amber-50 border-amber-100 text-amber-800" dot="bg-amber-500" />
            <Column title="Do next month" items={readout.do_next} tone="bg-brand-forest/5 border-brand-forest/10 text-brand-forest" dot="bg-brand-forest" />
          </div>
          {readout.watch_out.length > 0 && (
            <div className="mt-4 rounded-xl border border-gray-100 p-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Read these numbers with care</p>
              <Bullets items={readout.watch_out} dot="bg-gray-400" />
            </div>
          )}
        </>
      ) : (
        <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">The first monthly readout has not been written yet.</p>
      )}

      <div className="mt-6 border-t border-gray-100 pt-5">
        <h3 className="text-sm font-semibold text-gray-950">What did we test or change?</h3>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-500">
          Log launches, budget moves, new pages, list changes and tests here. The readout reads this log, so it can tell you what the change did.
        </p>
        <div className="mt-3">
          {canEdit ? <NoteForm /> : <p className="text-xs text-gray-500">Only the agency team can add to this log.</p>}
        </div>
        {notes.length > 0 && (
          <ul className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-100">
            {notes.map((n) => (
              <li key={n.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                <span className="w-14 shrink-0 text-xs font-semibold text-gray-500">{dayLabel(n.note_date)}</span>
                <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold', KIND_STYLE[n.kind])}>{KIND_LABEL[n.kind]}</span>
                <span className="leading-6 text-gray-700">{n.body}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
