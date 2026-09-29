import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioRepository, StudioRepositoryError, type TrustedStudioRpcTransport } from './creative-studio-repository.ts';
import { DEFAULT_BRIEF, DEFAULT_SCENE, PLACEMENTS } from '../lib/creative-studio/model.ts';
import { createHash } from 'node:crypto';
import { DEFAULT_DIRECTION, STYLES } from '../lib/creative-studio/directions.ts';
import { DEFAULT_IDEA, switchIdeaFormat } from '../lib/creative-studio/ideas.ts';
const owner = '11111111-1111-4111-8111-111111111111', pid = '22222222-2222-4222-8222-222222222222', did = '33333333-3333-4333-8333-333333333333';
const context = { ownerId: owner, tenantId: 'eicagency' } as const;
const time = '2026-09-28T12:00:00.000001+00:00';
const idea = switchIdeaFormat({ ...DEFAULT_IDEA, content: {kind:'note',body:'Incomplete saved draft'}, headline:'Original note' }, 'comparison');
const direction = { ...DEFAULT_DIRECTION, idea, notes:'  preserved historical whitespace  ' };
function dto() { return { project: {id:pid,owner_id:owner,tenant_id:'eicagency',planning_brief:DEFAULT_BRIEF,latest_direction_id:did,latest_version_id:null,approved_version_id:null,approved_at:null,created_at:time,updated_at:time}, directions:[{id:did,project_id:pid,parent_id:null,revision:1,created_by:owner,brief:direction,style_snapshot:{...STYLES[0],name:'Historical style name'},created_at:time}],versions:[],jobs:[],assets:[],reviews:[] }; }
function setup(handler: (name: string, args: unknown) => unknown = name => name === 'save_direction' ? {project_id:pid,direction_id:did,revision:1} : name === 'list_projects' ? [dto().project] : dto()) {
 const calls: {name:string;args:unknown}[]=[];
 const transport: TrustedStudioRpcTransport = {context,async invoke(schema,name,args){ assert.equal(schema,'creative_studio');calls.push({name,args});return {data:handler(name,args),error:null}; }};
 return {repo:createStudioRepository(context,transport),calls,transport};
}
const error = (code:string) => (e:unknown) => e instanceof StudioRepositoryError && e.code === code;
const vid='44444444-4444-4444-8444-444444444444', jid='55555555-5555-4555-8555-555555555555';
const hash=createHash('sha256').update('private recipe').digest('hex');
function artworkDto() { return {...dto(),project:{...dto().project,latest_version_id:vid},versions:[{id:vid,project_id:pid,parent_id:null,brief:DEFAULT_BRIEF,scene:DEFAULT_SCENE,source_snapshot:{sources:[],warnings:[]},recipes:{'1:1':{html:'private recipe',sha256:hash,placement:PLACEMENTS['1:1']}},created_at:time}],jobs:[{id:jid,version_id:vid,placement_id:'1:1',recipe_sha256:hash,status:'queued',attempts:0,lease_expires_at:null as string|null,error_code:null as string|null,created_at:time}]}; }
test('SQL jobs truthfully map statuses without unknown execution metadata or internal fields',async()=>{
 for(const status of ['queued','running','failed']) {
  const d=artworkDto();Object.assign(d.jobs[0],{status,attempts:status==='queued'?0:1,lease_expires_at:status==='running'?time:null,error_code:status==='failed'?'render_failed':null});
  const p=await setup(()=>d).repo.read(pid);const j=p.versions[0].jobs[0];
  assert.deepEqual(j,{id:jid,versionId:vid,ratio:'1:1',status,createdAt:time,...(status==='failed'?{error:'Render could not complete. Please retry.'}:{})});
  assert.deepEqual(p.versions[0].exports,{});assert(!JSON.stringify(p).includes('private recipe'));
 }
});
test('job references, recipe identity, status/lease shape and malicious tokens fail closed',async()=>{
 for(const change of [{version_id:pid},{placement_id:'9:16'},{recipe_sha256:'a'.repeat(64)},{status:'unknown'},{status:'running'},{lease_expires_at:time},{attempts:4},{error_code:'secret backend error'},{lease_token:owner},{provider:'invented'}]) {
  const d=artworkDto();Object.assign(d.jobs[0],change);await assert.rejects(setup(()=>d).repo.read(pid),error('invalid-response'));
 }
 for(const sameId of [true,false]) {const d=artworkDto();d.jobs.push({...d.jobs[0],id:sameId?jid:owner});await assert.rejects(setup(()=>d).repo.read(pid),error('invalid-response'));}
 const d=artworkDto();d.versions[0].project_id=owner;await assert.rejects(setup(()=>d).repo.read(pid),error('invalid-response'));
 d.project.owner_id=pid;await assert.rejects(setup(()=>d).repo.read(pid),error('denied'));
});
test('create sends exact normalized full snapshots and reads canonical history',async()=>{
 const {repo,calls}=setup();const p=await repo.create({brief:DEFAULT_BRIEF,direction});
 assert.deepEqual(calls.map(c=>c.name),['save_direction','read_project']);
 assert.deepEqual(calls[0].args,{p_project:null,p_expected:null,p_planning_brief:DEFAULT_BRIEF,p_direction:{...direction,notes:direction.notes.trim()},p_style_snapshot:STYLES[0]});
 assert.deepEqual(p.directions![0].brief,direction);assert.equal(p.directions![0].styleSnapshot.name,'Historical style name');
 assert.deepEqual(p.directions![0].brief.idea,idea);p.directions![0].brief.idea!.headline='mutated';assert.equal((await repo.read(pid)).directions![0].brief.idea!.headline,idea.headline);
});
test('save uses null planning brief and optimistic expected id; canonical read follows write',async()=>{
 const {repo,calls}=setup();await repo.save({projectId:pid,expectedDirectionId:did,direction});
 assert.deepEqual(calls.map(c=>c.name),['read_project','save_direction','read_project']);
 assert.equal((calls[1].args as {p_expected:string}).p_expected,did);assert.equal((calls[1].args as {p_planning_brief:null}).p_planning_brief,null);
});
test('owner injection and context mismatch are rejected before transport',async()=>{
 const {repo,calls,transport}=setup();await assert.rejects(repo.create({...{brief:DEFAULT_BRIEF,direction},ownerId:owner} as never),error('invalid'));assert.equal(calls.length,0);
 assert.throws(()=>createStudioRepository({...context,ownerId:pid},transport),error('denied'));
});
test('cross owner read and malformed or inconsistent DTO fail closed',async()=>{
 for(const value of [null,{}, {...dto(),directions:[]}, {...dto(),directions:[{...dto().directions[0],brief:{styleId:'invalid'}}]}]) await assert.rejects(setup(()=>value).repo.read(pid),error('invalid-response'));
 await assert.rejects(setup(()=>({...dto(),project:{...dto().project,owner_id:pid}})).repo.read(pid),error('denied'));
});
test('internal recipes and object keys never project as a direction-only project',async()=>{
 await assert.rejects(setup(()=>({...dto(),versions:[{recipes:{html:'secret'}}],assets:[{object_key:'private'}]})).repo.read(pid),error('invalid-response'));
});
const aid='66666666-6666-4666-8666-666666666666';
test('artwork-only create preserves exact snapshots and rejects malformed receipts and empty projects',async()=>{
 const d:any=structuredClone(artworkDto());d.project.planning_brief=null;d.project.latest_direction_id=null;d.directions=[];
 d.versions[0].scene.headline='  custom headline  ';
 d.versions[0].source_snapshot={sources:[{id:'custom',title:' Custom ',url:'https://example.com',role:'reference',note:' exact '}],warnings:[' exact warning ']};
 const v=d.versions[0], input={brief:v.brief,scene:v.scene,sourceSnapshot:v.source_snapshot,recipes:v.recipes};
 const {repo,calls}=setup(name=>name==='create_artwork'?{project_id:pid,version_id:vid}:d);
 const p=await repo.createVersion(input);assert(!('planningBrief' in p));assert.deepEqual(p.directions,[]);assert.deepEqual(p.versions[0].scene,v.scene);assert.deepEqual(p.versions[0].sourceSnapshot,v.source_snapshot);
 assert.deepEqual(calls.map(c=>c.name),['create_artwork','read_project']);assert.deepEqual((calls[0].args as any).p_scene,input.scene);
 for(const receipt of [vid,{}, {project_id:pid,version_id:owner},{project_id:pid,version_id:vid,extra:true}])await assert.rejects(setup(name=>name==='create_artwork'?receipt:d).repo.createVersion(input),error('invalid-response'));
 for(const extra of [{ownerId:owner},{projectId:pid},{expectedVersionId:null}])await assert.rejects(repo.createVersion({...input,...extra} as never),error('invalid'));
 const empty={...d,project:{...d.project,latest_version_id:null},versions:[],jobs:[]};await assert.rejects(setup(()=>empty).repo.read(pid),error('invalid-response'));
 d.project.owner_id=pid;await assert.rejects(setup(()=>d).repo.read(pid),error('denied'));
});
function completedDto():any {
 const d:any=artworkDto(); d.jobs[0].status='complete'; d.jobs[0].attempts=1;
 d.assets=[{id:aid,job_id:jid,object_key:`eicagency/${owner}/${pid}/${vid}/1:1/${jid}/${did}`,sha256:'a'.repeat(64),mime_type:'image/png',size_bytes:123,width:1080,height:1080,qa_passed:true,finalized_at:time}]; return d;
}
test('completed metadata, reviews and approval project without private fields',async()=>{
 const d=completedDto();d.reviews=[{asset_id:aid,approved:true,reviewed_at:time}];d.project.approved_version_id=vid;d.project.approved_at=time;
 const p=await setup(()=>d).repo.read(pid); const v=p.versions[0];
 assert.deepEqual(v.exports['1:1'],{status:'complete',qaPassed:true,filename:`${aid}.png`,issues:[],createdAt:time,mimeType:'image/png',extension:'png',sizeBytes:123,width:1080,height:1080});
 assert.deepEqual(v.reviews,{'1:1':true});assert.deepEqual(v.approval,{userId:owner,at:time});
 for(const value of ['object_key','lease','recipes','private recipe',d.assets[0].object_key]) assert(!JSON.stringify(p).includes(value));
 d.project.approved_version_id=null;d.project.approved_at=null;d.assets[0].qa_passed=false;d.jobs[0].error_code='qa_failed';d.reviews[0].approved=false;
 const failed=(await setup(()=>d).repo.read(pid)).versions[0];assert.equal(failed.exports['1:1']!.status,'failed');assert.equal(failed.reviews['1:1'],false);assert.equal(failed.approval,null);
});
test('completed asset integrity and unknown approval fail closed',async()=>{
 const changes:((d:any)=>void)[]=[d=>d.assets=[],d=>d.assets.push({...d.assets[0]}),d=>d.assets[0].job_id=did,d=>d.jobs[0].status='queued',d=>d.assets[0].sha256='bad',d=>d.assets[0].width=1,d=>d.assets[0].size_bytes=0,d=>d.assets[0].mime_type='image/jpeg',d=>d.assets[0].extra=true,d=>d.reviews=[{asset_id:did,approved:true,reviewed_at:time}],d=>d.reviews=[{asset_id:aid,approved:'true',reviewed_at:time}],d=>{d.project.approved_version_id=did;d.project.approved_at=time;},d=>{d.project.approved_version_id=vid;d.project.approved_at=time;}];
 for(let i=0;i<7;i++)changes.push(d=>{const parts=d.assets[0].object_key.split('/');parts[i]=i===6?'not-a-uuid':did;d.assets[0].object_key=parts.join('/');});
 changes.push(d=>d.assets[0].object_key+='/extra');
 for(const change of changes){const d=completedDto();change(d);await assert.rejects(setup(()=>d).repo.read(pid),error('invalid-response'));}
});
test('bounded pagination preserves timestamp precision and explicitly reports exhaustion',async()=>{
 const {repo,calls}=setup((name,args)=>name==='list_projects' && (args as {p_after_id:string}).p_after_id ? [] : [dto().project]);
 const first=await repo.list({limit:1});assert.equal(first.exhausted,false);assert.deepEqual(first.nextCursor,{createdAt:time,id:pid});
 const last=await repo.list({limit:1,cursor:first.nextCursor});assert.equal(last.exhausted,true);assert.equal(last.nextCursor,null);
 assert.deepEqual(calls[1].args,{p_limit:1,p_after_id:pid,p_after_created_at:time});
 for(const input of [{limit:0},{limit:101},{cursor:{id:pid}},{ownerId:owner}]) await assert.rejects(repo.list(input as never),error('invalid'));
 await assert.rejects(setup(()=>[dto().project,dto().project]).repo.list({limit:1}),error('invalid-response'));
});
test('SQLSTATE errors are sanitized and never retried',async()=>{
 for(const [sql,expected] of [['40001','conflict'],['42501','denied'],['22023','invalid'],['XX000','unavailable']]){
  const {transport}=setup();let count=0;transport.invoke=async()=>{count++;return {data:null,error:{code:sql,message:'secret'} as {code:string}};};
  await assert.rejects(createStudioRepository(context,transport).read(pid),error(expected));assert.equal(count,1);
 }
 const {transport}=setup();transport.invoke=async()=>{throw Error('private credential');};await assert.rejects(createStudioRepository(context,transport).read(pid),error('unavailable'));
});
