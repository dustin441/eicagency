import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONCEPT_CATALOG,
  COPY_MAXIMA,
  CreativeStrategySchema,
  GeneratedConceptSchema,
  LandingPageReceiptSchema,
} from '../lib/creative-studio/strategy.ts';

const excerpt = {id:'excerpt-1',sourceUrl:'https://example.com/offer',kind:'body' as const,text:'A plainly stated service offer.'};
const receipt = {
  requestedUrl:'https://example.com/offer',
  finalUrl:'https://example.com/offer',
  scannedAt:'2026-10-16T12:00:00.000Z',
  title:'Example offer',
  description:'A bounded page description.',
  excerpts:[excerpt],
  assets:[],
  warnings:[],
};
const assumption = (recommendation:string) => ({recommendation,observedSourceExcerptIds:['excerpt-1'],confirmed:true});
const assumptions = {
  advertisedSubject:assumption('Example service'),
  offer:assumption('A clearly scoped offer'),
  audience:assumption('Operations leaders'),
  awareness:assumption('problem-aware'),
  funnelStage:assumption('middle'),
  objective:assumption('Build consideration'),
  message:assumption('Make the process understandable'),
  cta:assumption('Learn more'),
  claims:[{id:'claim-1',text:'The page offers the service.',status:'source-backed' as const,sourceExcerptIds:['excerpt-1']}],
};
const jobs = ['problem-recognition','human-trust','demonstration','proof','objection-handling','offer-clarity'] as const;
const families = ['editorial','founder-note','tracker','communication-proof','text-thread','receipt'] as const;
const concept = (index:number) => ({
  id:`concept-${index}`,catalogEntryId:['breaking-news-editorial','founder-note','paid-media-launch-tracker','white-label-communication-gap','agency-owner-text-thread','zero-due-today-receipt'][index],
  title:`Concept ${index + 1}`,
  persuasionJob:jobs[index],visualFamily:families[index],mediaType:'static' as const,staticOutput:true,
  hypothesis:'A bounded test hypothesis.',primaryText:'Clear primary text.',headline:'Clear headline',description:'Short description',cta:'Learn More',
  rationale:'Why this is materially different.',visualDirection:'A realistic, customer-specific native treatment.',
  claims:[{id:`concept-claim-${index}`,text:'The service is offered.',status:'source-backed' as const,sourceExcerptIds:['excerpt-1']}],
  winnerClaim:false,fabricatedProof:false,
});
const strategy = {version:1 as const,receipt,assumptions,assumptionsConfirmedAt:'2026-10-16T12:05:00.000Z',channels:[{channel:'meta' as const,recommended:true,rationale:'Static placements fit the test.',placements:['feed-1:1','feed-4:5','stories-9:16']}],concepts:Array.from({length:6},(_,i)=>concept(i)),conversation:[]};

test('catalog preserves the ClickUp-derived native treatment library',()=>{
  const ids=new Set(CONCEPT_CATALOG.map(entry=>entry.id));
  for(const id of ['zero-due-today-receipt','agency-owner-text-thread','this-sounds-fake-founder-reel','founder-note','paid-media-launch-tracker','breaking-news-editorial','job-posting-cancelled','agency-owner-comment-section','one-client-math','think-vs-reality','white-label-communication-gap'] as const)assert.ok(ids.has(id),id);
  for(const family of ['receipt','text-thread','founder-note','tracker','editorial','job-post','comment-thread','math','comparison','communication-proof'] as const)assert.ok(CONCEPT_CATALOG.some(entry=>entry.visualFamily===family),family);
  assert.equal(CONCEPT_CATALOG.find(entry=>entry.id==='this-sounds-fake-founder-reel')?.staticSelectable,false);
});

test('portfolio requires exactly six unique persuasion jobs and visual families',()=>{
  assert.equal(CreativeStrategySchema.safeParse(strategy).success,true);
  assert.equal(CreativeStrategySchema.safeParse({...strategy,concepts:strategy.concepts.slice(0,5)}).success,false);
  assert.equal(CreativeStrategySchema.safeParse({...strategy,concepts:[...strategy.concepts.slice(0,5),{...strategy.concepts[5],persuasionJob:strategy.concepts[0].persuasionJob}]}).success,false);
  assert.equal(CreativeStrategySchema.safeParse({...strategy,concepts:[...strategy.concepts.slice(0,5),{...strategy.concepts[5],visualFamily:strategy.concepts[0].visualFamily}]}).success,false);
});

test('unsupported winner, fabricated proof, and video-as-static states fail closed',()=>{
  assert.equal(GeneratedConceptSchema.safeParse({...concept(0),winnerClaim:true}).success,false);
  assert.equal(GeneratedConceptSchema.safeParse({...concept(0),fabricatedProof:true}).success,false);
  assert.equal(GeneratedConceptSchema.safeParse({...concept(0),mediaType:'video',staticOutput:true}).success,false);
});

test('factual claims retain source provenance or explicitly need confirmation',()=>{
  assert.equal(GeneratedConceptSchema.safeParse({...concept(0),claims:[{id:'c',text:'Unproven result',status:'source-backed',sourceExcerptIds:[]}]}).success,false);
  assert.equal(GeneratedConceptSchema.safeParse({...concept(0),claims:[{id:'c',text:'Unproven result',status:'needs-confirmation',sourceExcerptIds:[]}]}).success,true);
  const unknown={...strategy,concepts:[{...strategy.concepts[0],claims:[{id:'c',text:'Unknown source',status:'source-backed',sourceExcerptIds:['missing']}]},...strategy.concepts.slice(1)]};
  assert.equal(CreativeStrategySchema.safeParse(unknown).success,false);
});

test('copy and source receipts are bounded and assumptions separate recommendation from observation',()=>{
  const fields:Record<string,number>={primaryText:COPY_MAXIMA.primaryText,headline:COPY_MAXIMA.headline,description:COPY_MAXIMA.description,cta:COPY_MAXIMA.cta,rationale:COPY_MAXIMA.rationale,visualDirection:COPY_MAXIMA.visualDirection};
  for(const [field,max] of Object.entries(fields))assert.equal(GeneratedConceptSchema.safeParse({...concept(0),[field]:'x'.repeat(max+1)}).success,false,field);
  assert.equal(LandingPageReceiptSchema.safeParse({...receipt,excerpts:Array.from({length:25},(_,i)=>({...excerpt,id:`e-${i}`}))}).success,false);
  assert.equal(LandingPageReceiptSchema.safeParse({...receipt,assets:Array.from({length:25},(_,i)=>({id:`asset-${i}`,sourceUrl:'https://example.com/image.jpg',kind:'hero',alt:''}))}).success,false);
  assert.equal(CreativeStrategySchema.safeParse({...strategy,channels:Array.from({length:6},()=>strategy.channels[0])}).success,false);
  assert.equal(CreativeStrategySchema.safeParse({...strategy,assumptions:{...assumptions,audience:{...assumptions.audience,recommendation:'x'.repeat(501)}}}).success,false);
  assert.equal(CreativeStrategySchema.safeParse({...strategy,conversation:Array.from({length:21},(_,i)=>({id:`turn-${i}`,role:'user',createdAt:'2026-10-16T12:00:00.000Z',message:'revise'}))}).success,false);
  assert.equal(CreativeStrategySchema.safeParse({...strategy,assumptions:{...assumptions,audience:{observedSourceExcerptIds:['excerpt-1'],confirmed:false}}}).success,false);
});
