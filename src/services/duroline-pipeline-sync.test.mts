import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { collectDurolinePipelineSnapshot, refreshDurolinePipelineSnapshot } from './duroline-pipeline-sync.ts';
import { POST } from '../app/api/internal/duroline-pipeline-sync/route.ts';

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
after(() => { globalThis.fetch = originalFetch; process.env = originalEnv; });
process.env.DUROLINE_MMC_CLIENT_ID = 'fixture-client';
process.env.DUROLINE_MMC_CLIENT_SECRET = 'fixture-secret';
process.env.DUROLINE_HIGHLEVEL_TOKEN = 'fixture-token';
process.env.DUROLINE_PIPELINE_SYNC_SECRET = 'fixture-sync-secret';
process.env.SPARTACO_SUPABASE_URL = 'https://snapshot.invalid';
process.env.SPARTACO_SUPABASE_SERVICE_ROLE_KEY = 'fixture-service';
const location = 'KU4RlCj1mDVF6eNxwqcZ';
const pipeline = 'DAtuQG1i9iWE5JGvK0a5';
const timestamp = '2026-11-11T12:00:00.000Z';
const stage = { id: 7, name: 'Qualified', type: 'default', hidden: true, displayOrder: 2, funnel: { id: 14159165 } };
const opportunity = (n: number) => ({ id: `opportunity${n}`, contactId: `contact${n}`, name: 'Fixture', locationId: location, pipelineId: pipeline, pipelineStageId: 's1', status: 'open', createdAt: timestamp, updatedAt: timestamp });
const deal = (n: number) => ({ id: n, name: 'Fixture test', funnel: { id: 14159165 }, stage: { id: 7, name: 'Qualified', type: 'default' }, amount: n === 1 ? 0 : null, createdAt: timestamp, updatedAt: timestamp, daysInStage: 0, user: { fullName: null, username: 'fixture-owner' }, lastCompletedActivity: {}, customFields: [], importId: 'random-uuid-not-an-identifier' });
type Fixture = { deals: ReturnType<typeof deal>[]; opportunities: ReturnType<typeof opportunity>[]; mmcTotal?: number; ghlTotal?: number; missingCursor?: boolean; repeatCursor?: boolean; retry?: boolean };
function fixture(overrides: Partial<Fixture> = {}) {
  const data: Fixture = { deals: [deal(1), deal(2)], opportunities: [opportunity(1), opportunity(2)], ...overrides };
  const calls: URL[] = [];
  let writes = 0;
  let searches = 0;
  let retries = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input)); calls.push(url);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    assert.equal(init?.redirect === 'error' || url.hostname === 'snapshot.invalid', true);
    if (url.hostname === 'snapshot.invalid') { writes++; assert.equal(init?.method, 'POST'); return json({ id: 123 }); }
    if (url.pathname === '/oauth/token/') {
      assert.equal(init?.method, 'POST');
      assert.equal(new URLSearchParams(String(init?.body)).get('grant_type'), 'client_credentials');
      return json({ accessToken: 'fixture-access' });
    }
    if (url.pathname.endsWith('/stages')) return json({ count: 1, total: 1, data: [stage] });
    if (url.pathname.endsWith('/deals')) {
      assert.equal(url.searchParams.get('$limit'), '20'); assert.equal(url.searchParams.get('$order'), 'id');
      assert.deepEqual(JSON.parse(url.searchParams.get('$filters')!), { funnelId: { $eq: 14159165 }, includeCustomFields: true });
      const offset = Number(url.searchParams.get('$offset'));
      const rows = data.deals.slice(offset, offset + 1); // intentionally short non-final pages
      return json({ total: data.mmcTotal ?? data.deals.length, count: rows.length, data: rows });
    }
    if (url.pathname === '/opportunities/pipelines') {
      assert.equal(url.searchParams.get('locationId'), location);
      return json({ pipelines: [{ id: pipeline, locationId: location, stages: [{ id: 's1', name: 'Interested' }] }] });
    }
    if (url.pathname === '/opportunities/search') {
      if (data.retry && retries++ === 0) return json({}, 429);
      assert.equal(url.searchParams.get('location_id'), location); assert.equal(url.searchParams.get('pipeline_id'), pipeline);
      assert.equal(url.searchParams.get('status'), 'all'); assert.equal(url.searchParams.get('limit'), '100');
      if (searches) { assert.equal(url.searchParams.get('startAfter'), '100'); assert.equal(url.searchParams.get('startAfterId'), 'cursor1'); }
      const rows = data.opportunities.slice(searches, ++searches);
      return json({ opportunities: rows, meta: { total: data.ghlTotal ?? data.opportunities.length,
        ...(data.missingCursor ? {} : { startAfter: 100, startAfterId: data.repeatCursor || searches === 1 ? 'cursor1' : 'cursor2' }),
        nextPageUrl: 'https://attacker.invalid/steal-token',
      } });
    }
    if (url.pathname === '/contacts/search') {
      assert.equal(init?.method, 'POST');
      assert.equal(new Headers(init?.headers).get('Content-Type'), 'application/json');
      const body = JSON.parse(String(init?.body));
      const ids = body.filters[0].value as string[];
      assert.deepEqual(body, { locationId: location, pageLimit: 100, page: 1, filters: [{ field: 'id', operator: 'eq', value: ids }] });
      assert.ok(ids.length > 0 && ids.length <= 100);
      assert.equal(new Set(ids).size, ids.length);
      return json({ total: ids.length, contacts: ids.map(id => ({ id, locationId: location, companyName: 'Standard Company', customFields: [{ id: 'SFoDbwYBmkxs9UQ4Y13s', value: 'Custom HVAC Company' }] })) });
    }
    throw new Error('Unexpected fixture request');
  };
  return { calls, writes: () => writes };
}

