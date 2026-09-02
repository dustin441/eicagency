import 'server-only';

import { createEicSupabaseClient } from '../../lib/spartaco-supabase-server.ts';


export type ClientHealthOverallStatus =
  | 'healthy'
  | 'watch'
  | 'at_risk'
  | 'incomplete'
  | 'configuration_required';
export type ClientHealthConfigStatus = 'approved' | 'configuration_required' | 'inactive';
export type ClientHealthMetricKey = 'budget_pacing' | 'north_star' | 'hours' | 'overdue_tasks' | 'margin';
export type ClientHealthDirection = 'lower_is_better' | 'higher_is_better';
export type ClientHealthSourceRunStatus = 'running' | 'succeeded' | 'partial' | 'failed';
export type ClientHealthRefreshRunStatus = 'collecting' | 'validated' | 'published' | 'failed';
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type ClientHealthDbError = { code?: string; message: string; details?: string; hint?: string };
type ClientHealthDbResponse = { data: unknown; error: ClientHealthDbError | null };

export interface ClientHealthRpcQuery extends PromiseLike<ClientHealthDbResponse> {
  abortSignal(signal: AbortSignal): ClientHealthRpcQuery;
}

export interface ClientHealthQuery extends PromiseLike<ClientHealthDbResponse> {
  select(columns?: string): ClientHealthQuery;
  insert(values: unknown): ClientHealthQuery;
  update(values: unknown): ClientHealthQuery;
  eq(column: string, value: unknown): ClientHealthQuery;
  in(column: string, values: readonly unknown[]): ClientHealthQuery;
  order(column: string, options?: { ascending?: boolean }): ClientHealthQuery;
  single(): PromiseLike<ClientHealthDbResponse>;
}

export interface ClientHealthDbClient {
  from(table: string): ClientHealthQuery;
}

export interface ClientHealthAtomicRpcClient {
  rpc(functionName: string, args: Record<string, unknown>): ClientHealthRpcQuery;
}

export type ClientHealthSourceFreshness = {
  status: ClientHealthSourceRunStatus | 'unavailable' | 'unknown';
  dataThrough: string | null;
  stale: boolean | null;
};

export type ClientHealthMetricConfig = {
  id: string;
  key: ClientHealthMetricKey;
  label: string;
  adapterKey: string;
  required: boolean;
  weight: number;
  direction: ClientHealthDirection;
  greenThreshold: number;
  yellowThreshold: number;
  sourceKeys: string[];
};

export type ClientHealthLatestRecord = {
  snapshotId: string;
  refreshRunId: string;
  snapshotDate: string;
  calculatedAt: string;
  status: ClientHealthOverallStatus;
  score: number | null;
  reasons: string[];
  client: {
    id: string;
    key: string;
    name: string;
    dashboardHref: string | null;
    configStatus: ClientHealthConfigStatus;
    reportingTimezone: string;
    monthlyHoursAllotment: number | null;
    clickupListIds: string[];
    marginAliases: string[];

  };
  metrics: {
    budget: number | null;
    monthSpend: number | null;
    expectedSpend: number | null;
    currentWindowStart: string | null;
    currentWindowEnd: string | null;
    currentSpend: number | null;
    currentResultCount: number | null;
    currentCostPerResult: number | null;
    previousWindowStart: string | null;
    previousWindowEnd: string | null;
    previousSpend: number | null;
    previousResultCount: number | null;
    previousCostPerResult: number | null;
    hoursUsed: number | null;
    hoursAllotted: number | null;
    projectedHours: number | null;
    overdueTaskCount: number | null;
    revenue: number | null;
    fulfillmentCost: number | null;
    marginPercent: number | null;
  };
  dimensionStatuses: JsonObject;
  freshness: {
    dataThrough: string | null;
    sources: Record<string, ClientHealthSourceFreshness>;
  };
  versions: { calculation: string; sourceContract: string };
  evidenceHash: string;
  configRevision: { id: string; hash: string };
  tasks: ClientHealthSnapshotTask[];
  metricConfig: ClientHealthMetricConfig[];
};

