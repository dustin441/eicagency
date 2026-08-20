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

/** Documented complete-array envelope from GET /team/{team_Id}/time_entries. */
export type ClickUpTimeEntriesResponse = {
  data: unknown;
  error?: unknown;
};

export type ClickUpTimeEntriesRequest = {
  teamId: string;
  startDateMs: string;
  endDateMs: string;
  includeLocationNames: true;
};

/** Documented page envelope from GET /team/{team_Id}/task plus the requested page identity. */
export type ClickUpFilteredTeamTasksResponse = {
  page: unknown;
  tasks: unknown;
  last_page: unknown;
  error?: unknown;
};

export type ClickUpFilteredTeamTasksRequest = {
  teamId: string;
  listIds: readonly string[];
  dueDateLtMs: string;
  includeClosed: false;
  subtasks: true;
  orderBy: 'due_date';
  reverse: false;
  page: number;
};

/** Injected implementations own transport/auth and expose each ClickUp endpoint's native continuation model. */
export interface ClickUpHttpClient {
  readonly teamId: string;
  getTeamTimeEntries(request: ClickUpTimeEntriesRequest): Promise<ClickUpTimeEntriesResponse>;
  getFilteredTeamTasks(request: ClickUpFilteredTeamTasksRequest): Promise<ClickUpFilteredTeamTasksResponse>;
}

type ClickUpContractInput = {
  sourceKey: string;
  clientKey: string;
  teamId: string;
  approvedListIds: readonly string[];
  timezone: 'America/Phoenix';
  contractVersion: string;
};

const injectedClickUpContractBrand: unique symbol = Symbol('injectedClickUpContract');
export type InjectedClickUpContract = Readonly<ClickUpContractInput> & {
  readonly [injectedClickUpContractBrand]: true;
};

