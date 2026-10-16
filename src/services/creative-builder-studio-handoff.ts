import {createHash} from 'node:crypto';
import {z} from 'zod';
import {renderSceneHtml,loadRenderAssets} from '../lib/creative-studio/render.ts';
import {BriefSchema,SceneSchema,PLACEMENTS,type Brief,type GeneratedScene,type Ratio,type Stage} from '../lib/creative-studio/model.ts';
import {GeneratedConceptSchema,CreativeAssumptionsSchema,ServerConfirmationReceiptSchema,type GeneratedConcept,type ServerConfirmationReceipt} from '../lib/creative-studio/strategy.ts';

const Id=z.string().uuid();
const Hash=z.string().regex(/^[a-f0-9]{64}$/);
const RATIOS=['1:1','4:5','9:16'] as const satisfies readonly Ratio[];
const AssetMetadata=z.object({id:Id,sha256:Hash,mimeType:z.enum(['image/png','image/jpeg','image/webp']),width:z.number().int().positive().max(8192),height:z.number().int().positive().max(8192),sizeBytes:z.number().int().positive().max(8_388_608),alt:z.string().trim().min(1).max(120)}).strict();
const CanonicalBase=z.object({
 projectId:Id,projectRevision:z.number().int().min(0).max(1000),currentSelectionId:Id,scanReceiptId:Id,scanReceiptSha256:Hash,planRevisionId:Id,planContentSha256:Hash,conceptReceiptId:Id,conceptContentSha256:Hash,
 selection:z.object({id:Id,contentSha256:Hash,orderedAssetIds:z.array(Id).max(8)}).strict(),
 assumptions:CreativeAssumptionsSchema,concept:GeneratedConceptSchema,
 confirmationReceipts:z.array(ServerConfirmationReceiptSchema).min(1).max(9),
 brandName:z.string().trim().min(1).max(120),
 assetReceipts:z.array(AssetMetadata).max(8),
}).strict();

export type CanonicalBuilderAsset=z.infer<typeof AssetMetadata>&{readonly bytes:Uint8Array};
export type CanonicalBuilderHandoff=Omit<z.infer<typeof CanonicalBase>,'assetReceipts'>&{readonly assetReceipts:readonly CanonicalBuilderAsset[]};
export type StudioSourceSnapshot={sources:Array<{id:string;title:string;url:string;role:string;note:string}>;warnings:string[]};
export type StudioRecipe={html:string;sha256:string;placement:(typeof PLACEMENTS)[Ratio]};
export type StudioHandoffArtwork={brief:Brief;scene:GeneratedScene;sourceSnapshot:StudioSourceSnapshot;recipes:Record<Ratio,StudioRecipe>};
export type StudioHandoffRecord={handoffKey:string;artifactSha256:string;projectId:string;versionId:string};
export type TransferRecord={handoffKey:string;artifactSha256:string;builderProjectId:string;selectionId:string;selectionContentSha256:string;studioProjectId:string|null;studioVersionId:string|null};

export interface CanonicalBuilderHandoffLoader {
 load(input:Readonly<{projectId:string;expectedProjectRevision:number;expectedSelectionId:string}>):Promise<CanonicalBuilderHandoff>;
}
export interface DurableBuilderStudioTransferStore {
 reserve(input:Readonly<{handoffKey:string;artifactSha256:string;builderProjectId:string;expectedProjectRevision:number;selectionId:string;selectionContentSha256:string}>):Promise<TransferRecord>;
 read(handoffKey:string):Promise<TransferRecord|null>;
 link(input:Readonly<{handoffKey:string;artifactSha256:string;studioProjectId:string;studioVersionId:string}>):Promise<void>;
}
/** createByHandoffKey must enforce an owner-scoped unique handoffKey and return the existing record on replay. */
export interface IdempotentStudioHandoffStore {
 createByHandoffKey(input:Readonly<{handoffKey:string;artifactSha256:string;artwork:StudioHandoffArtwork}>):Promise<StudioHandoffRecord>;
 readByHandoffKey(handoffKey:string):Promise<StudioHandoffRecord|null>;
}

export type HandoffErrorCode='invalid'|'conflict'|'unsupported'|'unavailable'|'invalid-response';
export class BuilderStudioHandoffError extends Error {
 readonly code:HandoffErrorCode;
 constructor(code:HandoffErrorCode,message=`Builder-to-Studio handoff: ${code}`){super(message);this.name='BuilderStudioHandoffError';this.code=code;}
}
/** Adapters use this only when a write may have committed but its response was lost. */
export class AmbiguousHandoffWriteError extends Error {
 constructor(){super('Handoff write response was ambiguous');this.name='AmbiguousHandoffWriteError';}
}