export type ClientHealthSnapshotTask = {
  id: string;
  listId: string;
  name: string;
  url: string;
  dueAt: string | null;
  rank: number;
};

export type CreateRefreshRunInput = {
  snapshotDate: string;
  calculationVersion: string;
  sourceContractVersion: string;
  startedAt?: string;
};

export type CreateSourceRunInput = {
  refreshRunId: string;
  clientId: string;
  sourceKey: string;
  windowStart?: string | null;
  windowEnd?: string | null;
  startedAt?: string;
};

export type CompleteSourceRunInput = {
  id: string;
  refreshRunId: string;
  status: Exclude<ClientHealthSourceRunStatus, 'running'>;
  finishedAt: string;
  dataThrough: string | null;
  rowCount: number | null;
  requestFingerprint: string | null;
  evidence: JsonObject;
  facts: JsonObject;
  errorCode?: string | null;
  errorMessage?: string | null;
};

export type InsertSnapshotInput = {
  refreshRunId: string;
  clientId: string;
  snapshotDate: string;
  dataThrough: string | null;
  budget: number | null;
  monthSpend: number | null;
  expectedSpend: number | null;
  currentWindowStart: string | null;
  currentWindowEnd: string | null;
  currentSpend: number | null;
  currentResultCount: number | null;
  currentCostPerResult: number | null;
  previousWindowStart: string | null;
  previousWindowEnd: string | null;
  previousSpend: number | null;
  previousResultCount: number | null;
  previousCostPerResult: number | null;
  hoursUsed: number | null;
  hoursAllotted: number | null;
  projectedHours: number | null;
  overdueTaskCount: number | null;
  revenue: number | null;
  fulfillmentCost: number | null;
  marginPercent: number | null;
  dimensionStatuses: JsonObject;
  sourceStatuses: JsonObject;
  overallStatus: ClientHealthOverallStatus;
  overallScore: number | null;
  reasons: JsonValue[];
  calculatedAt?: string;
};

export type InsertSnapshotTaskInput = {
  refreshRunId: string;
  snapshotId: string;
  clickupTaskId: string;
  listId: string;
  taskName: string;
  taskUrl: string;
  dueAt: string | null;
  displayRank: number;
};

export type ValidateRefreshRunInput = {
  refreshRunId: string;
  validatedAt: string;
  evidenceHash: string;
};

export type PublishRefreshRunInput = { refreshRunId: string; publishedAt: string };
export type FailRefreshRunInput = {
  refreshRunId: string;
  finishedAt: string;
  errorCode: string;
  errorMessage: string;
};

const LATEST_COLUMNS = [
  'id', 'refresh_run_id', 'client_id', 'snapshot_date', 'data_through', 'budget', 'month_spend',
  'expected_spend', 'current_window_start', 'current_window_end', 'current_spend', 'current_result_count',
  'current_cost_per_result', 'previous_window_start', 'previous_window_end', 'previous_spend',
  'previous_result_count', 'previous_cost_per_result', 'hours_used', 'hours_allotted', 'projected_hours',
  'overdue_task_count', 'revenue', 'fulfillment_cost', 'margin_percent', 'dimension_statuses',
  'source_statuses', 'overall_status', 'overall_score', 'reasons', 'calculated_at', 'calculation_version',
  'source_contract_version', 'evidence_hash', 'config_revision_id', 'config_revision_hash',
  'revision_client_id', 'revision_client_key', 'revision_display_name', 'revision_dashboard_href',
  'revision_config_status', 'revision_reporting_timezone', 'revision_monthly_hours_allotment',
  'revision_clickup_list_ids', 'revision_margin_aliases', 'revision_metric_config',
].join(',');

