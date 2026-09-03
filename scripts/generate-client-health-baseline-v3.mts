import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { buildApprovedConfigRevision } from '../src/services/client-health/config-revision.ts';
import { comparisonWindows, phoenixMonthWindow } from '../src/services/client-health/date-windows.ts';
import { canonicalEvidenceHash } from '../src/services/client-health/evidence.ts';

const SNAPSHOT_DATE = '2026-09-02';
const EFFECTIVE_MONTH = '2026-09-01';
const SOURCE_VERSION = 'client-health-sources-2026-09-03';
const CALCULATION_VERSION = 'client-health-v3-authoritative-2026-09-03';
const TEAM_ID = '1229523';
const TIMEZONE = 'America/Phoenix';

const roster = [
  ['prepass','PrePass','/dashboard',25000,'custom','240062401',['Prepass']],
  ['nsi','NSI','/dashboard/nsi',12300,'custom','900900564386',['NSI Electrical','NSI Direct Electrical','NSI Data Electrical','NSI HVAC']],
  ['spartaco','Spartaco','/dashboard/spartaco/leads',5000,'custom','901407399216',['Spartaco']],
  ['durodyne','Duro Dyne','/dashboard/durodyne',null,'custom','901415478138',[]],
  ['goodgame','Good Game / Nappy Boy','/dashboard/goodgame/sales',3500,'custom','901414768821',['Nappy Boy']],
  ['bridgeway','Bridgeway','/dashboard/bridgeway',500,'platform','901413196484',['Bridgeway']],
  ['arabella','Arabella Hotels','/dashboard/arabella',500,'platform','901414345904',['Scott - Arabella']],
  ['kinsey','Kinsey Design','/dashboard/kinsey',500,'platform','901414385622',['Scott - Kinsey']],
  ['state48','State Forty Eight','/dashboard/state-forty-eight',500,'platform','900500452322',['State Forty Eight']],
  ['cba','CBA Glass','/dashboard/cba',1700,'platform','901400944748',['CBA AutoGlass']],
  ['bloom','Bloom Aesthetics','/dashboard/bloom',500,'platform','901414401917',['Scott - Bloom']],
  ['champagne','Champagne Haus','/dashboard/champagne',500,'platform','901417128015',['Scott - Champagne Haus']],
  ['ihh','InfiniteHeart Health','/dashboard/ihh',5000,'custom','901418534831',['Infinite Health']],
  ['aurit','Aurit','/dashboard/eicagency/client-health',500,'custom','901424611194',['Scott - Aurit']],
  ['medibrane','Medibrane','/dashboard/eicagency/client-health',2500,'custom','901424642458',['Medibrane']],
] as const;

const approved = new Set(['spartaco','bridgeway','state48','cba','bloom','ihh']);
const month = phoenixMonthWindow(SNAPSHOT_DATE);
const comparison = comparisonWindows(SNAPSHOT_DATE, 14);
const windows = { month: { start: month.start, end: month.end }, current: comparison.current, previous: comparison.previous };

