import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

// Execute real service functions with an in-memory read-only Supabase boundary.
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '../src');
let rows = [];
const calls = [];
const db = { from(table) {
  const filters = []; const q = {
    select() { return q; }, order() { return q; }, or() { return q; },
    eq(k,v) { filters.push(r => r[k] === v); return q; },
    gte(k,v) { filters.push(r => r[k] >= v); calls.push(['gte',k,v]); return q; },
    lte(k,v) { filters.push(r => r[k] <= v); calls.push(['lte',k,v]); return q; },
    range(a,b) { q.bounds=[a,b]; return q; },
    then(resolve,reject) { const [a,b]=q.bounds??[0,999]; return Promise.resolve({data: rows.filter(r => filters.every(f=>f(r))).slice(a,b+1),error:null}).then(resolve,reject); },
  }; return q;
}, rpc() { throw new Error('Attribution filters must not use monthly rollup'); } };
const cache = new Map();
function load(relative) {
  const file=path.join(root,relative); if(cache.has(file))return cache.get(file).exports;
  const module={exports:{}}; cache.set(file,module);
  const code=ts.transpileModule(fs.readFileSync(file,'utf8').replace('async function fetchSpartacoBrandGoogleSearch(', 'export async function fetchSpartacoBrandGoogleSearch('),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const localRequire=(id)=> {
    if(id.startsWith('node:'))return require(id);
    if(id.includes('spartaco-supabase-server'))return {createSpartacoSupabaseClient:()=>db};
    if(id==='@/lib/date-utils')return load('lib/date-utils.ts');
    if(id==='./spartaco-analytics')return load('services/spartaco-analytics.ts');
    return {}; // unrelated creative/AI dependencies are not exercised in these tests
  };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`,{filename:file})(localRequire,module,module.exports);
  return module.exports;
}
const {spartacoParamsFromSearch}=load('services/spartaco-analytics.ts');
const {fetchSpartacoProductData}=load('services/spartaco-product-analytics.ts');

test('Google Search creative rows respect date, brand and inherited campaign filter', async()=>{
  rows=[{date:'2026-09-01',brand:'Jameson',ad_id:'a',campaign_name:'Selected',cost:10},{date:'2026-09-01',brand:'Jameson',ad_id:'b',campaign_name:'Other',cost:20},{date:'2026-08-01',brand:'Jameson',ad_id:'c',campaign_name:'Selected',cost:30}];
  const params=spartacoParamsFromSearch({start:'2026-09-01',end:'2026-09-07',campaign:'Selected'});
  const actual=await load('services/spartaco-analytics.ts').fetchSpartacoBrandGoogleSearch(db,'Jameson',params);
  assert.equal(actual.length,1);assert.equal(actual[0].spend,10);assert.equal(actual[0].campaign,'Selected');
});
test('effective date comparisons respect previous year and explicit custom dates',()=>{
  const base={start:'2026-09-01',end:'2026-09-07'};
  assert.equal(spartacoParamsFromSearch({...base,comp_mode:'prev_year'}).compStart,'2025-09-01');
  assert.equal(spartacoParamsFromSearch(base).compStart,'2026-08-25');
  assert.equal(spartacoParamsFromSearch({...base,comp_mode:'custom',comp_start:'2024-01-01',comp_end:'2024-01-07'}).compEnd,'2024-01-07');
});
test('product attribution filters scope current/comparison summaries, tables and trends; absent product never broadens',async()=>{
  rows=[];
  for(const date of ['2026-09-01','2026-08-25'])for(const [source,medium,group,sessions] of [['google','organic','Organic Search',100],['google','cpc','Paid Search',30]])rows.push({date,source:'ga4',brand:'Jameson',product:'Fiber Drivers',monday_product:'Fiber Drivers',parent_product:'Fiber Drivers',ga4_source:source,ga4_medium:medium,ga4_default_channel_group:group,ga4_sessions:sessions});
  const params=spartacoParamsFromSearch({start:'2026-09-01',end:'2026-09-07',brand:'Jameson',product:'Fiber Drivers'});
  const all=await fetchSpartacoProductData(params);
  const paid=await fetchSpartacoProductData({...params,sourceMedium:'google / cpc',channelGroup:'Paid Search'});
  assert.equal(all.summary.ga4_sessions,130);
  assert.equal(paid.summary.ga4_sessions,30);assert.equal(paid.previousSummary.ga4_sessions,30);
  assert.equal(paid.timeSeries.reduce((n,r)=>n+r.ga4_sessions,0),30);
  assert.equal(paid.productRows.reduce((n,r)=>n+r.ga4_sessions,0),30);
  assert.deepEqual(paid.filterOptions.sourceMediums,['google / cpc','google / organic']);
  const empty=await fetchSpartacoProductData({...params,product:'Unavailable product'});
  assert.equal(empty.summary.ga4_sessions,0);assert.equal(empty.productRows.length,0);
  assert.ok(calls.some(([op,key,value])=>op==='gte'&&key==='date'&&value==='2026-08-25'));
});
