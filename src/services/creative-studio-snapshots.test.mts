import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createStudioService} from './creative-studio.ts';
import {DEFAULT_BRIEF,DEFAULT_SCENE,PLACEMENTS,PACKS,getVersionPack,LEGACY_RATIOS,type Placement} from '../lib/creative-studio/model.ts';
const owner={userId:'00000000-0000-4000-8000-000000000071',role:'super_admin' as const};
test('saved placement specs survive registry changes and old briefs retain their original four placements',async t=>{
 const savedEnv={...process.env};
 Object.assign(process.env,{CREATIVE_STUDIO_LOCAL_REVIEW:'1',NODE_ENV:'test'});delete process.env.VERCEL;
 t.after(()=>{process.env=savedEnv;});
 const dataDir=await mkdtemp(path.join(tmpdir(),'eic-pinned-specs-'));
 t.after(()=>rm(dataDir,{recursive:true,force:true}));
 let received:Placement|undefined;
 const service=createStudioService({dataDir,render:async(_scene,_ratio,_html,spec)=>{received=spec;return {png:Buffer.from('explicit synthetic encoder fixture'),issues:[],qaPassed:true};}});
 const created=await service.execute(owner,{op:'create',brief:DEFAULT_BRIEF,scene:DEFAULT_SCENE});
 const v=created.versions[0]; const original=structuredClone(PLACEMENTS['1:1']); const originalPack=PACKS['meta-images'];
 try{
  PLACEMENTS['1:1']={...original,width:432,mimeType:'image/jpeg',extension:'jpg'};
  PACKS['meta-images']={...originalPack,placements:['1:1']};
  assert.deepEqual(getVersionPack(v).placements,['1:1','4:5','9:16']);
  assert.deepEqual(await service.readPlacement(owner,created.id,v.id,'1:1'),original);
  const rendered=await service.execute(owner,{op:'render',projectId:created.id,versionId:v.id,ratio:'1:1'});
  assert.deepEqual(received,original);
  assert.equal(rendered.versions[0].exports['1:1']?.width,1080);
  assert.equal(rendered.versions[0].exports['1:1']?.extension,'png');
  await assert.rejects(service.execute(owner,{op:'approve',projectId:created.id,versionId:v.id}),/Every placement/);
 }finally{PLACEMENTS['1:1']=original;PACKS['meta-images']=originalPack;}
 const file=path.join(dataDir,`${owner.userId}.json`);const disk=JSON.parse(await readFile(file,'utf8'));
 delete disk.projects[0].versions[0].brief.pack;
 delete disk.projects[0].versions[0].placementIds;
 delete disk.projects[0].versions[0].placementSnapshot;
 await writeFile(file,JSON.stringify(disk));
 const legacy=(await service.list(owner)).projects[0].versions[0];
 assert.equal(legacy.brief.pack,undefined);
 assert.deepEqual(getVersionPack(legacy).placements,LEGACY_RATIOS);
 assert.equal(JSON.parse(await readFile(file,'utf8')).projects[0].versions[0].brief.pack,undefined);
});
