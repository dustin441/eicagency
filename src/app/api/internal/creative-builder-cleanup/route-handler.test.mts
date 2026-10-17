import test from 'node:test';
import assert from 'node:assert/strict';
import {createCreativeBuilderCleanupPostHandler} from './route-handler.ts';
const secret='s'.repeat(32);
const request=(token?:string,body='')=>new Request('https://example.test/api/internal/creative-builder-cleanup',{method:'POST',headers:token?{authorization:`Bearer ${token}`}:{},body:body||undefined});

test('maintenance endpoint fails closed before work and rejects every request body',async()=>{
 let calls=0;const handler=createCreativeBuilderCleanupPostHandler({getSecret:()=>secret,run:async()=>{calls++;return {};}});
 assert.equal((await handler(request())).status,401);
 assert.equal((await handler(request('wrong'))).status,401);
 assert.equal((await handler(request(secret,'{"objectKey":"forged"}'))).status,400);
 assert.equal(calls,0);
});

test('authorized empty request returns only sanitized bounded receipt',async()=>{
 const receipt={expiredJobs:1,abandonedProjects:2,enqueuedObjects:3,claimedObjects:4,deletedObjects:4,missingObjects:0,retryObjects:0,acknowledgementFailures:0,purgedProjects:1,expiredTombstones:0};
 const response=await createCreativeBuilderCleanupPostHandler({getSecret:()=>secret,run:async()=>receipt})(request(secret));
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');assert.deepEqual(await response.json(),{ok:true,receipt});
});

test('worker failures are sanitized',async()=>{
 const response=await createCreativeBuilderCleanupPostHandler({getSecret:()=>secret,run:async()=>{throw new Error('private database details');}})(request(secret));
 assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'Creative Builder cleanup failed'});
});
