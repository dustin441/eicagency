import assert from 'node:assert/strict';
import fs from 'node:fs';

const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert(base && service && anon, 'Supabase environment is required');

async function read(table, key = service) {
  const response = await fetch(`${base}/rest/v1/${table}?select=*`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  assert.equal(response.status, 200, `${table} read failed`);
  return response.json();
}

const [snapshots, windows, measurement, channels, months, roadmap, anonSnapshots] = await Promise.all([
  read('barbri_plan_snapshots'), read('barbri_performance_windows'), read('barbri_measurement_bridge'),
  read('barbri_channel_plan'), read('barbri_monthly_plan'), read('barbri_roadmap'), read('barbri_plan_snapshots', anon),
]);
assert.equal(snapshots.length, 1);
assert.equal(windows.length, 5);
assert.equal(measurement.length, 5);
assert.equal(channels.length, 3);
assert.equal(months.length, 3);
assert.equal(roadmap.length, 4);
assert.equal(anonSnapshots.length, 0, 'Anonymous reads must remain blocked by RLS');

const snapshot = snapshots[0];
const sum = (rows, key) => rows.reduce((total, row) => total + Number(row[key]), 0);
const close = (actual, expected, tolerance, label) => assert(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
close(Number(snapshot.forecast_spend), 280333.077586, 0.01, 'forecast spend');
close(Number(snapshot.forecast_revenue), 2522997.698275, 0.01, 'forecast revenue');
close(Number(snapshot.forecast_sales), 967.385773, 0.001, 'forecast sales');
close(Number(snapshot.target_roas), 9, 0.0001, 'target ROAS');
close(sum(channels, 'spend'), Number(snapshot.forecast_spend), 0.01, 'channel spend conservation');
close(sum(channels, 'revenue'), Number(snapshot.forecast_revenue), 0.01, 'channel revenue conservation');
close(sum(channels, 'sales'), Number(snapshot.forecast_sales), 0.001, 'channel sales conservation');
close(sum(months, 'spend'), Number(snapshot.forecast_spend), 0.01, 'monthly spend conservation');
close(sum(months, 'revenue'), Number(snapshot.forecast_revenue), 0.01, 'monthly revenue conservation');
close(sum(months, 'sales'), Number(snapshot.forecast_sales), 0.001, 'monthly sales conservation');
assert(measurement.some((row) => row.metric_key === 'google_native' && Math.abs(Number(row.value) - 11.296132409) < 0.0001));
assert(measurement.some((row) => row.metric_key === 'portfolio_floor' && Math.abs(Number(row.value) - 5.481748616) < 0.0001));
assert(measurement.some((row) => row.metric_key === 'modeled_current' && Math.abs(Number(row.value) - 7.897374626) < 0.0001));
assert(roadmap[0].owner_boundary.includes('existing tracking partner'));
assert(roadmap[3].owner_boundary.includes('CRO remain outside current scope'));

const routeSource = fs.readFileSync(new URL('../src/app/dashboard/barbri/page.tsx', import.meta.url), 'utf8');
const layoutSource = fs.readFileSync(new URL('../src/app/dashboard/layout.tsx', import.meta.url), 'utf8');
const schemaSource = fs.readFileSync(new URL('../supabase/barbri_dashboard_preview.sql', import.meta.url), 'utf8');
assert(routeSource.includes("await requireAgencyAccess()"), 'BARBRI route must remain agency/admin only');
assert(!routeSource.includes('requireClientAccess'), 'BARBRI route must not permit client-role access yet');
assert(layoutSource.includes("href: '/dashboard/barbri', icon: FileBarChart2, agencyOnly: true"), 'BARBRI navigation must remain agency-only');
for (const table of ['barbri_plan_snapshots','barbri_performance_windows','barbri_measurement_bridge','barbri_channel_plan','barbri_monthly_plan','barbri_roadmap']) {
  assert(schemaSource.includes(`alter table public.${table} enable row level security;`), `${table} must enable RLS`);
}
console.log(JSON.stringify({
  snapshot: snapshot.version,
  counts: { windows: windows.length, measurement: measurement.length, channels: channels.length, months: months.length, roadmap: roadmap.length },
  totals: { spend: sum(channels, 'spend'), revenue: sum(channels, 'revenue'), sales: sum(channels, 'sales'), roas: Number(snapshot.target_roas) },
  anonRows: anonSnapshots.length,
  access: 'agency-admin-only',
}));
