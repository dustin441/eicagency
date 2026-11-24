import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyIndustrySubmission} from './duroline-buyer-fit.ts';
const c = (value:string) => classifyIndustrySubmission({industryEvidenceAvailable:true,industryFields:[{field:'company',value}]}).category;
test('home repair and abbreviated construction framing are retained as adjacent trades',()=>{
 for(const value of ['Example Home Repair','ABFRAMING Services','Example General Contractor','Example Sheet Metal Fabrication'])assert.equal(c(value),'adjacent',value);
});
test('ambiguous personal names and unrelated substrings are not construction evidence',()=>{
 for(const value of ['A Chair Company','Mac Scott','Framingham Books','Picture Framing Gallery'])assert.equal(c(value),'unknown',value);
});
