import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createStudioService} from './creative-studio.ts';
import {DEFAULT_BRIEF} from '../lib/creative-studio/model.ts';
import {DEFAULT_DIRECTION} from '../lib/creative-studio/directions.ts';
import {DEFAULT_IDEA,acceptSuggestion,ideaScene} from '../lib/creative-studio/ideas.ts';
process.env.CREATIVE_STUDIO_LOCAL_REVIEW='1';
test('idea-only decisions reopen, owner and stale revision guarded, MOF note maps into immutable HTML',async()=>{
 const dataDir=await mkdtemp(`${tmpdir()}/studio-ideas-`);const identity={userId:'00000000-0000-4000-8000-000000000041',role:'agency' as const};
 const service=createStudioService({dataDir,render:async()=>{throw Error('not used');}});
 try {
 const idea={...acceptSuggestion(acceptSuggestion(DEFAULT_IDEA,'note-headline'),'note-closing'),mode:'direct' as const,goal:'trust' as const,awareness:'aware' as const};
 const p=await service.execute(identity,{op:'create-direction',brief:DEFAULT_BRIEF,direction:{...DEFAULT_DIRECTION,styleId:'native-lo-fi',idea}});
 assert.equal(p.versions.length,0);assert.deepEqual((await service.list(identity)).projects[0].directions![0].brief.idea,idea);
 const command={op:'save-direction',projectId:p.id,expectedDirectionId:null,direction:{...DEFAULT_DIRECTION,idea}};
 await assert.rejects(service.execute(identity,command),{status:409});
 await assert.rejects(service.execute({...identity,userId:'00000000-0000-4000-8000-000000000042'},command),{status:404});
 const made=await service.execute(identity,{op:'revise',projectId:p.id,expectedVersionId:null,brief:{...DEFAULT_BRIEF,pack:'meta-feed',stage:'Desire'},scene:ideaScene(idea)});
 const v=made.versions[0];assert.match(await service.readPreview(identity,p.id,v.id,'1:1'),/When a client asks about ads/);
 await assert.rejects(service.execute(identity,{op:'revise',projectId:p.id,expectedVersionId:null,brief:v.brief,scene:v.scene}),{status:409});
 assert.deepEqual(made.directions,p.directions);
 }finally{await rm(dataDir,{recursive:true,force:true});}
});
