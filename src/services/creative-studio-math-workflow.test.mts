import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createStudioService} from './creative-studio.ts';
import {DEFAULT_BRIEF,sceneForConcept} from '../lib/creative-studio/model.ts';
import {DEFAULT_DIRECTION} from '../lib/creative-studio/directions.ts';
test('direction-only persistence, ownership, empty-version gates and math immutable source recipe',async()=>{
 process.env.CREATIVE_STUDIO_LOCAL_REVIEW='1';const dataDir=await mkdtemp(tmpdir()+'/math-workflow-');
 const owner={userId:'00000000-0000-4000-8000-000000000011',role:'agency' as const};
 const service=createStudioService({dataDir,render:async()=>{throw new Error('Not used');}});
 try{
 let p=await service.execute(owner,{op:'create-direction',brief:DEFAULT_BRIEF,direction:DEFAULT_DIRECTION});assert.deepEqual(p.versions,[]);assert.equal((await readdir(dataDir)).length,1);
 assert.equal((await service.list(owner)).projects[0].directions!.length,1);
 await assert.rejects(()=>service.execute({...owner,userId:'00000000-0000-4000-8000-000000000012'},{op:'save-direction',projectId:p.id,expectedDirectionId:p.directions![0].id,direction:DEFAULT_DIRECTION}),/not found/);
 await assert.rejects(()=>service.execute(owner,{op:'render',projectId:p.id,versionId:p.id,ratio:'1:1'}),/Version changed/);
 p=await service.execute(owner,{op:'revise',projectId:p.id,expectedVersionId:null,brief:{...DEFAULT_BRIEF,pack:'meta-feed'},scene:sceneForConcept('one-client-math')});
 const old=structuredClone(p.versions[0]);assert.ok(old.brief.sourceIds.includes('one-client-math'));assert.ok(!old.brief.sourceIds.includes('launch-tracker'));assert.ok(old.sourceSnapshot!.sources.some(s=>s.url.endsWith('86bc7h76e')));
 const html=await service.readPreview(owner,p.id,old.id,'1:1');assert.ok(html.includes('$2,005'));assert.ok(html.includes('Before other costs'));assert.ok(html.includes('Not guaranteed'));
 p=await service.execute(owner,{op:'save-direction',projectId:p.id,expectedDirectionId:p.directions![0].id,direction:{...DEFAULT_DIRECTION,notes:'Revision'}});assert.deepEqual(p.versions[0],old);assert.equal(await service.readPreview(owner,p.id,old.id,'1:1'),html);
 p=await service.execute(owner,{op:'revise',projectId:p.id,expectedVersionId:old.id,brief:old.brief,scene:{...old.scene,headline:'Your agency. One client.'}});assert.deepEqual(p.versions[0],old);assert.deepEqual(p.versions[1].exports,{});assert.equal(p.versions[1].approval,null);
 for(const pack of ['meta-images','google-assets','google-banners'])await assert.rejects(()=>service.execute(owner,{op:'create',brief:{...DEFAULT_BRIEF,pack},scene:old.scene}),/Meta feed/);
 }finally{await rm(dataDir,{recursive:true,force:true});}
});