const TASK_COLUMNS = 'refresh_run_id,snapshot_id,clickup_task_id,list_id,task_name,task_url,due_at,display_rank';

function dbFailure(operation: string, error: ClientHealthDbError): Error {
  const code = error.code ? ` (${error.code})` : '';
  return new Error(`Client health database ${operation} failed${code}: ${error.message}`);
}

function dataOrThrow(operation: string, response: ClientHealthDbResponse): unknown {
  if (response.error) throw dbFailure(operation, response.error);
  if (response.data === null || response.data === undefined) {
    throw new Error(`Client health database ${operation} returned no data`);
  }
  return response.data;
}

function records(value: unknown, operation: string): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
    throw new Error(`Client health database ${operation} returned malformed rows`);
  }
  return value as Record<string, unknown>[];
}

function record(value: unknown, operation: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Client health database ${operation} returned a malformed row`);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`Client health row has invalid ${field}`);
  return value;
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  return requiredString(value, field);
}

function nullableNumber(value: unknown, field: string): number | null {
  if (value === null) return null;
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value !== '' ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) throw new Error(`Client health row has invalid ${field}`);
  return parsed;
}

function requiredNumber(value: unknown, field: string): number {
  const parsed = nullableNumber(value, field);
  if (parsed === null) throw new Error(`Client health row has invalid ${field}`);
  return parsed;
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Client health row has invalid ${field}`);
  return value;
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Client health row has invalid ${field}`);
  }
  return [...value] as string[];
}

function jsonObject(value: unknown, field: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Client health row has invalid ${field}`);
  }
  return value as JsonObject;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`Client health row has invalid ${field}`);
  }
  return value as T;
}

function sourceFreshness(value: unknown): Record<string, ClientHealthSourceFreshness> {
  const sourceObject = jsonObject(value, 'source_statuses');
  return Object.fromEntries(Object.entries(sourceObject).map(([key, source]) => {
    if (typeof source === 'string') {
      return [key, {
        status: enumValue(source, ['running', 'succeeded', 'partial', 'failed', 'unavailable', 'unknown'], `source_statuses.${key}.status`),
        dataThrough: null,
        stale: null,
      }];
    }
    const item = jsonObject(source, `source_statuses.${key}`);
    const rawDataThrough = item.dataThrough ?? item.data_through ?? null;
    const rawStale = item.stale ?? null;
    if (rawStale !== null && typeof rawStale !== 'boolean') {
      throw new Error(`Client health row has invalid source_statuses.${key}.stale`);
    }
    const stale = rawStale as boolean | null;
    return [key, {
      status: enumValue(item.status ?? 'unknown', ['running', 'succeeded', 'partial', 'failed', 'unavailable', 'unknown'], `source_statuses.${key}.status`),
      dataThrough: nullableString(rawDataThrough, `source_statuses.${key}.dataThrough`),
      stale,
    }];
  }));
}

function mapTask(row: Record<string, unknown>): ClientHealthSnapshotTask {
  return {
    id: requiredString(row.clickup_task_id, 'clickup_task_id'),
    listId: requiredString(row.list_id, 'list_id'),
    name: requiredString(row.task_name, 'task_name'),
    url: requiredString(row.task_url, 'task_url'),
    dueAt: nullableString(row.due_at, 'due_at'),
    rank: requiredNumber(row.display_rank, 'display_rank'),
  };
}

function mapConfig(row: Record<string, unknown>): ClientHealthMetricConfig {
  return {
    id: requiredString(row.id, 'metric_config.id'),
    key: enumValue(row.metric_key, ['budget_pacing', 'north_star', 'hours', 'overdue_tasks', 'margin'], 'metric_key'),
    label: requiredString(row.label, 'label'),
    adapterKey: requiredString(row.adapter_key, 'adapter_key'),
    required: requiredBoolean(row.required, 'required'),
    weight: requiredNumber(row.weight, 'weight'),
    direction: enumValue(row.direction, ['lower_is_better', 'higher_is_better'], 'direction'),
    greenThreshold: requiredNumber(row.green_threshold, 'green_threshold'),
    yellowThreshold: requiredNumber(row.yellow_threshold, 'yellow_threshold'),
    sourceKeys: stringArray(row.source_keys, 'source_keys'),
  };
}

