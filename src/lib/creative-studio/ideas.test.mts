import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_IDEA, recommend, acceptSuggestion, ideaScene, IdeaSchema } from './ideas.ts';
import { DirectionSchema, DEFAULT_DIRECTION } from './directions.ts';
test('trust with aware audience recommends MOF and multiple formats; unknown asks instead',()=>{
 const r=recommend({...DEFAULT_IDEA,goal:'trust',awareness:'aware'});assert.equal(r.stage,'Desire');assert.ok(r.formats.length>1);
 assert.equal(recommend(DEFAULT_IDEA).stage,null);assert.match(recommend(DEFAULT_IDEA).reason,/know/i);
});
test('source help is opt-in; unknown cannot write inputs; planning never maps to receipt',()=>{
 assert.equal(DEFAULT_IDEA.headline,'');assert.throws(()=>acceptSuggestion(DEFAULT_IDEA,'unknown'));
 const accepted=acceptSuggestion(DEFAULT_IDEA,'note-headline');assert.ok(accepted.headline);assert.equal(accepted.accepted.length,1);
 assert.equal(ideaScene({...accepted,format:'process'}),null);
 assert.equal(ideaScene({...accepted,format:'notes',closing:'Bring us one client.'})?.template,'founder-note');
});
test('optional versioned journey is backward compatible and strict',()=>{
 assert.ok(DirectionSchema.safeParse(DEFAULT_DIRECTION).success);
 assert.ok(DirectionSchema.safeParse({...DEFAULT_DIRECTION,idea:DEFAULT_IDEA}).success);
 assert.equal(IdeaSchema.safeParse({...DEFAULT_IDEA,version:2}).success,false);
 assert.equal(IdeaSchema.safeParse({...DEFAULT_IDEA,verified:true}).success,false);
});
