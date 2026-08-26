import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { buildDashboardWorkbook, dashboardXlsxFilename } from '../src/lib/dashboard-xlsx.ts';

const workbook = await buildDashboardWorkbook({
  filters: { start: '2026-08-01', end: '2026-08-25', brand: 'Jameson' },
  summary: { spend: 123.45, ctr: 0.125, note: '=HYPERLINK("https://bad.example")' },
  daily: [
    { date: '2026-08-24', clicks: 10, labels: ['one', 'two'] },
    { date: '2026-08-25', clicks: 12, labels: ['three'] },
  ],
  metaAdsByBrand: {
    Jameson: [{ adId: '1', adName: 'Comma, quote " test', cost: 50 }],
    Huskie: [{ adId: '2', adName: 'Safe', cost: 25 }],
  },
}, 'Spartaco Media Report — Leads');

const buffer = await workbook.xlsx.writeBuffer();
assert.ok(buffer.byteLength > 1000, 'Workbook should contain a real XLSX package');

const parsed = new ExcelJS.Workbook();
await parsed.xlsx.load(buffer);
assert.deepEqual(parsed.worksheets.map(sheet => sheet.name), ['Filters', 'Summary', 'Daily', 'Meta Ads By Brand']);

const filters = parsed.getWorksheet('Filters');
assert.equal(filters?.getCell('A2').value, 'Start');
assert.equal(filters?.getCell('B2').value, '2026-08-01');

const summary = parsed.getWorksheet('Summary');
assert.equal(summary?.views[0]?.state, 'frozen');
assert.equal(summary?.getCell('A2').value, 123.45);
assert.equal(summary?.getCell('B2').value, 0.125);
assert.equal(summary?.getCell('C2').value, "'=HYPERLINK(\"https://bad.example\")");
assert.equal(summary?.getCell('A2').numFmt, '$#,##0.00');
assert.equal(summary?.getCell('B2').numFmt, '0.0%');

const daily = parsed.getWorksheet('Daily');
assert.equal(daily?.rowCount, 3);
assert.equal(daily?.getCell('C2').value, '["one","two"]');
assert.ok(daily?.autoFilter, 'Data sheets should have filters');

const ads = parsed.getWorksheet('Meta Ads By Brand');
assert.equal(ads?.getCell('A2').value, 'Jameson');
assert.equal(ads?.getCell('C2').value, 'Comma, quote " test');

assert.equal(
  dashboardXlsxFilename('Spartaco Media Report — Leads', { start: '2026-08-01', end: '2026-08-25' }),
  'spartaco-media-report-leads_2026-08-01_to_2026-08-25.xlsx',
);

console.log('Dashboard XLSX checks passed');
