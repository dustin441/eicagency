import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCreativeBuilderCleanupWorker,
  CreativeBuilderCleanupError,
  type CreativeBuilderCleanupObject,
  type CreativeBuilderCleanupStore,
} from './creative-builder-cleanup.ts';
import type {CreativeBuilderPrivateObjectProvider} from './creative-builder-source-storage.ts';

const OWNER='11111111-1111-4111-8111-111111111111';
const PROJECT='22222222-2222-4222-8222-222222222222';
const object=(id:string,key=`eicagency/${OWNER}/${PROJECT}/33333333-3333-4333-8333-333333333333/1/import.webp`):CreativeBuilderCleanupObject=>({id,ownerId:OWNER,tenantId:'eicagency',projectId:PROJECT,objectKey:key,leaseToken:'44444444-4444-4444-8444-444444444444',fencingGeneration:2,attempt:1});

class Store implements CreativeBuilderCleanupStore {
  claims:CreativeBuilderCleanupObject[][]=[];
  completed:Array<{id:string;outcome:'removed'|'not-found'}>=[];
  failed:string[]=[];
  sweepCalls:number[]=[];
  purgeCalls:number[]=[];
  async sweep(limit:number){this.sweepCalls.push(limit);return {expiredJobs:0,abandonedProjects:0,enqueuedObjects:0};}
  async claimObjects(limit:number){return (this.claims.shift()??[]).slice(0,limit);}
  async completeObject(value:{id:string;leaseToken:string;fencingGeneration:number;outcome:'removed'|'not-found'}){this.completed.push({id:value.id,outcome:value.outcome});}
  async failObject(value:{id:string}){this.failed.push(value.id);}
  async purge(limit:number){this.purgeCalls.push(limit);return {purgedProjects:0,expiredTombstones:0};}
}
class Objects implements CreativeBuilderPrivateObjectProvider {
  removed:string[]=[];
  failures=new Set<string>();
  missing=new Set<string>();
  async putCreateOnly():Promise<'created'|'exists'>{throw new Error('not used');}
  async get():Promise<{bytes:Uint8Array;contentType:string}|null>{throw new Error('not used');}
  async remove(_bucket:string,key:string){this.removed.push(key);if(this.failures.has(key))throw new Error('private provider detail');return this.missing.has(key)?'not-found' as const:'removed' as const;}
}

test('bounded worker deletes only DB-claimed opaque targets and records removed/not-found terminal receipts',async()=>{
 const store=new Store(),objects=new Objects();
 const one=object('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 const two=object('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',`eicagency/${OWNER}/${PROJECT}/55555555-5555-4555-8555-555555555555/3/import.webp`);
 objects.missing.add(two.objectKey);store.claims.push([one,two],[]);
 const worker=createCreativeBuilderCleanupWorker({store,objects,now:()=>0});
 const receipt=await worker.run({batchSize:2,maxObjects:2,maxRuntimeMs:1000});
 assert.deepEqual(receipt,{expiredJobs:0,abandonedProjects:0,enqueuedObjects:0,claimedObjects:2,deletedObjects:1,missingObjects:1,retryObjects:0,acknowledgementFailures:0,purgedProjects:0,expiredTombstones:0});
 assert.deepEqual(store.completed,[{id:one.id,outcome:'removed'},{id:two.id,outcome:'not-found'}]);
 assert.deepEqual(objects.removed,[one.objectKey,two.objectKey]);
 assert.deepEqual(store.sweepCalls,[2]);assert.deepEqual(store.purgeCalls,[2]);
});

test('storage failures schedule a database-owned retry without leaking provider errors',async()=>{
 const store=new Store(),objects=new Objects(),target=object('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 objects.failures.add(target.objectKey);store.claims.push([target]);
 const receipt=await createCreativeBuilderCleanupWorker({store,objects,now:()=>0}).run({batchSize:1,maxObjects:1,maxRuntimeMs:1000});
 assert.equal(receipt.retryObjects,1);assert.deepEqual(store.failed,[target.id]);assert.equal(receipt.deletedObjects,0);
});

test('database acknowledgement failure remains retryable after idempotent object deletion',async()=>{
 const store=new Store(),objects=new Objects(),target=object('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 store.claims.push([target]);store.completeObject=async()=>{throw new Error('database response lost');};
 const receipt=await createCreativeBuilderCleanupWorker({store,objects,now:()=>0}).run({batchSize:1,maxObjects:1,maxRuntimeMs:1000});
 assert.equal(receipt.acknowledgementFailures,1);assert.equal(objects.removed.length,1);assert.deepEqual(store.failed,[]);
});

test('owner/project key mismatch is rejected before storage and cannot be acknowledged',async()=>{
 const store=new Store(),objects=new Objects();
 store.claims.push([object('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',`eicagency/${OWNER}/99999999-9999-4999-8999-999999999999/job/1/import.webp`)]);
 await assert.rejects(createCreativeBuilderCleanupWorker({store,objects,now:()=>0}).run({batchSize:1,maxObjects:1,maxRuntimeMs:1000}),error=>error instanceof CreativeBuilderCleanupError&&error.code==='integrity');
 assert.deepEqual(objects.removed,[]);assert.deepEqual(store.completed,[]);assert.deepEqual(store.failed,[]);
});

test('run input is strict and bounded and never accepts browser keys or URLs',async()=>{
 const worker=createCreativeBuilderCleanupWorker({store:new Store(),objects:new Objects(),now:()=>0});
 await assert.rejects(worker.run({batchSize:1,maxObjects:1,maxRuntimeMs:1000,objectKey:'forged'} as never),/invalid/);
 await assert.rejects(worker.run({batchSize:51,maxObjects:1,maxRuntimeMs:1000}),/invalid/);
 await assert.rejects(worker.run({batchSize:1,maxObjects:501,maxRuntimeMs:1000}),/invalid/);
});