test('collects short pages completely; preserves null/zero, owner and absent activity; ignores random UUID joins', async () => {
  const f = fixture();
  const result = await collectDurolinePipelineSnapshot();
  assert.equal(result.leads.length, 2); assert.equal(result.deals.length, 2);
  assert.equal(result.deals[0].amount, 0); assert.equal(result.deals[1].amount, null);
  assert.equal(result.deals[0].lastActivityAt, null); assert.equal(result.deals[0].owner, 'fixture-owner');
  assert.equal(result.deals[0].salesState, 'legacy_qualified');
  assert.equal(result.deals[0].highlevelOpportunityId, null);
  assert.ok(result.warnings.some(x => x.includes('test records')));
  assert.ok(result.warnings.some(x => x.includes('overrides')));
  assert.ok(f.calls.every(x => ['api.mapmycustomers.me', 'services.leadconnectorhq.com'].includes(x.hostname)));
  assert.equal(f.writes(), 0);
});

test('enriches scoped contacts using custom Company before standard companyName', async () => {
  const f = fixture();
  const result = await collectDurolinePipelineSnapshot();
  assert.deepEqual(result.leads.map(x => [x.companyName, x.companyEvidenceAvailable]), [
    ['Custom HVAC Company', true], ['Custom HVAC Company', true],
  ]);
  assert.equal(result.schemaVersion, 1);
  assert.equal(f.calls.filter(x => x.pathname === '/contacts/search').length, 1);
});

function transformContacts(transform: (body: { total: number; contacts: Record<string, unknown>[] }) => unknown) {
  const fetchFixture = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const response = await fetchFixture(input, init);
    return new URL(String(input)).pathname === '/contacts/search' ? Response.json(transform(await response.json())) : response;
  };
}

