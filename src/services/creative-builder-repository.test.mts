import test from 'node:test';
import assert from 'node:assert/strict';
import { createCreativeBuilderRepository, CreativeBuilderRepositoryError, type TrustedCreativeBuilderRpcTransport } from './creative-builder-repository.ts';

const id = (n:number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12,'0')}`;
const owner=id(1), project=id(2), scan=id(3), page=id(4), plan=id(5), setId=id(7), confirmation=id(8);
const time='2026-10-16T12:00:00.000001+00:00', hash='a'.repeat(64);
const context={ownerId:owner,tenantId:'eicagency'} as const;
const assumption = {recommendation:'Canonical recommendation',observedPageExcerptIds:['source-1'],confirmed:false};
const assumptions = {advertisedSubject:assumption,offer:assumption,audience:assumption,awareness:assumption,funnelStage:assumption,objective:assumption,message:assumption,cta:assumption,claims:[]};
const receipt={id:scan,scannedAt:'2026-10-16T12:00:00.000Z',pages:[{id:page,kind:'landing' as const,requestedUrl:'https://example.com/landing',finalUrl:'https://example.com/landing',title:'Page',description:'Description'}],excerpts:[{id:'source-1',pageId:page,kind:'body' as const,text:'Canonical page evidence'}],assets:[{id:'candidate-1',pageId:page,sourceUrl:'https://cdn.example.com/private.jpg',kind:'hero' as const,alt:'Hero',sourceExcerptIds:['source-1']}],warnings:[]};
// Mutable adversarial fixtures intentionally span several incompatible database states.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function draftDto(): any {
  return {project:{id:project,normalized_url:'https://example.com/landing',revision:1,latest_scan_id:scan,latest_plan_revision_id:plan,latest_concept_set_id:null,latest_selection_id:null,linked_studio_project_id:null,linked_studio_version_id:null,created_at:time,updated_at:time},scans:[{id:scan,project_revision:1,receipt_sha256:hash,created_at:time,receipt}],plans:[{id:plan,project_id:project,parent_id:null,scan_id:scan,project_revision:1,assumptions,channels:[],assumptions_hash:hash,confirmation_receipts:[],created_at:time}],concept_sets:[],concept_revisions:[],selections:[],messages:[],source_assets:[],candidate_previews:[{id:id(6),project_id:project,scan_id:scan,candidate_id:'candidate-1',sha256:hash,mime_type:'image/webp',width:400,height:250,size_bytes:1024,created_at:time}],jobs:[]};
}
function setup(handler:(name:string,args:unknown)=>unknown = name => name==='list_projects' ? [draftDto().project] : draftDto()) {
  const calls:Array<{name:string;args:unknown}>=[];
  const transport:TrustedCreativeBuilderRpcTransport={context:{...context},async invoke(schema,name,args){assert.equal(schema,'creative_builder');calls.push({name,args});const value=handler(name,args);if(value instanceof Error) return {data:null,error:{}};return {data:value,error:null};}};
  return {repo:createCreativeBuilderRepository(context,transport),transport,calls};
}
const hasCode=(code:string)=>(error:unknown)=>error instanceof CreativeBuilderRepositoryError&&error.code===code;

test('owner context is frozen logically and compared before every checkout',async()=>{
  const {repo,transport,calls}=setup();
  (transport.context as {ownerId:string}).ownerId=id(99);
  await assert.rejects(repo.read(project),hasCode('denied'));
  assert.equal(calls.length,0);
});

test('strict canonical read returns a safe public projection only',async()=>{
  const publicProject=await setup().repo.read(project);
  assert.equal(publicProject.phase,'draft');
  assert.deepEqual(publicProject.candidates,[{id:'candidate-1',pageId:page,kind:'hero',alt:'Hero'}]);
  const serialized=JSON.stringify(publicProject);
  for(const secret of ['sourceUrl','sourceExcerptIds','object_key','lease_token','provider','prompt','cdn.example.com']) assert(!serialized.includes(secret));
  const malformed=draftDto() as ReturnType<typeof draftDto>&{provider?:string};malformed.provider='secret';
  await assert.rejects(setup(()=>malformed).repo.read(project),hasCode('invalid-response'));
});

test('public reads use sanitized candidates while canonical loaders require the worker-only receipt RPC',async()=>{
  const publicDto=draftDto();
  publicDto.scans=[{id:scan,project_revision:1,receipt_sha256:hash,created_at:time,candidates:[{id:'candidate-1',pageId:page,kind:'hero',alt:'Hero'}]}];
  const publicCalls:string[]=[];const canonicalCalls:string[]=[];
  const publicTransport:TrustedCreativeBuilderRpcTransport={context,async invoke(_schema,name){publicCalls.push(name);return {data:publicDto,error:null};}};
  const canonicalTransport:TrustedCreativeBuilderRpcTransport={context,async invoke(_schema,name){canonicalCalls.push(name);return {data:draftDto(),error:null};}};
  const repo=createCreativeBuilderRepository(context,publicTransport,canonicalTransport);
  assert.deepEqual((await repo.read(project)).candidates,[{id:'candidate-1',pageId:page,kind:'hero',alt:'Hero'}]);
  assert.equal((await repo.canonicalLoader.loadForAnalysis({projectId:project,scanId:scan})).pages[0].title,'Page');
  assert.deepEqual(publicCalls,['read_project']);assert.deepEqual(canonicalCalls,['read_project_canonical']);
});

test('cross-owner jobs and malformed responses fail closed',async()=>{
  const cross=draftDto();cross.jobs.push({id:id(20),owner_id:id(99),tenant_id:'eicagency',project_id:project,operation:'analysis',idempotency_key:'analysis:1',expected_project_revision:1,target_kind:null,target_id:null,state:'completed',reserved_units:1,reserved_bytes:0,completed_units:1,fencing_generation:1,lease_expires_at:null,model_deadline:null,attempts:1,error_code:null,created_at:time,updated_at:time} as never);
  await assert.rejects(setup(()=>cross).repo.read(project),hasCode('denied'));
  for(const value of [null,{}, {...draftDto(),project:{...draftDto().project,owner_id:owner}}, {...draftDto(),scans:[{...draftDto().scans[0],lease_token:id(30)}]}]) await assert.rejects(setup(()=>value).repo.read(project),hasCode('invalid-response'));
});

test('pagination is complete, ordered, and bounded',async()=>{
  const second={...draftDto().project,id:id(40),created_at:'2026-10-16T12:00:00.000002+00:00'};
  let pageNumber=0;
  const {repo,calls}=setup(name=>name==='list_projects'?(pageNumber++===0?[draftDto().project]:pageNumber===2?[second]:[]):draftDto());
  const projects=await repo.listAll({pageSize:1,maxProjects:3});
  assert.deepEqual(projects.map(item=>item.id),[project,second.id]);
  assert.equal(calls.filter(call=>call.name==='list_projects').length,3);
  await assert.rejects(setup(()=>[draftDto().project]).repo.listAll({pageSize:1,maxProjects:1}),hasCode('limit'));
});

test('SQLSTATEs map to sanitized invalid/denied/conflict/limit/unavailable without retry',async()=>{
  for(const [sql,code] of [['22023','invalid'],['42501','denied'],['40001','conflict'],['55000','conflict'],['54000','limit'],['XX000','unavailable']] as const){
    let count=0;const transport:TrustedCreativeBuilderRpcTransport={context,async invoke(){count++;return {data:null,error:{code:sql}};}};
    await assert.rejects(createCreativeBuilderRepository(context,transport).read(project),hasCode(code));assert.equal(count,1);
  }
});

test('ambiguous plan mutation reconciles through one canonical read, never blind-retries mutation',async()=>{
  const next=draftDto();next.project.revision=2;next.plans.push({...next.plans[0],id:id(50),parent_id:plan,project_revision:2});next.project.latest_plan_revision_id=id(50);
  const names:string[]=[];
  const transport:TrustedCreativeBuilderRpcTransport={context,async invoke(_schema,name){names.push(name);return name==='edit_plan'?{data:null,error:{}}:{data:next,error:null};}};
  const repo=createCreativeBuilderRepository(context,transport);
  const result=await repo.editPlan({projectId:project,expectedPlanRevisionId:plan,expectedProjectRevision:1,scanId:scan,assumptions,channels:[]});
  assert.equal(result.planRevisionId,id(50));assert.deepEqual(names,['edit_plan','read_project']);
});

const catalog=[['breaking-news-editorial','problem-recognition','editorial'],['founder-note','human-trust','founder-note'],['outcome-demo','demonstration','product-demo'],['white-label-communication-gap','proof','communication-proof'],['think-vs-reality','comparison','comparison'],['practical-playbook','practical-utility','checklist']] as const;
function generatedDto(){
  const value=draftDto();
  const confirmedAssumptions=structuredClone(assumptions);for(const [key,item] of Object.entries(confirmedAssumptions))if(key!=='claims'&&!Array.isArray(item))item.confirmed=true;
  const confirmedPlan={...value.plans[0],assumptions:confirmedAssumptions,confirmation_receipts:[{id:confirmation,scope:'plan' as const,planRevisionId:plan,contentSha256:hash,claimIds:[],confirmedAt:'2026-10-16T12:00:00.000Z',confirmedBy:owner}]};
  value.plans=[confirmedPlan];
  const concepts=catalog.map((entry,index)=>({id:`concept-${index}`,catalogEntryId:entry[0],title:`Concept ${index}`,persuasionJob:entry[1],visualFamily:entry[2],mediaType:'static' as const,staticOutput:true,hypothesis:'A bounded test hypothesis.',primaryText:'Canonical primary text.',headline:'Canonical headline',description:'Description',cta:'Learn More',rationale:'A distinct rationale.',visualDirection:'A safe static composition.',claims:[],winnerClaim:false as const,fabricatedProof:false as const}));
  const revisions=concepts.map((content,index)=>({id:id(100+index),project_id:project,concept_set_id:setId,concept_handle:content.id,parent_id:null as string|null,revision:1,content,content_hash:hash,created_at:time}));
  const revised={...concepts[0],headline:'Exact revised headline'};
  revisions.push({id:id(120),project_id:project,concept_set_id:setId,concept_handle:revised.id,parent_id:id(100),revision:2,content:revised,content_hash:hash,created_at:'2026-10-16T12:00:01.000001+00:00'});
  Object.assign(value.project,{revision:2,latest_concept_set_id:setId});
  value.concept_sets=[{id:setId,project_id:project,parent_id:null,plan_revision_id:plan,project_revision:2,portfolio:concepts.map(content=>({handle:content.id,content})),content_hash:hash,created_at:time}];
  value.concept_revisions=revisions;
  return value;
}

function portfolioRevisionDto(){
  const value=generatedDto(), nextSet=id(200);
  const concepts=value.concept_sets[0].portfolio.map((item:{handle:string;content:Record<string,unknown>},index:number)=>({handle:item.handle,content:{...item.content,headline:`Portfolio revision ${index}`}}));
  const priorByHandle=new Map(value.concept_revisions.filter((row:{concept_handle:string})=>row.concept_handle).map((row:{concept_handle:string;revision:number})=>[row.concept_handle,row]));
  const nextRevisions=concepts.map((item:{handle:string;content:Record<string,unknown>},index:number)=>{const parent=priorByHandle.get(item.handle) as {id:string;revision:number};return {id:id(210+index),project_id:project,concept_set_id:nextSet,concept_handle:item.handle,parent_id:parent.id,revision:parent.revision+1,content:item.content,content_hash:hash,created_at:'2026-10-16T12:00:02.000001+00:00'};});
  value.concept_sets.push({id:nextSet,project_id:project,parent_id:setId,plan_revision_id:plan,project_revision:3,portfolio:concepts,content_hash:hash,created_at:'2026-10-16T12:00:02.000001+00:00'});
  value.concept_revisions.push(...nextRevisions);Object.assign(value.project,{revision:3,latest_concept_set_id:nextSet});return value;
}

test('portfolio revisions and historical concept sets follow canonical project pointers',async()=>{
  const revised=portfolioRevisionDto();
  const loaded=await setup(()=>revised).repo.canonicalLoader.loadForGeneration({projectId:project,expectedPlanRevisionId:plan});
  assert.equal(loaded.strategy.phase==='generated'?loaded.strategy.portfolio.concepts[0].headline:'','Portfolio revision 0');
  const confirmed=generatedDto(), nextPlan=id(300), nextConfirmation=id(301);
  confirmed.plans.push({...confirmed.plans[0],id:nextPlan,parent_id:plan,project_revision:3,confirmation_receipts:[{id:nextConfirmation,scope:'plan',planRevisionId:nextPlan,contentSha256:hash,claimIds:[],confirmedAt:'2026-10-16T12:00:03.000Z',confirmedBy:owner}],created_at:'2026-10-16T12:00:03.000001+00:00'});
  Object.assign(confirmed.project,{revision:4,latest_plan_revision_id:nextPlan,latest_concept_set_id:null,latest_selection_id:null});
  assert.equal((await setup(()=>confirmed).repo.read(project)).phase,'confirmed');
});

test('canonical AI loading binds the exact latest concept revision identity',async()=>{
  const repo=setup(()=>generatedDto()).repo;
  const loaded=await repo.canonicalLoader.loadForRevision({projectId:project,target:'concept',expectedConceptRevisionId:id(120),conceptId:'concept-0',message:'shorten it'});
  assert.deepEqual(loaded.targetConceptRevision,{revisionId:id(120),concept:{...generatedDto().concept_revisions.at(-1)!.content}});
  await assert.rejects(repo.canonicalLoader.loadForRevision({projectId:project,target:'concept',expectedConceptRevisionId:id(100),conceptId:'concept-0',message:'stale revision'}),hasCode('conflict'));
});

test('portfolio order is canonical and selection source identity is exact',async()=>{
  const reordered=generatedDto();
  reordered.concept_revisions=[...reordered.concept_revisions.slice(0,6).reverse(),reordered.concept_revisions.at(-1)!];
  const loaded=await setup(()=>reordered).repo.canonicalLoader.loadForGeneration({projectId:project,expectedPlanRevisionId:plan});
  assert.deepEqual(loaded.strategy.phase==='generated' ? loaded.strategy.portfolio.concepts.map(item=>item.id) : [],['concept-0','concept-1','concept-2','concept-3','concept-4','concept-5']);
  const publicProject=await setup(()=>reordered).repo.read(project);
  assert.equal(publicProject.phase==='generated' ? publicProject.concepts[0].concept.headline : '', 'Exact revised headline');

  const mismatched=generatedDto();
  mismatched.selections=[{id:id(130),project_id:project,concept_set_id:setId,concept_revision_id:id(120),source_kind:'portfolio',concept_handle:'concept-0',ordered_asset_ids:[],content_hash:hash,created_at:time}];
  mismatched.project.latest_selection_id=id(130);
  await assert.rejects(setup(()=>mismatched).repo.read(project),hasCode('invalid-response'));
});
