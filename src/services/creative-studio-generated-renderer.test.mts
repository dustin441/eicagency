import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_BRIEF,DEFAULT_SCENE,BriefSchema,SceneSchema,conceptPackCompatible,validateSceneClaims,sceneStageAllowed,type Scene} from '../lib/creative-studio/model.ts';
import {renderPng,renderSceneHtml} from '../lib/creative-studio/render.ts';

const IDS={scan:'10000000-0000-4000-8000-000000000001',plan:'10000000-0000-4000-8000-000000000002',concept:'10000000-0000-4000-8000-000000000003',claim:'10000000-0000-4000-8000-000000000004',asset:'10000000-0000-4000-8000-000000000005'};
const families=['receipt','text-thread','founder-note','editorial-headline','process-tracker','comment-qa','math-economic','comparison','problem-solution','proof-card'] as const;
const ratios=['1:1','4:5','9:16'] as const;
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const claims={
 receipt:{id:'price',kind:'price' as const,text:'Setup is $0 today',confirmationReceiptId:IDS.claim},
 'math-economic':{id:'economic',kind:'economic' as const,text:'Save 20% in this illustrative case',confirmationReceiptId:IDS.claim},
 comparison:{id:'comparison',kind:'comparison' as const,text:'Option A has fewer steps than Option B',confirmationReceiptId:IDS.claim},
 'proof-card':{id:'proof',kind:'proof' as const,text:'A confirmed customer proof point',confirmationReceiptId:IDS.claim},
};
function scene(family:typeof families[number],max=false):Scene {
 const claim=claims[family as keyof typeof claims];
 const maxClaims=Array.from({length:8},(_,i)=>i===0&&claim?{...claim,id:`claim-${i}`.padEnd(64,'x'),text:`${claim.text} `.padEnd(160,'X')}:{id:`claim-${i}`.padEnd(64,'x'),kind:'general' as const,text:'G'.repeat(160),confirmationReceiptId:IDS.claim});
 return SceneSchema.parse({
  template:'generated-native-v1',headline:max?'H'.repeat(90):'A clearer way to work',subhead:max?'S'.repeat(160):'Customer-specific supporting copy.',cta:max?'C'.repeat(38):'See the approach',headlineScale:1,logoPosition:'left',
  generated:{family,brand:{name:max?'B'.repeat(120):'Northstar & Co <safe>',primaryColor:'#173f35',accentColor:'#f26a2e'},primaryText:max?'P'.repeat(125):'Useful context & detail <not markup>.',illustrativeLabel:['text-thread','founder-note','editorial-headline','comment-qa','math-economic','comparison','proof-card'].includes(family)?(max?`Illustrative ${'L'.repeat(67)}`:'Illustrative concept · not a real exchange or result'):undefined,items:Array.from({length:max?6:3},(_,i)=>({title:(max?'T'.repeat(40):`Item ${i+1}`),text:max?'D'.repeat(120):`Useful detail ${i+1}`})),claims:max?maxClaims:claim?[claim]:[],sourceImageDataUri:image,sourceImageAlt:max?'A'.repeat(120):'Trusted source asset'},
 });
}

test('generated-native-v1 is additive and keeps legacy schemas byte-for-byte compatible',()=>{
 assert.deepEqual(BriefSchema.parse(DEFAULT_BRIEF),DEFAULT_BRIEF);
 assert.deepEqual(SceneSchema.parse(DEFAULT_SCENE),DEFAULT_SCENE);
 const provenance={mode:'builder-v1' as const,scanReceiptId:IDS.scan,planRevisionId:IDS.plan,conceptReceiptId:IDS.concept,confirmationReceiptIds:[IDS.claim],assetReceiptIds:[IDS.asset]};
 const brief=BriefSchema.parse({...DEFAULT_BRIEF,sourceIds:[],provenance});
 assert.equal(brief.provenance?.mode,'builder-v1');
 assert.equal(BriefSchema.safeParse({...DEFAULT_BRIEF,sourceIds:[]}).success,false);
 assert.equal(BriefSchema.safeParse({...DEFAULT_BRIEF,sourceIds:[],provenance:{...provenance,confirmationReceiptIds:undefined}}).success,false);
 assert.equal(conceptPackCompatible(scene('receipt'),brief),true);
 assert.equal(conceptPackCompatible(scene('receipt'),{...brief,provenance:undefined,sourceIds:[...DEFAULT_BRIEF.sourceIds]}),false,'explicit provenance:undefined must not bypass the Builder gate');
 assert.equal(conceptPackCompatible(scene('receipt'),{...brief,provenance:{...provenance,confirmationReceiptIds:['20000000-0000-4000-8000-000000000001']}}),false,'claim receipt must belong to the authoritative Builder provenance');
 assert.equal(conceptPackCompatible(scene('receipt'),{...brief,provenance:{...provenance,assetReceiptIds:[]}}),false,'embedded source images require an authoritative asset receipt');
});