test('contact company fallback preserves raw placeholders and blank evidence', async () => {
  for (const [customFields, companyName, expected] of [
    [[], 'Standard Company', 'Standard Company'],
    [[{ id: 'SFoDbwYBmkxs9UQ4Y13s', value: '' }], 'Fallback', 'Fallback'],
    [[{ id: 'SFoDbwYBmkxs9UQ4Y13s', value: null }], 'Fallback', 'Fallback'],
    [[{ id: 'SFoDbwYBmkxs9UQ4Y13s', value: ' N/A ' }], 'Fallback', ' N/A '],
    [[], null, null], [[], '', ''], [[], '   ', '   '],
  ] as const) {
    fixture();
    transformContacts(body => ({ ...body, contacts: body.contacts.map(x => ({ ...x, customFields, companyName })) }));
    const result = await collectDurolinePipelineSnapshot();
    assert.equal(result.leads[0].companyName, expected);
    assert.equal(result.leads[0].companyEvidenceAvailable, true);
  }
});

test('contact identity, location, completeness and total errors abort before any snapshot write', async () => {
  const invalid: ((body: { total: number; contacts: Record<string, unknown>[] }) => unknown)[] = [
    body => ({ ...body, total: 1 }),
    body => ({ ...body, total: '2' }),
    body => ({ contacts: body.contacts }),
    body => ({ ...body, contacts: body.contacts.slice(1) }),
    body => ({ ...body, contacts: [body.contacts[0], body.contacts[0]] }),
    body => ({ ...body, contacts: body.contacts.map(x => ({ ...x, id: 'foreign' })) }),
    body => ({ ...body, contacts: body.contacts.map(x => ({ ...x, locationId: 'foreign' })) }),
    body => ({ ...body, contacts: body.contacts.map(x => { const row = { ...x }; delete row.locationId; return row; }) }),
    body => ({ ...body, contacts: body.contacts.map(x => { const row = { ...x }; delete row.id; return row; }) }),
    body => ({ ...body, contacts: body.contacts.map(x => { const row = { ...x }; delete row.customFields; return row; }) }),
    body => ({ ...body, contacts: body.contacts.map(x => ({ ...x, customFields: [{ id: 'SFoDbwYBmkxs9UQ4Y13s', value: [] }] })) }),
    body => ({ ...body, contacts: body.contacts.map(x => ({ ...x, customFields: [{ id: 'SFoDbwYBmkxs9UQ4Y13s', value: 'a' }, { id: 'SFoDbwYBmkxs9UQ4Y13s', value: 'b' }] })) }),
  ];
  for (const transform of invalid) {
    const f = fixture();
    transformContacts(transform);
    await assert.rejects(refreshDurolinePipelineSnapshot());
    assert.equal(f.writes(), 0);
  }
});

test('batches only unique scoped contacts by 100, not per opportunity or all location contacts', async () => {
  const rows = Array.from({ length: 2689 }, (_, n) => opportunity(n));
  rows[2688].contactId = rows[0].contactId;
  const f = fixture();
  const fetchFixture = globalThis.fetch;
  let page = 0;
  const batches: string[][] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === '/opportunities/search') {
      const chunk = rows.slice(page * 100, ++page * 100);
      return Response.json({ opportunities: chunk, meta: { total: rows.length, startAfter: page, startAfterId: `cursor${page}` } });
    }
    if (url.pathname === '/contacts/search') batches.push(JSON.parse(String(init?.body)).filters[0].value);
    return fetchFixture(input, init);
  };
  const result = await collectDurolinePipelineSnapshot();
  assert.deepEqual(batches.map(x => x.length), [...Array(26).fill(100), 88]);
  assert.equal(batches.length, 27);
  assert.deepEqual(batches.flat(), [...new Set(rows.map(x => x.contactId))]);
  assert.equal(result.leads.length, 2689);
  assert.ok(result.leads.every(x => x.companyEvidenceAvailable));
  assert.equal(f.calls.some(x => /^\/contacts\/[^/]+$/.test(x.pathname) && x.pathname !== '/contacts/search'), false);
});

test('no contact reference is unknown evidence and does not issue an unscoped contact search', async () => {
  const row = { ...opportunity(1), contactId: null };
  const f = fixture({ opportunities: [row] } as unknown as Partial<Fixture>);
  const result = await collectDurolinePipelineSnapshot();
  assert.equal(result.leads[0].companyEvidenceAvailable, false);
  assert.equal(result.leads[0].companyName, null);
  assert.equal(f.calls.some(x => x.pathname === '/contacts/search'), false);
});