function uuidFor(key: string): string {
  const chars = createHash('sha256').update(`client-health-client-v1:${key}`).digest('hex').slice(0,32).split('');
  chars[12]='8'; chars[16]=['8','9','a','b'][parseInt(chars[16],16)%4];
  const h=chars.join(''); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
function clickupFingerprint(clientKey: string, listId: string): string {
  const startMs=String(Date.parse(`${month.start}T07:00:00.000Z`));
  const cutoffMs=String(Date.parse(`${SNAPSHOT_DATE}T06:59:59.999Z`)+86_400_000);
  return canonicalEvidenceHash({endpointFamily:'team-time-entries-and-overdue-tasks',teamId:TEAM_ID,approvedListIds:[listId],timeEntries:{endpoint:'/team/{team_Id}/time_entries',inclusiveWindowMs:{start:startMs,end:cutoffMs},includeLocationNames:true,continuation:'complete-data-array-no-page-or-cursor',listScope:'local-task_location-list_id-filter'},filteredTeamTasks:{endpoint:'/team/{team_Id}/task',dueDateLtMs:String(Number(cutoffMs)+1),includeClosed:false,subtasks:true,orderBy:'due_date',reverse:false,listIds:[listId],pagination:{semantics:'zero-based-page-with-explicit-last_page',fixedPageLimit:100,maxPages:100}},contractVersion:SOURCE_VERSION,timezone:TIMEZONE,clientKey});
}
type PerformanceContract={sourceKey:string;relation:string;uniqueOrderColumn:string;spendColumn:string;resultsColumn:string;adapterKey:string};
function supabaseFingerprint(clientKey:string,c:PerformanceContract):string {
  const start=[month.start,comparison.current.start,comparison.previous.start].sort()[0];
  const columns=[c.sourceKey==='performance'&&c.relation==='bloom_meta_ads'?'cost':c.spendColumn,'date',c.uniqueOrderColumn,c.resultsColumn].filter((v,i,a)=>a.indexOf(v)===i).sort();
  return canonicalEvidenceHash({sourceKey:c.sourceKey,project:'eic',relation:c.relation,columns,filters:[],inclusiveWindow:{start,end:SNAPSHOT_DATE},order:['date',c.uniqueOrderColumn],pageSize:1000,sourceContractVersion:SOURCE_VERSION,clientKey,timezone:TIMEZONE});
}
const contracts:Record<string,PerformanceContract[]>={
  spartaco:[{sourceKey:'leads',relation:'client_health_spartaco_leads_daily',uniqueOrderColumn:'row_key',spendColumn:'spend',resultsColumn:'results',adapterKey:'spartaco.leads'},{sourceKey:'sales',relation:'client_health_spartaco_sales_daily',uniqueOrderColumn:'row_key',spendColumn:'spend',resultsColumn:'results',adapterKey:'spartaco.sales'}],
  bridgeway:[{sourceKey:'performance',relation:'client_health_bridgeway_daily',uniqueOrderColumn:'row_key',spendColumn:'spend',resultsColumn:'results',adapterKey:'bridgeway.performance'}],
  ihh:[{sourceKey:'performance',relation:'client_health_ihh_daily',uniqueOrderColumn:'row_key',spendColumn:'spend',resultsColumn:'results',adapterKey:'ihh.performance'}],
  cba:[{sourceKey:'performance',relation:'client_health_cba_daily',uniqueOrderColumn:'row_key',spendColumn:'spend',resultsColumn:'results',adapterKey:'cba.performance'}],
  state48:[{sourceKey:'performance',relation:'state48_google',uniqueOrderColumn:'id',spendColumn:'cost',resultsColumn:'revenue',adapterKey:'state48.performance'}],
  bloom:[{sourceKey:'performance',relation:'bloom_meta_ads',uniqueOrderColumn:'id',spendColumn:'cost',resultsColumn:'website_chats',adapterKey:'bloom.performance'}],
};
const cplLabels:Record<string,string>={bridgeway:'Cost per verified 60-second call',ihh:'Cost per scheduled appointment',cba:'Cost per qualified lead',bloom:'Cost per verified website chat'};
function lane(clientKey:string,sourceKey='performance') {
  if(clientKey==='state48') return [{key:'purchase-roas',label:'Purchase ROAS',formula:'roas',evaluation:'absolute_target',required:true,weight:100,direction:'higher_is_better',greenThreshold:3,yellowThreshold:2,sourceKeys:[sourceKey]}];
  if(clientKey==='spartaco') return [
    {key:'lead-cpl',label:'Lead Generation CPL',formula:'cost_per_result',evaluation:'period_over_period_change',required:true,weight:50,direction:'lower_is_better',greenThreshold:0,yellowThreshold:10,sourceKeys:['leads']},
    {key:'sales-roas',label:'eCommerce ROAS',formula:'roas',evaluation:'absolute_target',required:true,weight:50,direction:'higher_is_better',greenThreshold:3,yellowThreshold:2,sourceKeys:['sales']},
  ];
  return [{key:'primary-cpl',label:cplLabels[clientKey],formula:'cost_per_result',evaluation:'period_over_period_change',required:true,weight:100,direction:'lower_is_better',greenThreshold:0,yellowThreshold:10,sourceKeys:[sourceKey]}];
}
function metrics(clientKey:string,sourceKeys:string[]){return [
  {key:'budget_pacing',label:'Budget pacing',adapterKey:'fixed-budget-v1',required:false,weight:10,direction:'lower_is_better',greenThreshold:10,yellowThreshold:20,sourceKeys},
  {key:'north_star',label:'North Star',adapterKey:'north-star-lanes-v1',required:true,weight:35,direction:'higher_is_better',greenThreshold:1,yellowThreshold:0,sourceKeys},
  {key:'hours',label:'Hours utilization',adapterKey:'clickup-hours-v1',required:true,weight:20,direction:'lower_is_better',greenThreshold:90,yellowThreshold:110,sourceKeys:['clickup']},
  {key:'overdue_tasks',label:'Overdue tasks',adapterKey:'clickup-overdue-v1',required:true,weight:15,direction:'lower_is_better',greenThreshold:0,yellowThreshold:2,sourceKeys:['clickup']},
  {key:'margin',label:'Projected margin',adapterKey:'projected-margin-v1',required:true,weight:20,direction:'higher_is_better',greenThreshold:80,yellowThreshold:60,sourceKeys:['clickup']},
];}
const clients=roster.map(([clientKey,displayName,dashboardHref,monthlyRetainer,deliveryModel,listId,marginAliases])=>{
  const economics={effectiveMonth:EFFECTIVE_MONTH,monthlyRetainer,deliveryModel,fulfillmentHourlyCost:deliveryModel==='custom'?46:26,targetMarginPercent:80};
  const base={clientId:uuidFor(clientKey),clientKey,displayName,dashboardHref,reportingTimezone:TIMEZONE,clickupListIds:[listId],marginAliases:[...marginAliases],economics,fixedValues:{monthlyBudget:clientKey==='cba'?2000:null}};
  if(!approved.has(clientKey)) return {...base,configStatus:'configuration_required',metrics:[],sources:[],northStarLanes:[]};
  const perf=contracts[clientKey]; const sourceKeys=perf.map(x=>x.sourceKey);
  const sources=[{sourceKey:'clickup',provider:'clickup',endpointFamily:'team-time-entries-and-overdue-tasks',requestFingerprint:clickupFingerprint(clientKey,listId),permittedFactFields:['hoursUsed','overdueTaskCount'],freshnessPolicy:{maximumLagDays:0},permitsTasks:true,allowedListIds:[listId]},...perf.map(c=>({sourceKey:c.sourceKey,provider:'supabase',project:'eic',relation:c.relation,requestFingerprint:supabaseFingerprint(clientKey,c),permittedFactFields:clientKey==='spartaco'?['currentRows','previousRows']:['currentRows','monthSpend','previousRows'],freshnessPolicy:{maximumLagDays:0}}))];
  return {...base,configStatus:'approved',metrics:metrics(clientKey,sourceKeys),sources,northStarLanes:lane(clientKey)};
});
const revision=buildApprovedConfigRevision({schemaVersion:3,calculationVersion:CALCULATION_VERSION,sourceContractVersion:SOURCE_VERSION,clients});
const artifact={snapshotDate:SNAPSHOT_DATE,provenance:{retainers:'Budget: Monthly - Projections, 2025 / September 26, read 2026-09-03',budget:'EIC public.budgets exact September 2026 rows; only cba matched',excluded:['Canary','LiveWorld','EIC Agency'],configurationRequired:['prepass','nsi','durodyne','goodgame','arabella','kinsey','champagne','aurit','medibrane']},revision};
if(import.meta.url===`file://${process.argv[1]}`){const out=resolve(process.argv[2]??'docs/client-health/baseline-v3-2026-09-02.json');await writeFile(out,`${JSON.stringify(artifact,null,2)}\n`);console.log(`${out}\n${revision.id}\n${revision.hash}`);}
export { artifact, revision };
