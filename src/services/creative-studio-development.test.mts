import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createStudioService} from './creative-studio.ts';
import {DEFAULT_BRIEF} from '../lib/creative-studio/model.ts';
import {DEFAULT_DIRECTION} from '../lib/creative-studio/directions.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_IDEA, IdeaSchema, switchIdeaFormat } from '../lib/creative-studio/ideas.ts';
import { developDirection, updateDevelopment, confirmDevelopment, developmentBrief, DevelopmentSchema, directionKind } from '../lib/creative-studio/development-brief.ts';
test('development decisions persist through service reopen without artwork',async()=>{
 process.env.CREATIVE_STUDIO_LOCAL_REVIEW='1';const dataDir=await mkdtemp(`${tmpdir()}/studio-development-`);
 const identity={userId:'00000000-0000-4000-8000-000000000061',role:'agency' as const};
 try{const idea=updateDevelopment(developDirection(DEFAULT_IDEA,'da-03'),{statement:'A scoped review',route:'research'});
 const service=createStudioService({dataDir,render:async()=>{throw Error('Must not render');}});
 const p=await service.execute(identity,{op:'create-direction',brief:DEFAULT_BRIEF,direction:{...DEFAULT_DIRECTION,idea}});
 const reopened=createStudioService({dataDir,render:async()=>{throw Error('Must not render');}});
 const loaded=(await reopened.list(identity)).projects.find(x=>x.id===p.id)!;
 assert.deepEqual(loaded.directions![0].brief.idea,idea);assert.equal(loaded.versions.length,0);
 assert.match(developmentBrief(loaded.directions![0].brief.idea!),/NOT live research/);
 }finally{await rm(dataDir,{recursive:true,force:true});}
});
test('four direction mappings, negative excluded, legacy schema supported',()=>{
 assert.equal(directionKind('ai-research-problem'),'problem-recognition visual');
 assert.equal(directionKind('ve-apple-demonstration'),'approved artifact process demo');
 assert.equal(directionKind('da-05'),'documented evidence story');
 assert.equal(directionKind('da-03'),'confirmed next-step offer');
 assert.throws(()=>developDirection(DEFAULT_IDEA,'ve-p1-9'));
 assert.deepEqual(IdeaSchema.parse(DEFAULT_IDEA),DEFAULT_IDEA);
});
test('development brief uses the shared guided awareness mapping',()=>{
 const idea=developDirection({...DEFAULT_IDEA,advertisingType:'service',advertisingSubject:'White-label paid media',awareness:'considering'},'da-03');
 assert.match(developmentBrief(idea),/Stage: Desire/);
});
test('missing evidence, stale confirmation, limits and unsafe URLs fail closed',()=>{
 let i=developDirection({...DEFAULT_IDEA,audience:'Owners',goal:'trust',stageOverride:'Desire'},'da-05');
 assert.throws(()=>confirmDevelopment(i));
 i=updateDevelopment(i,{statement:'A documented milestone',sourceUrl:'https://example.com/evidence',reviewNote:'Reviewed permission and exact claim'});
 i=confirmDevelopment(i);assert.match(developmentBrief(i),/User-confirmed/);
 i=updateDevelopment(i,{statement:'Changed claim'});assert.equal(i.developments!['da-05'].confirmedFingerprint,undefined);
 assert.match(developmentBrief(i),/Changed claim/);assert.match(developmentBrief(i),/Owners/);assert.match(developmentBrief(i),/Planning brief only/);
 assert.equal(DevelopmentSchema.safeParse({...i.developments!['da-05'],sourceUrl:'https://user:pass@example.com'}).success,false);
 assert.equal(DevelopmentSchema.safeParse({...i.developments!['da-05'],statement:'x'.repeat(2001)}).success,false);
 assert.equal(DevelopmentSchema.safeParse({...i.developments!['da-05'],confirmedFingerprint:'stale'}).success,false);
});
test('direction, format and mode switching preserve independent answers and serialize',()=>{
 let i=updateDevelopment(developDirection(DEFAULT_IDEA,'da-03'),{statement:'Book a scoped diagnostic'});
 i=updateDevelopment(developDirection(i,'ai-research-problem'),{statement:'Too many disconnected reports'});
 i=developDirection({...switchIdeaFormat(i,'comparison'),mode:'direct'},'da-03');
 const saved=IdeaSchema.parse(JSON.parse(JSON.stringify(i)));
 assert.equal(saved.developments!['da-03'].statement,'Book a scoped diagnostic');
 assert.equal(saved.developments!['ai-research-problem'].statement,'Too many disconnected reports');
 assert.match(developmentBrief(saved),/Book a scoped diagnostic/);
});
