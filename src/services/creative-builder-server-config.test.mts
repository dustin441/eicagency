import test from 'node:test';
import assert from 'node:assert/strict';
import { creativeBuilderLifecycleConfig, creativeBuilderServerConfig, CreativeBuilderConfigError } from './creative-builder-server-config.ts';
import {studioServerConfig} from './creative-studio-server-config.ts';

const env = {
  CREATIVE_BUILDER_ENABLED: 'true',
  CREATIVE_BUILDER_REPOSITORY_DATABASE_URL: 'postgres://builder_request:secret@invalid.test/app',
  CREATIVE_BUILDER_WORKER_DATABASE_URL: 'postgres://builder_worker:secret@invalid.test/app',
  NEXT_PUBLIC_SUPABASE_URL: 'https://invalid.test',
  CREATIVE_BUILDER_STORAGE_KEY: 'private-storage-key',
  CREATIVE_BUILDER_OPENROUTER_API_KEY: `sk-or-v1-${'a'.repeat(64)}`,
};
const unavailable = (error: unknown) => error instanceof CreativeBuilderConfigError && error.status === 503;

test('Builder is exact-opt-in and fails closed when database, storage, or model config is absent', () => {
  for (const value of [{}, {...env, CREATIVE_BUILDER_ENABLED:'TRUE'}, {...env, CREATIVE_BUILDER_REPOSITORY_DATABASE_URL:undefined}, {...env, CREATIVE_BUILDER_STORAGE_KEY:''}, {...env, CREATIVE_BUILDER_OPENROUTER_API_KEY:''}]) {
    assert.throws(() => creativeBuilderServerConfig(value), unavailable);
  }
});

test('OpenRouter config accepts only a bounded server-side key and trusted model identifier', () => {
  const config = creativeBuilderServerConfig(env);
  assert.deepEqual(config.model, {
    provider: 'openrouter',
    apiKey: env.CREATIVE_BUILDER_OPENROUTER_API_KEY,
    strategyModel: 'anthropic/claude-sonnet-4.6',
    conceptModel: 'openai/gpt-4.1-mini',
    qaModel: 'google/gemini-3.1-pro-preview',
  });
  assert.equal('model' in env, false);
  for (const apiKey of ['private-model-key', ` ${env.CREATIVE_BUILDER_OPENROUTER_API_KEY}`, 'sk-or-v1-not-hex']) {
    assert.throws(() => creativeBuilderServerConfig({...env, CREATIVE_BUILDER_OPENROUTER_API_KEY:apiKey}), unavailable);
  }
  for (const strategyModel of ['', 'auto', '../model', 'vendor/model?fallback=true', `vendor/${'x'.repeat(129)}`]) {
    assert.throws(() => creativeBuilderServerConfig({...env, CREATIVE_BUILDER_STRATEGY_MODEL:strategyModel}), unavailable);
  }
  assert.equal(creativeBuilderServerConfig({...env, CREATIVE_BUILDER_STRATEGY_MODEL:'openai/gpt-5.2'}).model.strategyModel,'openai/gpt-5.2');
  assert.equal(creativeBuilderServerConfig({...env, CREATIVE_BUILDER_CONCEPT_MODEL:'openai/gpt-5.3'}).model.conceptModel,'openai/gpt-5.3');
  assert.equal(creativeBuilderServerConfig({...env, CREATIVE_BUILDER_QA_MODEL:'openai/gpt-5.4'}).model.qaModel,'openai/gpt-5.4');
  assert.throws(() => creativeBuilderServerConfig({...env, CREATIVE_BUILDER_QA_MODEL:'anthropic/claude-sonnet-4.6'}), unavailable);
  assert.throws(() => creativeBuilderServerConfig({...env, CREATIVE_BUILDER_CONCEPT_MODEL:'anthropic/claude-sonnet-4.6'}), unavailable);
});

test('config enforces separate roles, verified TLS, clean URLs, and bounded pools', () => {
  const config = creativeBuilderServerConfig(env);
  assert.equal(config.enabled, true);
  assert.equal(config.repository.ssl.rejectUnauthorized, true);
  assert.equal(config.worker.max, 2);
  assert.equal(config.storageUrl, 'https://invalid.test');
  assert.equal(creativeBuilderServerConfig({...env,CREATIVE_BUILDER_STORAGE_URL:'https://preview.invalid.test'}).storageUrl,'https://preview.invalid.test');
  assert.throws(() => creativeBuilderServerConfig({...env, CREATIVE_BUILDER_WORKER_DATABASE_URL:env.CREATIVE_BUILDER_REPOSITORY_DATABASE_URL}), unavailable);
  for (const suffix of ['?ssl=false', '?options=x', '#unsafe']) assert.throws(() => creativeBuilderServerConfig({...env, CREATIVE_BUILDER_WORKER_DATABASE_URL:env.CREATIVE_BUILDER_WORKER_DATABASE_URL + suffix}), unavailable);
});

test('lifecycle config is separately secret-gated and does not require a model or repository credential',()=>{
  const lifecycle={...env,CREATIVE_BUILDER_REPOSITORY_DATABASE_URL:undefined,CREATIVE_BUILDER_OPENROUTER_API_KEY:undefined,CREATIVE_BUILDER_CLEANUP_TOKEN:'x'.repeat(32)};
  const config=creativeBuilderLifecycleConfig(lifecycle);
  assert.equal(config.routeSecret,'x'.repeat(32));
  assert.equal(config.worker.max,2);
  assert.equal(creativeBuilderLifecycleConfig({...lifecycle,CREATIVE_BUILDER_STORAGE_URL:'https://preview.invalid.test'}).storageUrl,'https://preview.invalid.test');
  for(const token of [undefined,'','short',' '+ 'x'.repeat(32)]) assert.throws(()=>creativeBuilderLifecycleConfig({...lifecycle,CREATIVE_BUILDER_CLEANUP_TOKEN:token}),unavailable);
});

test('Studio can use an isolated server-only storage project without moving browser authentication',()=>{
  const config=studioServerConfig({
    CREATIVE_STUDIO_HOSTED_ENABLED:'true',
    CREATIVE_STUDIO_REPOSITORY_DATABASE_URL:'postgres://studio_request:***@invalid.test/app',
    CREATIVE_STUDIO_WORKER_DATABASE_URL:'postgres://studio_worker:***@invalid.test/app',
    NEXT_PUBLIC_SUPABASE_URL:'https://auth.invalid.test',
    CREATIVE_STUDIO_STORAGE_URL:'https://preview.invalid.test',
    CREATIVE_STUDIO_STORAGE_KEY:'private-storage-key',
  });
  assert.equal(config.storageUrl,'https://preview.invalid.test');
});
