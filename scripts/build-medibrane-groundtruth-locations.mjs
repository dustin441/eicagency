// Builds an idempotent SQL upsert for public.medibrane_groundtruth_locations from
// GroundTruth "location reporting" exports (campaign_<id>_location_reporting.xlsx).
// Run whenever new exports are downloaded, then execute the printed SQL in Supabase
// (EIC Clients project). Each campaign's existing rows are replaced.
//
// Usage: node scripts/build-medibrane-groundtruth-locations.mjs <collected_at YYYY-MM-DD> <file.xlsx>... > out.sql
import path from 'node:path';
import ExcelJS from 'exceljs';

const [collectedAt, ...files] = process.argv.slice(2);
if (!/^\d{4}-\d{2}-\d{2}$/.test(collectedAt ?? '') || files.length === 0) {
  console.error('Usage: node scripts/build-medibrane-groundtruth-locations.mjs <YYYY-MM-DD> <file.xlsx>...');
  process.exit(1);
}

// sheet name -> region_type, plus where state/city live in that sheet's columns
const SHEETS = {
  STATES: { type: 'state' },
  DMAS: { type: 'dma' },
  COUNTIES: { type: 'county', stateCol: 'STATE' },
  ZIPCODES: { type: 'zip', stateCol: 'STATE', cityCol: 'CITY' },
};

const q = value => (value === null || value === undefined ? 'null' : `'${String(value).replace(/'/g, "''")}'`);
const int = value => (Number.isFinite(Number(value)) ? Math.round(Number(value)) : 0);

const statements = ['begin;'];
for (const file of files) {
  const match = path.basename(file).match(/campaign_(\d+)_location_reporting/);
  if (!match) throw new Error(`Cannot read campaign id from file name: ${file}`);
  const campaignId = match[1];

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const rows = new Map();
  wb.eachSheet(ws => {
    const config = SHEETS[ws.name];
    if (!config) return;
    const header = ws.getRow(1).values.map(v => String(v ?? '').trim().toUpperCase());
    const col = name => header.indexOf(name);
    for (let r = 2; r <= ws.rowCount; r++) {
      const values = ws.getRow(r).values;
      const region = String(values[col(ws.name)] ?? '').trim();
      if (!region) continue;
      const state = config.stateCol ? String(values[col(config.stateCol)] ?? '').trim() : '';
      const city = config.cityCol ? String(values[col(config.cityCol)] ?? '').trim() || null : null;
      const key = `${config.type}|${region}|${state}`;
      const existing = rows.get(key) ?? { type: config.type, region, state, city, impressions: 0, clicks: 0 };
      existing.impressions += int(values[col('IMPRESSIONS')]);
      existing.clicks += int(values[col('CLICKS')]);
      rows.set(key, existing);
    }
  });

  statements.push(`delete from public.medibrane_groundtruth_locations where campaign_id = ${q(campaignId)};`);
  const values = [...rows.values()].map(row =>
    `(${q(campaignId)},${q(row.type)},${q(row.region)},${q(row.state)},${q(row.city)},${row.impressions},${row.clicks},${q(collectedAt)})`);
  for (let i = 0; i < values.length; i += 500) {
    statements.push(
      'insert into public.medibrane_groundtruth_locations (campaign_id, region_type, region, state, city, impressions, clicks, collected_at) values\n'
      + values.slice(i, i + 500).join(',\n') + ';');
  }
  console.error(`${campaignId}: ${rows.size} location rows`);
}
statements.push('commit;');
console.log(statements.join('\n'));