const CLICKUP_ID = /^[1-9]\d*$/;
const CANONICAL_INTEGER = /^(0|[1-9]\d*)$/;
const OPEN_TASK_STATUS_TYPES = new Set(['open', 'custom']);
const CLICKUP_TASK_PAGE_LIMIT = 100;
const MsDecimal = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
type MsDecimal = InstanceType<typeof MsDecimal>;

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${field} is required`);
  return value;
}

/** Defines only an injected/test boundary. It grants no production token or authorization. */
export function defineInjectedClickUpContract(input: ClickUpContractInput): InjectedClickUpContract {
  if (!input || typeof input !== 'object') throw new Error('Injected ClickUp contract is malformed');
  requiredText(input.sourceKey, 'sourceKey');
  requiredText(input.clientKey, 'clientKey');
  requiredText(input.contractVersion, 'contractVersion');
  if (!CLICKUP_ID.test(input.teamId)) throw new Error('teamId must be a static ClickUp ID');
  if (input.timezone !== 'America/Phoenix') throw new Error('ClickUp reporting timezone must be America/Phoenix');
  if (!Array.isArray(input.approvedListIds) || input.approvedListIds.length === 0) {
    throw new Error('At least one static ClickUp list ID is required');
  }
  const listIds = [...input.approvedListIds];
  if (listIds.some((id) => !CLICKUP_ID.test(id))) throw new Error('approvedListIds must contain static ClickUp IDs');
  if (new Set(listIds).size !== listIds.length) throw new Error('approvedListIds must not contain duplicates');
  listIds.sort((left, right) => left.localeCompare(right));
  const injected = { ...input, approvedListIds: Object.freeze(listIds) } as ClickUpContractInput & {
    [injectedClickUpContractBrand]?: true;
  };
  Object.defineProperty(injected, injectedClickUpContractBrand, { value: true, enumerable: false });
  return Object.freeze(injected) as InjectedClickUpContract;
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

function validateContext(context: AdapterContext, contract: InjectedClickUpContract): void {
  if (!context || typeof context !== 'object') throw new Error('Adapter context is malformed');
  if (context.clientKey !== contract.clientKey) throw new Error('Adapter context client does not match its injected ClickUp contract');
  if (context.timezone !== contract.timezone) throw new Error('Adapter context timezone does not match its injected ClickUp contract');
  if (context.sourceContractVersion !== contract.contractVersion) {
    throw new Error('Adapter context source contract version does not match its injected ClickUp contract');
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
  const expectedMonthStart = `${context.lastCompleteDate.slice(0, 7)}-01`;
  if (context.windows.month.start !== expectedMonthStart) {
    throw new Error("month window must start on the first day of lastCompleteDate's month");
  }
  if (context.windows.previous.end >= context.windows.current.start) throw new Error('previous and current windows must not overlap');
}

function phoenixStartMs(date: string): string {
  return String(Date.parse(`${date}T07:00:00.000Z`));
}

function phoenixEndMs(date: string): string {
  return String(Date.parse(`${date}T06:59:59.999Z`) + 86_400_000);
}

type FixedRequest = { startMs: string; cutoffMs: string; dueDateLtMs: string };

function fixedRequest(context: AdapterContext): FixedRequest {
  const startMs = phoenixStartMs(context.windows.month.start);
  const cutoffMs = phoenixEndMs(context.lastCompleteDate);
  return { startMs, cutoffMs, dueDateLtMs: new MsDecimal(cutoffMs).plus(1).toFixed(0) };
}

function evidenceFor(
  contract: InjectedClickUpContract,
  context: AdapterContext,
  fixed: FixedRequest,
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
      timeEntries: {
        endpoint: '/team/{team_Id}/time_entries',
        inclusiveWindowMs: { start: fixed.startMs, end: fixed.cutoffMs },
        includeLocationNames: true,
        continuation: 'complete-data-array-no-page-or-cursor',
        listScope: 'local-task_location-list_id-filter',
      },
      filteredTeamTasks: {
        endpoint: '/team/{team_Id}/task',
        dueDateLtMs: fixed.dueDateLtMs,
        includeClosed: false,
        subtasks: true,
        orderBy: 'due_date',
        reverse: false,
        listIds: contract.approvedListIds,
        pagination: { semantics: 'zero-based-page-with-explicit-last_page', fixedPageLimit: 100, maxPages },
      },
      contractVersion: contract.contractVersion,
      timezone: contract.timezone,
      clientKey: contract.clientKey,
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

type NormalizedTimeEntry = { id: string; listId: string; start: string; end: string; duration: string };
type NormalizedTask = ClickUpSnapshotTask & {
  listId: string;
  dueMs: string;
  status: string;
  statusType: string;
};

function approvedList(value: unknown, contract: InjectedClickUpContract, field: string): string {
  const id = requiredText(value, field);
  if (!contract.approvedListIds.includes(id)) throw new Error(`${field} is outside the static ClickUp list scope`);
  return id;
}

function normalizeTimeEntry(value: unknown, contract: InjectedClickUpContract, fixed: FixedRequest): NormalizedTimeEntry {
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

function normalizeTask(value: unknown, contract: InjectedClickUpContract, fixed: FixedRequest): NormalizedTask {
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
  if (!OPEN_TASK_STATUS_TYPES.has(statusType)) throw new Error('Task status type must be open or custom');
  if (['closed', 'complete', 'completed', 'done'].includes(normalizedStatus)) {
    throw new Error('Closed tasks are forbidden from the overdue open-task result');
  }
  const due = timestamp(row.due_date, 'task due timestamp', null, fixed.cutoffMs);
  return { id, name, url, dueAt: due.iso, dueMs: due.text, listId, status, statusType };
}

type ScanSuccess<T> = { ok: true; rows: T[]; count: number; digest: string };
type ScanFailure = { ok: false; failure: AdapterFailure; fetchedRows: number };

function scanFailure(code: AdapterFailure['code'], reason: string, fetchedRows: number): ScanFailure {
  return { ok: false, failure: { code, reason }, fetchedRows };
}

function normalizeRows<T extends { id: string }>(items: unknown[], normalize: (value: unknown) => T): ScanSuccess<T> | ScanFailure {
  const rows: T[] = [];
  const ids = new Set<string>();
  for (const item of items) {
    let normalized: T;
    try { normalized = normalize(item); } catch {
      return scanFailure('malformed_row', 'ClickUp returned malformed, unmapped, closed, or out-of-window data.', rows.length);
    }
    if (ids.has(normalized.id)) return scanFailure('duplicate_key', 'ClickUp returned a duplicate ID.', rows.length);
    ids.add(normalized.id);
    rows.push(normalized);
  }
  return { ok: true, rows, count: rows.length, digest: canonicalEvidenceHash({ count: rows.length, rows }) };
}

async function scanTimeEntries<T extends { id: string }>(
  client: ClickUpHttpClient,
  contract: InjectedClickUpContract,
  fixed: FixedRequest,
  normalize: (value: unknown) => T,
): Promise<ScanSuccess<T> | ScanFailure> {
  let response: ClickUpTimeEntriesResponse;
  try {
    response = await client.getTeamTimeEntries({
      teamId: contract.teamId,
      startDateMs: fixed.startMs,
      endDateMs: fixed.cutoffMs,
      includeLocationNames: true,
    });
  } catch {
    return scanFailure('query_failed', 'The ClickUp time entries query failed.', 0);
  }
  if (!response || typeof response !== 'object' || response.error) {
    return scanFailure('query_failed', 'The ClickUp time entries query failed.', 0);
  }
  if (!Array.isArray(response.data)) {
    return scanFailure('incomplete_page', 'ClickUp returned a malformed complete time entries envelope.', 0);
  }
  return normalizeRows(response.data, normalize);
}

async function scanFilteredTeamTasks<T extends { id: string }>(
  client: ClickUpHttpClient,
  contract: InjectedClickUpContract,
  fixed: FixedRequest,
  maxPages: number,
  normalize: (value: unknown) => T,
): Promise<ScanSuccess<T> | ScanFailure> {
  const rows: T[] = [];
  const ids = new Set<string>();
  const canonicalPages: unknown[] = [];
  const fail = (code: AdapterFailure['code'], reason: string) => scanFailure(code, reason, rows.length);

  for (let page = 0; page < maxPages; page += 1) {
    let response: ClickUpFilteredTeamTasksResponse;
    try {
      response = await client.getFilteredTeamTasks({
        teamId: contract.teamId,
        listIds: contract.approvedListIds,
        dueDateLtMs: fixed.dueDateLtMs,
        includeClosed: false,
        subtasks: true,
        orderBy: 'due_date',
        reverse: false,
        page,
      });
    } catch {
      return fail(rows.length > 0 ? 'partial_query' : 'query_failed', rows.length > 0
        ? 'A later ClickUp task page failed; accumulated values were discarded.'
        : 'The ClickUp filtered tasks query failed.');
    }
    if (!response || typeof response !== 'object' || response.error) {
      return fail(rows.length > 0 ? 'partial_query' : 'query_failed', rows.length > 0
        ? 'A later ClickUp task page failed; accumulated values were discarded.'
        : 'The ClickUp filtered tasks query failed.');
    }
    if (response.page !== page || typeof response.last_page !== 'boolean'
      || !Array.isArray(response.tasks) || response.tasks.length > CLICKUP_TASK_PAGE_LIMIT) {
      return fail('incomplete_page', 'ClickUp returned malformed or changing filtered-task page metadata.');
    }
    if (response.tasks.length === 0 && response.last_page !== true) {
      return fail('incomplete_page', 'ClickUp task pagination ended without an explicit complete last page.');
    }
    const canonicalPage: T[] = [];
    for (const item of response.tasks) {
      let normalized: T;
      try { normalized = normalize(item); } catch {
        return fail('malformed_row', 'ClickUp returned malformed, unmapped, closed, or out-of-window data.');
      }
      if (ids.has(normalized.id)) return fail('duplicate_key', 'ClickUp returned a duplicate ID.');
      ids.add(normalized.id);
      rows.push(normalized);
      canonicalPage.push(normalized);
    }
    canonicalPages.push({ page, rows: canonicalPage });
    if (response.last_page) {
      return { ok: true, rows, count: rows.length, digest: canonicalEvidenceHash({ count: rows.length, pages: canonicalPages }) };
    }
  }
  return fail('max_pages', 'Maximum ClickUp task page limit was exhausted before an explicit last page.');
}

export type ClickUpAdapterOptions = { client: ClickUpHttpClient; maxPages?: number };

function failedResult(
  contract: InjectedClickUpContract,
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
 * Injected/test adapter only. Production authorization and credential transport may be owned only by
 * clickup-production.ts. Success requires two matching complete time arrays and two matching task scans.
 */
export function createDeterministicClickUpAdapter(
  contract: InjectedClickUpContract,
  options: ClickUpAdapterOptions,
): (context: AdapterContext) => Promise<ClickUpAdapterResult> {
  if (!contract || typeof contract !== 'object' || contract[injectedClickUpContractBrand] !== true) {
    throw new Error('An injected ClickUp contract is required');
  }
  if (!options || typeof options !== 'object' || !options.client
    || typeof options.client.getTeamTimeEntries !== 'function'
    || typeof options.client.getFilteredTeamTasks !== 'function') {
    throw new Error('An explicitly injected ClickUp HTTP client is required');
  }
  if (options.client.teamId !== contract.teamId) throw new Error('Injected ClickUp client team does not match its contract');
  const maxPages = options.maxPages ?? 100;
  if (!Number.isInteger(maxPages) || maxPages <= 0) throw new Error('maxPages must be a positive integer');

  return async (context) => {
    validateContext(context, contract);
    const fixed = fixedRequest(context);
    const evidence = evidenceFor(contract, context, fixed, maxPages);
    const timeNormalizer = (item: unknown) => normalizeTimeEntry(item, contract, fixed);
    const taskNormalizer = (item: unknown) => normalizeTask(item, contract, fixed);

    const firstTime = await scanTimeEntries(options.client, contract, fixed, timeNormalizer);
    if ('failure' in firstTime) return failedResult(contract, evidence, firstTime.failure, firstTime.fetchedRows);
    const firstTasks = await scanFilteredTeamTasks(options.client, contract, fixed, maxPages, taskNormalizer);
    if ('failure' in firstTasks) return failedResult(contract, evidence, firstTasks.failure, firstTime.count + firstTasks.fetchedRows);
    const secondTime = await scanTimeEntries(options.client, contract, fixed, timeNormalizer);
    if ('failure' in secondTime) return failedResult(contract, evidence, secondTime.failure, Math.max(firstTime.count, secondTime.fetchedRows) + firstTasks.count);
    const secondTasks = await scanFilteredTeamTasks(options.client, contract, fixed, maxPages, taskNormalizer);
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