function revisionClient(row: Record<string, unknown>): { client: Record<string, unknown>; config: Record<string, unknown>[]; revisionId: string; revisionHash: string } {
  const revisionId = requiredString(row.config_revision_id, 'config_revision_id');
  const revisionHash = requiredString(row.config_revision_hash, 'config_revision_hash');
  if (!/^[0-9a-f]{64}$/.test(revisionHash)) throw new Error('Client health row has invalid config_revision_hash');
  const clientId = requiredString(row.client_id, 'client_id');
  if (requiredString(row.revision_client_id, 'revision_client_id') !== clientId) {
    throw new Error('Client health latest snapshot is not uniquely authorized by its projected configuration revision');
  }
  if (!Array.isArray(row.revision_metric_config)) throw new Error('Client health latest has malformed projected metric configuration');
  const config = row.revision_metric_config.map((value) => {
    const metric = jsonObject(value, 'revision_metric_config[]');
    const key = requiredString(metric.key, 'revision_metric_config.key');
    return {
      id: `${revisionId}:${key}`, metric_key: key, label: metric.label, adapter_key: metric.adapterKey,
      required: metric.required, weight: metric.weight, direction: metric.direction,
      green_threshold: metric.greenThreshold, yellow_threshold: metric.yellowThreshold, source_keys: metric.sourceKeys,
    };
  });
  if (new Set(config.map((metric) => metric.metric_key)).size !== config.length) throw new Error('Client health projected configuration contains duplicate metrics');
  return {
    revisionId,
    revisionHash,
    config,
    client: {
      id: clientId,
      client_key: row.revision_client_key,
      display_name: row.revision_display_name,
      dashboard_href: row.revision_dashboard_href,
      config_status: row.revision_config_status,
      reporting_timezone: row.revision_reporting_timezone,
      monthly_hours_allotment: row.revision_monthly_hours_allotment,
      clickup_list_ids: row.revision_clickup_list_ids,
      margin_aliases: row.revision_margin_aliases,
    },
  };
}

