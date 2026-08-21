import assert from 'node:assert/strict';
import test from 'node:test';

import { buildClientHealthSnapshot, type EngineMetricConfig } from '../engine.ts';
import { canonicalEvidenceHash } from '../evidence.ts';
import { createApprovedProductionGoogleSheetsAdapter } from './google-sheets-production.ts';
import {
  createDeterministicGoogleSheetsMarginAdapter,
  defineInjectedGoogleSheetsContract,
  type GoogleSheetsV4LikeClient,
  type GoogleSheetsValuesRequest,
  type GoogleSheetsValuesResponse,
} from './google-sheets.ts';
import type { AdapterContext } from './types.ts';

const headers = {
  clientAlias: 'Client Alias',
  reportingPeriod: 'Reporting Month',
  dataThrough: 'Data Through',
  revenue: 'Revenue',
  fulfillmentCost: 'Fulfillment Cost',
};
const headerRow = Object.values(headers);
const context: AdapterContext = {
  clientKey: 'fixture',
  timezone: 'America/Phoenix',
  retrievedAt: '2026-08-20T12:00:00.000Z',
  lastCompleteDate: '2026-08-19',
  windows: {
    month: { start: '2026-08-01', end: '2026-08-19' },
    current: { start: '2026-08-06', end: '2026-08-19' },
    previous: { start: '2026-07-23', end: '2026-08-05' },
  },
  sourceContractVersion: 'margin-fixture-v1',
};
const contract = (aliases: readonly string[] = ['Fixture LLC', 'Fixture']) => defineInjectedGoogleSheetsContract({
  sourceKey: 'margin_sheet',
  clientKey: 'fixture',
  spreadsheetId: 'private_sheet-ID_123',
  range: "'Monthly Margin'!A1:F1000",
  timezone: 'America/Phoenix',
  contractVersion: 'margin-fixture-v1',
  approvedClientAliases: aliases,
  headers,
});
const envelope = (values: unknown[][]): GoogleSheetsValuesResponse => ({
  data: { range: "'Monthly Margin'!A1:F1000", majorDimension: 'ROWS', values },
});
const row = (
  alias: unknown = 'Fixture LLC',
  period: unknown = '2026-08',
  dataThrough: unknown = '2026-08-19',
  revenue: unknown = 10_000,
  fulfillmentCost: unknown = 3_000,
): unknown[] => [alias, period, dataThrough, revenue, fulfillmentCost];
const emptyValues = {
  budget: null,
  monthSpend: null,
  currentRows: null,
  previousRows: null,
  hoursUsed: null,
  hoursAllotted: null,
  overdueTaskCount: null,
  revenue: null,
  fulfillmentCost: null,
};

function mockClient(responses: Array<GoogleSheetsValuesResponse | Error>) {
  const calls: GoogleSheetsValuesRequest[] = [];
  const client: GoogleSheetsV4LikeClient = {
    spreadsheets: { values: { async get(request) {
      calls.push(request);
      const response = responses.shift();
      assert.ok(response, 'missing mocked Google Sheets response');
      if (response instanceof Error) throw response;
      return response;
    } } },
  };
  return { client, calls };
}

function adapter(responses: Array<GoogleSheetsValuesResponse | Error>, aliases?: readonly string[]) {
  const mocked = mockClient(responses);
  return {
    ...mocked,
    run: createDeterministicGoogleSheetsMarginAdapter(contract(aliases), { client: mocked.client }),
  };
}

function repeated(values: unknown[][]): GoogleSheetsValuesResponse[] {
  return [envelope(values), envelope(values)];
}

test('reads an exact row after strict header reordering with authenticated values options', async () => {
  const reorderedHeaders = ['Revenue', 'Data Through', 'Client Alias', 'Fulfillment Cost', 'Reporting Month'];
  const values = [reorderedHeaders, [10_000, '2026-08-19', '  FIXTURE llc  ', 3_000, '2026-08']];
  const { run, calls } = adapter(repeated(values));
  const result = await run(context);

  assert.equal(result.source.status, 'succeeded');
  assert.deepEqual(result.source, {
    key: 'margin_sheet', status: 'succeeded', dataThrough: '2026-08-19', stale: false, rowCount: 1,
  });
  assert.deepEqual(result.values, { ...emptyValues, revenue: 10_000, fulfillmentCost: 3_000 });
  assert.equal(result.evidence.matchedRowCount, 1);
  assert.equal(result.failure, null);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], {
    spreadsheetId: 'private_sheet-ID_123',
    range: "'Monthly Margin'!A1:F1000",
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  assert.deepEqual(calls[1], calls[0]);
  assert.equal(JSON.stringify(calls).includes('http'), false);
});

