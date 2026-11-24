import {test} from 'node:test';
import assert from 'node:assert/strict';
import {durolineDefaultRangeSearch} from './duroline-buyer-fit.ts';
const now='2026-11-24T18:20:00Z';
test('fresh sales dashboard uses the rolling 30 UTC calendar days including today',()=>{
 assert.equal(durolineDefaultRangeSearch({},now),'start=2026-10-26&end=2026-11-24');
 assert.equal(durolineDefaultRangeSearch({start:'',end:''},now),'start=2026-10-26&end=2026-11-24');
});
test('explicit all-time, custom ranges, and open-ended ranges remain user-controlled',()=>{
 for(const params of [{range:'all'},{range:['all']},{start:'2026-10-25',end:'2026-11-23'},{start:'2026-10-25'},{end:'2026-11-23'},{start:'bad-date'}])assert.equal(durolineDefaultRangeSearch(params,now),null);
});
test('default date computation fails closed on invalid clocks',()=>{assert.equal(durolineDefaultRangeSearch({},'bad-date'),null);});
