import 'server-only';

import { assertDateOnly } from '../date-windows.ts';
import { canonicalEvidenceHash } from '../evidence.ts';
import type { ClientHealthValueInputs } from '../engine.ts';
import type {
  AdapterContext,
  AdapterFailure,
  GoogleSheetsAdapterEvidence,
  SourceAdapterResult,
} from './types.ts';

export type { AdapterContext, SourceAdapterResult } from './types.ts';

export type GoogleSheetsValuesRequest = {
  spreadsheetId: string;
  range: string;
  valueRenderOption: 'UNFORMATTED_VALUE';
  dateTimeRenderOption: 'FORMATTED_STRING';
};

export type GoogleSheetsValuesResponse = {
  data?: unknown;
  error?: unknown;
};

/** Auth and transport remain the responsibility of the explicitly injected server-side client. */
export interface GoogleSheetsV4LikeClient {
  spreadsheets: {
    values: {
      get(request: GoogleSheetsValuesRequest): Promise<GoogleSheetsValuesResponse>;
    };
  };
}

export type GoogleSheetsLogicalHeaders = Readonly<{
  clientAlias: string;
  reportingPeriod: string;
  dataThrough: string;
  revenue: string;
  fulfillmentCost: string;
}>;

type GoogleSheetsContractInput = {
  sourceKey: string;
  clientKey: string;
  spreadsheetId: string;
  range: string;
  timezone: 'America/Phoenix';
  contractVersion: string;
  approvedClientAliases: readonly string[];
  headers: GoogleSheetsLogicalHeaders;
};

const injectedGoogleSheetsContractBrand: unique symbol = Symbol('injectedGoogleSheetsContract');
export type InjectedGoogleSheetsContract = Readonly<GoogleSheetsContractInput> & {
  readonly [injectedGoogleSheetsContractBrand]: true;
};

