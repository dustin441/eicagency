import 'server-only';

import Decimal from 'decimal.js-light';
import { assertDateOnly } from '../date-windows.ts';
import { canonicalEvidenceHash, canonicalEvidenceJson } from '../evidence.ts';
import type { ClientHealthValueInputs, RatioRow } from '../engine.ts';
import type {
  AdapterContext,
  AdapterFailure,
  SourceAdapterEvidence,
  SourceAdapterResult,
  SupabaseProject,
} from './types.ts';

export type { AdapterContext, SourceAdapterResult, SupabaseProject } from './types.ts';

export type SupabaseLikeResponse = {
  data: unknown;
  error: unknown;
  count: number | null;
};

export interface SupabaseLikeQuery {
  select(columns: string, options: { count: 'exact' }): SupabaseLikeQuery;
  gte(column: string, value: string): SupabaseLikeQuery;
  lte(column: string, value: string): SupabaseLikeQuery;
  eq(column: string, value: string | number | boolean): SupabaseLikeQuery;
  order(column: string, options: { ascending: true }): SupabaseLikeQuery;
  range(from: number, to: number): PromiseLike<SupabaseLikeResponse>;
}

export interface SupabaseLikeClient {
  from(relation: string): SupabaseLikeQuery;
}

type StaticFilter = {
  column: string;
  operator: 'eq';
  value: string | number | boolean;
};

type RatioMapping = {
  kind: 'ratio';
  spendColumn: string;
  resultsColumn: string;
};

type ScalarTarget = Exclude<keyof ClientHealthValueInputs, 'currentRows' | 'previousRows'>;
type ScalarMapping = {
  kind: 'value';
  valueColumn: string;
  target: ScalarTarget;
  aggregation: 'sum' | 'single';
  window: 'month' | 'current' | 'previous';
};

type RelationContractInput = {
  sourceKey: string;
  /** The one approved client this source contract may collect. */
  clientKey: string;
  project: SupabaseProject;
  relation: string;
  dateColumn: string;
  /** A verified globally unique, immutable key. Date-only pagination is forbidden. */
  uniqueOrderColumn: string;
  /** Exact client/campaign predicates declared in source-contract code, never request input. */
  filters: readonly StaticFilter[];
  mapping: RatioMapping | ScalarMapping;
};

const approvedContractBrand: unique symbol = Symbol('approvedSupabaseRelationContract');
export type ApprovedSupabaseRelationContract = Readonly<RelationContractInput> & {
  readonly [approvedContractBrand]: true;
};

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

// Match the engine's exact finite binary64 aggregation domain. This precision
// preserves every possible nonnegative number-array sum before the adapter
// verifies that its number-shaped output can represent the total exactly.
const AdapterDecimal = Decimal.clone({ precision: 650, rounding: Decimal.ROUND_HALF_UP });
type AdapterDecimal = InstanceType<typeof AdapterDecimal>;

function identifier(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !IDENTIFIER.test(value)) {
    throw new Error(`${field} must be an approved static lowercase SQL identifier`);
  }
}

/**
 * Call only at module scope with reviewed literal identifiers and filters. The adapter
 * itself accepts only AdapterContext, so route/user input can never choose SQL objects.
 */