test('preserves verified revenue and fulfillment-cost zero', async () => {
  const result = await adapter(repeated([headerRow, row('Fixture', '2026-08', '2026-08-19', 0, -0)])).run(context);
  assert.equal(result.source.status, 'succeeded');
  assert.equal(result.values.revenue, 0);
  assert.equal(result.values.fulfillmentCost, 0);
});

test('fails closed on duplicate, empty, inexact, or missing required headers', async () => {
  const cases: Array<[string, unknown[]]> = [
    ['duplicate', ['Client Alias', 'Reporting Month', 'Data Through', 'Revenue', 'Revenue']],
    ['empty', ['Client Alias', '', 'Data Through', 'Revenue', 'Fulfillment Cost']],
    ['inexact', ['Client Alias', ' Reporting Month', 'Data Through', 'Revenue', 'Fulfillment Cost']],
    ['missing', ['Client Alias', 'Period', 'Data Through', 'Revenue', 'Fulfillment Cost']],
  ];
  for (const [name, header] of cases) {
    const result = await adapter([envelope([header, row()])]).run(context);
    assert.notEqual(result.source.status, 'succeeded', name);
    assert.deepEqual(result.values, emptyValues, name);
  }
});

test('rejects approved alias normalization collisions and forged unbranded contracts', () => {
  assert.throws(() => contract(['Fixture', ' fixture ']), /collide/i);
  assert.throws(() => contract(['ACME', 'acme']), /collide/i);
  assert.throws(
    () => createDeterministicGoogleSheetsMarginAdapter({ ...contract() } as never, { client: mockClient([]).client }),
    /injected Google Sheets contract/i,
  );
  assert.throws(() => createDeterministicGoogleSheetsMarginAdapter(contract(), {} as never), /authenticated Google Sheets/i);
});

test('requires exactly one approved alias/client-period row', async () => {
  const duplicate = await adapter([envelope([
    headerRow,
    row('Fixture'),
    row(' fixture llc ', '2026-08', '2026-08-18', 9_000, 2_000),
  ])]).run(context);
  assert.equal(duplicate.failure?.code, 'duplicate_key');
  assert.equal(duplicate.source.status, 'partial');
  assert.equal(duplicate.evidence.matchedRowCount, 2);
  assert.deepEqual(duplicate.values, emptyValues);

  const noAlias = await adapter([envelope([headerRow, row('Other Client')])]).run(context);
  assert.equal(noAlias.source.status, 'failed');
  assert.equal(noAlias.source.rowCount, null);
  assert.deepEqual(noAlias.values, emptyValues);

  const wrongPeriod = await adapter([envelope([headerRow, row('Fixture', '2026-07')])]).run(context);
  assert.equal(wrongPeriod.source.status, 'failed');
  assert.deepEqual(wrongPeriod.values, emptyValues);
});

test('rejects missing, null, string, formula, negative, and nonfinite numeric cells', async () => {
  const badValues: Array<[string, unknown, unknown]> = [
    ['missing revenue', undefined, 1],
    ['null revenue', null, 1],
    ['string revenue', '100', 1],
    ['formula revenue', '=SUM(A1:A2)', 1],
    ['negative revenue', -1, 1],
    ['infinite revenue', Number.POSITIVE_INFINITY, 1],
    ['NaN fulfillment', 1, Number.NaN],
    ['missing fulfillment', 1, undefined],
    ['null fulfillment', 1, null],
    ['string fulfillment', 1, '1'],
    ['formula fulfillment', 1, '=A1'],
    ['negative fulfillment', 1, -1],
  ];
  for (const [name, revenue, cost] of badValues) {
    const cells = row('Fixture', '2026-08', '2026-08-19', revenue ?? 0, cost ?? 0);
    cells[3] = revenue;
    cells[4] = cost;
    const result = await adapter([envelope([headerRow, cells])]).run(context);
    assert.equal(result.failure?.code, 'malformed_row', name);
    assert.deepEqual(result.values, emptyValues, name);
  }
});

