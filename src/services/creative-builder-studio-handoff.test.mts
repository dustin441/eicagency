import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {AmbiguousHandoffWriteError,BuilderStudioHandoffError,buildStudioHandoffArtwork,createBuilderStudioHandoffService,type CanonicalBuilderHandoff,type DurableBuilderStudioTransferStore,type IdempotentStudioHandoffStore,type StudioHandoffRecord,type TransferRecord} from './creative-builder-studio-handoff.ts';

const IDS={project:'10000000-0000-4000-8000-000000000001',selectionA:'10000000-0000-4000-8000-000000000002',selectionB:'10000000-0000-4000-8000-000000000003',scan:'10000000-0000-4000-8000-000000000004',plan:'10000000-0000-4000-8000-000000000005',concept:'10000000-0000-4000-8000-000000000006',planConfirmation:'10000000-0000-4000-8000-000000000007',claimConfirmation:'10000000-0000-4000-8000-000000000008',assetA:'10000000-0000-4000-8000-000000000009',assetB:'10000000-0000-4000-8000-000000000010',owner:'10000000-0000-4000-8000-000000000011',studioA:'20000000-0000-4000-8000-000000000001',versionA:'20000000-0000-4000-8000-000000000002',studioB:'20000000-0000-4000-8000-000000000003',versionB:'20000000-0000-4000-8000-000000000004'};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
const hash=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
const assumption=(recommendation:string)=>({recommendation,observedPageExcerptIds:['source-copy'],confirmed:true});
function canonical(selectionId=IDS.selectionA,assetIds=[IDS.assetA]):CanonicalBuilderHandoff {
 const assets=assetIds.map((id,index)=>({id,sha256:hash(png),mimeType:'image/png' as const,width:1,height:1,sizeBytes:png.length,alt:`Chosen source ${index+1}`,bytes:Buffer.from(png)}));
 return {projectId:IDS.project,projectRevision:5,currentSelectionId:selectionId,scanReceiptId:IDS.scan,scanReceiptSha256:'e'.repeat(64),planRevisionId:IDS.plan,planContentSha256:'c'.repeat(64),conceptReceiptId:IDS.concept,conceptContentSha256:'f'.repeat(64),selection:{id:selectionId,contentSha256:(selectionId===IDS.selectionA?'a':'b').repeat(64),orderedAssetIds:assetIds},brandName:'Northstar Agency',assetReceipts:assets,assumptions:{advertisedSubject:assumption('A clearer paid media launch'),offer:assumption('A confirmed setup offer'),audience:assumption('Independent agency owners'),awareness:assumption('Ready to compare options'),funnelStage:assumption('Bottom funnel action'),objective:assumption('Request a tailored launch plan'),message:assumption('Approve the launch before payment'),cta:assumption('Request the plan'),claims:[]},confirmationReceipts:[{id:IDS.planConfirmation,scope:'plan',planRevisionId:IDS.plan,contentSha256:'c'.repeat(64),claimIds:[],confirmedAt:'2026-10-16T12:00:00.000Z',confirmedBy:IDS.owner},{id:IDS.claimConfirmation,scope:'claim',planRevisionId:IDS.plan,contentSha256:'d'.repeat(64),claimIds:['price'],confirmedAt:'2026-10-16T12:01:00.000Z',confirmedBy:IDS.owner}],concept:{id:'concept-receipt',catalogEntryId:'zero-due-today-receipt',title:'A confirmed launch receipt',persuasionJob:'offer-clarity',visualFamily:'receipt',mediaType:'static',staticOutput:true,hypothesis:'A receipt format makes the confirmed offer concrete.',primaryText:'See the exact launch sequence before making a decision.',headline:'Approve first, then launch',description:'A clear next step',cta:'Request my plan',rationale:'Makes the approved process easy to scan.',visualDirection:'Use a clean receipt layout with strong hierarchy.',claims:[{id:'price',kind:'price',text:'Setup is $0 today',status:'user-confirmed',pageExcerptIds:[],confirmationReceiptId:IDS.claimConfirmation}],winnerClaim:false,fabricatedProof:false}};
}

