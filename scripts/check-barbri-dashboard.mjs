import assert from 'node:assert/strict';
import fs from 'node:fs';

const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const adminToken = process.env.SUPABASE_EIC_PLATFORM_ADMIN_TOKEN || process.env.SUPABASE_EIC_ANALYTICS_ACCESS_TOKEN;
assert(base && service && anon && adminToken, 'Supabase environment and EIC management token are required');

async function read(table, key = service) {
  const response = await fetch(`${base}/rest/v1/${table}?select=*`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  assert.equal(response.status, 200, `${table} read failed`);
  return response.json();
}

async function attempt(table, key, method, body) {
  return fetch(`${base}/rest/v1/${table}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function queryCatalog(query) {
  const projectRef = new URL(base).hostname.split('.')[0];
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  assert(response.ok, `Supabase catalog query failed: ${response.status}`);
  return response.json();
}

const [snapshots, windows, measurement, channels, months, roadmap] = await Promise.all([
  read('barbri_plan_snapshots'), read('barbri_performance_windows'), read('barbri_measurement_bridge'),
  read('barbri_channel_plan'), read('barbri_monthly_plan'), read('barbri_roadmap'),
]);
assert.equal(snapshots.length, 1);
assert.equal(windows.length, 5);
assert.equal(measurement.length, 5);
assert.equal(channels.length, 3);
assert.equal(months.length, 3);
assert.equal(roadmap.length, 4);
const deniedStatuses = new Set([401, 403]);
const [anonRead, anonWrite, serviceWrite] = await Promise.all([
  attempt('barbri_plan_snapshots?select=*', anon, 'GET'),
  attempt('barbri_plan_snapshots', anon, 'POST', { version: 'forbidden-anon-write' }),
  attempt('barbri_plan_snapshots', service, 'POST', { version: 'forbidden-service-write' }),
]);
assert(deniedStatuses.has(anonRead.status), `Anonymous read must be privilege-denied, got ${anonRead.status}`);
assert(deniedStatuses.has(anonWrite.status), `Anonymous write must be privilege-denied, got ${anonWrite.status}`);
assert(deniedStatuses.has(serviceWrite.status), `Service-role write must be privilege-denied, got ${serviceWrite.status}`);

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
assert(layoutSource.includes("name: 'BARBRI',\n    agencyOnly: true"), 'Entire BARBRI client entry must remain agency-only');
assert(layoutSource.includes("if (!profile) return [];"), 'Missing profiles must fail closed');
const tables = ['barbri_plan_snapshots','barbri_performance_windows','barbri_measurement_bridge','barbri_channel_plan','barbri_monthly_plan','barbri_roadmap'];
for (const table of tables) {
  assert(schemaSource.includes(`alter table public.${table} enable row level security;`), `${table} must enable RLS`);
}
assert(schemaSource.includes('from public, anon, authenticated, service_role;'), 'Schema must revoke API-role privileges');

const tableList = tables.map((table) => `'${table}'`).join(',');
const [grants, policies] = await Promise.all([
  queryCatalog(`select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and table_name in (${tableList}) and grantee in ('anon','authenticated','service_role') order by table_name, grantee, privilege_type`),
  queryCatalog(`select tablename, policyname from pg_policies where schemaname='public' and tablename in (${tableList}) order by tablename, policyname`),
]);
assert.equal(grants.filter((row) => row.grantee === 'anon' || row.grantee === 'authenticated').length, 0, 'anon/authenticated must have no BARBRI table grants');
const serviceGrants = grants.filter((row) => row.grantee === 'service_role');
assert.equal(serviceGrants.length, tables.length, 'service_role must have one grant per BARBRI table');
assert(serviceGrants.every((row) => row.privilege_type === 'SELECT'), 'service_role must be read-only');
assert.equal(policies.length, 0, 'BARBRI planning tables must not expose RLS policies');
console.log(JSON.stringify({
  snapshot: snapshot.version,
  counts: { windows: windows.length, measurement: measurement.length, channels: channels.length, months: months.length, roadmap: roadmap.length },
  totals: { spend: sum(channels, 'spend'), revenue: sum(channels, 'revenue'), sales: sum(channels, 'sales'), roas: Number(snapshot.target_roas) },
  denied: { anonRead: anonRead.status, anonWrite: anonWrite.status, serviceWrite: serviceWrite.status },
  grants: { serviceSelect: serviceGrants.length, anonAuthenticated: 0, policies: policies.length },
  access: 'agency-admin-only',
}));
