import { z } from 'zod';
import { DevelopmentSchema, developmentReference } from './development-brief.ts';
import { ContentSchema, DraftContentSchema, emptyComparison } from './content.ts';
import { type Brief } from './model.ts';
import { sceneForConcept, type Scene, type Stage } from './model.ts';
import { sourcesForConcept } from './sources.ts';
export const GOALS = {recognition:'Get noticed',understanding:'Explain what we do',trust:'Build trust',objection:'Address a hesitation',action:'Encourage action',unsure:'Not sure yet'} as const;
export const IdeaSchema = z.object({
 activeDevelopment:z.string().max(100).optional(),
 developments:z.record(z.string().max(100),DevelopmentSchema).refine(v=>Object.keys(v).length<=16,'Too many directions').optional(),
 content:z.union([ContentSchema,DraftContentSchema]).optional(),
 drafts:z.object({notes:z.object({headline:z.string().max(90),closing:z.string().max(38),content:z.union([ContentSchema,DraftContentSchema]).optional(),accepted:z.array(z.enum(['note-headline','note-closing','audience'])).max(3)}).strict().optional(),comparison:z.object({headline:z.string().max(90),closing:z.string().max(38),content:z.union([ContentSchema,DraftContentSchema]).optional(),accepted:z.array(z.enum(['note-headline','note-closing','audience'])).max(3)}).strict().optional()}).strict().optional(),
 version:z.literal(1), mode:z.enum(['guided','direct']), step:z.number().int().min(0).max(2),
 context:z.literal('eic-pilot'), business:z.string().max(280), audience:z.string().max(280),
 goal:z.enum(['recognition','understanding','trust','objection','action','unsure']),
 awareness:z.enum(['unknown','new','problem','aware','ready']),
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
export const DEFAULT_IDEA:Idea={version:1,mode:'guided',step:0,context:'eic-pilot',business:'',audience:'',goal:'unsure',awareness:'unknown',stageOverride:null,format:'notes',headline:'',closing:'',accepted:[]};
export const FORMATS = [
 {id:'notes',name:'Notes / founder note',capability:'Editable headline, body + closing · all stages',idea:'A personal note about taking on your first paid-media client.',required:'Headline, body and closing; user-authored draft, not a testimonial. No founder photo required.',concept:'founder-note',artDirection:'native-lo-fi'},
 {id:'comparison',name:'Comparison',capability:'Editable headings + 3–5 benefit rows',idea:'One client request. Two ways your agency could respond.',required:'Name both approaches and enter 3–5 comparable benefits. Claims remain unverified; source receipts are not proof of all competitors lacking a feature.',concept:'same-client-two-replies',artDirection:'proof-comparison'},
 {id:'process',name:'Process demo',capability:'Planning only · needs approved artifact',idea:'Show the actual work behind a launch.',required:'An approved process capture with private data removed, plus a bespoke renderer. Neither is supplied here. Try Notes without a photo instead.',concept:null,artDirection:'product-process-demo'},
] as const;
export function recommend(idea:Idea):{stage:Stage|null;reason:string;formats:Idea['format'][]} {
 if(idea.awareness==='unknown')return {stage:null,reason:'What does this audience already know about you? Choose the closest answer; we will not guess their stage.',formats:['notes','comparison','process']};
 if(idea.awareness==='new'||idea.goal==='recognition')return {stage:'Awareness',reason:'People who do not know you need recognition before an offer. Start with a clear introduction.',formats:['notes','process']};
 if(idea.goal==='action'&&idea.awareness==='ready')return {stage:'Action',reason:'An audience ready to decide can use a specific offer and next step.',formats:['comparison','notes']};
 if(idea.goal==='trust'||idea.goal==='objection')return {stage:'Desire',reason:'They already know the problem or your business. MOF can build confidence through an accountable note, a truthful comparison or a real process demonstration. These examples are not performance proof.',formats:['notes','comparison','process']};
 return {stage:'Interest',reason:'MOF education helps an audience understand the work before deciding.',formats:['process','notes','comparison']};
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
 return {...base,pack:'meta-feed',stage,title:idea.headline.trim()||base.title,audience:idea.audience.trim()||'Audience not yet specified',objective:GOALS[idea.goal],hypothesis:[idea.business.trim(),`User-authored ${idea.format} hypothesis for ${stage}; not performance evidence.`].filter(Boolean).join(' ').slice(0,400)};
}
