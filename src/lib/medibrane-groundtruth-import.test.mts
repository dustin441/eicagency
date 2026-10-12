import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { mergeGroundTruthWorkbookImports, parseGroundTruthWorkbook } from './medibrane-groundtruth-import.ts';

async function workbookBuffer(headers: string[], rows: unknown[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Location Report');
  sheet.addRow(headers);
  rows.forEach(row => sheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test('parses and aggregates a native GroundTruth location export', async () => {
  const buffer = await workbookBuffer(
    ['Account Name', 'Campaign Name', 'Campaign ID', 'Zipcode', 'City', 'State', 'Impressions', 'Clicks', 'Total Spent'],
    [
      ['Medibrane', 'Campaign A', 1658454, '28216', 'Charlotte', 'nc', 3, 1, 1.25],
      ['Medibrane', 'Campaign A', 1658454, '28216', 'Charlotte', 'nc', 2, 0, 0.75],
      ['Medibrane', 'Campaign A', 1658454, '85001', 'Phoenix', 'az', 4, 2, 2.5],
    ],
  );

  const parsed = await parseGroundTruthWorkbook(buffer, 'location_2026-09-17_2026-09-30.xlsx');
  assert.deepEqual(parsed.formats, ['location']);
  assert.equal(parsed.sourceRows, 3);
  assert.deepEqual(parsed.campaigns, [{
    campaignId: '1658454',
    campaignName: 'Campaign A',
    spend: 4.5,
    impressions: 9,
    clicks: 3,
    reach: null,
    dataStart: '2026-09-17',
    dataEnd: '2026-09-30',
    source: 'location',
  }]);
  assert.deepEqual(
    parsed.locations.map(row => ({ ...row })).sort((a, b) => `${a.regionType}-${a.region}`.localeCompare(`${b.regionType}-${b.region}`)),
    [
      { campaignId: '1658454', campaignName: 'Campaign A', regionType: 'state', region: 'Arizona', state: '', city: null, impressions: 4, clicks: 2 },
      { campaignId: '1658454', campaignName: 'Campaign A', regionType: 'state', region: 'North Carolina', state: '', city: null, impressions: 5, clicks: 1 },
      { campaignId: '1658454', campaignName: 'Campaign A', regionType: 'zip', region: '28216', state: 'NC', city: 'Charlotte', impressions: 5, clicks: 1 },
      { campaignId: '1658454', campaignName: 'Campaign A', regionType: 'zip', region: '85001', state: 'AZ', city: 'Phoenix', impressions: 4, clicks: 2 },
    ],
  );
});

test('parses a native GroundTruth campaign summary and keeps reach', async () => {
  const buffer = await workbookBuffer(
    ['Campaign Name', 'Campaign ID', 'Impressions', 'Clicks', 'Total Spent', 'Reach'],
    [['Campaign A', 1658454, 1000, 25, 123.45, 650]],
  );

  const parsed = await parseGroundTruthWorkbook(buffer, 'campaign_2026-09-17_2026-09-30.xlsx');
  assert.deepEqual(parsed.formats, ['campaign']);
  assert.deepEqual(parsed.campaigns, [{
    campaignId: '1658454',
    campaignName: 'Campaign A',
    spend: 123.45,
    impressions: 1000,
    clicks: 25,
    reach: 650,
    dataStart: '2026-09-17',
    dataEnd: '2026-09-30',
    source: 'campaign',
  }]);
  assert.equal(parsed.locations.length, 0);
});

test('preserves leading zeroes for numeric ZIP cells', async () => {
  const buffer = await workbookBuffer(
    ['Campaign Name', 'Campaign ID', 'Zipcode', 'City', 'State', 'Impressions', 'Clicks', 'Total Spent'],
    [['Campaign A', 1658454, 2108, 'Boston', 'ma', 10, 1, 2]],
  );
  const parsed = await parseGroundTruthWorkbook(buffer, 'location_2026-09-17_2026-09-30.xlsx');
  assert.equal(parsed.locations.find(row => row.regionType === 'zip')?.region, '02108');
});

test('rejects malformed metrics instead of converting them to zero', async () => {
  const buffer = await workbookBuffer(
    ['Campaign Name', 'Campaign ID', 'Zipcode', 'City', 'State', 'Impressions', 'Clicks', 'Total Spent'],
    [['Campaign A', 1658454, '85001', 'Phoenix', 'az', 'not-a-number', 1, 2]],
  );
  await assert.rejects(
    parseGroundTruthWorkbook(buffer, 'location_2026-09-17_2026-09-30.xlsx'),
    /Impressions must be a non-negative whole number/,
  );
});

test('rejects count values disguised by formatting characters', async t => {
  for (const value of ['10%', '1,00', '1 000', '$10']) {
    await t.test(String(value), async () => {
      const buffer = await workbookBuffer(
        ['Campaign Name', 'Campaign ID', 'Zipcode', 'City', 'State', 'Impressions', 'Clicks', 'Total Spent'],
        [['Campaign A', 1658454, '85001', 'Phoenix', 'az', value, 1, '$1,234.56']],
      );
      await assert.rejects(
        parseGroundTruthWorkbook(buffer, 'location_2026-09-17_2026-09-30.xlsx'),
        /Impressions must be a non-negative whole number/,
      );
    });
  }
});

test('accepts strictly formatted comma counts and currency spend', async () => {
  const buffer = await workbookBuffer(
    ['Campaign Name', 'Campaign ID', 'Zipcode', 'City', 'State', 'Impressions', 'Clicks', 'Total Spent'],
    [['Campaign A', 1658454, '85001', 'Phoenix', 'az', '1,000', '25', '$1,234.56']],
  );
  const parsed = await parseGroundTruthWorkbook(buffer, 'location_2026-09-17_2026-09-30.xlsx');
  assert.equal(parsed.campaigns[0].impressions, 1000);
  assert.equal(parsed.campaigns[0].spend, 1234.56);
});

test('does not accept impossible dates inferred from a file name', async () => {
  const buffer = await workbookBuffer(
    ['Campaign Name', 'Campaign ID', 'Impressions', 'Clicks', 'Total Spent', 'Reach'],
    [['Campaign A', 1658454, 1000, 25, 123.45, 650]],
  );
  const parsed = await parseGroundTruthWorkbook(buffer, 'campaign_2026-02-30_2026-03-05.xlsx');
  assert.equal(parsed.campaigns[0].dataStart, null);
  assert.match(parsed.warnings[0], /No valid date range/);
});

test('rejects duplicate workbook coverage instead of double-counting it', async () => {
  const buffer = await workbookBuffer(
    ['Campaign Name', 'Campaign ID', 'Zipcode', 'City', 'State', 'Impressions', 'Clicks', 'Total Spent'],
    [['Campaign A', 1658454, '85001', 'Phoenix', 'az', 10, 1, 2]],
  );
  const parsed = await parseGroundTruthWorkbook(buffer, 'location_2026-09-17_2026-09-30.xlsx');
  assert.throws(() => mergeGroundTruthWorkbookImports([parsed, parsed]), /appears in more than one location report/);
});

test('rejects an unrelated workbook', async () => {
  const buffer = await workbookBuffer(['Name', 'Value'], [['Example', 1]]);
  await assert.rejects(
    parseGroundTruthWorkbook(buffer, 'not-groundtruth.xlsx'),
    /No supported GroundTruth report/,
  );
});
