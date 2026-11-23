import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyIndustrySubmission } from './duroline-buyer-fit.ts';
const signal=(field:string,value:string)=>classifyIndustrySubmission({industryEvidenceAvailable:true,industryFields:[{field,value}]}).hits.length>0;
test('recognizes common HVAC email business compounds, without generic-name fragments',()=>{
 for(const value of ['service@fixtureheatingandair.example','fixtureheatingac@example.com','fixtureheatingandplumbing@example.com','service@fixtureheatingllc.example','fixturecoolingheating@example.com']) assert.equal(signal('email',value),true,value);
 for(const value of ['cheating@example.com','coolingwood@example.com','blair@example.com','scott@gmail.com','mac@example.com'])assert.equal(signal('email',value),false,value);
});
test('embedded explicit HVAC acronym remains a signal if entered in a name field',()=>{
 assert.equal(signal('firstName','FixtureHVAC'),true);
 assert.equal(signal('lastName','FixtureHVACRServices'),true);
});
