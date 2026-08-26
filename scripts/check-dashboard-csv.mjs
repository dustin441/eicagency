import assert from 'node:assert/strict';
import { buildDashboardCsv, dashboardCsvFilename } from '../src/lib/dashboard-csv.ts';

const csv = buildDashboardCsv({
  filters: { start: '2026-08-01', end: '2026-08-25', brand: 'Jameson' },
  summary: { spend: 123.45, note: '=HYPERLINK("https://bad.example")' },
  daily: [
    { date: '2026-08-24', clicks: 10, labels: ['one', 'two'] },
    { date: '2026-08-25', clicks: 12, labels: ['three'] },
  ],
  metaAdsByBrand: {
    Jameson: [{ adId: '1', adName: 'Comma, quote " test', cost: 50 }],
    Huskie: [{ adId: '2', adName: 'Safe', cost: 25 }],
  },
});

assert.ok(csv.startsWith('\uFEFF'), 'CSV should include a UTF-8 BOM for Excel');
assert.match(csv, /module/);
assert.match(csv, /summary/);
assert.match(csv, /daily/);
assert.match(csv, /metaAdsByBrand/);
assert.match(csv, /Jameson/);
assert.match(csv, /Comma, quote "" test/);
assert.match(csv, /'=HYPERLINK/);
assert.match(csv, /\[""one"",""two""\]/);
assert.equal(dashboardCsvFilename('Spartaco Media Report — Leads', { start: '2026-08-01', end: '2026-08-25' }), 'spartaco-media-report-leads_2026-08-01_to_2026-08-25.csv');

console.log('Dashboard CSV checks passed');