function sha256(value:string|Uint8Array){return createHash('sha256').update(value).digest('hex');}
function canonicalJson(value:unknown):string {
 if(Array.isArray(value))return `[${value.map(canonicalJson).join(',')}]`;
 if(value&&typeof value==='object')return `{${Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
 return JSON.stringify(value);
}
function bounded(value:string,max:number){return value.trim().slice(0,max).trim();}
function stageFor(value:string):Stage {
 const normalized=value.toLowerCase();
 if(/\b(desire|consideration)\b/.test(normalized))return 'Desire';
 if(/\b(action|bottom|bof|conversion)\b/.test(normalized))return 'Action';
 if(/\b(interest|middle|mof)\b/.test(normalized))return 'Interest';
 if(/\b(awareness|top|tof)\b/.test(normalized))return 'Awareness';
 throw new BuilderStudioHandoffError('invalid','Canonical funnel stage cannot be mapped to Studio.');
}
const FAMILY_MAP:Record<GeneratedConcept['visualFamily'],GeneratedScene['generated']['family']>={
 receipt:'receipt','text-thread':'text-thread','founder-reel':'founder-note','founder-note':'founder-note',tracker:'process-tracker',editorial:'editorial-headline','job-post':'problem-solution','comment-thread':'comment-qa',math:'math-economic',comparison:'comparison','communication-proof':'proof-card','problem-solution':'problem-solution','proof-card':'proof-card','product-demo':'process-tracker',scorecard:'comment-qa','benchmark-chart':'comparison',calculator:'math-economic','case-study':'proof-card',checklist:'process-tracker',
};
function claimKind(kind:GeneratedConcept['claims'][number]['kind']):GeneratedScene['generated']['claims'][number]['kind'] {
 if(kind==='guarantee'||kind==='testimonial'||kind==='result')return 'proof';
 return kind==='percentage'?'percentage':kind;
}
function imageBytesValid(asset:CanonicalBuilderAsset):boolean {
 const b=asset.bytes;
 if(asset.mimeType==='image/png')return b.length>=8&&Buffer.from(b.subarray(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 if(asset.mimeType==='image/jpeg')return b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255;
 return b.length>=12&&Buffer.from(b.subarray(0,4)).toString()==='RIFF'&&Buffer.from(b.subarray(8,12)).toString()==='WEBP';
}
function receiptSources(value:z.infer<typeof CanonicalBase>):StudioSourceSnapshot {
 const receipt=(kind:string,id:string,title:string,role:string,note:string)=>({id:`builder-${kind}:${id}`,title,url:`urn:creative-builder:${kind}:${id}`,role,note});
 return {sources:[
  receipt('scan',value.scanReceiptId,'Creative Builder landing-page scan receipt','Canonical page evidence',`Immutable owner-scoped scan receipt; SHA-256 ${value.scanReceiptSha256}.`),
  receipt('plan',value.planRevisionId,'Creative Builder confirmed plan revision','Confirmed strategy',`Exact confirmed plan used for this handoff; SHA-256 ${value.planContentSha256}.`),
  receipt('concept',value.conceptReceiptId,'Creative Builder concept receipt','Selected concept',`Exact immutable concept revision selected for artwork; SHA-256 ${value.conceptContentSha256}.`),
  receipt('selection',value.selection.id,'Creative Builder selection receipt','Immutable handoff identity',`Selection content SHA-256 ${value.selection.contentSha256}.`),
  ...value.confirmationReceipts.map(item=>receipt('confirmation',item.id,'Creative Builder confirmation receipt',item.scope==='plan'?'Plan confirmation':'Claim confirmation',`Exact ${item.scope} receipt for plan ${item.planRevisionId}.`)),
  ...value.assetReceipts.map(item=>receipt('asset',item.id,'Creative Builder imported asset receipt','Trusted private source asset',`Ordered asset receipt; SHA-256 ${item.sha256}.`)),
 ],warnings:['Builder-generated static concept. Claims and assets remain bound to the listed canonical receipts.','Static draft only. Human review is required; no publishing or performance claim is implied.']};
}
function validateCanonical(raw:CanonicalBuilderHandoff,projectId:string,selectionId:string):z.infer<typeof CanonicalBase> {
 const assetReceipts=raw.assetReceipts.map(asset=>({id:asset.id,sha256:asset.sha256,mimeType:asset.mimeType,width:asset.width,height:asset.height,sizeBytes:asset.sizeBytes,alt:asset.alt}));
 const parsed=CanonicalBase.safeParse({...raw,assetReceipts});
 if(!parsed.success)throw new BuilderStudioHandoffError('invalid-response','Canonical Builder handoff payload is invalid.');
 const value=parsed.data;
 if(value.projectId!==projectId)throw new BuilderStudioHandoffError('invalid-response','Canonical Builder project did not match the request.');
 if(value.currentSelectionId!==selectionId||value.selection.id!==selectionId)throw new BuilderStudioHandoffError('conflict','The selected Builder concept changed. Reload before handing off.');
 if(value.concept.mediaType!=='static'||!value.concept.staticOutput||value.concept.visualFamily==='founder-reel'||value.concept.catalogEntryId==='this-sounds-fake-founder-reel')throw new BuilderStudioHandoffError('unsupported','Founder Reel and video concepts cannot be handed to static Studio rendering.');
 const planReceipt=value.confirmationReceipts.find(item=>item.scope==='plan');
 if(!planReceipt||planReceipt.planRevisionId!==value.planRevisionId||planReceipt.contentSha256!==value.planContentSha256)throw new BuilderStudioHandoffError('conflict','The canonical plan is not confirmed by its exact content receipt.');
 const receipts=new Map(value.confirmationReceipts.map(item=>[item.id,item]));
 for(const claim of value.concept.claims)if(claim.confirmationReceiptId){const confirmation=receipts.get(claim.confirmationReceiptId);if(!confirmation||confirmation.scope!=='claim'||confirmation.planRevisionId!==value.planRevisionId||!confirmation.claimIds.includes(claim.id))throw new BuilderStudioHandoffError('conflict','A selected claim lacks its exact canonical confirmation receipt.');}
 if(new Set(value.selection.orderedAssetIds).size!==value.selection.orderedAssetIds.length||value.assetReceipts.map(item=>item.id).join(':')!==value.selection.orderedAssetIds.join(':'))throw new BuilderStudioHandoffError('conflict','Canonical asset receipts do not match the selected asset order.');
 raw.assetReceipts.forEach((asset,index)=>{if(!(asset.bytes instanceof Uint8Array)||asset.bytes.byteLength!==asset.sizeBytes||sha256(asset.bytes)!==asset.sha256||!imageBytesValid(asset)||asset.id!==value.assetReceipts[index]?.id)throw new BuilderStudioHandoffError('invalid-response','A selected asset receipt does not match its trusted bytes.');});
 return value;
}

export async function buildStudioHandoffArtwork(raw:CanonicalBuilderHandoff):Promise<StudioHandoffArtwork> {
 const value=validateCanonical(raw,raw.projectId,raw.selection.id);
 const concept=value.concept,firstAsset=raw.assetReceipts[0];
 const confirmationReceiptIds=value.confirmationReceipts.map(item=>item.id);
 const brief=BriefSchema.parse({pack:'meta-images',title:bounded(concept.title,100),audience:bounded(value.assumptions.audience.recommendation,280),objective:bounded(value.assumptions.objective.recommendation,280),hypothesis:bounded(concept.hypothesis,400),stage:stageFor(value.assumptions.funnelStage.recommendation),sourceIds:[],provenance:{mode:'builder-v1',scanReceiptId:value.scanReceiptId,planRevisionId:value.planRevisionId,conceptReceiptId:value.conceptReceiptId,confirmationReceiptIds,assetReceiptIds:[...value.selection.orderedAssetIds]}});
 const family=FAMILY_MAP[concept.visualFamily];
 const needsLabel=new Set<GeneratedScene['generated']['family']>(['text-thread','founder-note','editorial-headline','comment-qa','math-economic','comparison','proof-card']).has(family);
 const scene=SceneSchema.parse({template:'generated-native-v1',headline:concept.headline,subhead:concept.description,cta:concept.cta,headlineScale:1,logoPosition:'left',generated:{family,brand:{name:value.brandName,primaryColor:'#173f35',accentColor:'#f26a2e'},primaryText:concept.primaryText,...(needsLabel?{illustrativeLabel:'Source-backed draft · confirmation receipts attached'}:{}),items:[{title:'Creative direction',text:bounded(concept.visualDirection,120)},{title:'Why this approach',text:bounded(concept.rationale,120)}],claims:concept.claims.map(claim=>({id:claim.id,kind:claimKind(claim.kind),text:bounded(claim.text,160),confirmationReceiptId:claim.confirmationReceiptId??planReceipt(value.confirmationReceipts).id})),...(firstAsset?{sourceImageDataUri:`data:${firstAsset.mimeType};base64,${Buffer.from(firstAsset.bytes).toString('base64')}`,sourceImageAlt:firstAsset.alt}:{})}}) as GeneratedScene;
 const assets=await loadRenderAssets();
 const recipes=Object.fromEntries(RATIOS.map(ratio=>{const html=renderSceneHtml(scene,ratio,assets);return [ratio,{html,sha256:sha256(html),placement:structuredClone(PLACEMENTS[ratio])}];})) as Record<Ratio,StudioRecipe>;
 return {brief,scene,sourceSnapshot:receiptSources(value),recipes};
}
function planReceipt(receipts:readonly ServerConfirmationReceipt[]){return receipts.find(item=>item.scope==='plan')!;}
function artifactHash(artwork:StudioHandoffArtwork){return sha256(canonicalJson(artwork));}
function assertRecord(record:StudioHandoffRecord|null,key:string,hash:string):StudioHandoffRecord {
 if(!record||record.handoffKey!==key||record.artifactSha256!==hash||!Id.safeParse(record.projectId).success||!Id.safeParse(record.versionId).success)throw new BuilderStudioHandoffError('invalid-response','Studio handoff reconciliation did not return the exact immutable artifact.');
 return record;
}
function linked(record:TransferRecord|null,key:string,hash:string,value:{projectId:string;selection:{id:string;contentSha256:string}}):record is TransferRecord&{studioProjectId:string;studioVersionId:string} {
 if(!record)return false;
 if(record.handoffKey!==key||record.artifactSha256!==hash||record.builderProjectId!==value.projectId||record.selectionId!==value.selection.id||record.selectionContentSha256!==value.selection.contentSha256)throw new BuilderStudioHandoffError('invalid-response','Durable transfer record did not match the requested immutable selection.');
 return record.studioProjectId!==null&&record.studioVersionId!==null;
}

export function createBuilderStudioHandoffService(deps:{loader:CanonicalBuilderHandoffLoader;transfers:DurableBuilderStudioTransferStore;studio:IdempotentStudioHandoffStore}) {
 return Object.freeze({async execute(input:Readonly<{projectId:string;expectedProjectRevision:number;expectedSelectionId:string}>):Promise<StudioHandoffRecord>{
  const request=z.object({projectId:Id,expectedProjectRevision:z.number().int().min(0).max(1000),expectedSelectionId:Id}).strict().safeParse(input);
  if(!request.success)throw new BuilderStudioHandoffError('invalid');
  const canonical=await deps.loader.load(request.data);
  const value=validateCanonical(canonical,request.data.projectId,request.data.expectedSelectionId);
  if(value.projectRevision!==request.data.expectedProjectRevision)throw new BuilderStudioHandoffError('conflict','The Builder project changed. Reload before handing off.');
  const artwork=await buildStudioHandoffArtwork(canonical);
  const handoffKey=sha256(`${value.projectId}:${value.selection.id}:${value.selection.contentSha256}`),hash=artifactHash(artwork);
  let transfer:TransferRecord|null;
  try{transfer=await deps.transfers.reserve({handoffKey,artifactSha256:hash,builderProjectId:value.projectId,expectedProjectRevision:value.projectRevision,selectionId:value.selection.id,selectionContentSha256:value.selection.contentSha256});}
  catch(error){if(!(error instanceof AmbiguousHandoffWriteError))throw error;transfer=await deps.transfers.read(handoffKey);if(!transfer)throw new BuilderStudioHandoffError('unavailable');}
  if(linked(transfer,handoffKey,hash,value)){
   const existing=assertRecord(await deps.studio.readByHandoffKey(handoffKey),handoffKey,hash);
   if(existing.projectId!==transfer.studioProjectId||existing.versionId!==transfer.studioVersionId)throw new BuilderStudioHandoffError('invalid-response');
   return existing;
  }
  let studioRecord=await deps.studio.readByHandoffKey(handoffKey);
  if(!studioRecord){
   try{await deps.studio.createByHandoffKey({handoffKey,artifactSha256:hash,artwork});}
   catch(error){if(!(error instanceof AmbiguousHandoffWriteError))throw error;}
   studioRecord=await deps.studio.readByHandoffKey(handoffKey);
  }
  const exact=assertRecord(studioRecord,handoffKey,hash);
  try{await deps.transfers.link({handoffKey,artifactSha256:hash,studioProjectId:exact.projectId,studioVersionId:exact.versionId});}
  catch(error){if(!(error instanceof AmbiguousHandoffWriteError))throw error;}
  const reconciled=await deps.transfers.read(handoffKey);
  if(!linked(reconciled,handoffKey,hash,value)||reconciled.studioProjectId!==exact.projectId||reconciled.studioVersionId!==exact.versionId)throw new BuilderStudioHandoffError('unavailable','Builder link could not be reconciled after Studio creation.');
  return exact;
 }});
}
