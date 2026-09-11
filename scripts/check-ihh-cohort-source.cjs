// Synthetic forward adapter tests: no network or production writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
let db;
function load(path) {
 const compiled = ts.transpileModule(fs.readFileSync(path,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};
 new Function('require','exports',compiled)(name => name==='server-only'?{}:name.includes('spartaco-supabase')?{createEicSupabaseClient:()=>db}:name==='./ihh-contact-cohort'?core:require(name), mod.exports);
 return mod.exports;
}
const core=load('src/services/ihh-contact-cohort.ts');
const adapter=load('src/services/ihh-contact-cohort-source.ts');
Date.now=()=>Date.parse('2026-09-11T22:00:00Z');
const hash='a'.repeat(64), start='2026-09-11T20:53:10.000Z', end='2026-09-11T21:30:00.000Z';
const manifest={location_id:'m1hqL3irI6uiyW5tCGhR',export_sha256:hash,status:'published',source_table:'ihh_funnel_contacts',classifier_version:'preserved_native_snapshots',classification_evidence:'PRIVATE',cohort_start:start,cohort_end_exclusive:end,observation_cutoff:end,published_at:end,row_count:1,coverage:Object.fromEntries(core.IHH_COHORT_STAGES.map(s=>[s,{status:'complete',evidence:'PRIVATE verified source scan'}]))};
const row={location_id:manifest.location_id,contact_id:'PRIVATE',contact_key:'ghl:PRIVATE',export_sha256:hash,lead_at:start,quiz_taker:true,appointment_scheduled:false,appointment_at:null,opportunity_id:'PRIVATE',attribution_channel:'paid_social',attribution_source:'facebook',snapshot_at:start,snapshot_schema_version:'ihh_attr_v2_2026_08',source_table:manifest.source_table,lifecycle_tracking_start:'2026-08-28',payload:{lifecycle_events:[]}};
const parse=(m=manifest,rows=[row],s=start,e=end)=>adapter.inputFromIhhExport(m,rows,s,e);
assert.equal(parse().contacts.length,1);
assert.equal(parse(manifest,[row],'2026-09-11T21:00:00Z').contacts.length,1);
assert.throws(()=>parse(manifest,[]));
assert.throws(()=>parse({...manifest,row_count:2},[row,row]));
assert.throws(()=>parse(manifest,[{...row,snapshot_schema_version:' '} ]));
assert.throws(()=>parse(manifest,[{...row,attribution_source:'google'}]));
assert.throws(()=>parse(manifest,[{...row,export_sha256:'b'.repeat(64)}]));
assert.equal(parse(manifest,[{...row,appointment_scheduled:true}]).coverage.appointmentScheduled.status,'partial');
assert.throws(()=>parse(manifest,[row],'2026-09-11T00:00:00Z'));
const mixed=[row,{...row,contact_id:'PRIVATE2',contact_key:'ghl:PRIVATE2',snapshot_schema_version:'ihh_attr_v3_2026_09'}];
assert.deepEqual(parse({...manifest,row_count:2},mixed).contacts.map(c=>c.attributionSnapshot.schemaVersion),['ihh_attr_v2_2026_08','ihh_attr_v3_2026_09']);
const params={start:'2026-09-01',end:'2026-09-11'};
let calls=[];
function mock(m=manifest,rows=[row],badCount=false,failPage=false){calls=[];db={from(table){const q={select(){return q},eq(k,v){calls.push(['eq',table,k,v]);return q},order(k,o){calls.push(['order',k,o.ascending]);return q},limit(n){assert.equal(n,1);return q},maybeSingle:async()=>({data:m,error:null}),range:async(a,b)=>{calls.push(['range',a,b]);return {data:rows.slice(a,b+1),count:badCount?rows.length+1:rows.length,error:failPage?'failure':null}}};return q}};}
(async()=>{
 delete process.env.IHH_META_PAID_EXPORT_SHA256;
 mock();const ready=await adapter.fetchIhhMetaPaidCohort(params);
 assert.equal(ready.status,'ready');assert.equal(ready.cohort.cohortStart,start);assert.equal(ready.cohort.cohortEndExclusive,end);assert.ok(!JSON.stringify(ready).includes('PRIVATE'));
 assert.deepEqual(calls.filter(c=>c[0]==='order'),[['order','published_at',false],['order','export_sha256',false],['order','contact_id',true]]);
 assert.equal((await adapter.fetchIhhMetaPaidCohort({start:'2026-09-01',end:'2026-09-10'})).status,'blocked');
 const defaultWindow=await adapter.fetchIhhMetaPaidCohort({start:'2026-08-12',end:'2026-09-10',sinceCollectionStart:true});
 assert.equal(defaultWindow.status,'ready');assert.equal(defaultWindow.cohort.cohortStart,start);assert.equal(defaultWindow.cohort.cohortEndExclusive,end);
 assert.equal((await adapter.fetchIhhMetaPaidCohort({start:'2026-09-12',end:'2026-09-12'})).status,'blocked');
 assert.equal((await adapter.fetchIhhMetaPaidCohort({start:'2026-02-30',end:'2026-09-12'})).status,'error');
 mock(null);assert.equal((await adapter.fetchIhhMetaPaidCohort(params)).status,'blocked');
 mock({...manifest,observation_cutoff:'2026-09-11T21:30:00Z'});Date.now=()=>Date.parse('2026-09-12T04:00:00Z');assert.equal((await adapter.fetchIhhMetaPaidCohort(params)).status,'stale');Date.now=()=>Date.parse('2026-09-11T22:00:00Z');
 mock({...manifest,row_count:0},[]);const empty=await adapter.fetchIhhMetaPaidCohort(params);assert.equal(empty.status,'ready');assert.deepEqual(empty.cohort.stages.map(s=>s.count),[0,0,0,0]);
 const many=Array.from({length:1001},(_,i)=>({...row,contact_id:`PRIVATE${i}`,contact_key:`ghl:PRIVATE${i}`}));
 mock({...manifest,row_count:many.length},many);assert.equal((await adapter.fetchIhhMetaPaidCohort(params)).cohort.stages[0].count,1001);assert.deepEqual(calls.filter(c=>c[0]==='range'),[['range',0,499],['range',500,999],['range',1000,1000]]);
 mock(manifest,[row],true);assert.equal((await adapter.fetchIhhMetaPaidCohort(params)).status,'error');
 mock(manifest,[row],false,true);assert.equal((await adapter.fetchIhhMetaPaidCohort(params)).status,'error');
 db={from(){throw Error('PRIVATE')}};assert.deepEqual(await adapter.fetchIhhMetaPaidCohort(params),{status:'error'});
 console.log('PASS: forward clipping, mixed native versions, complete empty scan, 1001-row pagination, exact counts, latest manifest ordering, stale/no overlap gates, malformed dates, safe serialization and failures.');
})().catch(e=>{console.error(e);process.exitCode=1});