class MemoryTransfers implements DurableBuilderStudioTransferStore {
 records=new Map<string,TransferRecord>(); reserveCalls=0;linkCalls=0;ambiguousReserve=false;ambiguousLink=false;
 async reserve(input:Parameters<DurableBuilderStudioTransferStore['reserve']>[0]){this.reserveCalls++;let record=this.records.get(input.handoffKey);if(!record){record={...input,studioProjectId:null,studioVersionId:null};this.records.set(input.handoffKey,record);}if(this.ambiguousReserve){this.ambiguousReserve=false;throw new AmbiguousHandoffWriteError();}return structuredClone(record);}
 async read(key:string){return structuredClone(this.records.get(key)??null);}
 async link(input:Parameters<DurableBuilderStudioTransferStore['link']>[0]){this.linkCalls++;const record=this.records.get(input.handoffKey);if(!record||record.artifactSha256!==input.artifactSha256)throw Error('bad link');this.records.set(input.handoffKey,{...record,studioProjectId:input.studioProjectId,studioVersionId:input.studioVersionId});if(this.ambiguousLink){this.ambiguousLink=false;throw new AmbiguousHandoffWriteError();}}
}
class MemoryStudio implements IdempotentStudioHandoffStore {
 records=new Map<string,StudioHandoffRecord>();createCalls=0;ambiguousAfterCommit=false;ambiguousBeforeCommit=false;artworks:any[]=[];
 async createByHandoffKey(input:Parameters<IdempotentStudioHandoffStore['createByHandoffKey']>[0]){this.createCalls++;if(this.ambiguousBeforeCommit){this.ambiguousBeforeCommit=false;throw new AmbiguousHandoffWriteError();}let record=this.records.get(input.handoffKey);if(!record){const second=this.records.size>0;record={handoffKey:input.handoffKey,artifactSha256:input.artifactSha256,projectId:second?IDS.studioB:IDS.studioA,versionId:second?IDS.versionB:IDS.versionA};this.records.set(input.handoffKey,record);this.artworks.push(structuredClone(input.artwork));}if(this.ambiguousAfterCommit){this.ambiguousAfterCommit=false;throw new AmbiguousHandoffWriteError();}return structuredClone(record);}
 async readByHandoffKey(key:string){return structuredClone(this.records.get(key)??null);}
}
function setup(value=canonical()){
 const transfers=new MemoryTransfers(),studio=new MemoryStudio();let loads=0;
 const service=createBuilderStudioHandoffService({loader:{async load(input){loads++;assert.deepEqual(input,{projectId:IDS.project,expectedProjectRevision:5,expectedSelectionId:value.selection.id});return structuredClone(value);}},transfers,studio});
 return {service,transfers,studio,get loads(){return loads;}};
}

test('builds generated-native-v1 artwork with exact ordered Builder provenance and immutable recipes',async()=>{
 const value=canonical(IDS.selectionA,[IDS.assetA,IDS.assetB]);
 const artwork=await buildStudioHandoffArtwork(value);
 assert.equal(artwork.scene.template,'generated-native-v1');
 assert.deepEqual(artwork.brief.provenance,{mode:'builder-v1',scanReceiptId:IDS.scan,planRevisionId:IDS.plan,conceptReceiptId:IDS.concept,confirmationReceiptIds:[IDS.planConfirmation,IDS.claimConfirmation],assetReceiptIds:[IDS.assetA,IDS.assetB]});
 assert.equal(artwork.scene.generated.sourceImageAlt,'Chosen source 1','first selected asset owns the rendered image slot');
 const sourceIds=artwork.sourceSnapshot.sources.map(source=>source.id);
 assert.deepEqual(sourceIds,[`builder-scan:${IDS.scan}`,`builder-plan:${IDS.plan}`,`builder-concept:${IDS.concept}`,`builder-selection:${IDS.selectionA}`,`builder-confirmation:${IDS.planConfirmation}`,`builder-confirmation:${IDS.claimConfirmation}`,`builder-asset:${IDS.assetA}`,`builder-asset:${IDS.assetB}`]);
 assert.deepEqual(Object.keys(artwork.recipes),['1:1','4:5','9:16']);
 for(const recipe of Object.values(artwork.recipes)){assert.equal(recipe.sha256,hash(recipe.html));assert.ok(recipe.html.includes('data:image/png;base64,'));assert.ok(!recipe.html.includes('http://')&&!recipe.html.includes('https://'));}
});

test('exact retry returns the original Studio project/version without another create',async()=>{
 const x=setup();const first=await x.service.execute({projectId:IDS.project,expectedProjectRevision:5,expectedSelectionId:IDS.selectionA});const second=await x.service.execute({projectId:IDS.project,expectedProjectRevision:5,expectedSelectionId:IDS.selectionA});
 assert.deepEqual(second,first);assert.equal(x.studio.createCalls,1);assert.equal(x.transfers.linkCalls,1);assert.equal(x.loads,2);
});