test('all generated static families export maximum schema-valid copy in all three safe-zone ratios with real Chromium QA',async()=>{
 let exports=0;const failures:string[]=[];
 for(const family of families)for(const ratio of ratios){
  const value=scene(family,true);const html=renderSceneHtml(value,ratio,{logoData:'invalid legacy asset is unused',fontData:'invalid legacy asset is unused'});
  assert.match(html,new RegExp(`width:1080px;height:${ratio==='1:1'?1080:ratio==='4:5'?1350:1920}px`));
  assert.ok(html.includes('Content-Security-Policy'));assert.ok(html.includes("default-src 'none'"));
  assert.ok(!/(?:src|href)=["']https?:/i.test(html));assert.ok(html.includes('data-qa-box'));assert.ok(html.includes('data-text'));
  const result=await renderPng(value,ratio,html);
  if(!result.qaPassed)failures.push(`${family} ${ratio}: ${JSON.stringify(result.issues)}`);
  assert.equal(result.width,1080);assert.equal(result.height,ratio==='1:1'?1080:ratio==='4:5'?1350:1920);assert.equal(result.mimeType,'image/png');
  exports++;
 }
 assert.deepEqual(failures,[]);
 assert.equal(exports,30);
 const escaped=renderSceneHtml(scene('process-tracker'),'1:1',{logoData:'unused',fontData:'unused'});
 assert.ok(escaped.includes('Northstar &amp; Co &lt;safe&gt;'));assert.ok(escaped.includes('&amp; detail &lt;not markup&gt;'));assert.ok(!escaped.includes('<not markup>'));
});

test('generated scenes reject video, internal labels, unsafe assets, missing labels and unreceipted sensitive claims',()=>{
 const base=scene('process-tracker') as Extract<Scene,{template:'generated-native-v1'}>;
 for(const family of ['founder-reel','video'])assert.equal(SceneSchema.safeParse({...base,generated:{...base.generated,family}}).success,false);
 for(const text of ['TOF idea','MOF concept','BOF proof','AIDA framework','retargeting ad'])assert.equal(SceneSchema.safeParse({...base,headline:text}).success,false,text);
 for(const sourceImageDataUri of ['https://example.com/a.png','data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Lz48L3N2Zz4=','data:image/png;base64,bm90LXBuZw=='])assert.equal(SceneSchema.safeParse({...base,generated:{...base.generated,sourceImageDataUri}}).success,false,sourceImageDataUri);
 const thread=scene('text-thread') as Extract<Scene,{template:'generated-native-v1'}>;assert.equal(SceneSchema.safeParse({...thread,generated:{...thread.generated,illustrativeLabel:undefined}}).success,false);
 assert.equal(SceneSchema.safeParse({...base,subhead:'Save 25% today'}).success,false);
 assert.deepEqual(validateSceneClaims(scene('receipt')),[]);
});

test('generated stage bypass is explicit per validated family, not a blanket Action exception',()=>{
 assert.equal(sceneStageAllowed(scene('editorial-headline'),'Awareness'),true);
 assert.equal(sceneStageAllowed(scene('receipt'),'Awareness'),false);
 assert.equal(sceneStageAllowed(scene('receipt'),'Action'),true);
 assert.equal(sceneStageAllowed(DEFAULT_SCENE,'Awareness'),false);
});
