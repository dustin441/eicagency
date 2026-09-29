import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {authorizeSupabaseHostedStudioIdentity} from './creative-studio-supabase-auth.ts';
const config={enabled:true};
function fixture(role:string|null,client_access:string[]|null=null,anonymous=false){
 const id=randomUUID(),calls:string[]=[];
 const client={auth:{getUser:async()=>{calls.push('getUser');return {data:{user:anonymous?null:{id,user_metadata:{role:'super_admin',client_access:['eicagency']}}},error:null};}},from:(table:string)=>{
 assert.equal(table,'profiles');calls.push('profile');return {select:(fields:string)=>{assert.equal(fields,'role, client_access');return {eq:(field:string,value:string)=>{assert.equal(field,'id');assert.equal(value,id);return {single:async()=>({data:role?{role,client_access}:null,error:null})};}};}};
 }};
 return {id,calls,create:async()=>client as unknown as SupabaseClient};
}
for(const [role,access] of [['agency',null],['super_admin',null],['client',['eicagency']]] as const){
 test(`cookie-bound ${role} with existing client access authorized without enrollment`,async()=>{const f=fixture(role,access?[...access]:null);const result=await authorizeSupabaseHostedStudioIdentity(config,f.create);assert.deepEqual(result.context,{tenantId:'eicagency',ownerId:f.id});assert.deepEqual(result.identity,{userId:f.id,role});assert.deepEqual(f.calls,['getUser','profile']);});
}
test('other-client and missing profile denied despite forged editable metadata',async()=>{for(const f of [fixture('client',['nsi']),fixture('client'),fixture(null)])await assert.rejects(authorizeSupabaseHostedStudioIdentity(config,f.create),{status:403});});
test('anonymous denied, disabled never constructs client',async()=>{const f=fixture('agency',null,true);await assert.rejects(authorizeSupabaseHostedStudioIdentity(config,f.create),{status:401});assert.deepEqual(f.calls,['getUser']);await assert.rejects(authorizeSupabaseHostedStudioIdentity({enabled:false},async()=>{throw Error('unexpected')}),{status:503});});
