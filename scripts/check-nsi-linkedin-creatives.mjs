import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const service = readFileSync(path.join(root, 'src/services/nsi-creative-analytics.ts'), 'utf8');
const client = readFileSync(path.join(root, 'src/components/NsiCreativeAnalysisClient.tsx'), 'utf8');
const migrationPath = path.join(root, 'supabase/nsi_linkedin_creatives.sql');
assert.ok(existsSync(migrationPath), 'NSI LinkedIn creative migration must exist');
const migration = readFileSync(migrationPath, 'utf8');

assert.match(service, /export type NsiLinkedInCreative/,
  'NSI creative analytics must expose a LinkedIn creative contract');
assert.match(service, /linkedin:\s*\{\s*kpis:\s*NsiCreativeKpis;\s*creatives:\s*NsiLinkedInCreative\[\]/s,
  'NSI analysis result must include LinkedIn KPI and creative data');
assert.match(service, /\.from\('nsi_linkedin_creatives'\)/,
  'NSI service must read the LinkedIn creative table');
assert.match(service, /fetchLinkedIn\(supabase/,
  'NSI service must fetch LinkedIn creatives in the main analysis request');
assert.match(service, /\.eq\('as_of_date', latestAsOf\)/,
  'NSI service must exclude stale LinkedIn creative snapshots');
assert.match(service, /kpis:\s*kpisFrom\(allCreatives\.map/,
  'LinkedIn KPIs must aggregate all current creatives before preview limiting');
assert.match(service, /creatives:\s*allCreatives\.slice\(0, 30\)/,
  'Only preview cards, not KPI inputs, may be limited');
assert.match(client, /title="LinkedIn"/,
  'NSI Ad Analysis must render a LinkedIn section');
assert.match(client, /linkedin\.creatives/,
  'LinkedIn preview cards must receive the fetched creatives');
assert.match(client, /LinkedIn Ad Creatives/,
  'LinkedIn previews must be clearly labeled');
assert.match(migration, /create table if not exists public\.nsi_linkedin_creatives/i,
  'Migration must create the NSI LinkedIn creative table idempotently');
assert.match(migration, /unique\s*\(creative_id\)/i,
  'Creative rows must be idempotent by LinkedIn creative ID');
assert.match(migration, /permanent_media_url\s+text/i,
  'Migration must store a permanent media URL');

console.log('NSI LinkedIn creative presentation contract: PASS');
