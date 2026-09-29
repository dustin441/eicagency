import test from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { createStudioPgTransport } from './creative-studio-pg-transport.ts';
const context = {tenantId:'eicagency',ownerId:'11111111-1111-4111-8111-111111111111'} as const;
test('rollback failure destroys connection; no exception detail escapes', async()=>{
  const calls:string[]=[];let destroyed: boolean | undefined;
  const pool = {async connect(){return {async query(sql:string){calls.push(sql);if(sql==='ROLLBACK')throw Error('private rollback');if(sql.startsWith('SELECT creative_studio'))throw Object.assign(Error('secret'),{code:'42501',detail:'private data'});return {rows:[]};},release(value:boolean){destroyed=value;}};}} as unknown as Pick<Pool,'connect'>;
  assert.deepEqual(await createStudioPgTransport(pool,context).invoke('creative_studio','read_project',{p_project:context.ownerId}),{data:null,error:{code:'42501'}});
  assert.equal(calls.at(-1),'ROLLBACK');assert.equal(destroyed,true);
});
test('connect failures sanitized; unknown operations never check out a connection',async()=>{
  let count=0;
  const pool={async connect(){count++;throw Error('password=secret');}} as unknown as Pick<Pool,'connect'>;
  const transport=createStudioPgTransport(pool,context);
  assert.deepEqual(await transport.invoke('creative_studio','__proto__' as never,{} as never),{data:null,error:{code:'42501'}});
  assert.equal(count,0);
  assert.deepEqual(await transport.invoke('creative_studio','read_project',{p_project:context.ownerId}),{data:null,error:{}});
  assert.equal(count,1);
});
test('context cloned and frozen; invalid identity shape rejected without database use',()=>{
  const pool={} as Pick<Pool,'connect'>;const input={...context};
  const transport=createStudioPgTransport(pool,input);
  input.ownerId='22222222-2222-4222-8222-222222222222' as typeof input.ownerId;
  assert.equal(transport.context.ownerId,context.ownerId);
  assert(Object.isFrozen(transport.context));assert(Object.isFrozen(transport));
  assert.throws(()=>createStudioPgTransport(pool,{...context,tenantId:'other'} as never),/denied/);
});
