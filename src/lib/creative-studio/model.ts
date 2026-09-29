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
export const BriefSchema = z.object({
 pack:z.enum(PACK_IDS).default('meta-images'),
 title:z.string().trim().min(3).max(100),
 audience:z.string().trim().min(5).max(280),
 objective:z.string().trim().min(5).max(280),
 hypothesis:z.string().trim().min(5).max(400),
 stage:z.enum(STAGES),
 sourceIds:z.array(z.enum([...REQUIRED_SOURCE_IDS,'one-client-math','agency-owner-text-thread','founder-note','same-client-two-replies','build-or-partner-note'])).length(REQUIRED_SOURCE_IDS.length).refine(v=>new Set(v).size===REQUIRED_SOURCE_IDS.length && REQUIRED_SOURCE_IDS.filter(id=>id!=='launch-tracker').every(id=>v.includes(id)) && TASK_SOURCE_IDS.some(id=>v.includes(id)),'Select every required source once'),
}).strict();
export type Brief = z.infer<typeof BriefSchema>;
export const CONCEPTS = {'editable-note-v2':'Editable note','benefit-comparison-v2':'Editable benefit comparison','launch-tracker-v1':'Launch Tracker','zero-receipt-v1':'$0 Receipt','cancelled-job-v1':'Cancelled Job Posting','communication-gap-v1':'Communication Gap','one-client-math':'One-Client Math · Meta feed','agency-owner-text-thread':'Agency Owner Text Thread · illustrative','founder-note':'Founder Note · draft','same-client-two-replies':'Same Client, Two Replies · comparison','build-or-partner-note':'Build or Partner · checklist'} as const;
export const SceneSchema = z.object({
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
export type Scene = z.infer<typeof SceneSchema>;
export const DEFAULT_BRIEF: Brief = {
 pack:'meta-images',
 title:'Approve your launch. Then pay.', audience:'Marketing agency owners adding white-label paid media for their clients.',
 objective:'Get qualified agencies to request their free media plan.',
 hypothesis:'Showing the plan, build and approval sequence makes the no-obligation offer tangible and reduces uncertainty.',
 stage:'Action',sourceIds:[...REQUIRED_SOURCE_IDS],
};
export const DEFAULT_SCENE: Scene = {
 template:'launch-tracker-v1', headline:'You approve the launch.\nThen you pay.',
 subhead:'Your agency. Our paid media team.\nFree plan, campaign setup, ads and tracking.',
 cta:'Get my free media plan', headlineScale:1,logoPosition:'left',
};
export function sceneForConcept(template:Scene['template']):Scene {
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
 const copy=[scene.headline,scene.subhead,scene.cta,scene.content?JSON.stringify(scene.content):''].join(' ');
 const forbidden=[/\bguarantee(?:d|s)?\b/i,/\brisk.free\b/i,/\b(?:TOF|MOF|BOF|AIDA|retargeting)\b/,/\blimited (?:spots|time)\b/i,/\bfree ad spend\b/i,/\blanding pages?\b/i,/\b\d+(?:\.\d+)?\s*(?:%|x\b)/i,/\$\s*\d/];
 return forbidden.filter(re=>re.test(copy)).map(()=> 'Unsupported claim or internal label in editable copy. Remove it or use a separately approved proof workflow.');
}