test('rejects malformed, wrong-month, and future data-through dates but marks older valid data stale', async () => {
  for (const [name, date] of [
    ['malformed', '08/19/2026'],
    ['unknown date', '2026-02-30'],
    ['wrong month', '2026-07-31'],
    ['future', '2026-08-20'],
    ['non-string', 45_522],
  ] as const) {
    const result = await adapter([envelope([headerRow, row('Fixture', '2026-08', date)])]).run(context);
    assert.equal(result.failure?.code, 'malformed_row', name);
    assert.deepEqual(result.values, emptyValues, name);
  }
  const stale = await adapter(repeated([headerRow, row('Fixture', '2026-08', '2026-08-17')])).run(context);
  assert.equal(stale.source.status, 'succeeded');
  assert.equal(stale.source.dataThrough, '2026-08-17');
  assert.equal(stale.source.stale, true);
});

test('fails closed on malformed envelopes, API errors, unsupported cells, and over-width rows', async () => {
  const secret = 'oauth-token-and-private-row-value';
  const cases: Array<[string, GoogleSheetsValuesResponse | Error]> = [
    ['transport', new Error(secret)],
    ['API error', { data: { values: [] }, error: { message: secret } }],
    ['missing data', {}],
    ['missing values', { data: {} }],
    ['empty values', envelope([])],
    ['wrong dimension', { data: { majorDimension: 'COLUMNS', values: [headerRow] } }],
    ['object cell', envelope([headerRow, row('Fixture', '2026-08', '2026-08-19', { secret }, 1)])],
    ['over width', envelope([headerRow, [...row(), 1, 2]])],
  ];
  for (const [name, response] of cases) {
    const result = await adapter([response]).run(context);
    assert.notEqual(result.source.status, 'succeeded', name);
    assert.deepEqual(result.values, emptyValues, name);
    assert.equal(JSON.stringify(result).includes(secret), false, name);
  }
});

test('requires two complete identical canonical scans and discards mutation', async () => {
  const result = await adapter([
    envelope([headerRow, row('Fixture', '2026-08', '2026-08-19', 10_000, 3_000)]),
    envelope([headerRow, row('Fixture', '2026-08', '2026-08-19', 10_001, 3_000)]),
  ]).run(context);
  assert.equal(result.failure?.code, 'source_changed');
  assert.equal(result.source.status, 'partial');
  assert.deepEqual(result.values, emptyValues);

  const secondFailure = await adapter([
    envelope([headerRow, row()]),
    new Error('second scan private transport failure'),
  ]).run(context);
  assert.equal(secondFailure.failure?.code, 'query_failed');
  assert.deepEqual(secondFailure.values, emptyValues);
});

test('evidence is deterministic and contains no credentials, raw rows, formulas, aliases, or errors', async () => {
  const privateAlias = 'Private Client Legal Name';
  const values = [headerRow, row(privateAlias, '2026-08', '2026-08-19', 12_345.67, 7_654.32)];
  const first = await adapter(repeated(values), [privateAlias]).run(context);
  const second = await adapter(repeated(values), [privateAlias]).run(context);
  assert.deepEqual(first.evidence, second.evidence);
  assert.deepEqual(Object.keys(first.evidence).sort(), [
    'approvedClientAliasHash', 'dateTimeRenderOption', 'matchedRowCount', 'provider', 'range', 'requestFingerprint',
    'sourceContractVersion', 'sourceKey', 'spreadsheetId', 'valueRenderOption',
  ]);
  assert.equal(first.evidence.approvedClientAliasHash, canonicalEvidenceHash(['private client legal name']));
  assert.match(first.evidence.requestFingerprint, /^[a-f0-9]{64}$/);
  const serialized = JSON.stringify(first.evidence).toLowerCase();
  for (const forbidden of [
    'private client', '12345', '7654', 'oauth', 'token', 'authorization', 'headers', 'raw',
    'formula', 'error', 'http', 'csv', context.retrievedAt.toLowerCase(),
  ]) assert.equal(serialized.includes(forbidden), false, forbidden);
});

