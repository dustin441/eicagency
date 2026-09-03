import {
  buildApprovedConfigRevision,
  type ActiveConfigRevision,
  type NormalizedConfigRevision,
} from './config-revision.ts';
import {
  normalizeClientEconomicsSettings,
  type ClientEconomicsSettingsPreview,
} from './economics-settings.ts';
import type { DeliveryModel } from './economics.ts';
import {
  normalizeNorthStarLanes,
  type NorthStarLane,
  type NorthStarLaneDirection,
  type NorthStarLaneEvaluation,
  type NorthStarLaneFormula,
} from './north-star-lanes.ts';

const INPUT_KEYS = [
  'clientId',
  'deliveryModel',
  'effectiveMonth',
  'monthlyBudget',
  'monthlyRetainer',
  'northStarLanes',
  'targetMarginPercent',
] as const;
const LANE_EDIT_KEYS = [
  'direction',
  'evaluation',
  'formula',
  'greenThreshold',
  'key',
  'label',
  'required',
  'weight',
  'yellowThreshold',
] as const;

export type ClientPortfolioLaneEdit = {
  key: string;
  label: string;
  formula: NorthStarLaneFormula;
  evaluation: NorthStarLaneEvaluation;
  required: boolean;
  weight: number;
  direction: NorthStarLaneDirection;
  greenThreshold: number;
  yellowThreshold: number;
};

export type ClientPortfolioSettingsInput = {
  clientId: string;
  effectiveMonth: string;
  monthlyRetainer: number;
  deliveryModel: DeliveryModel;
  targetMarginPercent: number;
  monthlyBudget: number | null;
  northStarLanes: ClientPortfolioLaneEdit[];
};

export type ClientPortfolioSettingsPreview = ClientEconomicsSettingsPreview & {
  monthlyBudget: number | null;
  northStarLanes: NorthStarLane[];
};

function exactObject(value: unknown, keys: readonly string[], field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${field} has an incompatible key set`);
  return value as Record<string, unknown>;
}

function normalizeMonthlyBudget(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000_000) {
    throw new Error('Monthly budget must be a bounded nonnegative number or null');
  }
  return Object.is(value, -0) ? 0 : value;
}

function laneKeySet(lanes: readonly { key: string }[]): string[] {
  return lanes.map(({ key }) => key).sort();
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertSupportedLaneSemantics(lane: ClientPortfolioLaneEdit, index: number): void {
  const supported = (lane.formula === 'cost_per_result'
    && (lane.evaluation === 'absolute_target' || lane.evaluation === 'period_over_period_change'))
    || (lane.formula === 'roas'
      && (lane.evaluation === 'absolute_target' || lane.evaluation === 'period_over_period_change'));
  if (!supported) throw new Error(`northStarLanes[${index}] formula and evaluation must use a supported pair`);
}

export function reviseClientPortfolioSettings(
  active: ActiveConfigRevision,
  input: ClientPortfolioSettingsInput,
): { revision: NormalizedConfigRevision; preview: ClientPortfolioSettingsPreview } {
  if (active.revision.content.schemaVersion !== 3) {
    throw new Error('Client portfolio settings require an active v3 revision');
  }
  const rawInput = exactObject(input, INPUT_KEYS, 'Client portfolio settings input');
  const economics = normalizeClientEconomicsSettings({
    clientId: rawInput.clientId as string,
    effectiveMonth: rawInput.effectiveMonth as string,
    monthlyRetainer: rawInput.monthlyRetainer as number,
    deliveryModel: rawInput.deliveryModel as DeliveryModel,
    targetMarginPercent: rawInput.targetMarginPercent as number,
  });
  const requestedMonthlyBudget = normalizeMonthlyBudget(rawInput.monthlyBudget);
  if (!Array.isArray(rawInput.northStarLanes)) throw new Error('North Star lane edits must be an array');

  const content = structuredClone(active.revision.content);
  const client = content.clients.find(({ clientId }) => clientId === economics.clientId);
  if (!client) throw new Error('Client is not present in the active revision');

  let northStarLanes: NorthStarLane[];
  let monthlyBudget: number | null;
  if (client.configStatus === 'configuration_required') {
    if (requestedMonthlyBudget !== null) throw new Error('Configuration-required clients cannot edit monthly budget');
    if (rawInput.northStarLanes.length !== 0) throw new Error('Configuration-required clients cannot edit North Star lanes');
    monthlyBudget = client.fixedValues.monthlyBudget;
    northStarLanes = [];
  } else {
    monthlyBudget = requestedMonthlyBudget;
    const laneEdits = rawInput.northStarLanes.map((candidate, index) => {
      const lane = exactObject(candidate, LANE_EDIT_KEYS, `northStarLanes[${index}]`) as ClientPortfolioLaneEdit;
      assertSupportedLaneSemantics(lane, index);
      return lane;
    });
    const existingByKey = new Map(client.northStarLanes.map((lane) => [lane.key, lane]));
    if (!sameStrings(laneKeySet(laneEdits), laneKeySet(client.northStarLanes))) {
      throw new Error('Approved clients require the exact reviewed lane key set');
    }
    northStarLanes = normalizeNorthStarLanes(laneEdits.map((lane, index) => {
      const existing = existingByKey.get(lane.key)!;
      if (lane.formula !== existing.formula || lane.direction !== existing.direction) {
        throw new Error(`northStarLanes[${index}] formula and direction are bound to the reviewed source contract`);
      }
      return {
        ...lane,
        sourceKeys: [...existing.sourceKeys],
      };
    }));
  }

  client.economics = {
    effectiveMonth: economics.effectiveMonth,
    monthlyRetainer: economics.monthlyRetainer,
    deliveryModel: economics.deliveryModel,
    fulfillmentHourlyCost: economics.fulfillmentHourlyCost,
    targetMarginPercent: economics.targetMarginPercent,
  };
  client.fixedValues = { monthlyBudget };
  client.northStarLanes = northStarLanes;

  const revision = buildApprovedConfigRevision(content);
  return {
    revision,
    preview: { ...economics, monthlyBudget, northStarLanes },
  };
}
