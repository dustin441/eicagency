import test from 'node:test';
import assert from 'node:assert/strict';
import {REFERENCE_CATALOG,referencesForStage,safeReferenceUrl} from '../lib/creative-studio/reference-catalog.ts';
import {DEFAULT_IDEA,IdeaSchema,switchIdeaFormat,editIdea,acceptSuggestion} from '../lib/creative-studio/ideas.ts';
test('17 bounded external references stay planning-only and available across stages',()=>{
 assert.equal(new Set(REFERENCE_CATALOG.map(e=>e.id)).size,17);
 for(const stage of ['Awareness','Interest','Desire','Action']){const entries=referencesForStage(stage);assert.equal(entries.length,17);assert.ok(entries[0].stages.some(s=>s===stage));}
 for(const e of REFERENCE_CATALOG){assert.equal(e.winnerEligible,false);assert.equal(e.productionStatus,'reference-only');assert.ok(e.sources.every(s=>safeReferenceUrl(s.url)));}
 for(const u of ['javascript:alert(1)','file:///tmp/a','/tmp/capture.png','https://user:pass@example.com','data:text/html,hello'])assert.equal(safeReferenceUrl(u),false);
});
test('per-style incomplete drafts survive switches and schema roundtrip; edits invalidate acceptance',()=>{
 let idea=acceptSuggestion({...DEFAULT_IDEA,content:{kind:'note',body:'Keep this body'}},'note-headline');
 idea=editIdea(idea,'headline','Manual replacement');assert.deepEqual(idea.accepted,[]);
 idea=switchIdeaFormat(idea,'comparison');idea=editIdea(idea,'headline','Comparison draft');
 idea=switchIdeaFormat(IdeaSchema.parse(JSON.parse(JSON.stringify(idea))),'notes');assert.equal(idea.headline,'Manual replacement');assert.deepEqual(idea.content,{kind:'note',body:'Keep this body'});
 idea=switchIdeaFormat(idea,'process');idea=switchIdeaFormat(idea,'comparison');assert.equal(idea.headline,'Comparison draft');assert.equal(idea.content?.kind,'comparison');
});