test('ambiguous Studio create and Builder link responses reconcile by keyed readback',async()=>{
 const x=setup();x.studio.ambiguousAfterCommit=true;x.transfers.ambiguousLink=true;
 const result=await x.service.execute({projectId:IDS.project,expectedProjectRevision:5,expectedSelectionId:IDS.selectionA});
 assert.equal(result.versionId,IDS.versionA);assert.equal(x.studio.createCalls,1);assert.equal(x.transfers.linkCalls,1);
});

test('ambiguous reservation reconciles before any Studio mutation',async()=>{
 const x=setup();x.transfers.ambiguousReserve=true;
 const result=await x.service.execute({projectId:IDS.project,expectedProjectRevision:5,expectedSelectionId:IDS.selectionA});
 assert.equal(result.projectId,IDS.studioA);assert.equal(x.transfers.reserveCalls,1);assert.equal(x.studio.createCalls,1);
});

test('an ambiguous create with no keyed readback never blindly creates again',async()=>{
 const x=setup();x.studio.ambiguousBeforeCommit=true;
 await assert.rejects(x.service.execute({projectId:IDS.project,expectedProjectRevision:5,expectedSelectionId:IDS.selectionA}),(error:any)=>error instanceof BuilderStudioHandoffError&&error.code==='invalid-response');
 assert.equal(x.studio.createCalls,1);assert.equal(x.transfers.linkCalls,0);
});

test('two immutable selections produce distinct keys and Studio versions while either selection replays its own result',async()=>{
 const values=new Map([[IDS.selectionA,canonical(IDS.selectionA,[IDS.assetA])],[IDS.selectionB,canonical(IDS.selectionB,[IDS.assetB])]]);const transfers=new MemoryTransfers(),studio=new MemoryStudio();
 const service=createBuilderStudioHandoffService({loader:{async load(input){return structuredClone(values.get(input.expectedSelectionId)!);}},transfers,studio});
 const a=await service.execute({projectId:IDS.project,expectedProjectRevision:5,expectedSelectionId:IDS.selectionA});const b=await service.execute({projectId:IDS.project,expectedProjectRevision:5,expectedSelectionId:IDS.selectionB});const replayA=await service.execute({projectId:IDS.project,expectedProjectRevision:5,expectedSelectionId:IDS.selectionA});
 assert.notEqual(a.versionId,b.versionId);assert.deepEqual(replayA,a);assert.equal(studio.createCalls,2);assert.deepEqual(studio.artworks.map(item=>item.brief.provenance.assetReceiptIds),[[IDS.assetA],[IDS.assetB]]);
});

test('stale selection, bad asset order or bytes, unconfirmed claims, and Founder Reel fail closed before reservation',async()=>{
 const cases:CanonicalBuilderHandoff[]=[];
 cases.push({...canonical(),currentSelectionId:IDS.selectionB});
 cases.push({...canonical(IDS.selectionA,[IDS.assetA,IDS.assetB]),assetReceipts:[...canonical(IDS.selectionA,[IDS.assetB,IDS.assetA]).assetReceipts]});
 const badBase=canonical();const badBytes={...badBase,assetReceipts:[{...badBase.assetReceipts[0],bytes:Buffer.from('not an image')}]};cases.push(badBytes);
 const unconfirmed=canonical();unconfirmed.confirmationReceipts=unconfirmed.confirmationReceipts.slice(0,1);cases.push(unconfirmed);
 const video=canonical();video.concept={...video.concept,id:'founder-reel',catalogEntryId:'this-sounds-fake-founder-reel',persuasionJob:'objection-handling',visualFamily:'founder-reel',mediaType:'video',staticOutput:false,claims:[]};cases.push(video);
 for(const value of cases){const x=setup(value);await assert.rejects(x.service.execute({projectId:IDS.project,expectedProjectRevision:5,expectedSelectionId:IDS.selectionA}));assert.equal(x.transfers.reserveCalls,0);assert.equal(x.studio.createCalls,0);}
});

test('owner authorization remains a canonical-loader prerequisite with no downstream side effects',async()=>{
 const transfers=new MemoryTransfers(),studio=new MemoryStudio();const denied=new Error('denied');
 const service=createBuilderStudioHandoffService({loader:{async load(){throw denied;}},transfers,studio});
 await assert.rejects(service.execute({projectId:IDS.project,expectedProjectRevision:5,expectedSelectionId:IDS.selectionA}),denied);assert.equal(transfers.reserveCalls,0);assert.equal(studio.createCalls,0);
});
