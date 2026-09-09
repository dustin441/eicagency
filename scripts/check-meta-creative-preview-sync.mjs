#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CLIENTS,
  assertExpectedMetaAccount,
  decodeImageDimensions,
  isAllowedMetaImageUrl,
  isRenderableImage,
  maximumMetaUsage,
  needsDurablePreview,
  parseMetaJsonResponse,
  readResponseBodyWithLimit,
  resolveAllowedMetaRedirect,
  createSyncBudget,
  runClients,
} from './sync-meta-creative-previews.mjs';

assert.equal(
  needsDurablePreview('https://www.facebook.com/ads/image/?d=AQExample'),
  true,
  'Meta /ads/image URLs are transient and must be persisted',
);
assert.equal(
  needsDurablePreview('https://facebook.com/ads/image/?d=AQExample'),
  true,
  'bare facebook.com /ads/image URLs are transient and must be persisted',
);
assert.equal(
  needsDurablePreview('https://project.supabase.co/storage/v1/object/public/meta-creative-previews/client/ad.jpg'),
  false,
  'Supabase Storage previews are already durable',
);

assert.equal(isRenderableImage({ width: 480, height: 270 }), false, '480x270 is below the UI quality floor');
assert.equal(isRenderableImage({ width: 600, height: 315 }), true, '600x315 meets the UI quality floor');
assert.equal(isRenderableImage({ width: 315, height: 600 }), true, 'portrait images use orientation-independent dimensions');
assert.equal(isRenderableImage({ width: 599, height: 315 }), false, 'long edge below 600 is rejected');
assert.equal(isRenderableImage({ width: 600, height: 314 }), false, 'short edge below 315 is rejected');

