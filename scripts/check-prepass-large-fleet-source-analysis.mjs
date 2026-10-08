import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync('supabase/prepass_large_fleet_source_analysis.sql', 'utf8');
const page = fs.readFileSync('src/app/dashboard/large-fleet-analysis/page.tsx', 'utf8');
const client = fs.readFileSync('src/components/LargeFleetSourceAnalysisClient.tsx', 'utf8');
const service = fs.readFileSync('src/services/prepass-large-fleet.ts', 'utf8');
const layout = fs.readFileSync('src/app/dashboard/layout.tsx', 'utf8');

assert.match(migration, /create table if not exists public\.prepass_large_fleet_contacts/);
assert.match(migration, /prepass_large_fleet_normalize/);
assert.match(migration, />= 100/);
assert.match(migration, /Event \/ Trade Show/);
assert.match(migration, /Partner \/ Referral/);
assert.match(migration, /prepass_large_fleet_source_summary/);
assert.match(migration, /prepass_large_fleet_source_detail/);
assert.match(migration, /raw_payload jsonb not null/);
assert.doesNotMatch(migration, /campaign_leads/);
assert.doesNotMatch(migration, /leads_abm/);
assert.doesNotMatch(migration, /leads_fd360/);
assert.doesNotMatch(migration, /leads_mobileapp/);

assert.match(page, /requireClientAccess\('prepass'\)/);
assert.match(page, /fetchPrepassLargeFleetAnalysis/);
assert.match(service, /prepass_large_fleet_source_summary/);
assert.match(service, /prepass_large_fleet_source_detail/);
assert.match(client, /Primary channels are mutually exclusive/);
assert.match(client, /Event \/ Trade Show|events/);
assert.match(client, /Source detail/);
assert.match(layout, /Large Fleet Sources/);
assert.match(layout, /\/dashboard\/large-fleet-analysis/);

console.log('PrePass large-fleet source-analysis checks passed.');
