import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

process.env.SPARTACO_SUPABASE_URL = 'https://example.supabase.co';
process.env.SPARTACO_SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://prepass.example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-prepass-service-role-key';

const adapterModule = await import('./supabase-production.ts');
const { createApprovedProductionSupabaseAdapter } = adapterModule;

const context = {
  clientKey: 'wrong-client',
  timezone: 'America/Phoenix',
  sourceContractVersion: 'portfolio-v3',
  retrievedAt: '2026-09-03T00:00:00.000Z',
  lastCompleteDate: '2026-09-02',
  windows: {
    month: { start: '2026-09-01', end: '2026-09-02' },
    current: { start: '2026-08-20', end: '2026-09-02' },
    previous: { start: '2026-08-06', end: '2026-08-19' },
  },
};

test('production Supabase registry accepts only the fifteen reviewed client-specific contracts', async () => {
  for (const key of [
    'arabella.performance', 'bloom.performance', 'bridgeway.performance', 'cba.performance',
    'champagne.performance', 'durodyne.performance', 'goodgame.performance', 'ihh.performance',
    'kinsey.performance', 'nsi.performance', 'prepass.sqls', 'prepass.won',
    'spartaco.leads', 'spartaco.sales', 'state48.performance',
  ]) {
    const adapter = createApprovedProductionSupabaseAdapter(key);
    assert.equal(typeof adapter, 'function');
    await assert.rejects(() => adapter(context), /client does not match its approved source contract/i);
  }
  for (const key of ['unknown', 'canary', 'canary.performance', 'state48_google', 'public.anything', '', null]) {
    assert.throws(() => createApprovedProductionSupabaseAdapter(key as never), /unsupported production Supabase adapter key/i);
  }
});

test('production module exposes no registry, SQL identifiers, or Canary contract', async () => {
  assert.deepEqual(Object.keys(adapterModule), ['createApprovedProductionSupabaseAdapter']);
  const source = await readFile(new URL('./supabase-production.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /canary/i);
  assert.doesNotMatch(source, /process\.env\[[^\]]+\]/);
});
