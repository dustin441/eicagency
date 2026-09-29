import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hostedStudioServer } from './creative-studio-server.ts';
import { studioServerConfig } from './creative-studio-server-config.ts';
const owner='11111111-1111-4111-8111-111111111111';
const env={CREATIVE_STUDIO_HOSTED_ENABLED:'true',CREATIVE_STUDIO_REPOSITORY_DATABASE_URL:'postgres://studio_request:***@invalid.test/studio',CREATIVE_STUDIO_WORKER_DATABASE_URL:'postgres://studio_worker:***@invalid.test/studio',NEXT_PUBLIC_SUPABASE_URL:'https://invalid.test',CREATIVE_STUDIO_STORAGE_KEY:'fake-test-key'};
test('disabled/misconfigured bootstrap constructs nothing and performs no auth/network',async()=>{
 let clients=0,constructed=0;
 const client=async()=>{clients++;throw Error('unexpected');};
 const construct=async()=>{constructed++;throw Error('unexpected');};
 for(const config of [{},{...env,CREATIVE_STUDIO_HOSTED_ENABLED:'false'},{...env,CREATIVE_STUDIO_STORAGE_KEY:''},{...env,CREATIVE_STUDIO_REPOSITORY_DATABASE_URL:env.CREATIVE_STUDIO_REPOSITORY_DATABASE_URL+'?sslmode=no-verify'}]) await assert.rejects(hostedStudioServer(config,client,construct),{status:503});
 assert.equal(clients,0);assert.equal(constructed,0);
});
test('unauthenticated and ineligible client cannot construct runtime',async()=>{
 let constructed=0;
 const construct=async()=>{constructed++;throw Error('unexpected');};
 for(const [id,role,status] of [[null,'agency',401],[owner,'client',403]] as const){
 const client=async()=>({auth:{getUser:async()=>({data:{user:id?{id}:null},error:null})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{role},error:null})})})})}) as unknown as SupabaseClient;
 await assert.rejects(hostedStudioServer(env,client,construct),{status});
 }
 assert.equal(constructed,0);
});
test('explicit config enforces separate roles TLS verification and bounded pools',()=>{
 const c=studioServerConfig(env); assert.equal(c.repository.ssl.rejectUnauthorized,true);assert.equal(c.repository.max,2);assert.equal(c.worker.connectionTimeoutMillis,5000);
 for(const suffix of ['?sslmode=require','?ssl=false','?options=x','#x']) assert.throws(()=>studioServerConfig({...env,CREATIVE_STUDIO_WORKER_DATABASE_URL:env.CREATIVE_STUDIO_WORKER_DATABASE_URL+suffix}),{status:503});
 assert.throws(()=>studioServerConfig({...env,CREATIVE_STUDIO_WORKER_DATABASE_URL:env.CREATIVE_STUDIO_REPOSITORY_DATABASE_URL}),{status:503});
 assert.deepEqual(c.access,{enabled:true});
});
