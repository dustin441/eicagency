'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { CheckCircle2, Loader2, Save } from 'lucide-react';
import { saveClientEconomicsSettings, type EconomicsSettingsActionState } from './actions';

const INITIAL_ECONOMICS_SETTINGS_STATE: EconomicsSettingsActionState = { status: 'idle', message: '' };

type Props = {
  client: {
    clientId: string;
    displayName: string;
    effectiveMonth: string;
    monthlyRetainer: number;
    deliveryModel: 'custom' | 'platform';
    fulfillmentHourlyCost: number;
    targetMarginPercent: number;
  };
};

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-forest px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-forest/90 disabled:cursor-wait disabled:opacity-60">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      {pending ? 'Activating…' : 'Save and activate'}
    </button>
  );
}

export default function ClientEconomicsSettingsForm({ client }: Props) {
  const [state, action] = useActionState(saveClientEconomicsSettings, INITIAL_ECONOMICS_SETTINGS_STATE);
  const [deliveryModel, setDeliveryModel] = useState(client.deliveryModel);
  const [retainer, setRetainer] = useState(String(client.monthlyRetainer));
  const [targetMargin, setTargetMargin] = useState(String(client.targetMarginPercent));
  const hourlyCost = deliveryModel === 'custom' ? 46 : 26;
  const allottedHours = useMemo(() => {
    const revenue = Number(retainer); const margin = Number(targetMargin);
    if (!Number.isFinite(revenue) || revenue < 0 || !Number.isFinite(margin) || margin < 0 || margin >= 100) return null;
    return revenue * ((100 - margin) / 100) / hourlyCost;
  }, [hourlyCost, retainer, targetMargin]);

  return (
    <form action={action} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="clientId" value={client.clientId} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">{client.displayName}</h2>
          <p className="mt-1 text-xs text-slate-500">Each save creates and activates a new immutable portfolio revision.</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Derived allotted hours</p>
          <p className="text-lg font-black tabular-nums text-emerald-900">{allottedHours === null ? 'Invalid' : number.format(allottedHours)}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-semibold text-slate-700">Effective month
          <input name="effectiveMonth" type="month" defaultValue={client.effectiveMonth.slice(0, 7)} required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal text-slate-900" />
        </label>
        <label className="text-sm font-semibold text-slate-700">Monthly retainer
          <input name="monthlyRetainer" type="number" min="0" max="1000000000" step="0.01" value={retainer} onChange={(event) => setRetainer(event.target.value)} required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal tabular-nums text-slate-900" />
        </label>
        <label className="text-sm font-semibold text-slate-700">Delivery model
          <select name="deliveryModel" value={deliveryModel} onChange={(event) => setDeliveryModel(event.target.value as 'custom' | 'platform')} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal text-slate-900">
            <option value="custom">Custom</option><option value="platform">Platform</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">Fulfillment hourly cost
          <input readOnly value={money.format(hourlyCost)} aria-describedby={`${client.clientId}-rate-help`} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal tabular-nums text-slate-600" />
          <span id={`${client.clientId}-rate-help`} className="mt-1 block text-[11px] font-normal text-slate-500">Fixed by delivery model.</span>
        </label>
        <label className="text-sm font-semibold text-slate-700">Target margin percent
          <input name="targetMarginPercent" type="number" min="0" max="99.99" step="0.01" value={targetMargin} onChange={(event) => setTargetMargin(event.target.value)} required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal tabular-nums text-slate-900" />
        </label>
        <label className="text-sm font-semibold text-slate-700 md:col-span-1 xl:col-span-3">Change reason
          <input name="reason" maxLength={1024} required placeholder="Why this retainer or delivery model changed" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal text-slate-900" />
        </label>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p aria-live="polite" className={state.status === 'error' ? 'text-sm font-semibold text-red-700' : 'inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700'}>
          {state.status === 'success' ? <CheckCircle2 className="h-4 w-4" /> : null}{state.message}
        </p>
        <SubmitButton />
      </div>
    </form>
  );
}
