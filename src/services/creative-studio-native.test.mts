import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createStudioService} from './creative-studio.ts';
import {DEFAULT_BRIEF,sceneForConcept} from '../lib/creative-studio/model.ts';
import {renderNativeHtml} from '../lib/creative-studio/native-renderer.ts';
for(const concept of ['agency-owner-text-thread','founder-note'] as const)test(concept+' source-pinned persistence, rendering and fail-closed coverage',async()=>{
 process.env.CREATIVE_STUDIO_LOCAL_REVIEW='1';const dataDir=await mkdtemp(tmpdir()+'/native-workflow-');
 const owner={userId:'00000000-0000-4000-8000-000000000011',role:'agency' as const};
 const service=createStudioService({dataDir,render:async()=>{throw new Error('Not used');}});
 try{
 const scene=sceneForConcept(concept);let p=await service.execute(owner,{op:'create',brief:{...DEFAULT_BRIEF,pack:'meta-feed'},scene});const v=p.versions[0];
 assert.ok(v.brief.sourceIds.includes(concept));assert.ok(v.sourceSnapshot!.sources.some(s=>s.url.endsWith(concept==='founder-note'?'86bc7h75z':'86bc7h75n')));
 for(const ratio of ['1:1','4:5'] as const){const html=await service.readPreview(owner,p.id,v.id,ratio);assert.ok(html.includes('Management starts at $995'));assert.ok(html.includes('Ad spend separate'));assert.ok(html.includes('approval'));}
 assert.deepEqual((await service.list(owner)).projects[0].versions[0],v);
 for(const pack of ['meta-images','google-assets','google-banners'])await assert.rejects(()=>service.execute(owner,{op:'create',brief:{...DEFAULT_BRIEF,pack},scene}),/Meta feed/);
 assert.throws(()=>renderNativeHtml(scene,'9:16'),/Meta feed/);
 if(concept==='founder-note'){const edit={...scene,headline:'A new note title',cta:'Start with one client.'};p=await service.execute(owner,{op:'revise',projectId:p.id,expectedVersionId:v.id,brief:v.brief,scene:edit});assert.deepEqual(p.versions[0],v);const html=await service.readPreview(owner,p.id,p.versions[1].id,'1:1');assert.ok(html.includes(edit.headline));assert.ok(html.includes(edit.cta));}
 else {const html=renderNativeHtml(scene,'1:1');assert.equal((html.match(/class="exchange/g)||[]).length,3);assert.ok(html.includes('Illustrative conversation'));assert.ok(html.indexOf('Can you manage')<html.indexOf('Can you handle'));assert.ok(html.indexOf('Can you handle')<html.indexOf('Yes. We can'));}
 }finally{await rm(dataDir,{recursive:true,force:true});}
});