test('contract and context scopes are static and fail before any request', async () => {
  const contractWithRange = (range: string) => defineInjectedGoogleSheetsContract({
    sourceKey: 'x', clientKey: 'x', spreadsheetId: 'id', range,
    timezone: 'America/Phoenix', contractVersion: 'v1', approvedClientAliases: ['x'], headers,
  });

  assert.throws(() => contractWithRange('https://example.test/sheet.csv'), /bounded A1/i);
  assert.doesNotThrow(() => contractWithRange("'August ''26'!A1:E1000"));
  assert.doesNotThrow(() => contractWithRange('Sheet!A1:BL10000'));
  assert.doesNotThrow(() => contractWithRange('Sheet!ZXO9990000:ZZZ9999999'));

  for (const [name, range] of [
    ['unescaped worksheet apostrophe', "'August '26'!A1:E1000"],
    ['worksheet exclamation', "'August!26'!A1:E1000"],
    ['worksheet carriage return', "'August\r26'!A1:E1000"],
    ['worksheet line feed', "'August\n26'!A1:E1000"],
    ['230-character start column', `Sheet!${'A'.repeat(230)}1:E1000`],
    ['230-character end column', `Sheet!A1:${'Z'.repeat(230)}1000`],
    ['400-digit start row', `Sheet!A${'1'.repeat(400)}:E1000`],
    ['400-digit end row', `Sheet!A1:E${'9'.repeat(400)}`],
    ['noncanonical start row', 'Sheet!A01:E1000'],
    ['reversed columns', 'Sheet!E1:A1000'],
    ['reversed rows', 'Sheet!A1000:E1'],
    ['column span overflow', 'Sheet!A1:BM1000'],
    ['row span overflow', 'Sheet!A1:E10001'],
  ] as const) assert.throws(() => contractWithRange(range), Error, name);

  const mocked = mockClient([]);
  const run = createDeterministicGoogleSheetsMarginAdapter(contract(), { client: mocked.client });
  for (const changed of [
    { ...context, clientKey: 'other' },
    { ...context, timezone: 'UTC' },
    { ...context, sourceContractVersion: 'other' },
  ]) await assert.rejects(run(changed), /does not match/i);
  assert.deepEqual(mocked.calls, []);
});

test('Google Sheets margin result feeds the engine without reshaping', async () => {
  const adapted = await adapter(repeated([headerRow, row()])).run(context);
  const metricConfig: EngineMetricConfig[] = [
    { key: 'budget_pacing', required: false, weight: 1, direction: 'lower_is_better', greenThreshold: 100, yellowThreshold: 200, sourceKeys: ['optional'] },
    { key: 'north_star', required: false, weight: 1, direction: 'lower_is_better', greenThreshold: 100, yellowThreshold: 200, sourceKeys: ['optional'] },
    { key: 'hours', required: false, weight: 1, direction: 'lower_is_better', greenThreshold: 100, yellowThreshold: 200, sourceKeys: ['optional'] },
    { key: 'overdue_tasks', required: false, weight: 1, direction: 'lower_is_better', greenThreshold: 1, yellowThreshold: 2, sourceKeys: ['optional'] },
    { key: 'margin', required: true, weight: 1, direction: 'higher_is_better', greenThreshold: 60, yellowThreshold: 40, sourceKeys: ['margin_sheet'] },
  ];
  const snapshot = buildClientHealthSnapshot({
    clientKey: context.clientKey,
    configApproved: true,
    lastCompleteSourceDate: context.lastCompleteDate,
    calculationVersion: 'fixture',
    metricConfig,
    sources: [adapted.source],
    values: adapted.values,
  });
  assert.equal(snapshot.values.revenue, 10_000);
  assert.equal(snapshot.values.fulfillmentCost, 3_000);
  assert.equal(snapshot.values.marginPercent, 70);
  assert.notEqual(snapshot.dimensions.margin.status, 'incomplete');
});

test('production allowlist is empty, Canary fails closed, and only the key creator is exported', async () => {
  for (const key of ['unknown', 'fixture', 'canary', 'canary:anything', 'private_sheet-ID_123', '', null]) {
    assert.throws(() => createApprovedProductionGoogleSheetsAdapter(key as never), /unsupported production Google Sheets adapter key/i);
  }
  assert.deepEqual(Object.keys(await import('./google-sheets-production.ts')), ['createApprovedProductionGoogleSheetsAdapter']);
  const genericModule = await import('./google-sheets.ts');
  assert.equal('GOOGLE_SHEETS_CLIENTS' in genericModule, false);
  assert.equal('defineApprovedGoogleSheetsContract' in genericModule, false);
  assert.equal('ApprovedGoogleSheetsContract' in genericModule, false);
});
