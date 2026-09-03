import 'server-only';

import type { AdapterContext } from './adapters/types.ts';
import { createApprovedProductionClickUpAdapter } from './adapters/clickup-production.ts';
import { createApprovedProductionSupabaseAdapter } from './adapters/supabase-production.ts';
import type { CompletedSourceAdapterResult, SnapshotSourceBinding } from './build-snapshot.ts';
import {
  normalizeActiveConfigRevision,
  projectV3ClientEconomics,
  type ConfigRevisionMetric,
  type ConfigRevisionSourceBinding,
} from './config-revision.ts';
import { assertDateOnly, comparisonWindows, phoenixMonthWindow } from './date-windows.ts';
import type {
  ClientRefreshPlan,
  MaterializedRefreshPlan,
  RefreshPlanMaterializer,
  SourceCollectorContext,
} from './run-refresh.ts';

const COMPARISON_DAYS = 14;
const compareCodeUnits = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
type Adapter = (context: AdapterContext) => Promise<unknown>;

export type ProductionAdapterFactories = {
  createSupabase(adapterKey: string): Adapter;
  createClickUp(clientKey: string, contractVersion: string): Adapter;
};

const productionFactories: ProductionAdapterFactories = {
  createSupabase: createApprovedProductionSupabaseAdapter,
  createClickUp: createApprovedProductionClickUpAdapter,
};

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function retrievedAtForSnapshot(snapshotDate: string): string {
  return `${addDays(snapshotDate, 1)}T07:00:00.000Z`;
}

function engineMetrics(metrics: ConfigRevisionMetric[]) {
  return metrics.map(({ key, required, weight, direction, greenThreshold, yellowThreshold, sourceKeys }) => ({
    key,
    required,
    weight,
    direction,
    greenThreshold,
    yellowThreshold,
    sourceKeys: [...sourceKeys],
  }));
}

function expectedDataThrough(snapshotDate: string, maximumLagDays: number): string {
  return addDays(snapshotDate, -maximumLagDays);
}

function bindingFor(source: ConfigRevisionSourceBinding, snapshotDate: string): SnapshotSourceBinding {
  const common = {
    sourceKey: source.sourceKey,
    requestFingerprint: source.requestFingerprint,
    permittedValueFields: [...source.permittedFactFields],
    permitsTasks: source.provider === 'clickup' && source.permitsTasks,
    expectedDataThrough: expectedDataThrough(snapshotDate, source.freshnessPolicy.maximumLagDays),
  };
  if (source.provider === 'supabase') {
    return { ...common, provider: 'supabase', project: source.project, relation: source.relation };
  }
  if (source.provider === 'clickup') {
    return { ...common, provider: 'clickup', endpointFamily: source.endpointFamily };
  }
  throw new Error('Unsupported production source provider');
}


function adapterContext(context: SourceCollectorContext): AdapterContext {
  return {
    clientKey: context.clientKey,
    timezone: 'America/Phoenix',
    retrievedAt: context.retrievedAt,
    lastCompleteDate: context.snapshotDate,
    windows: {
      month: context.phoenix.month,
      current: context.phoenix.current,
      previous: context.phoenix.previous,
    },
    sourceContractVersion: context.sourceContractVersion,
    signal: context.signal,
  };
}

function collector(
  source: ConfigRevisionSourceBinding,
  clientKey: string,
  contractVersion: string,
  phoenix: { month: { start: string; end: string }; previous: { start: string; end: string } },
  factories: ProductionAdapterFactories,
) {
  const approvedAdapterKey = `${clientKey}.${source.sourceKey}`;
  let adapter: Adapter;
  let windowStart: string;
  if (source.provider === 'supabase') {
    adapter = factories.createSupabase(approvedAdapterKey);
    windowStart = phoenix.previous.start < phoenix.month.start ? phoenix.previous.start : phoenix.month.start;
  } else if (source.provider === 'clickup') {
    adapter = factories.createClickUp(clientKey, contractVersion);
    windowStart = phoenix.month.start;
  } else {
    throw new Error('Unsupported production source provider');
  }
  return {
    sourceKey: source.sourceKey,
    windowStart,
    windowEnd: phoenix.month.end,
    async collect(context: SourceCollectorContext): Promise<CompletedSourceAdapterResult> {
      return await adapter(adapterContext(context)) as CompletedSourceAdapterResult;
    },
  };
}