export function defineApprovedSupabaseRelationContract(
  input: RelationContractInput,
): ApprovedSupabaseRelationContract {
  if (!input || typeof input !== 'object') throw new Error('Supabase relation contract is malformed');
  if (typeof input.sourceKey !== 'string' || input.sourceKey.trim() === '') throw new Error('sourceKey is required');
  if (typeof input.clientKey !== 'string' || input.clientKey.trim() === '') throw new Error('clientKey is required');
  if (input.project !== 'prepass' && input.project !== 'eic') throw new Error('Unsupported Supabase project in contract');
  identifier(input.relation, 'relation');
  identifier(input.dateColumn, 'dateColumn');
  if (!input.uniqueOrderColumn) throw new Error('A verified stable unique order key is required');
  identifier(input.uniqueOrderColumn, 'uniqueOrderColumn');
  if (input.uniqueOrderColumn === input.dateColumn) {
    throw new Error('Stable unique order key must be separate from the date column');
  }
  if (!Array.isArray(input.filters)) throw new Error('filters must be a static array');
  for (const [index, filter] of input.filters.entries()) {
    if (!filter || filter.operator !== 'eq') throw new Error(`filters[${index}] must be an exact equality filter`);
    identifier(filter.column, `filters[${index}].column`);
    if (!['string', 'number', 'boolean'].includes(typeof filter.value)) throw new Error(`filters[${index}].value is invalid`);
    if (typeof filter.value === 'number' && !Number.isFinite(filter.value)) throw new Error(`filters[${index}].value must be finite`);
  }
  if (input.mapping.kind === 'ratio') {
    identifier(input.mapping.spendColumn, 'mapping.spendColumn');
    identifier(input.mapping.resultsColumn, 'mapping.resultsColumn');
  } else if (input.mapping.kind === 'value') {
    identifier(input.mapping.valueColumn, 'mapping.valueColumn');
    if (!['sum', 'single'].includes(input.mapping.aggregation)) throw new Error('value aggregation is invalid');
    if (!['month', 'current', 'previous'].includes(input.mapping.window)) throw new Error('value window is invalid');
    if (!['budget', 'monthSpend', 'hoursUsed', 'hoursAllotted', 'overdueTaskCount', 'revenue', 'fulfillmentCost'].includes(input.mapping.target)) {
      throw new Error('value target is invalid');
    }
  } else {
    throw new Error('mapping is invalid');
  }
  const approved = {
    ...input,
    filters: Object.freeze(input.filters.map((filter) => Object.freeze({ ...filter }))),
    mapping: Object.freeze({ ...input.mapping }),
  } as RelationContractInput & { [approvedContractBrand]?: true };
  Object.defineProperty(approved, approvedContractBrand, { value: true, enumerable: false });
  return Object.freeze(approved) as ApprovedSupabaseRelationContract;
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

function validateContext(context: AdapterContext): void {
  if (!context || typeof context !== 'object') throw new Error('Adapter context is malformed');
  if (typeof context.clientKey !== 'string' || context.clientKey.trim() === '') throw new Error('clientKey is required');
  if (typeof context.timezone !== 'string' || context.timezone.trim() === '') throw new Error('timezone is required');
  if (typeof context.sourceContractVersion !== 'string' || context.sourceContractVersion.trim() === '') {
    throw new Error('sourceContractVersion is required');
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
  if (context.windows.previous.end >= context.windows.current.start) throw new Error('previous and current windows must not overlap');
}

function selectedColumns(contract: ApprovedSupabaseRelationContract): string[] {
  const mappingColumns = contract.mapping.kind === 'ratio'
    ? [contract.mapping.spendColumn, contract.mapping.resultsColumn]
    : [contract.mapping.valueColumn];
  return [...new Set([
    contract.dateColumn,
    contract.uniqueOrderColumn,
    ...mappingColumns,
  ])].sort();
}

function queryWindow(
  contract: ApprovedSupabaseRelationContract,
  context: AdapterContext,
): { start: string; end: string } {
  if (contract.mapping.kind === 'value') return context.windows[contract.mapping.window];
  return {
    start: [context.windows.month.start, context.windows.current.start, context.windows.previous.start].sort()[0],
    end: context.lastCompleteDate,
  };
}

function requestEvidence(
  contract: ApprovedSupabaseRelationContract,
  context: AdapterContext,
  pageSize: number,
): SourceAdapterEvidence {
  const window = queryWindow(contract, context);
  const filters = contract.filters.map((filter) => ({ ...filter })).sort((left, right) => {
    const leftJson = canonicalEvidenceJson(left);
    const rightJson = canonicalEvidenceJson(right);
    return leftJson < rightJson ? -1 : leftJson > rightJson ? 1 : 0;
  });
  const requestFingerprint = canonicalEvidenceHash({
    sourceKey: contract.sourceKey,
    project: contract.project,
    relation: contract.relation,
    columns: selectedColumns(contract),
    filters,
    inclusiveWindow: window,
    order: [contract.dateColumn, contract.uniqueOrderColumn],
    pageSize,
    sourceContractVersion: context.sourceContractVersion,
    clientKey: context.clientKey,
    timezone: context.timezone,
  });
  return {
    sourceKey: contract.sourceKey,
    project: contract.project,
    relation: contract.relation,
    retrievedAt: context.retrievedAt,
    sourceContractVersion: context.sourceContractVersion,
    requestFingerprint,
  };
}

function failureResult(
  contract: ApprovedSupabaseRelationContract,
  evidence: SourceAdapterEvidence,
  failure: AdapterFailure,
  fetchedRows: number,
): SourceAdapterResult {
  return {
    source: {
      key: contract.sourceKey,
      status: fetchedRows > 0 ? 'partial' : 'failed',
      dataThrough: null,
      stale: true,
      rowCount: fetchedRows > 0 ? fetchedRows : null,
    },
    values: EMPTY_VALUES(),
    evidence,
    failure,
  };
}

function rowObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stableKey(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return `s:${value}`;
  if (typeof value === 'number' && Number.isFinite(value)) return `n:${value}`;
  return null;
}

function orderedAfter(
  previousDate: string,
  previousKey: string | number,
  date: string,
  key: string | number,
): boolean {
  if (date !== previousDate) return date > previousDate;
  if (typeof key !== typeof previousKey) return false;
  return key > previousKey;
}

function nonnegative(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${field} must be a finite number`);
  if (value < 0) throw new Error(`${field} must be nonnegative`);
  return Object.is(value, -0) ? 0 : value;
}

function decimal(value: number): AdapterDecimal {
  return new AdapterDecimal(value);
}

function exactDecimalSum(values: number[], field: string): number {
  const total = values.reduce((sum, value) => sum.plus(decimal(value)), new AdapterDecimal(0));
  const result = total.toNumber();
  if (!Number.isFinite(result) || (!total.isZero() && result === 0) || !decimal(result).eq(total)) {
    throw new Error(`${field} must be exactly representable as a finite number`);
  }
  return Object.is(result, -0) ? 0 : result;
}

function inWindow(date: string, window: { start: string; end: string }): boolean {
  return date >= window.start && date <= window.end;
}

function normalizeValues(
  contract: ApprovedSupabaseRelationContract,
  rows: Record<string, unknown>[],
  context: AdapterContext,
): ClientHealthValueInputs {
  const values = EMPTY_VALUES();
  if (contract.mapping.kind === 'ratio') {
    const currentRows: RatioRow[] = [];
    const previousRows: RatioRow[] = [];
    const monthSpend: number[] = [];
    let monthRows = 0;
    for (const [index, row] of rows.entries()) {
      const date = row[contract.dateColumn] as string;
      const normalized = {
        spend: nonnegative(row[contract.mapping.spendColumn], `rows[${index}].spend`),
        results: nonnegative(row[contract.mapping.resultsColumn], `rows[${index}].results`),
      };
      if (inWindow(date, context.windows.current)) currentRows.push(normalized);
      if (inWindow(date, context.windows.previous)) previousRows.push(normalized);
      if (inWindow(date, context.windows.month)) {
        monthSpend.push(normalized.spend);
        monthRows += 1;
      }
    }
    values.currentRows = currentRows.length > 0 ? currentRows : null;
    values.previousRows = previousRows.length > 0 ? previousRows : null;
    values.monthSpend = monthRows > 0 ? exactDecimalSum(monthSpend, 'month spend aggregate') : null;
    return values;
  }

  const scalarMapping = contract.mapping as ScalarMapping;
  const applicable = rows.filter((row) => inWindow(row[contract.dateColumn] as string, context.windows[scalarMapping.window]));
  const parsed = applicable.map((row, index) => {
    const raw = row[scalarMapping.valueColumn];
    return raw === null || raw === undefined ? null : nonnegative(raw, `rows[${index}].value`);
  });
  let value: number | null = null;
  if (scalarMapping.aggregation === 'single') {
    if (parsed.length > 1) throw new Error('single value mapping returned multiple rows');
    value = parsed[0] ?? null;
  } else if (parsed.length > 0 && parsed.every((item) => item !== null)) {
    value = exactDecimalSum(parsed as number[], 'value aggregate');
  }
  (values[scalarMapping.target] as number | null) = value;
  return values;
}

export type SupabaseAdapterOptions = {
  /** Generic contracts can execute only through an explicitly injected client. */
  client: SupabaseLikeClient;
  pageSize?: number;
  maxPages?: number;
};

type CompleteScan = {
  ok: true;
  rows: Record<string, unknown>[];
  count: number;
  digest: string;
};

type FailedScan = {
  ok: false;
  failure: AdapterFailure;
  fetchedRows: number;
};

async function scanDeterministically(
  contract: ApprovedSupabaseRelationContract,
  context: AdapterContext,
  client: SupabaseLikeClient,
  pageSize: number,
  maxPages: number,
): Promise<CompleteScan | FailedScan> {
  const window = queryWindow(contract, context);
  const columns = selectedColumns(contract);
  const rows: Record<string, unknown>[] = [];
  const keys = new Set<string>();
  let expectedCount: number | null = null;
  let previousDate: string | null = null;
  let previousOrderKey: string | number | null = null;
  let orderKeyType: 'string' | 'number' | null = null;

  const fail = (failure: AdapterFailure): FailedScan => ({ ok: false, failure, fetchedRows: rows.length });

  for (let page = 0; page < maxPages; page += 1) {
    let response: SupabaseLikeResponse;
    try {
      let query = client
        .from(contract.relation)
        .select(columns.join(','), { count: 'exact' })
        .gte(contract.dateColumn, window.start)
        .lte(contract.dateColumn, window.end);
      for (const filter of contract.filters) query = query.eq(filter.column, filter.value);
      response = await query
        .order(contract.dateColumn, { ascending: true })
        .order(contract.uniqueOrderColumn, { ascending: true })
        .range(page * pageSize, ((page + 1) * pageSize) - 1);
    } catch {
      return fail({
        code: rows.length > 0 ? 'partial_query' : 'query_failed',
        reason: rows.length > 0 ? 'A later source page failed; accumulated rows were discarded.' : 'The source query failed.',
      });
    }

    if (!response || typeof response !== 'object') {
      return fail({ code: 'query_failed', reason: 'The source query returned a malformed response.' });
    }
    if (response.error) {
      return fail({
        code: rows.length > 0 ? 'partial_query' : 'query_failed',
        reason: rows.length > 0 ? 'A later source page failed; accumulated rows were discarded.' : 'The source query failed.',
      });
    }
    if (!Number.isSafeInteger(response.count) || (response.count as number) < 0) {
      return fail({ code: 'invalid_count', reason: 'Exact source count is missing or invalid.' });
    }
    if (expectedCount === null) expectedCount = response.count;
    else if (response.count !== expectedCount) {
      return fail({ code: 'count_changed', reason: 'Exact source count changed during pagination.' });
    }
    if (!Array.isArray(response.data) || response.data.length > pageSize) {
      return fail({ code: 'malformed_row', reason: 'A source page was malformed.' });
    }

    for (const item of response.data) {
      const row = rowObject(item);
      if (!row) return fail({ code: 'malformed_row', reason: 'A source row was malformed.' });
      const date = row[contract.dateColumn];
      try {
        if (typeof date !== 'string') throw new Error('date missing');
        assertDateOnly(date, 'source row date');
      } catch {
        return fail({ code: 'malformed_row', reason: 'A source row date was malformed.' });
      }
      if (date < window.start || date > window.end) {
        return fail({ code: 'malformed_row', reason: 'A source row date fell outside the inclusive request window.' });
      }
      const rawKey = row[contract.uniqueOrderColumn];
      if (typeof rawKey !== 'string' && typeof rawKey !== 'number') {
        return fail({ code: 'malformed_row', reason: 'A source row is missing its stable unique key.' });
      }
      const key = stableKey(rawKey);
      if (key === null) return fail({ code: 'malformed_row', reason: 'A source row is missing its stable unique key.' });
      const rawKeyType: 'string' | 'number' = typeof rawKey === 'string' ? 'string' : 'number';
      if (orderKeyType === null) orderKeyType = rawKeyType;
      else if (rawKeyType !== orderKeyType) {
        return fail({ code: 'page_order', reason: 'The stable unique-key type changed within the source result.' });
      }
      if (keys.has(key)) return fail({ code: 'duplicate_key', reason: 'A duplicate stable unique key was returned.' });
      if (previousDate !== null && previousOrderKey !== null && !orderedAfter(previousDate, previousOrderKey, date, rawKey)) {
        return fail({ code: 'page_order', reason: 'Source pages were not in stable date and unique-key order.' });
      }
      keys.add(key);
      previousDate = date;
      previousOrderKey = rawKey;
      rows.push(row);
    }

    const total = expectedCount as number;
    if (rows.length > total) {
      return fail({ code: 'incomplete_page', reason: 'Fetched row count exceeded the exact source count.' });
    }
    if (rows.length === total) {
      try {
        const canonicalRows = rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]])));
        return { ok: true, rows, count: total, digest: canonicalEvidenceHash({ count: total, rows: canonicalRows }) };
      } catch {
        return fail({ code: 'malformed_row', reason: 'A selected source value was malformed.' });
      }
    }
    if (response.data.length < pageSize) {
      return fail({ code: 'incomplete_page', reason: 'Source pagination ended before exact count completeness was reached.' });
    }
  }

  return fail({ code: 'max_pages', reason: 'Maximum page limit was exhausted before count reconciliation.' });
}

/**
 * Uses stable offset pages because the typed query surface deliberately has no raw
 * PostgREST filter interpolation. Success requires two identical complete scans.
 * High-volume production contracts should prefer an existing single-request
 * aggregated view or RPC instead of adding a large relation contract here.
 */
export function createDeterministicSupabaseRelationAdapter(
  contract: ApprovedSupabaseRelationContract,
  options: SupabaseAdapterOptions,
): (context: AdapterContext) => Promise<SourceAdapterResult> {
  if (!contract || typeof contract !== 'object' || contract[approvedContractBrand] !== true) {
    throw new Error('An approved Supabase relation contract is required');
  }
  if (!options || typeof options !== 'object' || !options.client || typeof options.client.from !== 'function') {
    throw new Error('An explicitly injected Supabase client is required');
  }
  const pageSize = options.pageSize ?? 1_000;
  const maxPages = options.maxPages ?? 100;
  if (!Number.isInteger(pageSize) || pageSize <= 0) throw new Error('pageSize must be a positive integer');
  if (!Number.isInteger(maxPages) || maxPages <= 0) throw new Error('maxPages must be a positive integer');

  return async (context) => {
    validateContext(context);
    if (context.clientKey !== contract.clientKey) {
      throw new Error('Adapter context client does not match its approved source contract');
    }
    const evidence = requestEvidence(contract, context, pageSize);
    const first = await scanDeterministically(contract, context, options.client, pageSize, maxPages);
    if ('failure' in first) return failureResult(contract, evidence, first.failure, first.fetchedRows);

    let values: ClientHealthValueInputs;
    try {
      values = normalizeValues(contract, first.rows, context);
    } catch {
      return failureResult(contract, evidence, {
        code: 'malformed_row',
        reason: 'Source numeric values were malformed, null, nonfinite, or nonnegative validation failed.',
      }, first.rows.length);
    }

    const second = await scanDeterministically(contract, context, options.client, pageSize, maxPages);
    if ('failure' in second) {
      return failureResult(contract, evidence, second.failure, Math.max(first.rows.length, second.fetchedRows));
    }
    if (second.count !== first.count || second.digest !== first.digest) {
      return failureResult(contract, evidence, {
        code: 'source_changed',
        reason: 'The source changed between deterministic verification scans; all fetched values were discarded.',
      }, Math.max(first.rows.length, second.rows.length));
    }

    const window = queryWindow(contract, context);
    const dataThrough = first.rows.length === 0
      ? null
      : first.rows[first.rows.length - 1][contract.dateColumn] as string;
    return {
      source: {
        key: contract.sourceKey,
        status: 'succeeded',
        dataThrough,
        stale: dataThrough !== window.end,
        rowCount: first.rows.length,
      },
      values,
      evidence,
      failure: null,
    };
  };
}
