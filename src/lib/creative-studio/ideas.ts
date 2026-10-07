import { z } from 'zod';
import { DevelopmentSchema, developmentReference } from './development-brief.ts';
import { ContentSchema, DraftContentSchema, emptyComparison } from './content.ts';
import { type Brief } from './model.ts';
import { sceneForConcept, type Scene, type Stage } from './model.ts';
import { sourcesForConcept } from './sources.ts';
export const GOALS = {recognition:'Get noticed',understanding:'Explain what we do',trust:'Build trust',objection:'Address a hesitation',action:'Encourage action',unsure:'Not sure yet'} as const;
export const ADVERTISING_TYPES = {brand:'Brand',product:'Product',service:'Service',offer:'Offer',other:'Other'} as const;
export const AWARENESS_OPTIONS = [
 {id:'new',label:'They have never heard of us',description:'Introduce the brand or offer clearly.'},
 {id:'problem',label:'They know the problem',description:'Help them understand the kind of solution.'},
 {id:'aware',label:'They have visited or engaged',description:'Build on what they have already seen.'},
 {id:'considering',label:'They are considering the product or service',description:'Give them useful reasons to choose.'},
 {id:'ready',label:'They are ready to contact or buy',description:'Make the next step clear.'},
] as const;
export type Awareness=typeof AWARENESS_OPTIONS[number]['id']|'unknown';
export function stageForAwareness(awareness:Awareness):Stage|null {
 return ({unknown:null,new:'Awareness',problem:'Interest',aware:'Interest',considering:'Desire',ready:'Action'} as const)[awareness];
}
export const IdeaSchema = z.object({
 activeDevelopment:z.string().max(100).optional(),
 developments:z.record(z.string().max(100),DevelopmentSchema).refine(v=>Object.keys(v).length<=16,'Too many directions').optional(),
 content:z.union([ContentSchema,DraftContentSchema]).optional(),
 drafts:z.object({notes:z.object({headline:z.string().max(90),closing:z.string().max(38),content:z.union([ContentSchema,DraftContentSchema]).optional(),accepted:z.array(z.enum(['note-headline','note-closing','audience'])).max(3)}).strict().optional(),comparison:z.object({headline:z.string().max(90),closing:z.string().max(38),content:z.union([ContentSchema,DraftContentSchema]).optional(),accepted:z.array(z.enum(['note-headline','note-closing','audience'])).max(3)}).strict().optional()}).strict().optional(),
 version:z.literal(1), mode:z.enum(['guided','direct']), step:z.number().int().min(0).max(2),
 context:z.literal('eic-pilot'), business:z.string().max(280), audience:z.string().max(280),
 advertisingType:z.enum(['brand','product','service','offer','other']).optional(),
 advertisingSubject:z.string().max(280).optional(),
 goal:z.enum(['recognition','understanding','trust','objection','action','unsure']),
 awareness:z.enum(['unknown','new','problem','aware','considering','ready']),
 stageOverride:z.enum(['Awareness','Interest','Desire','Action']).nullable(),
 format:z.enum(['notes','comparison','process']),
 headline:z.string().max(90), closing:z.string().max(38),
 accepted:z.array(z.enum(['note-headline','note-closing','audience'])).max(3),
}).strict().superRefine((idea,ctx)=>{
 for(const [id,d] of Object.entries(idea.developments??{})){try{const r=developmentReference(id);if(d.inputs.length!==r.requiredInputs.length)throw Error('Input count mismatch');}catch{ctx.addIssue({code:'custom',message:'Invalid development reference or inputs',path:['developments',id]});}}
 if(idea.activeDevelopment&&!idea.developments?.[idea.activeDevelopment])ctx.addIssue({code:'custom',message:'Active development is missing',path:['activeDevelopment']});
 for(const id of idea.accepted){const s=SUGGESTIONS.find(s=>s.id===id);if(s&&idea[s.field]!==s.value)ctx.addIssue({code:'custom',message:'Accepted suggestion no longer matches copy',path:['accepted']});}
 for(const format of ['notes','comparison'] as const){const d=idea.drafts?.[format];if(!d)continue;
  if(d.content&&d.content.kind!==(format==='notes'?'note':'comparison'))ctx.addIssue({code:'custom',message:'Draft content must match its format',path:['drafts',format]});
  for(const id of d.accepted){const s=SUGGESTIONS.find(s=>s.id===id);if(s&&(s.field==='audience'||d[s.field]!==s.value))ctx.addIssue({code:'custom',message:'Draft acceptance must match its copy',path:['drafts',format]});}
 }
});
export type Idea = z.infer<typeof IdeaSchema>;
export const DEFAULT_IDEA:Idea={version:1,mode:'guided',step:0,context:'eic-pilot',business:'',audience:'',advertisingSubject:'',goal:'unsure',awareness:'unknown',stageOverride:null,format:'notes',headline:'',closing:'',accepted:[]};
export const FORMATS = [
 {id:'notes',name:'Founder note',capability:'A simple, personal message',idea:'Feels like a thoughtful note, with a headline, short body and closing line.',required:'Write a headline, body and closing. This is a user-authored draft, not a testimonial. No founder photo is required.',concept:'founder-note',artDirection:'native-lo-fi'},
 {id:'comparison',name:'Side-by-side comparison',capability:'Compare two approaches clearly',idea:'Shows two choices across three to five useful points.',required:'Name both approaches and enter 3–5 comparable benefits. Claims remain unverified; source receipts are not proof of all competitors lacking a feature.',concept:'same-client-two-replies',artDirection:'proof-comparison'},
 {id:'process',name:'Process walkthrough',capability:'Planning only · needs a real capture',idea:'Shows the actual steps or work behind the service.',required:'Provide an approved process capture with private data removed. A renderer is not supplied in PR1; choose Founder note if you need artwork now.',concept:null,artDirection:'product-process-demo'},
] as const;
export function recommend(idea:Idea):{stage:Stage|null;reason:string;formats:Idea['format'][]} {
 const isGuidedAdvertisingFlow=idea.advertisingType!==undefined;
 if(!isGuidedAdvertisingFlow){
  if(idea.awareness==='unknown')return {stage:null,reason:'What does this audience already know about you? Choose the closest answer; we will not guess their stage.',formats:['notes','comparison','process']};
  if(idea.awareness==='new'||idea.goal==='recognition')return {stage:'Awareness',reason:'People who do not know you need recognition before an offer. Start with a clear introduction.',formats:['notes','process']};
  if(idea.goal==='action'&&idea.awareness==='ready')return {stage:'Action',reason:'An audience ready to decide can use a specific offer and next step.',formats:['comparison','notes']};
  if(idea.goal==='trust'||idea.goal==='objection')return {stage:'Desire',reason:'They already know the problem or your business. Build confidence through an accountable note, a truthful comparison or a real process demonstration.',formats:['notes','comparison','process']};
  return {stage:'Interest',reason:'Education helps an audience understand the work before deciding.',formats:['process','notes','comparison']};
 }
 const stage=stageForAwareness(idea.awareness);
 if(!stage)return {stage:null,reason:'Choose what this audience already knows so the builder can shape the message.',formats:['notes','comparison','process']};
 if(stage==='Awareness')return {stage,reason:'Start with a clear introduction for people who have not heard of you.',formats:['notes','process']};
 if(stage==='Interest')return {stage,reason:'Explain the approach for people who know the problem or have already engaged.',formats:['process','notes','comparison']};
 if(stage==='Desire')return {stage,reason:'Help people who are considering their options feel confident about the approach.',formats:['comparison','notes','process']};
 return {stage,reason:'Give people who are ready a clear offer and next step.',formats:['comparison','notes']};
}
export const SUGGESTIONS = [
 {id:'note-headline',field:'headline',value:'When a client asks about ads',sourceId:'founder-note',why:'Frame a real agency question, without inventing a result.'},
 {id:'note-closing',field:'closing',value:'Bring us one client.',sourceId:'founder-note',why:'A small next step from the saved EIC founder-note brief.'},
 {id:'audience',field:'audience',value:'Marketing agency owners adding white-label paid media for their clients.',sourceId:'white-label-parent',why:'EIC pilot audience; change manually if this does not fit.'},
] as const;
export function suggestionSource(id:string) {return sourcesForConcept('founder-note').find(s=>s.id===id)!;}
export function suggestionsForIdea(idea:Idea){const stage=idea.stageOverride??recommend(idea).stage;return SUGGESTIONS.filter(s=>s.field==='audience'||(idea.format==='notes'&&(s.field==='headline'||stage==='Action')));}
export function acceptSuggestion(idea:Idea,id:string):Idea {
 const s=SUGGESTIONS.find(s=>s.id===id);if(!s)throw new Error('Unknown suggestion');
 return IdeaSchema.parse({...idea,[s.field]:s.value,accepted:[...new Set([...idea.accepted,s.id])]});
}
export function editIdea<K extends keyof Idea>(idea:Idea,key:K,value:Idea[K]):Idea {
 const stale=SUGGESTIONS.filter(s=>s.field===key&&s.value!==value).map(s=>s.id);
 return {...idea,[key]:value,accepted:idea.accepted.filter(id=>!stale.includes(id))};
}
export function switchIdeaFormat(idea:Idea,format:Idea['format']):Idea {
 if(format===idea.format)return idea;
 const drafts={...idea.drafts};
 if(idea.format!=='process')drafts[idea.format]={headline:idea.headline,closing:idea.closing,content:idea.content,accepted:idea.accepted.filter(id=>id!=='audience')};
 const draft=format==='process'?undefined:drafts[format];
 return {...idea,drafts,format,headline:draft?.headline??'',closing:draft?.closing??'',content:draft?.content??(format==='notes'?{kind:'note',body:''}:format==='comparison'?emptyComparison():undefined),accepted:[...idea.accepted.filter(id=>id==='audience'),...(draft?.accepted??[])]};
}
export function ideaScene(idea:Idea):Scene|null {
 if(idea.activeDevelopment||idea.format==='process')return null;
 if(idea.content){
  if(!ContentSchema.safeParse(idea.content).success||idea.headline.trim().length<5||idea.closing.trim().length<3)return null;
  if((idea.format==='notes')!==(idea.content.kind==='note'))return null;
  return {...sceneForConcept(idea.format==='notes'?'editable-note-v2':'benefit-comparison-v2'),headline:idea.headline,cta:idea.closing,content:idea.content};
 }
 if(idea.format==='comparison')return sceneForConcept('same-client-two-replies');
 if(idea.headline.trim().length<5||idea.closing.trim().length<3)return null;
 return {...sceneForConcept('founder-note'),headline:idea.headline,cta:idea.closing};
}

export function ideaBrief(idea:Idea,base:Brief):Brief {
 const stage=idea.stageOverride??recommend(idea).stage;
 if(!stage)throw Error('Choose a stage; no implicit Action default');
 const inferredGoal=({Awareness:'recognition',Interest:'understanding',Desire:'trust',Action:'action'} as const)[stage];
 return {...base,pack:'meta-feed',stage,title:idea.headline.trim()||base.title,audience:idea.audience.trim()||'Audience not yet specified',objective:GOALS[idea.goal==='unsure'?inferredGoal:idea.goal],hypothesis:[idea.advertisingSubject?.trim(),idea.business.trim(),`User-authored ${idea.format} hypothesis for ${stage}; not performance evidence.`].filter(Boolean).join(' ').slice(0,400)};
}
