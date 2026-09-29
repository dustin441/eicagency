import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createStudioService} from './creative-studio.ts';
import {IdeaSchema,DEFAULT_IDEA,ideaScene,ideaBrief} from '../lib/creative-studio/ideas.ts';
import {ContentSchema,emptyComparison} from '../lib/creative-studio/content.ts';
import {DEFAULT_BRIEF,SceneSchema} from '../lib/creative-studio/model.ts';
process.env.CREATIVE_STUDIO_LOCAL_REVIEW='1';
test('structured notes at Awareness Interest Desire and comparison Action persist exact edited body and context',async()=>{
 const dataDir=await mkdtemp(`${tmpdir()}/builder-v2-`);const service=createStudioService({dataDir,render:async()=>{throw Error('unused');}});const identity={userId:'00000000-0000-4000-8000-000000000041',role:'agency' as const};
 try{for(const stage of ['Awareness','Interest','Desire','Action'] as const){
 const comparison={...emptyComparison(),rows:emptyComparison().rows.map((r,i)=>({...r,label:`Benefit ${i}`,left:{...r.left,text:'Review your workflow'},right:{...r.right,text:'Discuss a shared plan'}}))};
 const idea={...DEFAULT_IDEA,goal:'trust' as const,audience:'Specific agency audience',business:'Specific context',stageOverride:stage,format:stage==='Action'?'comparison' as const:'notes' as const,headline:'A thoughtful introduction',closing:'Explore the approach',content:stage==='Action'?comparison:{kind:'note' as const,body:'My editable body <script>no</script> & meaningful context.'}};
 const brief=ideaBrief(idea,DEFAULT_BRIEF);assert.equal(brief.objective,'Build trust');assert.equal(brief.audience,idea.audience);assert.match(brief.hypothesis,/Specific context/);
 const p=await service.execute(identity,{op:'create',brief,scene:ideaScene(idea)});const v=p.versions[0];assert.equal(v.brief.stage,stage);const html=await service.readPreview(identity,p.id,v.id,'1:1');assert.match(html,stage==='Action'?/Review your workflow/:/My editable body &lt;script&gt;no&lt;\/script&gt; &amp;/);assert.deepEqual((await service.list(identity)).projects.find(x=>x.id===p.id)!.versions[0].scene.content,idea.content);
 }}finally{await rm(dataDir,{recursive:true,force:true});}
});
test('incomplete structured inputs can be saved as decisions but cannot compose',()=>{
 for(const content of [{kind:'note' as const,body:''},emptyComparison()]){
 const idea={...DEFAULT_IDEA,format:content.kind==='note'?'notes' as const:'comparison' as const,content,headline:'A valid headline',closing:'Explore'};
 assert.equal(IdeaSchema.safeParse(idea).success,true);
 assert.equal(ideaScene(idea),null);
 }
});
test('strict maxima, claims confirmation and template mismatch fail closed',()=>{
 assert.equal(ContentSchema.safeParse({kind:'note',body:'x'.repeat(601)}).success,false);
 const c=emptyComparison();assert.equal(ContentSchema.safeParse(c).success,false);
 assert.equal(SceneSchema.safeParse({...ideaScene({...DEFAULT_IDEA,headline:'A valid headline',closing:'Explore'}),content:{kind:'note',body:'Must not be ignored'}}).success,false);
 assert.throws(()=>ideaBrief(DEFAULT_IDEA,DEFAULT_BRIEF),/no implicit/);
});
