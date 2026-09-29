import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createHostedStudioService} from './creative-studio-hosted.ts';
import {DEFAULT_BRIEF,DEFAULT_SCENE,PLACEMENTS} from '../lib/creative-studio/model.ts';
import {DEFAULT_DIRECTION,STYLES} from '../lib/creative-studio/directions.ts';
const owner='11111111-1111-4111-8111-111111111111',pid='22222222-2222-4222-8222-222222222222',did='33333333-3333-4333-8333-333333333333',vid='44444444-4444-4444-8444-444444444444',jid='55555555-5555-4555-8555-555555555555';
const context={ownerId:owner,tenantId:'eicagency'} as const, identity={userId:owner,role:'agency'} as const;
const time='2026-09-28T12:00:00Z',html='<!doctype html>  historical exact recipe\n',hash=createHash('sha256').update(html).digest('hex');
test('direct hosted create builds recipes and canonical artwork without questionnaire',async()=>{
 const calls:string[]=[]; let dto:any; let saved:any;
 const scene={...DEFAULT_SCENE,headline:'My custom headline'};
 const service=createHostedStudioService({context,transport:{context,async invoke(_s,name,args){
  calls.push(name);
  if(name==='create_artwork') {
   saved=args as any;
   dto={project:{id:pid,owner_id:owner,tenant_id:'eicagency',planning_brief:null,latest_direction_id:null,latest_version_id:vid,approved_version_id:null,approved_at:null,created_at:time,updated_at:time},directions:[],versions:[{id:vid,project_id:pid,parent_id:null,brief:saved.p_brief,scene:saved.p_scene,source_snapshot:saved.p_sources,recipes:saved.p_recipes,created_at:time}],jobs:[],assets:[],reviews:[]};
   return {data:{project_id:pid,version_id:vid},error:null};
  }
  return {data:dto,error:null};
 }},privateStorage:{async download(){throw Error('unexpected download');}},async runRender(){throw Error('unexpected render');}});
 const p=await service.execute(identity,{op:'create',brief:DEFAULT_BRIEF,scene});
 assert.deepEqual(calls,['create_artwork','read_project']);assert.deepEqual(p.directions,[]);assert(!('planningBrief' in p));
 assert.deepEqual(p.versions[0].scene,scene);assert.deepEqual(p.versions[0].sourceSnapshot,saved.p_sources);
 for(const r of Object.values(saved.p_recipes) as any[])assert.equal(r.sha256,createHash('sha256').update(r.html).digest('hex'));
 assert(!JSON.stringify(p).includes('recipes'));
});
function setup() {
 const calls:string[]=[];
 const dto={project:{id:pid,owner_id:owner,tenant_id:'eicagency',planning_brief:DEFAULT_BRIEF,latest_direction_id:did,latest_version_id:vid,approved_version_id:null,approved_at:null,created_at:time,updated_at:time},directions:[{id:did,project_id:pid,parent_id:null,revision:1,created_by:owner,brief:DEFAULT_DIRECTION,style_snapshot:STYLES[0],created_at:time}],versions:[{id:vid,project_id:pid,parent_id:null,brief:DEFAULT_BRIEF,scene:DEFAULT_SCENE,source_snapshot:{sources:[],warnings:[]},recipes:{'1:1':{html,sha256:hash,placement:PLACEMENTS['1:1']}},created_at:time}],jobs:[{id:jid,version_id:vid,placement_id:'1:1',recipe_sha256:hash,status:'queued',attempts:0,lease_expires_at:null,error_code:null,created_at:time}],assets:[],reviews:[]};
 const service=createHostedStudioService({context,transport:{context,async invoke(_schema,name){calls.push(name);return {data:name==='list_projects'?[dto.project]:name==='enqueue'?jid:dto,error:null};}},privateStorage:{async download(){throw Error('must not download');}},async runRender(project){assert.equal(project,pid);calls.push('worker');}});
 return {service,calls,dto};
}
test('immutable stored preview and public projection remain separate',async()=>{
 const {service}=setup(); assert.equal(await service.readPreview(identity,pid,vid,'1:1'),html);
 assert.deepEqual(await service.readPlacement(identity,pid,vid,'1:1'),PLACEMENTS['1:1']);
 const list=await service.list(identity); assert.equal(list.mode,'hosted-private-beta');assert.equal(list.projects.length,1);
 assert(!JSON.stringify(list).includes(html));assert(!JSON.stringify(list).includes('recipes'));
});
test('server-verified eligible client can use hosted service but never another owner context',async()=>{
 const {service}=setup();const client={...identity,role:'client'} as const;
 assert.equal((await service.list(client)).projects.length,1);
 assert.equal(await service.readPreview(client,pid,vid,'1:1'),html);
 await assert.rejects(service.list({...client,userId:pid}),{status:403});
});
test('all per-method identity mismatches deny before transport',async()=>{
 const {service,calls}=setup();const other={...identity,userId:pid};
 for(const invoke of [()=>service.list(other),()=>service.execute(other,{}),()=>service.readPreview(other,pid,vid,'1:1'),()=>service.readPlacement(other,pid,vid,'1:1'),()=>service.readAsset(other,pid,vid,'1:1')]) await assert.rejects(invoke,{status:403});
 assert.deepEqual(calls,[]);
});
test('pending queued render never reports synchronous success',async()=>{
 const {service,calls}=setup();await assert.rejects(service.execute(identity,{op:'render',projectId:pid,versionId:vid,ratio:'1:1'}),{status:409});
 assert.deepEqual(calls,['read_project','enqueue','worker','read_project']);
});
test('invalid body owner is side effect free',async()=>{
 const {service,calls}=setup();
 await assert.rejects(service.execute(identity,{op:'create-direction',brief:DEFAULT_BRIEF,direction:DEFAULT_DIRECTION,ownerId:owner}),{status:400});assert.deepEqual(calls,[]);
});
test('missing assets and stale version fail closed',async()=>{
 const {service}=setup();await assert.rejects(service.readAsset(identity,pid,vid,'1:1'),{status:404});
 await assert.rejects(service.execute(identity,{op:'approve',projectId:pid,versionId:did}),{status:409});
});
