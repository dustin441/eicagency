import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeDurolineProgression } from './duroline-executive.ts';
const lead=(id:string,stage='New',matchStatus='unmatched',ids:number[]=[])=>({id,stage,matchStatus,mmcDealIds:ids,industryEvidenceAvailable:true,industryFields:[{field:'companyName',value:'Fixture Mechanical'}]});
test('trade audience and recorded current-stage qualification are overlapping not historical funnel steps',()=>{
 const leads=[lead('a'),lead('b','Interested - Small'),{...lead('c'),industryFields:[{field:'companyName',value:'Fixture Plumbing'}]},{...lead('d'),industryFields:[{field:'companyName',value:'Unknown'}]}];
 const s=summarizeDurolineProgression(leads as any,[]);
 assert.equal(s.tradeTotal,3);assert.equal(s.tradeQuality,1);assert.equal(s.tradeOutsideQuality,2);assert.equal(s.tradeSmall,1);assert.equal(s.tradeMatched,0);assert.equal(s.tradeWon,0);
});
test('requires a reciprocal unambiguous valid deal and counts a lead only once',()=>{
 const leads=[lead('a','New','matched',[1,1,2]),lead('b','New','ambiguous',[1]),lead('c','New','matched',[3]),lead('d','New','matched',[99])];
 const deals=[{id:1,matchStatus:'matched',salesState:'won'},{id:2,matchStatus:'matched',salesState:'contacted'},{id:3,matchStatus:'ambiguous',salesState:'won'}];
 const s=summarizeDurolineProgression(leads as any,deals as any);assert.equal(s.tradeMatched,1);assert.equal(s.tradeWon,1);assert.equal(s.tradeOutsideQuality,4);
});
test('no unread or empty cohort is relabeled a buyer; counts partition trade audience',()=>{
 const s=summarizeDurolineProgression([{...lead('a'),industryEvidenceAvailable:false,industryFields:undefined}] as any,[]);assert.equal(s.tradeTotal,0);assert.equal(s.tradeOutsideQuality+s.tradeQuality,s.tradeTotal);
 assert.equal(summarizeDurolineProgression([],[]).tradeMatched,0);
});
