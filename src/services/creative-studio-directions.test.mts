import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createStudioService, StudioInputSchema} from './creative-studio.ts';
import {DEFAULT_BRIEF,DEFAULT_SCENE} from '../lib/creative-studio/model.ts';
import {DEFAULT_DIRECTION,STYLES,EVIDENCE_LANES,winnerEligible} from '../lib/creative-studio/directions.ts';
process.env.CREATIVE_STUDIO_LOCAL_REVIEW='1';
const actor={userId:'00000000-0000-4000-8000-000000000021',role:'agency' as const};
test('directions persist separately, conflict atomically and preserve immutable artwork',async()=>{
 const dataDir=await mkdtemp(`${tmpdir()}/studio-directions-`);
 const options={dataDir,render:async()=>({png:Buffer.from('test'),qaPassed:true,issues:[]})};
 try {
 const service=createStudioService(options);
 const p=await service.execute(actor,{op:'create',brief:DEFAULT_BRIEF,scene:DEFAULT_SCENE});
 const old=structuredClone(p.versions);
 const html=await service.readPreview(actor,p.id,p.versions[0].id,'1:1');
 const command={op:'save-direction',projectId:p.id,expectedDirectionId:null,direction:DEFAULT_DIRECTION};
 const results=await Promise.allSettled([service.execute(actor,command),service.execute(actor,command)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const failure=results.find(r=>r.status==='rejected'); assert.equal(failure?.reason.status,409);
 let saved=(await createStudioService(options).list(actor)).projects[0];
 assert.deepEqual(saved.versions,old); assert.equal(saved.directions?.length,1);
 const first=structuredClone(saved.directions![0]);
 saved=await service.execute(actor,{...command,expectedDirectionId:first.id,direction:{...DEFAULT_DIRECTION,styleId:'native-lo-fi',subject:'both',copyDensity:'copy-heavy',notes:'Original capture required'}});
 assert.deepEqual(saved.directions![0],first); assert.equal(saved.directions![1].revision,2);
 assert.deepEqual(saved.versions,old); assert.equal(await service.readPreview(actor,p.id,p.versions[0].id,'1:1'),html);
 await assert.rejects(service.execute({...actor,userId:'00000000-0000-4000-8000-000000000022'},command),{status:404});
 await assert.rejects(service.execute({...actor,role:'unknown'} as never,command));
 assert.equal(StudioInputSchema.safeParse({op:'render',projectId:p.id,versionId:p.versions[0].id,ratio:'1:1',direction:DEFAULT_DIRECTION}).success,false);
 } finally {await rm(dataDir,{recursive:true,force:true});}
});
test('nine planning styles; no external reference is winner eligible',()=>{
 assert.equal(STYLES.length,9); assert.equal(new Set(STYLES.map(s=>s.id)).size,9);
 for(const style of STYLES){assert.equal(style.support,'planning-only');assert.ok(style.references.length);for(const ref of style.references){assert.ok(ref.url.startsWith('https://'));assert.equal(winnerEligible({lane:ref.lane,ownedAccount:false,verifiedResults:false}),false);}}
 for(const lane of EVIDENCE_LANES)assert.equal(winnerEligible({lane,ownedAccount:true,verifiedResults:true}),lane==='verified-first-party');
 assert.equal(winnerEligible({lane:'verified-first-party',ownedAccount:false,verifiedResults:true}),false);
 assert.equal(winnerEligible({lane:'verified-first-party',ownedAccount:true,verifiedResults:false}),false);
});