test('missing custom field array is a contract failure, not silently empty data', async () => {
  const row = deal(1); delete (row as Partial<typeof row>).customFields;
  const f = fixture({ deals: [row] });
  await assert.rejects(refreshDurolinePipelineSnapshot()); assert.equal(f.writes(), 0);
});

test('refuses incomplete pages, duplicate IDs, unsafe funnel/location/stages, and malformed dates/amounts', async () => {
  for (const overrides of [
    { mmcTotal: 3 }, { ghlTotal: 3 }, { missingCursor: true },
    { deals: [deal(1), deal(1)] }, { opportunities: [opportunity(1), opportunity(1)] },
    { deals: [{ ...deal(1), funnel: { id: 99 } }] },
    { deals: [{ ...deal(1), stage: { ...deal(1).stage, id: 999 } }] },
    { opportunities: [{ ...opportunity(1), locationId: 'other' }] },
    { opportunities: [{ ...opportunity(1), pipelineId: 'other' }] },
    { opportunities: [{ ...opportunity(1), pipelineStageId: 'other' }] },
    { deals: [{ ...deal(1), createdAt: 'not-a-date' }] },
    { deals: [{ ...deal(1), daysInStage: -1 }] },
    { deals: [{ ...deal(1), amount: '0' }] },
  ]) {
    const f = fixture(overrides as Partial<Fixture>);
    await assert.rejects(refreshDurolinePipelineSnapshot()); assert.equal(f.writes(), 0);
  }
});

test('rejects changing totals in either source', async () => {
  for (const source of ['/deals', '/opportunities/search']) {
    const f = fixture();
    const fetchFixture = globalThis.fetch;
    let pages = 0;
    globalThis.fetch = async (input, init) => {
      const response = await fetchFixture(input, init);
      if (!new URL(String(input)).pathname.endsWith(source) || ++pages === 1) return response;
      const body = await response.json();
      if (source === '/deals') body.total++;
      else body.meta.total++;
      return Response.json(body);
    };
    await assert.rejects(refreshDurolinePipelineSnapshot(), /Unstable/);
    assert.equal(f.writes(), 0);
  }
});

test('source rejection, invalid JSON and exhausted retries never write', async () => {
  for (const status of [401, 429, 500, 200]) {
    const f = fixture();
    const fetchFixture = globalThis.fetch;
    let attempts = 0;
    globalThis.fetch = async (input, init) => {
      if (new URL(String(input)).pathname.endsWith('/deals')) {
        attempts++;
        return new Response(status === 200 ? 'not json' : '{}', { status });
      }
      return fetchFixture(input, init);
    };
    await assert.rejects(refreshDurolinePipelineSnapshot());
    assert.equal(attempts, status === 429 || status === 500 ? 3 : 1);
    assert.equal(f.writes(), 0);
  }
});

test('rejects repeated cursors before an exact total is reached', async () => {
  fixture({ opportunities: [opportunity(1), opportunity(2), opportunity(3)], repeatCursor: true });
  await assert.rejects(collectDurolinePipelineSnapshot(), /Repeated HighLevel cursor/);
});

test('reads custom-field identifiers and only integration-verified import fallback semantics', async () => {
  const a = { ...deal(1), importId: 'ghl-deal-opportunity1', contact: { importId: 'ghl-contact-opportunity1' } };
  const b = { ...deal(2), customFields: [{ customField: { id: 8177, displayName: 'HighLevel Opportunity ID' }, value: ['opportunity2'] }, { customField: { id: 8178, displayName: 'HighLevel Contact ID' }, value: ['contact2'] }] };
  fixture({ deals: [a, b] } as unknown as Partial<Fixture>);
  const result = await collectDurolinePipelineSnapshot();
  assert.equal(result.deals[0].highlevelOpportunityId, 'opportunity1');
  assert.equal(result.deals[0].highlevelContactId, 'contact1');
  assert.equal(result.deals[1].matchStatus, 'matched');
});

