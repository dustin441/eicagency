import 'server-only';

import Decimal from 'decimal.js-light';
import { assertDateOnly } from '../date-windows.ts';
import { canonicalEvidenceHash } from '../evidence.ts';
import type { ClientHealthValueInputs } from '../engine.ts';
import type {
  AdapterContext,
  AdapterFailure,
  ClickUpAdapterEvidence,
  ClickUpAdapterResult,
  ClickUpSnapshotTask,
} from './types.ts';

export type { AdapterContext, ClickUpAdapterResult, ClickUpSnapshotTask } from './types.ts';

export type ClickUpPageResponse = {
  page: unknown;
  items: unknown;
  lastPage: unknown;
  error?: unknown;
};

export type ClickUpTimeEntriesRequest = {
  teamId: string;
  approvedListIds: readonly string[];
  startDateMs: string;
  endDateMs: string;
  page: number;
  pageSize: number;
};

export type ClickUpOverdueTasksRequest = {
  teamId: string;
  approvedListIds: readonly string[];
  dueDateLtMs: string;
  includeClosed: false;
  subtasks: true;
  orderBy: 'due_date';
  reverse: false;
  page: number;
  pageSize: number;
};

/** The injected implementation owns transport/auth and normalizes documented page semantics. */
export interface ClickUpHttpClient {
  readonly teamId: string;
  getTeamTimeEntries(request: ClickUpTimeEntriesRequest): Promise<ClickUpPageResponse>;
  getTeamOverdueTasks(request: ClickUpOverdueTasksRequest): Promise<ClickUpPageResponse>;
}

type ClickUpContractInput = {
  sourceKey: string;
  clientKey: string;
  teamId: string;
  approvedListIds: readonly string[];
  timezone: 'America/Phoenix';
  contractVersion: string;
};

const approvedClickUpContractBrand: unique symbol = Symbol('approvedClickUpContract');
export type ApprovedClickUpContract = Readonly<ClickUpContractInput> & {
  readonly [approvedClickUpContractBrand]: true;
};

