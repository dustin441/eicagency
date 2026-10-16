import test from 'node:test';
import assert from 'node:assert/strict';
import { creativeBuilderLifecycleConfig, creativeBuilderServerConfig, CreativeBuilderConfigError } from './creative-builder-server-config.ts';

const env = {
  CREATIVE_BUILDER_ENABLED: 'true',
  CREATIVE_BUILDER_REPOSITORY_DATABASE_URL: 'postgres://builder_request:secret@invalid.test/app',
  CREATIVE_BUILDER_WORKER_DATABASE_URL: 'postgres://builder_worker:secret@invalid.test/app',
  NEXT_PUBLIC_SUPABASE_URL: 'https://invalid.test',
  CREATIVE_BUILDER_STORAGE_KEY: 'private-storage-key',
  ANTHROPIC_API_KEY: 'private-model-key',
};
const unavailable = (error: unknown) => error instanceof CreativeBuilderConfigError && error.status === 503;

test('Builder is exact-opt-in and fails closed when database, storage, or model config is absent', () => {
  for (const value of [{}, {...env, CREATIVE_BUILDER_ENABLED:'TRUE'}, {...env, CREATIVE_BUILDER_REPOSITORY_DATABASE_URL:undefined}, {...env, CREATIVE_BUILDER_STORAGE_KEY:''}, {...env, ANTHROPIC_API_KEY:''}]) {
    assert.throws(() => creativeBuilderServerConfig(value), unavailable);
  }
});

test('config enforces separate roles, verified TLS, clean URLs, and bounded pools', () => {
  const config = creativeBuilderServerConfig(env);
  assert.equal(config.enabled, true);
  assert.equal(config.repository.ssl.rejectUnauthorized, true);
  assert.equal(config.worker.max, 2);
  assert.equal(config.storageUrl, 'https://invalid.test');
  assert.throws(() => creativeBuilderServerConfig({...env, CREATIVE_BUILDER_WORKER_DATABASE_URL:env.CREATIVE_BUILDER_REPOSITORY_DATABASE_URL}), unavailable);
  for (const suffix of ['?ssl=false', '?options=x', '#unsafe']) assert.throws(() => creativeBuilderServerConfig({...env, CREATIVE_BUILDER_WORKER_DATABASE_URL:env.CREATIVE_BUILDER_WORKER_DATABASE_URL + suffix}), unavailable);
});

test('lifecycle config is separately secret-gated and does not require a model or repository credential',()=>{
  const lifecycle={...env,CREATIVE_BUILDER_REPOSITORY_DATABASE_URL:undefined,ANTHROPIC_API_KEY:undefined,CREATIVE_BUILDER_CLEANUP_TOKEN:'x'.repeat(32)};
  const config=creativeBuilderLifecycleConfig(lifecycle);
  assert.equal(config.routeSecret,'x'.repeat(32));
  assert.equal(config.worker.max,2);
  for(const token of [undefined,'','short',' '+ 'x'.repeat(32)]) assert.throws(()=>creativeBuilderLifecycleConfig({...lifecycle,CREATIVE_BUILDER_CLEANUP_TOKEN:token}),unavailable);
});
