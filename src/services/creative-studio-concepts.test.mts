import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {DEFAULT_BRIEF,DEFAULT_SCENE,SceneSchema,sceneForConcept, type Scene} from '../lib/creative-studio/model.ts';
import {renderPng,renderSceneHtml,loadRenderAssets} from '../lib/creative-studio/render.ts';
import {createStudioService} from './creative-studio.ts';
const ids=['zero-receipt-v1','cancelled-job-v1','communication-gap-v1'] as const;
const brief={...DEFAULT_BRIEF,pack:'meta-feed' as const};
const identity={userId:'00000000-0000-4000-8000-000000000009',role:'agency' as const};
test('concept schema is backward compatible, rejects unknown HTML and unsupported placements',async()=>{
 const {template,...legacy}=DEFAULT_SCENE;assert.equal(SceneSchema.parse(legacy).template,template);
 assert.equal(SceneSchema.safeParse({...DEFAULT_SCENE,html:'<script>'}).success,false);
 const assets=await loadRenderAssets();
 for(const id of ids){
  const scene=sceneForConcept(id);
  for(const ratio of ['9:16','16:9','google-square','300x250'] as const)assert.throws(()=>renderSceneHtml(scene,ratio,assets),/Meta feed/);
  const html=renderSceneHtml({...scene,headline:'<script>alert(1)</script>'},'1:1',assets);
  assert.ok(html.includes('background:transparent'));assert.ok(!html.includes('object-fit:contain;background:white'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('Content-Security-Policy'));
 }
});
test('real concepts render both feeds; changed text, persisted revisions, approvals and immutable HTML',{skip:process.env.CREATIVE_STUDIO_RENDER_TEST!=='1'},async()=>{
 process.env.CREATIVE_STUDIO_LOCAL_REVIEW='1';
 const dataDir=await mkdtemp('/opt/data/eic-concept-integration-');console.log('ARTIFACTS',dataDir);
 const service=createStudioService({dataDir,render:renderPng});
 for(const id of ids){
  const scene=sceneForConcept(id);
  await assert.rejects(service.execute(identity,{op:'create',brief:DEFAULT_BRIEF,scene}),/Meta feed/);
  let project=await service.execute(identity,{op:'create',brief,scene});const v=project.versions[0];
  const original=await service.readPreview(identity,project.id,v.id,'1:1');
  assert.ok(v.sourceSnapshot);assert.deepEqual(v.placementIds,['1:1','4:5']);
  for(const ratio of ['1:1','4:5'] as const){
   project=await service.execute(identity,{op:'render',projectId:project.id,versionId:v.id,ratio});
   const exported=project.versions[0].exports[ratio]!;assert.equal(exported.qaPassed,true,JSON.stringify({id,ratio,issues:exported.issues}));
   const image=await service.readAsset(identity,project.id,v.id,ratio);const meta=await sharp(image).metadata();assert.equal(meta.width,1080);assert.equal(meta.height,ratio==='1:1'?1080:1350);
   await writeFile(`${dataDir}/${id}-${ratio.replace(':','x')}.png`,image);
   project=await service.execute(identity,{op:'review',projectId:project.id,versionId:v.id,ratio,approved:true});
  }
  project=await service.execute(identity,{op:'approve',projectId:project.id,versionId:v.id});assert.ok(project.versions[0].approval);
  const revised:Scene={...scene,headline:'Your next\nagency partner.',cta:'Explore your plan'};
  project=await service.execute(identity,{op:'revise',projectId:project.id,expectedVersionId:v.id,brief,scene:revised});
  const next=project.versions[1];assert.equal(next.approval,null);assert.deepEqual(next.reviews,{});assert.deepEqual(next.exports,{});
  assert.equal(await service.readPreview(identity,project.id,v.id,'1:1'),original);
  const changed=await service.readPreview(identity,project.id,next.id,'1:1');assert.ok(changed.includes(revised.headline));assert.ok(changed.includes(revised.cta));
  const result=await renderPng(revised,'1:1',changed);assert.equal(result.qaPassed,true,JSON.stringify(result.issues));
  await assert.rejects(service.execute(identity,{op:'render',projectId:project.id,versionId:next.id,ratio:'9:16'}),/outside/);
  await assert.rejects(service.execute(identity,{op:'review',projectId:project.id,versionId:v.id,ratio:'1:1',approved:false}),/Version changed/);
 }
 assert.equal((await createStudioService({dataDir,render:renderPng}).list(identity)).projects.length,3);
});