const CLICKUP_ID = /^[1-9]\d*$/;
const CANONICAL_INTEGER = /^(0|[1-9]\d*)$/;
const MsDecimal = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
type MsDecimal = InstanceType<typeof MsDecimal>;

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${field} is required`);
  return value;
}

/** Call only with reviewed module-scope literals; the brand cannot be forged by request data. */
export function defineApprovedClickUpContract(input: ClickUpContractInput): ApprovedClickUpContract {
  if (!input || typeof input !== 'object') throw new Error('ClickUp contract is malformed');
  requiredText(input.sourceKey, 'sourceKey');
  requiredText(input.clientKey, 'clientKey');
  requiredText(input.contractVersion, 'contractVersion');
  if (!CLICKUP_ID.test(input.teamId)) throw new Error('teamId must be a static ClickUp ID');
  if (input.timezone !== 'America/Phoenix') throw new Error('ClickUp reporting timezone must be America/Phoenix');
  if (!Array.isArray(input.approvedListIds) || input.approvedListIds.length === 0) {
    throw new Error('At least one approved ClickUp list ID is required');
  }
  const listIds = [...input.approvedListIds];
  if (listIds.some((id) => !CLICKUP_ID.test(id))) throw new Error('approvedListIds must contain static ClickUp IDs');
  if (new Set(listIds).size !== listIds.length) throw new Error('approvedListIds must not contain duplicates');
  listIds.sort((left, right) => left.localeCompare(right));
  const approved = { ...input, approvedListIds: Object.freeze(listIds) } as ClickUpContractInput & {
    [approvedClickUpContractBrand]?: true;
  };
  Object.defineProperty(approved, approvedClickUpContractBrand, { value: true, enumerable: false });
  return Object.freeze(approved) as ApprovedClickUpContract;
}

const EMPTY_VALUES = (): ClientHealthValueInputs => ({
  budget: null,
  monthSpend: null,
  currentRows: null,
  previousRows: null,
  hoursUsed: null,
  hoursAllotted: null,
  overdueTaskCount: null,
  revenue: null,
  fulfillmentCost: null,
});

function validateContext(context: AdapterContext, contract: ApprovedClickUpContract): void {
  if (!context || typeof context !== 'object') throw new Error('Adapter context is malformed');
  if (context.clientKey !== contract.clientKey) throw new Error('Adapter context client does not match its approved ClickUp contract');
  if (context.timezone !== contract.timezone) throw new Error('Adapter context timezone does not match its approved ClickUp contract');
  if (context.sourceContractVersion !== contract.contractVersion) {
    throw new Error('Adapter context source contract version does not match its approved ClickUp contract');
  }
  const retrievedAt = new Date(context.retrievedAt);
  if (!Number.isFinite(retrievedAt.getTime()) || retrievedAt.toISOString() !== context.retrievedAt) {
    throw new Error('retrievedAt must be a canonical ISO timestamp');
  }
  assertDateOnly(context.lastCompleteDate, 'lastCompleteDate');
  for (const [name, window] of Object.entries(context.windows)) {
    assertDateOnly(window.start, `${name}.start`);
    assertDateOnly(window.end, `${name}.end`);
    if (window.start > window.end) throw new Error(`${name} must be an inclusive ordered window`);
  }
  if (context.windows.month.end !== context.lastCompleteDate || context.windows.current.end !== context.lastCompleteDate) {
    throw new Error('month and current windows must end on lastCompleteDate');
  }
  if (!context.windows.month.start.endsWith('-01')) throw new Error('month window must start on the first day of the month');
  if (context.windows.previous.end >= context.windows.current.start) throw new Error('previous and current windows must not overlap');
}

function phoenixStartMs(date: string): string {
  return String(Date.parse(`${date}T07:00:00.000Z`));
}

function phoenixEndMs(date: string): string {
  return String(Date.parse(`${date}T06:59:59.999Z`) + 86_400_000);
}

type FixedRequest = {
  startMs: string;
  cutoffMs: string;
  dueDateLtMs: string;
};

function fixedRequest(context: AdapterContext): FixedRequest {
  const startMs = phoenixStartMs(context.windows.month.start);
  const cutoffMs = phoenixEndMs(context.lastCompleteDate);
  return { startMs, cutoffMs, dueDateLtMs: new MsDecimal(cutoffMs).plus(1).toFixed(0) };
}

function evidenceFor(
  contract: ApprovedClickUpContract,
  context: AdapterContext,
  fixed: FixedRequest,
  pageSize: number,
  maxPages: number,
): ClickUpAdapterEvidence {
  return {
    sourceKey: contract.sourceKey,
    provider: 'clickup',
    endpointFamily: 'team-time-entries-and-overdue-tasks',
    retrievedAt: context.retrievedAt,
    sourceContractVersion: contract.contractVersion,
    requestFingerprint: canonicalEvidenceHash({
      endpointFamily: 'team-time-entries-and-overdue-tasks',
      teamId: contract.teamId,
      approvedListIds: contract.approvedListIds,
      inclusiveTimeWindowMs: { start: fixed.startMs, end: fixed.cutoffMs },
      inclusiveOverdueCutoffMs: fixed.cutoffMs,
      contractVersion: contract.contractVersion,
      timezone: contract.timezone,
      clientKey: contract.clientKey,
      pagination: { semantics: 'zero-based-page-with-explicit-last-page', pageSize, maxPages },
    }),
    totalDurationMs: null,
    overdueTaskCount: null,
  };
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function canonicalSafeInteger(value: unknown, field: string): { decimal: MsDecimal; text: string; number: number } {
  let text: string;
  if (typeof value === 'string') text = value;
  else if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) text = String(value);
  else throw new Error(`${field} must be a nonnegative safe integer`);
  if (!CANONICAL_INTEGER.test(text)) throw new Error(`${field} must be a canonical nonnegative integer`);
  const decimal = new MsDecimal(text);
  if (decimal.gt(Number.MAX_SAFE_INTEGER)) throw new Error(`${field} must be a safe integer`);
  return { decimal, text, number: Number(text) };
}

function timestamp(value: unknown, field: string, minimum: string | null, maximum: string): { text: string; iso: string } {
  const parsed = canonicalSafeInteger(value, field);
  if ((minimum !== null && parsed.decimal.lt(minimum)) || parsed.decimal.gt(maximum)) {
    throw new Error(`${field} fell outside its inclusive fixed window`);
  }
  const date = new Date(parsed.number);
  if (!Number.isFinite(date.getTime())) throw new Error(`${field} is invalid`);
  return { text: parsed.text, iso: date.toISOString() };
}

type NormalizedTimeEntry = {
  id: string;
  listId: string;
  start: string;
  end: string;
  duration: string;
};

type NormalizedTask = ClickUpSnapshotTask & {
  listId: string;
  dueMs: string;
  status: string;
  statusType: string;
};

function approvedList(value: unknown, contract: ApprovedClickUpContract, field: string): string {
  const id = requiredText(value, field);
  if (!contract.approvedListIds.includes(id)) throw new Error(`${field} is outside the approved ClickUp list scope`);
  return id;
}

function normalizeTimeEntry(
  value: unknown,
  contract: ApprovedClickUpContract,
  fixed: FixedRequest,
): NormalizedTimeEntry {
  const row = object(value);
  if (!row) throw new Error('Time entry is malformed');
  const id = requiredText(row.id, 'time entry ID');
  const location = object(row.task_location);
  if (!location) throw new Error('Time entry task location is missing');
  const listId = approvedList(location.list_id, contract, 'time entry list ID');
  const start = timestamp(row.start, 'time entry start', fixed.startMs, fixed.cutoffMs);
  const end = timestamp(row.end, 'time entry end', fixed.startMs, fixed.cutoffMs);
  const duration = canonicalSafeInteger(row.duration, 'time entry duration');
  if (new MsDecimal(end.text).lt(start.text)) throw new Error('Time entry end precedes its start');
  if (!new MsDecimal(end.text).minus(start.text).eq(duration.decimal)) {
    throw new Error('Time entry duration does not equal its fixed start/end interval');
  }
  return { id, listId, start: start.text, end: end.text, duration: duration.text };
}

function normalizeTask(value: unknown, contract: ApprovedClickUpContract, fixed: FixedRequest): NormalizedTask {
  const row = object(value);
  if (!row) throw new Error('Task is malformed');
  const id = requiredText(row.id, 'task ID');
  const name = requiredText(row.name, 'task name');
  const url = requiredText(row.url, 'task URL');
  let parsedUrl: URL;
  try { parsedUrl = new URL(url); } catch { throw new Error('task URL is malformed'); }
  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') throw new Error('task URL is malformed');
  const list = object(row.list);
  if (!list) throw new Error('Task list is missing');
  const listId = approvedList(list.id, contract, 'task list ID');
  const statusObject = object(row.status);
  if (!statusObject) throw new Error('Task status is missing');
  const status = requiredText(statusObject.status, 'task status');
  const statusType = requiredText(statusObject.type, 'task status type');
  const normalizedStatus = status.trim().toLowerCase();
  const normalizedType = statusType.trim().toLowerCase();
  if (normalizedType === 'closed' || ['closed', 'complete', 'completed', 'done'].includes(normalizedStatus)) {
    throw new Error('Closed tasks are forbidden from the overdue open-task result');
  }
  const due = timestamp(row.due_date, 'task due timestamp', null, fixed.cutoffMs);
  return { id, name, url, dueAt: due.iso, dueMs: due.text, listId, status, statusType };
}

type ScanSuccess<T> = { ok: true; rows: T[]; count: number; digest: string };
type ScanFailure = { ok: false; failure: AdapterFailure; fetchedRows: number };

type Endpoint = 'time' | 'tasks';

async function scanEndpoint<T>(
  endpoint: Endpoint,
  client: ClickUpHttpClient,
  contract: ApprovedClickUpContract,
  fixed: FixedRequest,
  pageSize: number,
  maxPages: number,
  normalize: (value: unknown) => T & { id: string },
): Promise<ScanSuccess<T> | ScanFailure> {
  const rows: T[] = [];
  const ids = new Set<string>();
  const canonicalPages: unknown[] = [];
  const fail = (code: AdapterFailure['code'], reason: string): ScanFailure => ({
    ok: false,
    failure: { code, reason },
    fetchedRows: rows.length,
  });

  for (let page = 0; page < maxPages; page += 1) {
    let response: ClickUpPageResponse;
    try {
      response = endpoint === 'time'
        ? await client.getTeamTimeEntries({
          teamId: contract.teamId,
          approvedListIds: contract.approvedListIds,
          startDateMs: fixed.startMs,
          endDateMs: fixed.cutoffMs,
          page,
          pageSize,
        })
        : await client.getTeamOverdueTasks({
          teamId: contract.teamId,
          approvedListIds: contract.approvedListIds,
          dueDateLtMs: fixed.dueDateLtMs,
          includeClosed: false,
          subtasks: true,
          orderBy: 'due_date',
          reverse: false,
          page,
          pageSize,
        });
    } catch {
      return fail(rows.length > 0 ? 'partial_query' : 'query_failed', rows.length > 0
        ? 'A later ClickUp page failed; accumulated values were discarded.'
        : 'The ClickUp query failed.');
    }
    if (!response || typeof response !== 'object' || response.error) {
      return fail(rows.length > 0 ? 'partial_query' : 'query_failed', rows.length > 0
        ? 'A later ClickUp page failed; accumulated values were discarded.'
        : 'The ClickUp query failed.');
    }
    if (response.page !== page || typeof response.lastPage !== 'boolean' || !Array.isArray(response.items)
      || response.items.length > pageSize) {
      return fail('incomplete_page', 'ClickUp returned malformed or changing page metadata.');
    }
    if (response.items.length === 0 && response.lastPage !== true) {
      return fail('incomplete_page', 'ClickUp pagination ended without an explicit complete last page.');
    }
    const canonicalPage: unknown[] = [];
    for (const item of response.items) {
      let normalized: T & { id: string };
      try { normalized = normalize(item); } catch {
        return fail('malformed_row', 'ClickUp returned malformed, unapproved, closed, or out-of-window data.');
      }
      if (ids.has(normalized.id)) return fail('duplicate_key', 'ClickUp returned a duplicate ID.');
      ids.add(normalized.id);
      rows.push(normalized);
      canonicalPage.push(normalized);
    }
    canonicalPages.push({ page, rows: canonicalPage });
    if (response.lastPage) {
      return {
        ok: true,
        rows,
        count: rows.length,
        digest: canonicalEvidenceHash({ count: rows.length, pages: canonicalPages }),
      };
    }
  }
  return fail('max_pages', 'Maximum ClickUp page limit was exhausted before an explicit last page.');
}

export type ClickUpAdapterOptions = {
  client: ClickUpHttpClient;
  pageSize?: number;
  maxPages?: number;
};

function failedResult(
  contract: ApprovedClickUpContract,
  evidence: ClickUpAdapterEvidence,
  failure: AdapterFailure,
  fetchedRows: number,
): ClickUpAdapterResult {
  return {
    source: {
      key: contract.sourceKey,
      status: fetchedRows > 0 ? 'partial' : 'failed',
      dataThrough: null,
      stale: true,
      rowCount: fetchedRows > 0 ? fetchedRows : null,
    },
    values: EMPTY_VALUES(),
    tasks: [],
    evidence,
    failure,
  };
}

function hoursFromMilliseconds(total: MsDecimal): number {
  if (total.gt(Number.MAX_SAFE_INTEGER)) throw new Error('Total duration is unsafe');
  const hours = total.div(3_600_000).toNumber();
  if (!Number.isFinite(hours) || (!total.isZero() && hours === 0)) throw new Error('Hours total is unsafe');
  return Object.is(hours, -0) ? 0 : hours;
}

/**
 * Collects only one statically approved client scope. Success requires two complete,
 * byte-canonical page scans of both endpoint families; any ambiguity discards all values.
 */
export function createDeterministicClickUpAdapter(
  contract: ApprovedClickUpContract,
  options: ClickUpAdapterOptions,
): (context: AdapterContext) => Promise<ClickUpAdapterResult> {
  if (!contract || typeof contract !== 'object' || contract[approvedClickUpContractBrand] !== true) {
    throw new Error('An approved ClickUp contract is required');
  }
  if (!options || typeof options !== 'object' || !options.client
    || typeof options.client.getTeamTimeEntries !== 'function'
    || typeof options.client.getTeamOverdueTasks !== 'function') {
    throw new Error('An explicitly injected ClickUp HTTP client is required');
  }
  if (options.client.teamId !== contract.teamId) throw new Error('Injected ClickUp client team does not match its approved contract');
  const pageSize = options.pageSize ?? 100;
  const maxPages = options.maxPages ?? 100;
  if (!Number.isInteger(pageSize) || pageSize <= 0) throw new Error('pageSize must be a positive integer');
  if (!Number.isInteger(maxPages) || maxPages <= 0) throw new Error('maxPages must be a positive integer');

  return async (context) => {
    validateContext(context, contract);
    const fixed = fixedRequest(context);
    const evidence = evidenceFor(contract, context, fixed, pageSize, maxPages);
    const timeNormalizer = (item: unknown) => normalizeTimeEntry(item, contract, fixed);
    const taskNormalizer = (item: unknown) => normalizeTask(item, contract, fixed);

    const firstTime = await scanEndpoint('time', options.client, contract, fixed, pageSize, maxPages, timeNormalizer);
    if ('failure' in firstTime) return failedResult(contract, evidence, firstTime.failure, firstTime.fetchedRows);
    const firstTasks = await scanEndpoint('tasks', options.client, contract, fixed, pageSize, maxPages, taskNormalizer);
    if ('failure' in firstTasks) return failedResult(contract, evidence, firstTasks.failure, firstTime.count + firstTasks.fetchedRows);
    const secondTime = await scanEndpoint('time', options.client, contract, fixed, pageSize, maxPages, timeNormalizer);
    if ('failure' in secondTime) return failedResult(contract, evidence, secondTime.failure, Math.max(firstTime.count, secondTime.fetchedRows) + firstTasks.count);
    const secondTasks = await scanEndpoint('tasks', options.client, contract, fixed, pageSize, maxPages, taskNormalizer);
    if ('failure' in secondTasks) return failedResult(contract, evidence, secondTasks.failure, secondTime.count + Math.max(firstTasks.count, secondTasks.fetchedRows));

    if (firstTime.count !== secondTime.count || firstTime.digest !== secondTime.digest
      || firstTasks.count !== secondTasks.count || firstTasks.digest !== secondTasks.digest) {
      return failedResult(contract, evidence, {
        code: 'source_changed',
        reason: 'ClickUp changed between complete verification scans; all values and tasks were discarded.',
      }, Math.max(firstTime.count, secondTime.count) + Math.max(firstTasks.count, secondTasks.count));
    }

    let total = new MsDecimal(0);
    try {
      for (const entry of firstTime.rows) total = total.plus(entry.duration);
      const hoursUsed = hoursFromMilliseconds(total);
      const tasks = [...firstTasks.rows]
        .sort((left, right) => {
          const due = new MsDecimal(left.dueMs).cmp(right.dueMs);
          return due !== 0 ? due : left.id.localeCompare(right.id);
        })
        .slice(0, 5)
        .map(({ id, name, url, dueAt }) => ({ id, name, url, dueAt }));
      return {
        source: {
          key: contract.sourceKey,
          status: 'succeeded',
          dataThrough: context.lastCompleteDate,
          stale: false,
          rowCount: firstTime.count + firstTasks.count,
        },
        values: { ...EMPTY_VALUES(), hoursUsed, overdueTaskCount: firstTasks.count },
        tasks,
        evidence: { ...evidence, totalDurationMs: total.toFixed(0), overdueTaskCount: firstTasks.count },
        failure: null,
      };
    } catch {
      return failedResult(contract, evidence, {
        code: 'malformed_row',
        reason: 'ClickUp duration totals were unsafe or malformed; all values and tasks were discarded.',
      }, firstTime.count + firstTasks.count);
    }
  };
}