function mapLatest(
  row: Record<string, unknown>,
  client: Record<string, unknown>,
  tasks: ClientHealthSnapshotTask[],
  metricConfig: ClientHealthMetricConfig[],
  revisionId: string,
  revisionHash: string,
): ClientHealthLatestRecord {
  const status = enumValue(row.overall_status, ['healthy', 'watch', 'at_risk', 'incomplete', 'configuration_required'], 'overall_status');
  return {
    snapshotId: requiredString(row.id, 'snapshot.id'),
    refreshRunId: requiredString(row.refresh_run_id, 'refresh_run_id'),
    snapshotDate: requiredString(row.snapshot_date, 'snapshot_date'),
    calculatedAt: requiredString(row.calculated_at, 'calculated_at'),
    status,
    score: nullableNumber(row.overall_score, 'overall_score'),
    reasons: stringArray(row.reasons, 'reasons'),
    client: {
      id: requiredString(client.id, 'client.id'),
      key: requiredString(client.client_key, 'client_key'),
      name: requiredString(client.display_name, 'display_name'),
      dashboardHref: nullableString(client.dashboard_href, 'dashboard_href'),
      configStatus: enumValue(client.config_status, ['approved', 'configuration_required', 'inactive'], 'config_status'),
      reportingTimezone: requiredString(client.reporting_timezone, 'reporting_timezone'),
      monthlyHoursAllotment: nullableNumber(client.monthly_hours_allotment, 'monthly_hours_allotment'),
      clickupListIds: stringArray(client.clickup_list_ids, 'clickup_list_ids'),
      marginAliases: stringArray(client.margin_aliases, 'margin_aliases'),
    },
    metrics: {
      budget: nullableNumber(row.budget, 'budget'),
      monthSpend: nullableNumber(row.month_spend, 'month_spend'),
      expectedSpend: nullableNumber(row.expected_spend, 'expected_spend'),
      currentWindowStart: nullableString(row.current_window_start, 'current_window_start'),
      currentWindowEnd: nullableString(row.current_window_end, 'current_window_end'),
      currentSpend: nullableNumber(row.current_spend, 'current_spend'),
      currentResultCount: nullableNumber(row.current_result_count, 'current_result_count'),
      currentCostPerResult: nullableNumber(row.current_cost_per_result, 'current_cost_per_result'),
      previousWindowStart: nullableString(row.previous_window_start, 'previous_window_start'),
      previousWindowEnd: nullableString(row.previous_window_end, 'previous_window_end'),
      previousSpend: nullableNumber(row.previous_spend, 'previous_spend'),
      previousResultCount: nullableNumber(row.previous_result_count, 'previous_result_count'),
      previousCostPerResult: nullableNumber(row.previous_cost_per_result, 'previous_cost_per_result'),
      hoursUsed: nullableNumber(row.hours_used, 'hours_used'),
      hoursAllotted: nullableNumber(row.hours_allotted, 'hours_allotted'),
      projectedHours: nullableNumber(row.projected_hours, 'projected_hours'),
      overdueTaskCount: nullableNumber(row.overdue_task_count, 'overdue_task_count'),
      revenue: nullableNumber(row.revenue, 'revenue'),
      fulfillmentCost: nullableNumber(row.fulfillment_cost, 'fulfillment_cost'),
      marginPercent: nullableNumber(row.margin_percent, 'margin_percent'),
    },
    dimensionStatuses: jsonObject(row.dimension_statuses, 'dimension_statuses'),
    freshness: {
      dataThrough: nullableString(row.data_through, 'data_through'),
      sources: sourceFreshness(row.source_statuses),
    },
    versions: {
      calculation: requiredString(row.calculation_version, 'calculation_version'),
      sourceContract: requiredString(row.source_contract_version, 'source_contract_version'),
    },
    evidenceHash: requiredString(row.evidence_hash, 'evidence_hash'),
    configRevision: { id: revisionId, hash: revisionHash },
    tasks,
    metricConfig,
  };
}

async function mutation(
  query: ClientHealthQuery,
  operation: string,
  expected: { status: ClientHealthRefreshRunStatus; id?: string },
): Promise<Record<string, unknown>> {
  const row = record(dataOrThrow(operation, await query.select('id,run_status').single()), operation);
  if (row.run_status !== expected.status) {
    throw new Error(`Client health database ${operation} returned unexpected status`);
  }
  if (expected.id !== undefined) {
    if (requiredString(row.id, 'refresh_run.id') !== expected.id) {
      throw new Error(`Client health database ${operation} returned unexpected refresh run`);
    }
  }
  return row;
}

