'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { CheckCircle2, Loader2, LockKeyhole, Save, Target } from 'lucide-react';
import { saveClientEconomicsSettings, type EconomicsSettingsActionState } from './actions';

const INITIAL_ECONOMICS_SETTINGS_STATE: EconomicsSettingsActionState = { status: 'idle', message: '' };

type EditableLane = {
  key: string;
  label: string;
  formula: 'cost_per_result' | 'roas';
  evaluation: 'period_over_period_change' | 'absolute_target';
  required: boolean;
  weight: number;
  direction: 'lower_is_better' | 'higher_is_better';
  greenThreshold: number;
  yellowThreshold: number;
};

type Props = {
  client: {
    clientId: string;
    displayName: string;
    configStatus: 'approved' | 'configuration_required';
    effectiveMonth: string;
    monthlyRetainer: number;
    monthlyBudget: number | null;
    deliveryModel: 'custom' | 'platform';
    fulfillmentHourlyCost: number;
    targetMarginPercent: number;
    northStarLanes: EditableLane[];
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

function thresholdLabel(lane: EditableLane, healthy: boolean): string {
  if (lane.evaluation === 'period_over_period_change') return `${healthy ? 'Healthy' : 'Watch'} change %`;
  if (lane.direction === 'lower_is_better') return `${healthy ? 'Healthy' : 'Watch'} ceiling`;
  return `${healthy ? 'Healthy' : 'Watch'} floor`;
}

function semanticLabel(lane: EditableLane): string {
  const formula = lane.formula === 'roas' ? 'Revenue ÷ spend' : 'Spend ÷ results';
  const direction = lane.direction === 'higher_is_better' ? 'higher is better' : 'lower is better';
  return `${formula}, ${direction}`;
}

export default function ClientEconomicsSettingsForm({ client }: Props) {
  const [state, action] = useActionState(saveClientEconomicsSettings, INITIAL_ECONOMICS_SETTINGS_STATE);
  const [deliveryModel, setDeliveryModel] = useState(client.deliveryModel);
  const [retainer, setRetainer] = useState(String(client.monthlyRetainer));
  const [targetMargin, setTargetMargin] = useState(String(client.targetMarginPercent));
  const [lanes, setLanes] = useState(client.northStarLanes);
  const hourlyCost = deliveryModel === 'custom' ? 46 : 26;
  const allottedHours = useMemo(() => {
    const revenue = Number(retainer); const margin = Number(targetMargin);
    if (!Number.isFinite(revenue) || revenue < 0 || !Number.isFinite(margin) || margin < 0 || margin >= 100) return null;
    return revenue * ((100 - margin) / 100) / hourlyCost;
  }, [hourlyCost, retainer, targetMargin]);
  const approved = client.configStatus === 'approved';

  const updateLane = <K extends keyof EditableLane>(index: number, key: K, value: EditableLane[K]) => {
    setLanes((current) => current.map((lane, laneIndex) => laneIndex === index ? { ...lane, [key]: value } : lane));
  };

  return (
    <form action={action} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="clientId" value={client.clientId} />
      <input type="hidden" name="northStarLaneCount" value={lanes.length} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-black text-slate-900">{client.displayName}</h2>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${approved ? 'bg-emerald-100 text-emerald-800' : 'bg-violet-100 text-violet-800'}`}>
              {approved ? 'Source ready' : 'Pre-launch'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Each save creates and activates a new immutable portfolio revision.</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Derived allotted hours</p>
          <p className="text-lg font-black tabular-nums text-emerald-900">{allottedHours === null ? 'Invalid' : number.format(allottedHours)}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <label className="text-sm font-semibold text-slate-700">Effective month
          <input name="effectiveMonth" type="month" defaultValue={client.effectiveMonth.slice(0, 7)} required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal text-slate-900" />
        </label>
        <label className="text-sm font-semibold text-slate-700">Monthly retainer
          <input name="monthlyRetainer" type="number" min="0" max="1000000000" step="0.01" value={retainer} onChange={(event) => setRetainer(event.target.value)} required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal tabular-nums text-slate-900" />
        </label>
        <label className="text-sm font-semibold text-slate-700">Monthly media budget
          <input name="monthlyBudget" type="number" min="0" max="1000000000" step="0.01" defaultValue={client.monthlyBudget ?? ''} disabled={!approved} placeholder={approved ? 'Optional' : 'Available after launch'} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal tabular-nums text-slate-900 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-500" />
        </label>
        <label className="text-sm font-semibold text-slate-700">Delivery model
          <select name="deliveryModel" value={deliveryModel} onChange={(event) => setDeliveryModel(event.target.value as 'custom' | 'platform')} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal text-slate-900">
            <option value="custom">Custom</option><option value="platform">Platform</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">Target margin percent
          <input name="targetMarginPercent" type="number" min="0" max="99.99" step="0.01" value={targetMargin} onChange={(event) => setTargetMargin(event.target.value)} required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal tabular-nums text-slate-900" />
        </label>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">Fulfillment cost is locked by model at {money.format(hourlyCost)}/hour. The monthly budget is the top-level Client Health pacing budget; campaign or product splits remain in the client dashboard.</p>

      {approved ? (
        <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center gap-2"><Target className="h-4 w-4 text-brand-forest" /><h3 className="text-sm font-black text-slate-900">North Star settings</h3></div>
          <p className="mt-1 text-xs text-slate-500">Targets and trend rules are editable. Metric formulas and source meaning are locked to reviewed data contracts.</p>
          <div className="mt-4 space-y-4">
            {lanes.map((lane, index) => {
              const prefix = `northStarLane${index}`;
              return (
                <div key={lane.key} className="rounded-xl border border-slate-200 bg-white p-4">
                  <input type="hidden" name={`${prefix}Key`} value={lane.key} />
                  <input type="hidden" name={`${prefix}Formula`} value={lane.formula} />
                  <input type="hidden" name={`${prefix}Direction`} value={lane.direction} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600"><LockKeyhole className="h-3 w-3" />{semanticLabel(lane)}</span>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <input name={`${prefix}Required`} type="checkbox" value="true" checked={lane.required} onChange={(event) => updateLane(index, 'required', event.target.checked)} className="rounded border-slate-300" />Required lane
                    </label>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <label className="text-xs font-bold text-slate-700 xl:col-span-2">Display label
                      <input name={`${prefix}Label`} value={lane.label} onChange={(event) => updateLane(index, 'label', event.target.value)} maxLength={120} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-900" />
                    </label>
                    <label className="text-xs font-bold text-slate-700">Evaluation
                      <select name={`${prefix}Evaluation`} value={lane.evaluation} onChange={(event) => updateLane(index, 'evaluation', event.target.value as EditableLane['evaluation'])} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-900">
                        <option value="period_over_period_change">Period trend</option>
                        <option value="absolute_target">Fixed target</option>
                      </select>
                    </label>
                    <label className="text-xs font-bold text-slate-700">{thresholdLabel(lane, true)}
                      <input name={`${prefix}GreenThreshold`} type="number" step="0.01" value={lane.greenThreshold} onChange={(event) => updateLane(index, 'greenThreshold', Number(event.target.value))} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal tabular-nums text-slate-900" />
                    </label>
                    <label className="text-xs font-bold text-slate-700">{thresholdLabel(lane, false)}
                      <input name={`${prefix}YellowThreshold`} type="number" step="0.01" value={lane.yellowThreshold} onChange={(event) => updateLane(index, 'yellowThreshold', Number(event.target.value))} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal tabular-nums text-slate-900" />
                    </label>
                    <label className="text-xs font-bold text-slate-700">Weight
                      <input name={`${prefix}Weight`} type="number" min="0.01" max="100" step="0.01" value={lane.weight} onChange={(event) => updateLane(index, 'weight', Number(event.target.value))} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal tabular-nums text-slate-900" />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">
          Performance settings remain locked until this client has a reviewed source contract. Economics can be maintained now without inventing performance data.
        </div>
      )}

      <label className="mt-5 block text-sm font-semibold text-slate-700">Change reason
        <input name="reason" maxLength={1024} required placeholder="Why these economics, budget, or North Star settings changed" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal text-slate-900" />
      </label>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p aria-live="polite" className={state.status === 'error' ? 'text-sm font-semibold text-red-700' : 'inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700'}>
          {state.status === 'success' ? <CheckCircle2 className="h-4 w-4" /> : null}{state.message}
        </p>
        <SubmitButton />
      </div>
    </form>
  );
}