assert.equal(isAllowedMetaImageUrl('https://facebook.com:444/ads/image'), false, 'non-HTTPS-standard ports must be rejected');
assert.equal(isAllowedMetaImageUrl('https://user:pass@facebook.com/ads/image'), false, 'credential-bearing URLs must be rejected');
assert.equal(
  resolveAllowedMetaRedirect('https://www.facebook.com/ads/image/?d=1', 'https://scontent.xx.fbcdn.net/image.jpg'),
  'https://scontent.xx.fbcdn.net/image.jpg',
  'allowed Meta redirects must resolve',
);
assert.throws(
  () => resolveAllowedMetaRedirect('https://www.facebook.com/ads/image/?d=1', 'https://example.com/image.jpg'),
  /disallowed Meta image redirect/,
  'redirects outside the Meta allowlist must fail closed',
);
await assert.rejects(
  readResponseBodyWithLimit(new Response(new Uint8Array(11)), 10),
  /image exceeds 10 bytes/,
  'image response bodies must be bounded while streaming',
);
let bodyReadBeforeUsageWait = false;
const parsedMetaBody = await parseMetaJsonResponse(
  new Response(JSON.stringify({ data: [{ id: '1' }] }), { status: 200 }),
  async (response) => { bodyReadBeforeUsageWait = response.bodyUsed; },
);
assert.equal(bodyReadBeforeUsageWait, true, 'Graph response bodies must be read before usage throttling can outlive the fetch timeout');
assert.deepEqual(parsedMetaBody, { data: [{ id: '1' }] });
assert.equal(
  maximumMetaUsage(JSON.stringify({ account: [{ call_count: 7, total_cputime: 12, total_time: 9, estimated_time_to_regain_access: 90 }] })),
  12,
  'estimated recovery time must not be interpreted as a usage percentage',
);
assert.equal(maximumMetaUsage(JSON.stringify({ acc_id_util_pct: 73 })), 73, 'ad-account utilization must participate in throttling');
assert.doesNotThrow(() => assertExpectedMetaAccount('123', '123', 'prepass'));
assert.throws(() => assertExpectedMetaAccount('999', '123', 'prepass'), /account mismatch/, 'cross-account creative resolution must fail closed');
const truncatedPng = Buffer.alloc(24);
Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').copy(truncatedPng);
truncatedPng.writeUInt32BE(1200, 16);
truncatedPng.writeUInt32BE(628, 20);
await assert.rejects(
  decodeImageDimensions(truncatedPng),
  /invalid image payload/,
  'plausible headers are insufficient; the complete image must decode',
);
await assert.rejects(
  decodeImageDimensions(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><image href="http://127.0.0.1/private"/></svg>')),
  /unsupported image payload/,
  'active/vector formats must be rejected before the raster decoder runs',
);

assert.deepEqual(
  CLIENTS.durodyne,
  { project: 'spartaco', table: 'durodyne_meta_ads', target: 'permanent_image_url', id: true },
  'Duro Dyne must participate in the durable preview sync',
);
assert.equal(CLIENTS.cba.id, true, 'CBA must use its immutable ad_id instead of account/name matching');
assert.equal(CLIENTS.bloom.id, true, 'Bloom must use its immutable ad_id instead of account/name matching');

const workflow = fs.readFileSync(new URL('../.github/workflows/sync-meta-creative-previews.yml', import.meta.url), 'utf8');
const syncSource = fs.readFileSync(new URL('./sync-meta-creative-previews.mjs', import.meta.url), 'utf8');
assert.match(syncSource, /query = query\.eq\('date', row\.date\)/, 'preview updates must be scoped to the fetched daily row');
assert.match(syncSource, /query\.select\('date'\)/, 'preview updates must request affected rows for verification');
assert.doesNotMatch(syncSource, /unique\.has\(key\)/, 'all transient daily rows must remain eligible for durable updates');
assert.match(syncSource, /upsert:\s*false/, 'content-addressed objects must never be overwritten');
assert.match(syncSource, /if \(created\) await db\.storage/, 'failed row updates may only remove objects created by that attempt');
const isolatedRun = await runClients(
  { clients: ['prepass', 'ihh'] },
  async (client) => {
    if (client === 'prepass') throw new Error('simulated failure');
    return { client, candidates: 1, updated: 1, unresolved: 0, applied: false };
  },
);
assert.equal(isolatedRun.failures.length, 1, 'one client failure must be reported');
assert.equal(isolatedRun.results[0]?.client, 'ihh', 'later clients must still run after an earlier client fails');
const boundedBudget = createSyncBudget({ maxCandidates: 2, maxRequests: 3, maxRuntimeMs: 60_000, now: () => 0 });
assert.equal(boundedBudget.claimCandidate(), true);
assert.equal(boundedBudget.claimCandidate(), true);
assert.equal(boundedBudget.claimCandidate(), false, 'candidate limits must be global and deterministic');
assert.equal(boundedBudget.claimRequest(), true);
assert.equal(boundedBudget.claimRequest(), true);
assert.equal(boundedBudget.claimRequest(), true);
assert.equal(boundedBudget.claimRequest(), false, 'Meta and image request limits must be global and deterministic');
let budgetClock = 0;
const timedBudget = createSyncBudget({ maxCandidates: 10, maxRequests: 10, maxRuntimeMs: 100, now: () => budgetClock });
budgetClock = 101;
assert.equal(timedBudget.claimCandidate(), false, 'the sync must stop before its configured runtime budget is exceeded');
assert.match(syncSource, /deferred/, 'bounded runs must report deferred work for safe re-entry instead of claiming completion');
assert.match(syncSource, /checkpoint/, 'bounded runs must expose an explicit checkpoint for re-entry diagnostics');
for (const client of ['PREPASS', 'IHH', 'ARABELLA', 'CBA', 'BLOOM', 'DURODYNE', 'KINSEY', 'CHAMPAGNE', 'JAMESON', 'HUSKIE', 'RONIN']) {
  assert.match(workflow, new RegExp(`META_ACCESS_TOKEN_${client}:`), `workflow must allow a client-specific Meta token for ${client}`);
  assert.match(workflow, new RegExp(`META_ACCOUNT_ID_${client}:`), `workflow must require an expected Meta account for ${client}`);
}
assert.match(workflow, /args=\(--apply --days=30 /, 'scheduled sync must stay within the current 30-day creative window');
assert.match(workflow, /--max-candidates=/, 'scheduled sync must configure a global candidate ceiling');
assert.match(workflow, /--max-requests=/, 'scheduled sync must configure a global request ceiling');
assert.match(workflow, /--max-runtime-seconds=/, 'scheduled sync must stop with time reserved before the 45 minute job timeout');
assert.match(syncSource, /if \(!outcome\.complete\) process\.exitCode = 2;/, 'partial bounded runs must fail visibly instead of producing a green workflow');
assert.match(workflow, /exit 1/, 'missing sync credentials must fail visibly instead of silently succeeding');
assert.doesNotMatch(workflow, /sync skipped/, 'the scheduled sync must not report success when it did no work');

console.log('Meta creative preview sync checks passed.');
