import {
  buildApprovedConfigRevision,
  type ActiveConfigRevision,
  type NormalizedConfigRevision,
} from './config-revision.ts';
import {
  calculateMonthlyAllottedHours,
  DEFAULT_FULFILLMENT_HOURLY_COST,
  type DeliveryModel,
} from './economics.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MONTH = /^\d{4}-(?:0[1-9]|1[0-2])-01$/;

export type ClientEconomicsSettingsInput = {
  clientId: string;
  effectiveMonth: string;
  monthlyRetainer: number;
  deliveryModel: DeliveryModel;
  targetMarginPercent: number;
};

export type ClientEconomicsSettingsPreview = ClientEconomicsSettingsInput & {
  fulfillmentHourlyCost: number;
  monthlyAllottedHours: number;
};

export function normalizeClientEconomicsSettings(input: ClientEconomicsSettingsInput): ClientEconomicsSettingsPreview {
  if (!UUID.test(input.clientId)) throw new Error('Client ID must be a canonical UUID');
  if (!MONTH.test(input.effectiveMonth) || Number.isNaN(Date.parse(`${input.effectiveMonth}T00:00:00.000Z`))) {
    throw new Error('Effective month must be the first day of a valid month');
  }
  if (!Number.isFinite(input.monthlyRetainer) || input.monthlyRetainer < 0 || input.monthlyRetainer > 1_000_000_000) {
    throw new Error('Monthly retainer must be a bounded nonnegative number');
  }
  if (input.deliveryModel !== 'custom' && input.deliveryModel !== 'platform') throw new Error('Delivery model must be custom or platform');
  if (!Number.isFinite(input.targetMarginPercent) || input.targetMarginPercent < 0 || input.targetMarginPercent >= 100) {
    throw new Error('Target margin percent must be between 0 and 100');
  }
  const fulfillmentHourlyCost = DEFAULT_FULFILLMENT_HOURLY_COST[input.deliveryModel];
  const monthlyAllottedHours = calculateMonthlyAllottedHours({
    monthlyRetainer: input.monthlyRetainer,
    fulfillmentHourlyCost,
    targetMarginPercent: input.targetMarginPercent,
  });
  if (monthlyAllottedHours === null) throw new Error('Monthly allotted hours could not be derived');
  return { ...input, fulfillmentHourlyCost, monthlyAllottedHours };
}

export function reviseClientEconomics(
  active: ActiveConfigRevision,
  input: ClientEconomicsSettingsInput,
): { revision: NormalizedConfigRevision; preview: ClientEconomicsSettingsPreview } {
  if (active.revision.content.schemaVersion !== 3) throw new Error('Client economics settings require an active v3 revision');
  const preview = normalizeClientEconomicsSettings(input);
  const content = structuredClone(active.revision.content);
  const client = content.clients.find(({ clientId }) => clientId === preview.clientId);
  if (!client) throw new Error('Client is not present in the active revision');
  client.economics = {
    effectiveMonth: preview.effectiveMonth,
    monthlyRetainer: preview.monthlyRetainer,
    deliveryModel: preview.deliveryModel,
    fulfillmentHourlyCost: preview.fulfillmentHourlyCost,
    targetMarginPercent: preview.targetMarginPercent,
  };
  return { revision: buildApprovedConfigRevision(content), preview };
}
