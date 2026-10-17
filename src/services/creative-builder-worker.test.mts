import test from 'node:test';
import assert from 'node:assert/strict';
import {createCreativeBuilderWorker} from './creative-builder-worker.ts';
import type {TrustedCreativeBuilderRpcTransport} from './creative-builder-repository.ts';

const id=(n:number)=>`00000000-0000-4000-8000-${n.toString(16).padStart(12,'0')}`;

test('worker recovery returns only a newly fenced reserved lease',async()=>{
  const calls:unknown[]=[];
  const transport={async invoke(schema:string,name:string,args:unknown){calls.push({schema,name,args});return {data:{job_id:id(1),state:'reserved',lease_token:id(2),fencing_generation:2,attempts:2},error:null};}} as unknown as TrustedCreativeBuilderRpcTransport;
  const result=await createCreativeBuilderWorker(transport).recover({jobId:id(1),projectId:id(3),operation:'analysis',expectedProjectRevision:0});
  assert.deepEqual(result,{jobId:id(1),state:'reserved',leaseToken:id(2),fencingGeneration:2,result:null});
  assert.deepEqual(calls,[{schema:'creative_builder',name:'recover_job',args:{p_job:id(1),p_project:id(3),p_operation:'analysis',p_expected_revision:0}}]);
});

test('worker recovery maps exhausted and malformed receipts safely',async()=>{
  const exhausted={async invoke(){return {data:{job_id:id(1),state:'failed',attempts:3},error:null};}} as unknown as TrustedCreativeBuilderRpcTransport;
  assert.deepEqual(await createCreativeBuilderWorker(exhausted).recover({jobId:id(1),projectId:id(3),operation:'analysis',expectedProjectRevision:0}),{jobId:id(1),state:'failed',leaseToken:null,fencingGeneration:0,result:null});
  const malformed={async invoke(){return {data:{job_id:id(1),state:'reserved',lease_token:id(2),fencing_generation:1,attempts:1},error:null};}} as unknown as TrustedCreativeBuilderRpcTransport;
  await assert.rejects(createCreativeBuilderWorker(malformed).recover({jobId:id(1),projectId:id(3),operation:'analysis',expectedProjectRevision:0}));
});
