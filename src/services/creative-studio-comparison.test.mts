import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createStudioService} from './creative-studio.ts';
import {DEFAULT_BRIEF,sceneForConcept} from '../lib/creative-studio/model.ts';
import {renderComparisonHtml} from '../lib/creative-studio/comparison-renderer.ts';
for(const concept of ['same-client-two-replies','build-or-partner-note'] as const)test(concept+' source-pinned fixed comparison and fail-closed placements',async()=>{
 process.env.CREATIVE_STUDIO_LOCAL_REVIEW='1';const dataDir=await mkdtemp(tmpdir()+'/comparison-');
 const owner={userId:'00000000-0000-4000-8000-000000000011',role:'agency' as const};
 const service=createStudioService({dataDir,render:async()=>{throw new Error('Not used');}});
 try{
 const scene=sceneForConcept(concept);const p=await service.execute(owner,{op:'create',brief:{...DEFAULT_BRIEF,pack:'meta-feed'},scene});const v=p.versions[0];
 assert.ok(v.brief.sourceIds.includes(concept));assert.ok(v.sourceSnapshot!.sources.some(s=>s.url.endsWith('86bc7h76j')));
 for(const ratio of ['1:1','4:5'] as const){const html=await service.readPreview(owner,p.id,v.id,ratio);assert.ok(html.includes('Management starts at $995'));assert.ok(html.includes('Ad spend separate'));assert.ok(html.includes('explicit launch approval'));if(concept==='same-client-two-replies'){assert.equal((html.match(/Can you manage our ads too/g)||[]).length,1);assert.equal((html.match(/>Your agency</g)||[]).length,2);assert.ok(html.includes('Illustrative scenario'));assert.ok(!html.includes('private agency'));}else{assert.equal((html.match(/<li data-text>/g)||[]).length,6);assert.ok(html.includes('Build it in-house'));assert.ok(html.includes('Partner with EIC'));}}
 assert.deepEqual((await service.list(owner)).projects[0].versions[0],v);
 for(const pack of ['meta-images','google-assets','google-banners'])await assert.rejects(()=>service.execute(owner,{op:'create',brief:{...DEFAULT_BRIEF,pack},scene}),/Meta feed/);
 assert.throws(()=>renderComparisonHtml(scene,'9:16'),/Meta feed/);
 }finally{await rm(dataDir,{recursive:true,force:true});}
});
