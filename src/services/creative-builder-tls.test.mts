import test from 'node:test';
import assert from 'node:assert/strict';
import {studioServerConfig} from './creative-studio-server-config.ts';
const env={CREATIVE_STUDIO_HOSTED_ENABLED:'true',CREATIVE_STUDIO_REPOSITORY_DATABASE_URL:'postgres://request:fake@invalid.test/db',CREATIVE_STUDIO_WORKER_DATABASE_URL:'postgres://worker:fake@invalid.test/db',NEXT_PUBLIC_SUPABASE_URL:'https://invalid.test',CREATIVE_STUDIO_STORAGE_KEY:'fake'};
test('custom database CA never disables certificate verification',()=>{
 const ca='-----BEGIN CERTIFICATE-----\nTEST-PUBLIC-CA\n-----END CERTIFICATE-----';
 const c=studioServerConfig({...env,CREATIVE_STUDIO_DATABASE_CA:ca.replace(/\n/g,'\\n')});
 assert.equal(c.repository.ssl.ca,ca);assert.equal(c.worker.ssl.ca,ca);
 assert.equal(c.repository.ssl.rejectUnauthorized,true);assert.equal(c.worker.ssl.rejectUnauthorized,true);
 assert.throws(()=>studioServerConfig({...env,CREATIVE_STUDIO_DATABASE_CA:'not a certificate'}),{status:503});
});