export function createProductionClientHealthRefreshPlanner(
  factories: ProductionAdapterFactories = productionFactories,
): RefreshPlanMaterializer {
  return {
    materializePlan(activeRevision, snapshotDate): MaterializedRefreshPlan {
      assertDateOnly(snapshotDate, 'snapshotDate');
      const active = normalizeActiveConfigRevision(activeRevision);
      const revision = active.revision;
      const month = phoenixMonthWindow(snapshotDate);
      const comparison = comparisonWindows(snapshotDate, COMPARISON_DAYS);
      const phoenix = {
        month: { start: month.start, end: month.end },
        current: comparison.current,
        previous: comparison.previous,
        elapsedMonthDays: month.elapsedDays,
        daysInMonth: month.daysInMonth,
        comparisonDays: COMPARISON_DAYS,
      };
      const retrievedAt = retrievedAtForSnapshot(snapshotDate);
      const clients: ClientRefreshPlan[] = revision.content.clients.map((client) => {
        const display = {
          clientId: client.clientId,
          clientKey: client.clientKey,
          displayName: client.displayName,
          dashboardHref: client.dashboardHref,
          reportingTimezone: client.reportingTimezone,
          clickupListIds: [...client.clickupListIds],
          marginAliases: [...client.marginAliases],
          configStatus: client.configStatus,
        };
        const v3 = 'economics' in client;
        const fixedValues = v3 ? projectV3ClientEconomics(client).fixedValues : client.fixedValues;
        if (client.configStatus === 'configuration_required') {
          return {
            display,
            metricConfig: [],
            collectors: [],
            assemblyInput: {
              clientId: client.clientId,
              clientKey: client.clientKey,
              configApproved: false,
              calculationVersion: revision.content.calculationVersion,
              sourceContractVersion: revision.content.sourceContractVersion,
              snapshotDate,
              retrievedAt,
              phoenix,
              metricConfig: [],
              requiredSourceKeys: [],
              optionalSourceKeys: [],
              sourceBindings: {},
              fixedValues: { monthlyBudget: null, monthlyHoursAllotment: null },
              sourceResults: [],
              ...(v3 ? { northStarLanes: [] } : {}),
            },
          };
        }
        if (v3 && client.economics.effectiveMonth !== `${snapshotDate.slice(0, 7)}-01`) {
          throw new Error('V3 economics effective month does not match snapshotDate');
        }
        const sources = [...client.sources].sort((left, right) => compareCodeUnits(left.sourceKey, right.sourceKey));
        const sourceBindings = Object.fromEntries(sources.map((source) => [source.sourceKey, bindingFor(source, snapshotDate)]));
        const requiredSourceKeys = sources
          .filter((source) => client.metrics.some((metric) => metric.required && metric.sourceKeys.includes(source.sourceKey)))
          .map(({ sourceKey }) => sourceKey);
        const optionalSourceKeys = sources.map(({ sourceKey }) => sourceKey).filter((key) => !requiredSourceKeys.includes(key));
        return {
          display,
          metricConfig: client.metrics.map((metric) => ({ ...metric, sourceKeys: [...metric.sourceKeys] })),
          collectors: sources.map((source) => collector(
            source,
            client.clientKey,
            revision.content.sourceContractVersion,
            phoenix,
            factories,
          )),
          assemblyInput: {
            clientId: client.clientId,
            clientKey: client.clientKey,
            configApproved: true,
            calculationVersion: revision.content.calculationVersion,
            sourceContractVersion: revision.content.sourceContractVersion,
            snapshotDate,
            retrievedAt,
            phoenix,
            metricConfig: engineMetrics(client.metrics),
            requiredSourceKeys,
            optionalSourceKeys,
            sourceBindings,
            fixedValues,
            sourceResults: [],
            ...('northStarLanes' in client ? { northStarLanes: client.northStarLanes } : {}),
          },
        };
      });
      return {
        calculationVersion: revision.content.calculationVersion,
        sourceContractVersion: revision.content.sourceContractVersion,
        configRevision: revision,
        clients,
      };
    },
  };
}