const GOOGLE_ID = /^[A-Za-z0-9_-]+$/;
const A1_RANGE = /^(?:'(?:[^'!\r\n]|'')+'|[A-Za-z0-9 _-]+)!([A-Z]{1,3})([1-9]\d{0,6}):([A-Z]{1,3})([1-9]\d{0,6})$/;
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_SHEET_ROWS = 10_000;
const MAX_SHEET_COLUMNS = 64;
const VALUE_RENDER_OPTION = 'UNFORMATTED_VALUE' as const;
const DATE_TIME_RENDER_OPTION = 'FORMATTED_STRING' as const;

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${field} is required`);
  if (value !== value.trim()) throw new Error(`${field} must not contain surrounding whitespace`);
  return value;
}

/** Deliberately limited to deterministic trim and locale-independent case normalization. */
function normalizeAlias(value: string): string {
  return value.trim().toLowerCase();
}

function columnNumber(column: string): number {
  let value = 0;
  for (const character of column) value = (value * 26) + character.charCodeAt(0) - 64;
  return value;
}

function rangeBounds(range: string): { columns: number; rows: number } {
  const match = A1_RANGE.exec(range);
  if (!match) throw new Error('range must be one static bounded A1 range');
  const startColumn = columnNumber(match[1]);
  const endColumn = columnNumber(match[3]);
  const startRow = Number(match[2]);
  const endRow = Number(match[4]);
  const coordinates = [startColumn, endColumn, startRow, endRow];
  if (coordinates.some((coordinate) => (
    !Number.isFinite(coordinate) || !Number.isSafeInteger(coordinate) || coordinate <= 0
  ))) throw new Error('range coordinates must be finite safe positive integers');
  if (endColumn < startColumn || endRow < startRow) throw new Error('range must be ordered');
  const columns = endColumn - startColumn + 1;
  const rows = endRow - startRow + 1;
  if (
    !Number.isFinite(columns) || !Number.isSafeInteger(columns) || columns <= 0
    || !Number.isFinite(rows) || !Number.isSafeInteger(rows) || rows <= 0
  ) throw new Error('range dimensions must be finite safe positive integers');
  if (columns > MAX_SHEET_COLUMNS || rows > MAX_SHEET_ROWS) throw new Error('range exceeds fixed sheet bounds');
  return { columns, rows };
}

/** Defines an injected/test contract only; this brand is not a production authorization claim. */
export function defineInjectedGoogleSheetsContract(
  input: GoogleSheetsContractInput,
): InjectedGoogleSheetsContract {
  if (!input || typeof input !== 'object') throw new Error('Injected Google Sheets contract is malformed');
  requiredText(input.sourceKey, 'sourceKey');
  requiredText(input.clientKey, 'clientKey');
  requiredText(input.contractVersion, 'contractVersion');
  if (!GOOGLE_ID.test(input.spreadsheetId)) throw new Error('spreadsheetId must be one static Google Sheets ID');
  rangeBounds(input.range);
  if (input.timezone !== 'America/Phoenix') throw new Error('Google Sheets reporting timezone must be America/Phoenix');
  if (!Array.isArray(input.approvedClientAliases) || input.approvedClientAliases.length === 0) {
    throw new Error('At least one approved client alias is required');
  }
  const aliases = input.approvedClientAliases.map((alias, index) => {
    if (typeof alias !== 'string' || normalizeAlias(alias) === '') throw new Error(`approvedClientAliases[${index}] is invalid`);
    return normalizeAlias(alias);
  }).sort();
  if (new Set(aliases).size !== aliases.length) {
    throw new Error('Approved client aliases collide after deterministic trim/case normalization');
  }
  if (!input.headers || typeof input.headers !== 'object') throw new Error('Logical sheet headers are required');
  const headers = {
    clientAlias: requiredText(input.headers.clientAlias, 'headers.clientAlias'),
    reportingPeriod: requiredText(input.headers.reportingPeriod, 'headers.reportingPeriod'),
    dataThrough: requiredText(input.headers.dataThrough, 'headers.dataThrough'),
    revenue: requiredText(input.headers.revenue, 'headers.revenue'),
    fulfillmentCost: requiredText(input.headers.fulfillmentCost, 'headers.fulfillmentCost'),
  };
  if (new Set(Object.values(headers)).size !== Object.keys(headers).length) {
    throw new Error('Logical sheet header names must be unique');
  }
  const injected = {
    ...input,
    approvedClientAliases: Object.freeze(aliases),
    headers: Object.freeze(headers),
  } as GoogleSheetsContractInput & { [injectedGoogleSheetsContractBrand]?: true };
  Object.defineProperty(injected, injectedGoogleSheetsContractBrand, { value: true, enumerable: false });
  return Object.freeze(injected) as InjectedGoogleSheetsContract;
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

function validateContext(context: AdapterContext, contract: InjectedGoogleSheetsContract): void {
  if (!context || typeof context !== 'object') throw new Error('Adapter context is malformed');
  if (context.clientKey !== contract.clientKey) throw new Error('Adapter context client does not match its injected Google Sheets contract');
  if (context.timezone !== contract.timezone) throw new Error('Adapter context timezone does not match its injected Google Sheets contract');
  if (context.sourceContractVersion !== contract.contractVersion) {
    throw new Error('Adapter context source contract version does not match its injected Google Sheets contract');
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
  if (context.windows.month.start !== `${context.lastCompleteDate.slice(0, 7)}-01`
    || context.windows.month.end !== context.lastCompleteDate) {
    throw new Error('month window must cover the current reporting month through lastCompleteDate');
  }
}

function evidenceFor(contract: InjectedGoogleSheetsContract): GoogleSheetsAdapterEvidence {
  const approvedClientAliasHash = canonicalEvidenceHash(contract.approvedClientAliases);
  const requestFingerprint = canonicalEvidenceHash({
    spreadsheetId: contract.spreadsheetId,
    range: contract.range,
    valueRenderOption: VALUE_RENDER_OPTION,
    dateTimeRenderOption: DATE_TIME_RENDER_OPTION,
    reportingTimezone: contract.timezone,
    contractVersion: contract.contractVersion,
    approvedClientAliasHash,
    headers: contract.headers,
  });
  return {
    sourceKey: contract.sourceKey,
    provider: 'google-sheets',
    spreadsheetId: contract.spreadsheetId,
    range: contract.range,
    valueRenderOption: VALUE_RENDER_OPTION,
    dateTimeRenderOption: DATE_TIME_RENDER_OPTION,
    sourceContractVersion: contract.contractVersion,
    approvedClientAliasHash,
    requestFingerprint,
    matchedRowCount: null,
  };
}

type CanonicalRow = {
  alias: string;
  period: string;
  dataThrough: string;
  revenue: number;
  fulfillmentCost: number;
};
type ScanSuccess = { ok: true; row: CanonicalRow; digest: string; matchingRows: number };
type ScanFailure = { ok: false; failure: AdapterFailure; matchingRows: number };

function failure(code: AdapterFailure['code'], reason: string, matchingRows = 0): ScanFailure {
  return { ok: false, failure: { code, reason }, matchingRows };
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonnegativeNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('invalid numeric cell');
  return Object.is(value, -0) ? 0 : value;
}

function parseEnvelope(
  response: GoogleSheetsValuesResponse,
  contract: InjectedGoogleSheetsContract,
  context: AdapterContext,
): ScanSuccess | ScanFailure {
  if (!response || typeof response !== 'object' || response.error !== undefined && response.error !== null) {
    return failure('query_failed', 'The authenticated Google Sheets values query failed.');
  }
  const data = object(response.data);
  if (!data || !Array.isArray(data.values)) {
    return failure('incomplete_page', 'Google Sheets returned a malformed values envelope.');
  }
  if (data.majorDimension !== undefined && data.majorDimension !== 'ROWS') {
    return failure('incomplete_page', 'Google Sheets returned an unsupported values orientation.');
  }
  const bounds = rangeBounds(contract.range);
  if (data.values.length === 0 || data.values.length > bounds.rows) {
    return failure('incomplete_page', 'Google Sheets returned an empty or over-bounds values envelope.');
  }
  const rows: unknown[][] = [];
  for (const rawRow of data.values) {
    if (!Array.isArray(rawRow) || rawRow.length > bounds.columns) {
      return failure('malformed_row', 'Google Sheets returned an over-width or malformed row.');
    }
    if (rawRow.some((cell) => !['string', 'number', 'boolean'].includes(typeof cell) && cell !== null)) {
      return failure('malformed_row', 'Google Sheets returned an unsupported cell value.');
    }
    rows.push(rawRow);
  }
  const header = rows[0];
  if (header.length === 0 || header.some((cell) => typeof cell !== 'string' || cell.trim() === '' || cell !== cell.trim())) {
    return failure('malformed_row', 'Google Sheets headers must be nonempty exact strings.');
  }
  if (new Set(header).size !== header.length) return failure('duplicate_key', 'Google Sheets returned duplicate headers.');
  const indexes = Object.fromEntries(Object.entries(contract.headers).map(([logical, name]) => [logical, header.indexOf(name)])) as Record<keyof GoogleSheetsLogicalHeaders, number>;
  if (Object.values(indexes).some((index) => index < 0)) {
    return failure('malformed_row', 'Google Sheets is missing an exact required logical header.');
  }

  const approved = new Set(contract.approvedClientAliases);
  const targetPeriod = context.windows.month.start.slice(0, 7);
  const candidates: CanonicalRow[] = [];
  for (const row of rows.slice(1)) {
    if (row.length === 0 || row.every((cell) => cell === '' || cell === null)) continue;
    const aliasCell = row[indexes.clientAlias];
    if (typeof aliasCell !== 'string') continue;
    const alias = normalizeAlias(aliasCell);
    if (!approved.has(alias)) continue;
    const period = row[indexes.reportingPeriod];
    if (typeof period !== 'string' || !PERIOD.test(period)) {
      return failure('malformed_row', 'A matching Google Sheets reporting period was malformed.', candidates.length + 1);
    }
    if (period !== targetPeriod) continue;
    const dataThrough = row[indexes.dataThrough];
    try {
      if (typeof dataThrough !== 'string') throw new Error('date must be a string');
      assertDateOnly(dataThrough, 'dataThrough');
      if (!dataThrough.startsWith(`${period}-`)) throw new Error('date is outside reporting month');
      if (dataThrough > context.lastCompleteDate) throw new Error('date is in the future');
      const revenue = nonnegativeNumber(row[indexes.revenue]);
      const fulfillmentCost = nonnegativeNumber(row[indexes.fulfillmentCost]);
      candidates.push({ alias, period, dataThrough, revenue, fulfillmentCost });
    } catch {
      return failure('malformed_row', 'A matching Google Sheets row had malformed, null, formula, string, negative, nonfinite, or out-of-window values.', candidates.length + 1);
    }
  }
  if (candidates.length === 0) {
    return failure('incomplete_page', 'Google Sheets returned no approved client row for the reporting period.');
  }
  if (candidates.length !== 1) {
    return failure('duplicate_key', 'Google Sheets returned duplicate approved client-period rows.', candidates.length);
  }
  let digest: string;
  try {
    digest = canonicalEvidenceHash({ values: rows, selected: candidates[0] });
  } catch {
    return failure('malformed_row', 'Google Sheets values could not be canonicalized.', candidates.length);
  }
  return { ok: true, row: candidates[0], digest, matchingRows: 1 };
}

async function scan(
  client: GoogleSheetsV4LikeClient,
  contract: InjectedGoogleSheetsContract,
  context: AdapterContext,
): Promise<ScanSuccess | ScanFailure> {
  let response: GoogleSheetsValuesResponse;
  try {
    response = await client.spreadsheets.values.get({
      spreadsheetId: contract.spreadsheetId,
      range: contract.range,
      valueRenderOption: VALUE_RENDER_OPTION,
      dateTimeRenderOption: DATE_TIME_RENDER_OPTION,
    });
  } catch {
    return failure('query_failed', 'The authenticated Google Sheets values query failed.');
  }
  try {
    return parseEnvelope(response, contract, context);
  } catch {
    return failure('incomplete_page', 'Google Sheets returned a malformed values envelope.');
  }
}

function failedResult(
  contract: InjectedGoogleSheetsContract,
  evidence: GoogleSheetsAdapterEvidence,
  failed: ScanFailure,
): SourceAdapterResult<GoogleSheetsAdapterEvidence> {
  return {
    source: {
      key: contract.sourceKey,
      status: failed.matchingRows > 0 ? 'partial' : 'failed',
      dataThrough: null,
      stale: true,
      rowCount: failed.matchingRows > 0 ? failed.matchingRows : null,
    },
    values: EMPTY_VALUES(),
    evidence: { ...evidence, matchedRowCount: failed.matchingRows > 0 ? failed.matchingRows : null },
    failure: failed.failure,
  };
}

/**
 * Authenticated injected-client adapter. There is intentionally no CSV/public-URL fallback.
 * Values are released only after two complete canonical scans are byte-for-byte equivalent.
 */
export function createDeterministicGoogleSheetsMarginAdapter(
  contract: InjectedGoogleSheetsContract,
  options: { client: GoogleSheetsV4LikeClient },
): (context: AdapterContext) => Promise<SourceAdapterResult<GoogleSheetsAdapterEvidence>> {
  if (!contract || typeof contract !== 'object' || contract[injectedGoogleSheetsContractBrand] !== true) {
    throw new Error('An explicitly injected Google Sheets contract is required');
  }
  if (!options || typeof options !== 'object' || !options.client
    || typeof options.client.spreadsheets?.values?.get !== 'function') {
    throw new Error('An explicitly injected authenticated Google Sheets v4-like client is required');
  }
  return async (context) => {
    validateContext(context, contract);
    const evidence = evidenceFor(contract);
    const first = await scan(options.client, contract, context);
    if ('failure' in first) return failedResult(contract, evidence, first);
    const second = await scan(options.client, contract, context);
    if ('failure' in second) return failedResult(contract, evidence, second);
    if (first.digest !== second.digest) {
      return failedResult(contract, evidence, failure(
        'source_changed',
        'Google Sheets changed between complete verification scans; all values were discarded.',
        Math.max(first.matchingRows, second.matchingRows),
      ));
    }
    return {
      source: {
        key: contract.sourceKey,
        status: 'succeeded',
        dataThrough: first.row.dataThrough,
        stale: first.row.dataThrough !== context.lastCompleteDate,
        rowCount: 1,
      },
      values: {
        ...EMPTY_VALUES(),
        revenue: first.row.revenue,
        fulfillmentCost: first.row.fulfillmentCost,
      },
      evidence: { ...evidence, matchedRowCount: 1 },
      failure: null,
    };
  };
}