export function createClientHealthRepository(db: ClientHealthDbClient) {
  return {
    async readLatest(): Promise<ClientHealthLatestRecord[]> {
      const latestResponse = await db.from('client_health_latest').select(LATEST_COLUMNS).order('client_id');
      const latest = records(dataOrThrow('read client_health_latest', latestResponse), 'read client_health_latest');
      if (latest.length === 0) return [];

      const snapshotIds = [...new Set(latest.map((row) => requiredString(row.id, 'snapshot.id')))];
      const taskResponse = await db.from('client_health_snapshot_tasks').select(TASK_COLUMNS).in('snapshot_id', snapshotIds).order('display_rank');
      const tasks = records(dataOrThrow('read client_health_snapshot_tasks', taskResponse), 'read client_health_snapshot_tasks');
      const tasksBySnapshot = new Map<string, ClientHealthSnapshotTask[]>();
      for (const taskRow of tasks) {
        const snapshotId = requiredString(taskRow.snapshot_id, 'snapshot_id');
        tasksBySnapshot.set(snapshotId, [...(tasksBySnapshot.get(snapshotId) ?? []), mapTask(taskRow)]);
      }
      return latest.map((row) => {
        const snapshotId = requiredString(row.id, 'snapshot.id');
        const revision = revisionClient(row);
        return mapLatest(row, revision.client, tasksBySnapshot.get(snapshotId) ?? [], revision.config.map(mapConfig), revision.revisionId, revision.revisionHash);
      });
    },

    async createRefreshRun(input: CreateRefreshRunInput): Promise<{ id: string; status: 'collecting' }> {
      const values = {
        snapshot_date: input.snapshotDate,
        run_status: 'collecting',
        calculation_version: input.calculationVersion,
        source_contract_version: input.sourceContractVersion,
        ...(input.startedAt ? { started_at: input.startedAt } : {}),
      };
      const row = await mutation(
        db.from('client_health_refresh_runs').insert(values),
        'create refresh run',
        { status: 'collecting' },
      );
      return { id: requiredString(row.id, 'refresh_run.id'), status: 'collecting' };
    },

    async createSourceRun(input: CreateSourceRunInput): Promise<{ id: string }> {
      const values = {
        refresh_run_id: input.refreshRunId,
        client_id: input.clientId,
        source_key: input.sourceKey,
        run_status: 'running',
        window_start: input.windowStart ?? null,
        window_end: input.windowEnd ?? null,
        ...(input.startedAt ? { started_at: input.startedAt } : {}),
      };
      const row = record(dataOrThrow(
        'create source evidence',
        await db.from('client_health_source_runs').insert(values).select('id').single(),
      ), 'create source evidence');
      return { id: requiredString(row.id, 'source_run.id') };
    },

    async completeSourceRun(input: CompleteSourceRunInput): Promise<void> {
      const values = {
        run_status: input.status,
        finished_at: input.finishedAt,
        data_through: input.dataThrough,
        row_count: input.rowCount,
        request_fingerprint: input.requestFingerprint,
        evidence: input.evidence,
        error_code: input.errorCode ?? null,
        error_message: input.errorMessage ?? null,
      };
      const row = record(dataOrThrow(
        'complete source evidence',
        await db.from('client_health_source_runs').update(values)
          .eq('id', input.id).eq('refresh_run_id', input.refreshRunId).eq('run_status', 'running')
          .select('id').single(),
      ), 'complete source evidence');
      if (requiredString(row.id, 'source_run.id') !== input.id) {
        throw new Error('Client health database complete source evidence returned unexpected source run');
      }
    },

    async insertSnapshot(input: InsertSnapshotInput): Promise<{ id: string }> {
      const values = {
        refresh_run_id: input.refreshRunId,
        client_id: input.clientId,
        snapshot_date: input.snapshotDate,
        data_through: input.dataThrough,
        budget: input.budget,
        month_spend: input.monthSpend,
        expected_spend: input.expectedSpend,
        current_window_start: input.currentWindowStart,
        current_window_end: input.currentWindowEnd,
        current_spend: input.currentSpend,
        current_result_count: input.currentResultCount,
        current_cost_per_result: input.currentCostPerResult,
        previous_window_start: input.previousWindowStart,
        previous_window_end: input.previousWindowEnd,
        previous_spend: input.previousSpend,
        previous_result_count: input.previousResultCount,
        previous_cost_per_result: input.previousCostPerResult,
        hours_used: input.hoursUsed,
        hours_allotted: input.hoursAllotted,
        projected_hours: input.projectedHours,
        overdue_task_count: input.overdueTaskCount,
        revenue: input.revenue,
        fulfillment_cost: input.fulfillmentCost,
        margin_percent: input.marginPercent,
        dimension_statuses: input.dimensionStatuses,
        source_statuses: input.sourceStatuses,
        overall_status: input.overallStatus,
        overall_score: input.overallScore,
        reasons: input.reasons,
        ...(input.calculatedAt ? { calculated_at: input.calculatedAt } : {}),
      };
      const row = record(dataOrThrow(
        'insert snapshot',
        await db.from('client_health_snapshots').insert(values).select('id').single(),
      ), 'insert snapshot');
      return { id: requiredString(row.id, 'snapshot.id') };
    },

    async insertSnapshotTasks(inputs: InsertSnapshotTaskInput[]): Promise<void> {
      if (inputs.length === 0) return;
      const values = inputs.map((input) => ({
        refresh_run_id: input.refreshRunId,
        snapshot_id: input.snapshotId,
        clickup_task_id: input.clickupTaskId,
        list_id: input.listId,
        task_name: input.taskName,
        task_url: input.taskUrl,
        due_at: input.dueAt,
        display_rank: input.displayRank,
      }));
      const expectedIdentities = new Map<string, number>();
      for (const input of inputs) {
        const identity = JSON.stringify([input.snapshotId, input.clickupTaskId]);
        expectedIdentities.set(identity, (expectedIdentities.get(identity) ?? 0) + 1);
      }
      const rows = records(dataOrThrow(
        'insert snapshot tasks',
        await db.from('client_health_snapshot_tasks').insert(values).select('snapshot_id,clickup_task_id'),
      ), 'insert snapshot tasks');
      for (const row of rows) {
        const identity = JSON.stringify([
          requiredString(row.snapshot_id, 'snapshot_task.snapshot_id'),
          requiredString(row.clickup_task_id, 'snapshot_task.clickup_task_id'),
        ]);
        const remaining = expectedIdentities.get(identity);
        if (!remaining) {
          throw new Error('Client health database insert snapshot tasks returned unexpected task identity');
        }
        if (remaining === 1) expectedIdentities.delete(identity);
        else expectedIdentities.set(identity, remaining - 1);
      }
      if (expectedIdentities.size > 0) {
        throw new Error('Client health database insert snapshot tasks did not return all inserted tasks');
      }
    },

    async validateRefreshRun(input: ValidateRefreshRunInput): Promise<void> {
      if (!/^[0-9a-f]{64}$/.test(input.evidenceHash)) throw new Error('Client health evidence hash must be lowercase SHA-256');
      await mutation(
        db.from('client_health_refresh_runs').update({
          run_status: 'validated',
          validated_at: input.validatedAt,
          evidence_hash: input.evidenceHash,
        }).eq('id', input.refreshRunId).eq('run_status', 'collecting'),
        'validate refresh run',
        { status: 'validated', id: input.refreshRunId },
      );
    },

    async publishRefreshRun(input: PublishRefreshRunInput): Promise<void> {
      await mutation(
        db.from('client_health_refresh_runs').update({
          run_status: 'published',
          published_at: input.publishedAt,
          finished_at: input.publishedAt,
        }).eq('id', input.refreshRunId).eq('run_status', 'validated'),
        'publish refresh run',
        { status: 'published', id: input.refreshRunId },
      );
    },

    async failRefreshRun(input: FailRefreshRunInput): Promise<void> {
      await mutation(
        db.from('client_health_refresh_runs').update({
          run_status: 'failed',
          finished_at: input.finishedAt,
          error_code: input.errorCode,
          error_message: input.errorMessage,
        }).eq('id', input.refreshRunId).in('run_status', ['collecting', 'validated']),
        'fail refresh run',
        { status: 'failed', id: input.refreshRunId },
      );
    },
  };
}

export function createEicClientHealthRepository(
  createClient: () => ClientHealthDbClient = createEicSupabaseClient as unknown as () => ClientHealthDbClient,
) {
  return createClientHealthRepository(createClient());
}

export type ClientHealthRepository = ReturnType<typeof createClientHealthRepository>;
