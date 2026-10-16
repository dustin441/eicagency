import test from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { createCreativeBuilderPgTransport } from './creative-builder-pg-transport.ts';

const context = {tenantId:'eicagency',ownerId:'11111111-1111-4111-8111-111111111111'} as const;

test('unknown and cross-capability RPCs are denied before DB checkout', async () => {
  let checkouts = 0;
  const pool = {async connect(){checkouts++; throw Error('must not connect');}} as unknown as Pick<Pool,'connect'>;
  const repository = createCreativeBuilderPgTransport(pool, context);
  assert.deepEqual(await repository.invoke('creative_builder','read_project_canonical',{} as never), {data:null,error:{code:'42501'}});
  assert.deepEqual(await repository.invoke('creative_builder','transition_job' as never,{} as never), {data:null,error:{code:'42501'}});
  assert.deepEqual(await repository.invoke('creative_builder','__proto__' as never,{} as never), {data:null,error:{code:'42501'}});
  assert.equal(checkouts, 0);
});

test('context is cloned and frozen and claims/role are installed transaction-locally', async () => {
  const calls: Array<{sql:string;values?:unknown[]}> = [];
  const input = {...context};
  const pool = {async connect(){return {async query(sql:string,values?:unknown[]){calls.push({sql,values}); return sql.startsWith('SELECT creative_builder') ? {rows:[{data:{project_id:context.ownerId,revision:0}}]} : {rows:[]};},release(){}};}} as unknown as Pick<Pool,'connect'>;
  const transport = createCreativeBuilderPgTransport(pool,input);
  input.ownerId='22222222-2222-4222-8222-222222222222' as typeof input.ownerId;
  await transport.invoke('creative_builder','create_project',{p_normalized_url:'https://example.com',p_idempotency_key:'create-test-1'});
  assert.equal(transport.context.ownerId,context.ownerId);
  assert(Object.isFrozen(transport)); assert(Object.isFrozen(transport.context));
  assert(calls.some(call => call.sql === 'SET LOCAL ROLE creative_builder_repository'));
  const claimCall = calls.find(call => call.sql.includes("request.jwt.claims"));
  assert(claimCall && String(claimCall.values?.[0]).includes(context.ownerId));
  calls.length=0;
  await createCreativeBuilderPgTransport(pool,input,'worker').invoke('creative_builder','read_project_canonical',{p_project:context.ownerId});
  assert(calls.some(call=>call.sql==='SET LOCAL ROLE creative_builder_worker'));
  assert(calls.some(call=>call.sql.includes('read_project_canonical')));
});

test('rollback failure releases the connection as broken and sanitizes SQL errors', async () => {
  let broken: boolean | undefined;
  const pool = {async connect(){return {async query(sql:string){if(sql === 'ROLLBACK') throw Error('private rollback'); if(sql.startsWith('SELECT creative_builder')) throw Object.assign(Error('secret detail'),{code:'42501'}); return {rows:[]};},release(value:boolean){broken=value;}};}} as unknown as Pick<Pool,'connect'>;
  const response = await createCreativeBuilderPgTransport(pool,context).invoke('creative_builder','read_project',{p_project:context.ownerId});
  assert.deepEqual(response,{data:null,error:{code:'42501'}});
  assert.equal(broken,true);
});