test('limited transient retries followed by one atomic insert', async () => {
  const f = fixture({ retry: true });
  const result = await refreshDurolinePipelineSnapshot();
  assert.deepEqual({ ...result, capturedAt: timestamp, warningCount: 0 }, { snapshotId: '123', capturedAt: timestamp, leadCount: 2, dealCount: 2, warningCount: 0 });
  assert.equal(f.writes(), 1);
});

test('POST auth is fail-closed; no caller input; response contains only sanitized summary', async () => {
  const f = fixture();
  assert.equal((await POST(new Request('https://dashboard.invalid/api/internal/duroline-pipeline-sync', { method: 'POST' }))).status, 401);
  const headers = { Authorization: 'Bearer fixture-sync-secret' };
  assert.equal((await POST(new Request('https://dashboard.invalid/api/internal/duroline-pipeline-sync?target=other', { method: 'POST', headers }))).status, 400);
  assert.equal((await POST(new Request('https://dashboard.invalid/api/internal/duroline-pipeline-sync', { method: 'POST', headers, body: '{}' }))).status, 400);
  assert.equal(f.calls.length, 0);
  const emptyStream = new Request('https://dashboard.invalid/api/internal/duroline-pipeline-sync', { method: 'POST', headers, body: '' });
  assert.notEqual(emptyStream.body, null);
  assert.equal((await POST(emptyStream)).status, 200, 'empty POST streams from HTTP clients are permitted');
  fixture();
  const result = await POST(new Request('https://dashboard.invalid/api/internal/duroline-pipeline-sync', { method: 'POST', headers }));
  assert.equal(result.status, 200);
  assert.deepEqual(Object.keys(await result.json()).sort(), ['capturedAt', 'dealCount', 'leadCount', 'snapshotId', 'warningCount']);
  delete process.env.DUROLINE_PIPELINE_SYNC_SECRET;
  assert.equal((await POST(new Request('https://dashboard.invalid', { method: 'POST', headers }))).status, 503);
  process.env.DUROLINE_PIPELINE_SYNC_SECRET = 'fixture-sync-secret';
  fixture({ mmcTotal: 999 });
  const failure = await POST(new Request('https://dashboard.invalid', { method: 'POST', headers }));
  assert.equal(failure.status, 502); assert.deepEqual(await failure.json(), { error: 'Pipeline sync failed' });
});

test('replays audited live source contracts without credentials or source writes', async t => {
  const root = '/opt/data/reports/duroline-sales-pipeline/';
  let mmc, stages, ghl;
  try {
    [mmc, stages, ghl] = await Promise.all(['mmc-deals', 'mmc-stages', 'ghl-opportunities'].map(async x => JSON.parse(await readFile(root + x + '.json', 'utf8'))));
  } catch { t.skip('External source audit fixtures unavailable'); return; }
  let mmcPage = 0, ghlPage = 0;
  // Historical audit has opportunities/deals only. Contact enrichment below is
  // explicitly synthetic contract data, not replayed live company evidence.
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    let body;
    if (url.pathname === '/contacts/search') {
      const ids = JSON.parse(String(init?.body)).filters[0].value as string[];
      body = { total: ids.length, contacts: ids.map(id => ({ id, locationId: location, companyName: null, customFields: [] })) };
    }
    else if (url.pathname.includes('/oauth/')) body = { accessToken: 'fixture-access' };
    else if (url.pathname.endsWith('/stages')) body = stages;
    else if (url.pathname.endsWith('/deals')) body = mmc.pages[mmcPage++];
    else if (url.pathname.endsWith('/pipelines')) body = { pipelines: [ghl.pipeline] };
    else body = ghl.pages[ghlPage++];
    return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
  };
  const result = await collectDurolinePipelineSnapshot();
  assert.equal(result.leads.length, ghl.opportunities.length);
  assert.equal(result.deals.length, mmc.pages[0].total);
  assert.equal(mmcPage, mmc.pages.length);
  assert.equal(ghl.pages.slice(ghlPage).flatMap((page: { opportunities: unknown[] }) => page.opportunities).length, 0);
});
