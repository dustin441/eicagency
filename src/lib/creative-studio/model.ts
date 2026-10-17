import { z } from 'zod';
import { ContentSchema } from './content.ts';

export const STAGES = ['Awareness','Interest','Desire','Action'] as const;
export type Stage = typeof STAGES[number];
import { RATIOS, LEGACY_RATIOS, PACK_IDS, PLACEMENTS, getPack, type Ratio, type Placement, type Pack } from './placements.ts';
export * from './placements.ts';
export const RatioSchema = z.enum(RATIOS);
export function bucketFor(stage: Stage) { return ({Awareness:'TOF',Interest:'MOF',Desire:'MOF',Action:'BOF'} as const)[stage]; }
export const REQUIRED_SOURCE_IDS = ['brief-v2','blueprint','transcript','brand-guide','brand-sheet','launch-tracker','owner-offer'] as const;
export const TASK_SOURCE_IDS = ['launch-tracker','one-client-math','agency-owner-text-thread','founder-note','same-client-two-replies','build-or-partner-note'] as const;
export function taskSourceFor(template:string):typeof TASK_SOURCE_IDS[number] {return TASK_SOURCE_IDS.includes(template as typeof TASK_SOURCE_IDS[number])?template as typeof TASK_SOURCE_IDS[number]:'launch-tracker';}
const BuilderProvenanceSchema=z.object({mode:z.literal('builder-v1'),scanReceiptId:z.string().uuid(),planRevisionId:z.string().uuid(),conceptReceiptId:z.string().uuid(),confirmationReceiptIds:z.array(z.string().uuid()).min(1).max(9),assetReceiptIds:z.array(z.string().uuid()).max(8)}).strict();
const BriefBase={
 pack:z.enum(PACK_IDS).default('meta-images'),
 title:z.string().trim().min(3).max(100),
 audience:z.string().trim().min(5).max(280),
 objective:z.string().trim().min(5).max(280),
 hypothesis:z.string().trim().min(5).max(400),
 stage:z.enum(STAGES),
};
const BriefSourceIdSchema=z.enum([...REQUIRED_SOURCE_IDS,'one-client-math','agency-owner-text-thread','founder-note','same-client-two-replies','build-or-partner-note']);
export const BriefSchema=z.object({...BriefBase,sourceIds:z.array(BriefSourceIdSchema).max(REQUIRED_SOURCE_IDS.length),provenance:BuilderProvenanceSchema.optional()}).strict().superRefine((brief,ctx)=>{
 if(brief.provenance){
  if(brief.pack!=='meta-images')ctx.addIssue({code:'custom',message:'Generated Builder briefs use the three-placement Meta images pack',path:['pack']});
  if(brief.sourceIds.length)ctx.addIssue({code:'custom',message:'Builder provenance cannot claim legacy EIC sources',path:['sourceIds']});
  return;
 }
 if(brief.sourceIds.length!==REQUIRED_SOURCE_IDS.length||new Set(brief.sourceIds).size!==REQUIRED_SOURCE_IDS.length||!REQUIRED_SOURCE_IDS.filter(id=>id!=='launch-tracker').every(id=>brief.sourceIds.includes(id))||!TASK_SOURCE_IDS.some(id=>brief.sourceIds.includes(id)))ctx.addIssue({code:'custom',message:'Select every required source once',path:['sourceIds']});
});
export type Brief = z.infer<typeof BriefSchema>;
export const CONCEPTS = {'editable-note-v2':'Editable note','benefit-comparison-v2':'Editable benefit comparison','launch-tracker-v1':'Launch Tracker','zero-receipt-v1':'$0 Receipt','cancelled-job-v1':'Cancelled Job Posting','communication-gap-v1':'Communication Gap','one-client-math':'One-Client Math · Meta feed','agency-owner-text-thread':'Agency Owner Text Thread · illustrative','founder-note':'Founder Note · draft','same-client-two-replies':'Same Client, Two Replies · comparison','build-or-partner-note':'Build or Partner · checklist'} as const;
const LegacySceneSchema = z.object({
 content:ContentSchema.optional(),
 template:z.enum(['editable-note-v2','benefit-comparison-v2','launch-tracker-v1','zero-receipt-v1','cancelled-job-v1','communication-gap-v1','one-client-math','agency-owner-text-thread','founder-note','same-client-two-replies','build-or-partner-note']).default('launch-tracker-v1'),
 headline:z.string().trim().min(5).max(90),
 subhead:z.string().trim().min(5).max(160),
 cta:z.string().trim().min(3).max(38),
 headlineScale:z.number().min(0.9).max(1.1),
 logoPosition:z.enum(['left','right']),
}).strict().superRefine((s,ctx)=>{
 const expected=s.template==='editable-note-v2'?'note':s.template==='benefit-comparison-v2'?'comparison':null;
 if(expected&&s.content?.kind!==expected)ctx.addIssue({code:'custom',message:'Template requires matching structured content'});
 if(!expected&&s.content)ctx.addIssue({code:'custom',message:'Legacy templates cannot ignore structured content'});
});
export const GENERATED_FAMILIES=['receipt','text-thread','founder-note','editorial-headline','process-tracker','comment-qa','math-economic','comparison','problem-solution','proof-card'] as const;
const GeneratedClaimSchema=z.object({id:z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/),kind:z.enum(['general','price','percentage','comparison','economic','proof','operational']),text:z.string().trim().min(1).max(160),confirmationReceiptId:z.string().uuid()}).strict();
const GeneratedItemSchema=z.object({title:z.string().trim().min(1).max(40),text:z.string().trim().min(1).max(120)}).strict();
const safeImageDataUri=(value:string)=>{
 const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);if(!match)return false;
 try{const binary=atob(match[2]);if(!binary.length||binary.length>8*1024*1024)return false;const bytes=Array.from(binary.slice(0,12),c=>c.charCodeAt(0));return match[1]==='png'?(bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10'):match[1]==='jpeg'?(bytes[0]===255&&bytes[1]===216&&bytes[2]===255):(binary.slice(0,4)==='RIFF'&&binary.slice(8,12)==='WEBP');}catch{return false;}
};
const GeneratedSceneDataSchema=z.object({
 family:z.enum(GENERATED_FAMILIES),brand:z.object({name:z.string().trim().min(1).max(120),primaryColor:z.string().regex(/^#[0-9a-fA-F]{6}$/),accentColor:z.string().regex(/^#[0-9a-fA-F]{6}$/)}).strict(),primaryText:z.string().trim().min(1).max(125),illustrativeLabel:z.string().trim().min(8).max(80).optional(),items:z.array(GeneratedItemSchema).min(2).max(6),claims:z.array(GeneratedClaimSchema).max(8),sourceImageDataUri:z.string().max(12_000_000).refine(safeImageDataUri,'Only a validated PNG, JPEG or WebP data URI is allowed').optional(),sourceImageAlt:z.string().trim().min(1).max(120).optional(),
}).strict().superRefine((data,ctx)=>{
 const labeled=new Set(['text-thread','founder-note','editorial-headline','comment-qa','math-economic','comparison','proof-card']);
 if(labeled.has(data.family)&&!data.illustrativeLabel)ctx.addIssue({code:'custom',message:'This treatment requires a prominent illustrative label',path:['illustrativeLabel']});
 if(data.illustrativeLabel&&!/(?:illustrative|draft|source-backed|confirmed)/i.test(data.illustrativeLabel))ctx.addIssue({code:'custom',message:'The label must state the illustrative or source-backed status',path:['illustrativeLabel']});
 const requiredKind=data.family==='receipt'?'price':data.family==='math-economic'?'economic':data.family==='comparison'?'comparison':data.family==='proof-card'?'proof':null;
 if(requiredKind&&!data.claims.some(c=>c.kind===requiredKind))ctx.addIssue({code:'custom',message:`${data.family} requires a confirmed ${requiredKind} claim`,path:['claims']});
 if(!!data.sourceImageDataUri!==!!data.sourceImageAlt)ctx.addIssue({code:'custom',message:'Source image data and alt text must be supplied together',path:['sourceImageAlt']});
});
const GeneratedSceneSchema=z.object({template:z.literal('generated-native-v1'),headline:z.string().trim().min(5).max(90),subhead:z.string().trim().min(5).max(160),cta:z.string().trim().min(3).max(38),headlineScale:z.number().min(.9).max(1.1),logoPosition:z.enum(['left','right']),content:z.undefined().optional(),generated:GeneratedSceneDataSchema}).strict().superRefine((scene,ctx)=>{
 const all=[scene.headline,scene.subhead,scene.cta,scene.generated.brand.name,scene.generated.primaryText,scene.generated.illustrativeLabel??'',...scene.generated.items.flatMap(i=>[i.title,i.text]),...scene.generated.claims.map(c=>c.text)].join(' ');
 if(/\b(?:TOF|MOF|BOF|AIDA|retargeting)\b/i.test(all))ctx.addIssue({code:'custom',message:'Internal funnel labels are not allowed in generated output'});
 const sensitive=[...all.matchAll(/(?:\$\s*\d[\d,.]*|\d+(?:\.\d+)?\s*(?:%|x\b))/gi)].map(m=>m[0].replace(/\s+/g,'').toLowerCase());
 const receipts=scene.generated.claims.map(c=>c.text.replace(/\s+/g,'').toLowerCase());
 if(sensitive.some(value=>!receipts.some(text=>text.includes(value))))ctx.addIssue({code:'custom',message:'Numeric claims require a matching structured confirmation receipt',path:['generated','claims']});
});
export const SceneSchema=z.union([LegacySceneSchema,GeneratedSceneSchema]);
export type Scene = z.infer<typeof SceneSchema>;
export type LegacyScene=z.infer<typeof LegacySceneSchema>;
export type GeneratedScene=z.infer<typeof GeneratedSceneSchema>;
export const DEFAULT_BRIEF: Brief = {
 pack:'meta-images',
 title:'Approve your launch. Then pay.', audience:'Marketing agency owners adding white-label paid media for their clients.',
 objective:'Get qualified agencies to request their free media plan.',
 hypothesis:'Showing the plan, build and approval sequence makes the no-obligation offer tangible and reduces uncertainty.',
 stage:'Action',sourceIds:[...REQUIRED_SOURCE_IDS],
};
export const DEFAULT_SCENE: LegacyScene = {
 template:'launch-tracker-v1', headline:'You approve the launch.\nThen you pay.',
 subhead:'Your agency. Our paid media team.\nFree plan, campaign setup, ads and tracking.',
 cta:'Get my free media plan', headlineScale:1,logoPosition:'left',
};
export function sceneForConcept(template:Scene['template']):LegacyScene {
 if(template==='generated-native-v1')throw new Error('Generated scenes require canonical Builder content');
 const copy = {
  'editable-note-v2':{headline:'Your note headline',cta:'Explore the approach'},
  'benefit-comparison-v2':{headline:'Compare the approaches',cta:'Discuss your next step'},
  'same-client-two-replies':{headline:'Can you manage our ads too?',cta:'Get my free audit + media plan'},
  'build-or-partner-note':{headline:'Adding paid media to your agency',cta:'Get my free audit + media plan'},
  'agency-owner-text-thread':{headline:'Can you manage our ads too?',cta:'See the White Label System'},
  'founder-note':{headline:'When a client asks about ads',cta:'Bring us one client.'},
  'one-client-math':{headline:'One client.\nDo the math.',cta:'Map My First Client'},
  'launch-tracker-v1':{headline:DEFAULT_SCENE.headline,cta:DEFAULT_SCENE.cta},
  'zero-receipt-v1':{headline:'YOUR NEXT\nCLIENT LAUNCH',cta:'Get your free plan'},
  'cancelled-job-v1':{headline:'Add the service.\nNot the headcount.',cta:'Your brand. Our team.'},
  'communication-gap-v1':{headline:'Behind your brand.\nNot out of touch.',cta:'See the white-label system'},
 }[template];
 return {...DEFAULT_SCENE,template,...copy};
}
export function conceptPackCompatible(scene:Scene,brief:Brief):boolean {
 if(scene.template==='generated-native-v1')return brief.pack==='meta-images'&&!!brief.provenance&&scene.generated.claims.every(claim=>brief.provenance!.confirmationReceiptIds.includes(claim.confirmationReceiptId))&&(!scene.generated.sourceImageDataUri||brief.provenance.assetReceiptIds.length>0);
 return scene.template==='launch-tracker-v1'||brief.pack==='meta-feed';
}
export const OFFER = {
 kicker:'WHITE-LABEL PAID MEDIA',
 steps:[{title:'Review your accounts',detail:'We start with what you already have.'},{title:'See your plan + forecast',detail:'A custom media plan. No obligation.'},{title:'We build it',detail:'Campaign setup, ads and tracking.'},{title:'Review. Approve. Launch.',detail:'Payment starts when you approve launch.'}],
 footer:'No obligation to launch. Ad spend is separate.',
 disclosure:'Forecasts are estimates, not guarantees. Launch timing depends on account readiness and platform review.',
};
export type ExportRecord = { status:'complete'|'failed'; qaPassed:boolean; filename?:string; issues:string[]; createdAt:string; mimeType?:'image/png'|'image/jpeg';extension?:'png'|'jpg';sizeBytes?:number;width?:number;height?:number };
export type RenderJob = {id:string;versionId:string;ratio:Ratio;status:'queued'|'running'|'complete'|'failed';provider?:'chromium';costUsd?:number;createdAt?:string;startedAt?:string;finishedAt?:string;error?:string};
export type Version = {placementIds?:Ratio[];placementSnapshot?:Partial<Record<Ratio,Placement>>;sourceSnapshot?:{sources:ReadonlyArray<{id:string;title:string;url:string;role:string;note:string}>;warnings:readonly string[]};id:string;parentId:string|null;createdAt:string;brief:Brief;scene:Scene;exports:Partial<Record<Ratio,ExportRecord>>;reviews:Partial<Record<Ratio,boolean>>;approval:null|{userId:string;at:string};jobs:RenderJob[]};
export type Project = {planningBrief?:Brief;directions?:import('./directions.ts').SavedDirection[];id:string;tenantId:'eicagency';ownerId:string;createdAt:string;updatedAt:string;versions:Version[]};
export type StudioState = {mode:'local-review'|'hosted-private-beta';projects:Project[]};
export function getVersionPack(version:Version):Pack {
 const pack=getPack(version.brief);
 return {...pack,placements:version.placementIds??(version.brief.pack?pack.placements:LEGACY_RATIOS)};
}
export function placementFor(version:Version,ratio:Ratio):Placement {return version.placementSnapshot?.[ratio]??PLACEMENTS[ratio];}
export function canApprove(exports:Version['exports'],reviews:Version['reviews'],ratios:readonly Ratio[]=LEGACY_RATIOS) { return ratios.length>0 && ratios.every(r=>exports[r]?.status==='complete' && exports[r]?.qaPassed===true && reviews[r]===true); }
export function validateSceneClaims(scene:Scene):string[] {
 if(scene.template==='generated-native-v1')return SceneSchema.safeParse(scene).success?[]:['Generated scene claims are invalid or lack canonical confirmation receipts.'];
 const copy=[scene.headline,scene.subhead,scene.cta,scene.content?JSON.stringify(scene.content):''].join(' ');
 const forbidden=[/\bguarantee(?:d|s)?\b/i,/\brisk.free\b/i,/\b(?:TOF|MOF|BOF|AIDA|retargeting)\b/,/\blimited (?:spots|time)\b/i,/\bfree ad spend\b/i,/\blanding pages?\b/i,/\b\d+(?:\.\d+)?\s*(?:%|x\b)/i,/\$\s*\d/];
 return forbidden.filter(re=>re.test(copy)).map(()=> 'Unsupported claim or internal label in editable copy. Remove it or use a separately approved proof workflow.');
}
const GENERATED_STAGE_FAMILIES:Record<Stage,ReadonlySet<typeof GENERATED_FAMILIES[number]>>={
 Awareness:new Set<typeof GENERATED_FAMILIES[number]>(['editorial-headline','problem-solution']),
 Interest:new Set<typeof GENERATED_FAMILIES[number]>(['text-thread','founder-note','editorial-headline','process-tracker','comment-qa','problem-solution']),
 Desire:new Set<typeof GENERATED_FAMILIES[number]>(['text-thread','founder-note','process-tracker','comment-qa','comparison','proof-card']),
 Action:new Set(GENERATED_FAMILIES),
};
export function sceneStageAllowed(scene:Scene,stage:Stage):boolean {
 if(scene.template==='generated-native-v1')return GENERATED_STAGE_FAMILIES[stage].has(scene.generated.family);
 return stage==='Action'||['founder-note','editable-note-v2','benefit-comparison-v2'].includes(scene.template);
}
