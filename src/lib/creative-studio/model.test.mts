import test from 'node:test';
import assert from 'node:assert/strict';
import { BriefSchema, SceneSchema, DEFAULT_BRIEF, DEFAULT_SCENE, bucketFor, RATIOS, PACKS, PLACEMENTS, getPack, canApprove, type Version } from './model.ts';
test('pack registry, legacy defaults and scoped approval',()=>{
 const {pack: _pack,...legacy}=DEFAULT_BRIEF;
 assert.equal(_pack,'meta-images');
 assert.equal(BriefSchema.parse(legacy).pack,'meta-images');
 assert.equal(getPack(legacy),PACKS['meta-images']);
 assert.deepEqual(getPack(DEFAULT_BRIEF).placements,['1:1','4:5','9:16']);
 assert.equal(RATIOS.length,17);
 assert.equal(PLACEMENTS['300x250'].maxBytes,150*1024);
 const ratios=getPack(DEFAULT_BRIEF).placements;
 const exports=Object.fromEntries(ratios.map(r=>[r,{status:'complete',qaPassed:true}])) as Version['exports'];
 const reviews=Object.fromEntries(ratios.map(r=>[r,true])) as Version['reviews'];
 assert.equal(canApprove(exports,reviews,ratios),true);
 assert.equal(canApprove(exports,reviews),false);
 assert.throws(()=>BriefSchema.parse({...DEFAULT_BRIEF,pack:'all-platforms'}));
});
test('AIDA is canonical and Interest/Desire stay distinct', () => {
 assert.equal(bucketFor('Awareness'),'TOF'); assert.equal(bucketFor('Interest'),'MOF'); assert.equal(bucketFor('Desire'),'MOF'); assert.equal(bucketFor('Action'),'BOF');
 assert.equal(BriefSchema.parse({...DEFAULT_BRIEF, stage:'Desire'}).stage,'Desire');
});
test('schemas reject unknown identity fields and unsupported scene changes',()=>{
 assert.throws(()=>BriefSchema.parse({...DEFAULT_BRIEF, tenantId:'other'}));
 assert.throws(()=>SceneSchema.parse({...DEFAULT_SCENE, logo:'https://evil.invalid'}));
 assert.throws(()=>SceneSchema.parse({...DEFAULT_SCENE, headline:'a'.repeat(91)}));
 assert.throws(()=>SceneSchema.parse({...DEFAULT_SCENE, headlineScale:1.8}));
 assert.deepEqual(SceneSchema.parse(DEFAULT_SCENE),DEFAULT_SCENE);
});
test('approval requires successful exports and explicit human review of each exact version ratio',()=>{
 const exports=Object.fromEntries(RATIOS.map(r=>[r,{status:'complete',qaPassed:true}])) as Version['exports'];
 const reviews=Object.fromEntries(RATIOS.map(r=>[r,true])) as Version['reviews'];
 assert.equal(canApprove(exports,reviews),true);
 assert.equal(canApprove({},reviews),false);
 assert.equal(canApprove(exports,{...reviews,'9:16':false}),false);
 assert.equal(canApprove({...exports,'1:1':{status:'failed',qaPassed:false}} as never,reviews),false);
});
