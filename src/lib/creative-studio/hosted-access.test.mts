import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {authorizeHostedStudio,hostedStudioAccessConfig} from './hosted-access.ts';
const id=randomUUID();
for(const [role,client_access,allowed] of [['agency',null,true],['super_admin',null,true],['client',['eicagency'],true],['client',['nsi'],false],['client',null,false],['unknown',['eicagency'],false]] as const){
 test(`protected profile ${role}/${client_access} allowed=${allowed}`,async()=>{
 const run=authorizeHostedStudio({enabled:true},{getVerifiedUser:async()=>({id}),getProtectedProfile:async()=>({role,client_access:client_access?[...client_access]:null})});
 if(allowed){assert.deepEqual(await run,{tenantId:'eicagency',ownerId:id});assert.ok(Object.isFrozen(await run));}else await assert.rejects(run,{status:403});
 });
}
test('flag only, no owner environment or enrollment required',()=>{assert.deepEqual(hostedStudioAccessConfig({CREATIVE_STUDIO_HOSTED_ENABLED:'true'}),{enabled:true});assert.equal(hostedStudioAccessConfig({}).enabled,false);});
test('disabled, anonymous, missing profile and failed lookups fail closed',async()=>{
 const valid={getVerifiedUser:async()=>({id}),getProtectedProfile:async()=>({role:'agency',client_access:null})};
 await assert.rejects(authorizeHostedStudio({enabled:false},{...valid,getVerifiedUser:async()=>{throw Error('must not call')}}),{status:503});
 await assert.rejects(authorizeHostedStudio({enabled:true},{...valid,getVerifiedUser:async()=>null}),{status:401});
 await assert.rejects(authorizeHostedStudio({enabled:true},{...valid,getProtectedProfile:async()=>null}),{status:403});
 await assert.rejects(authorizeHostedStudio({enabled:true},{...valid,getVerifiedUser:async()=>{throw Error('secret')}}),{status:401});
 await assert.rejects(authorizeHostedStudio({enabled:true},{...valid,getProtectedProfile:async()=>{throw Error('secret')}}),{status:403});
});
