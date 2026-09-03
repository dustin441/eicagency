import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { buildApprovedConfigRevision } from '../src/services/client-health/config-revision.ts';
import { comparisonWindows, phoenixMonthWindow } from '../src/services/client-health/date-windows.ts';
import { canonicalEvidenceHash } from '../src/services/client-health/evidence.ts';

const SNAPSHOT_DATE = '2026-09-02';
const EFFECTIVE_MONTH = '2026-09-01';
const SOURCE_VERSION = 'client-health-normalized-sources-2026-09-03';
const CALCULATION_VERSION = 'client-health-v3-normalized-2026-09-03';
const TEAM_ID = '1229523';
const TIMEZONE = 'America/Phoenix';

const roster = [
  ['prepass','PrePass','/dashboard',25000,'custom','240062401',['Prepass']],
  ['nsi','NSI','/dashboard/nsi',12300,'custom','900900564386',['NSI Electrical','NSI Direct Electrical','NSI Data Electrical','NSI HVAC']],
  ['spartaco','Spartaco','/dashboard/spartaco/leads',5000,'custom','901407399216',['Spartaco']],
  ['durodyne','Duro Dyne','/dashboard/durodyne',1500,'custom','901415478138',['NSI HVAC']],
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

const budgets: Record<string, number | null> = {
  prepass: 150000,
  nsi: 29500,
  spartaco: null,
  durodyne: 5500,
  goodgame: 5000,
  bridgeway: 1250,
  arabella: 3500,
  kinsey: 2500,
  state48: 3000,
  cba: 2000,
  bloom: 3000,
  champagne: 2500,
  ihh: 10000,
  aurit: null,
  medibrane: null,
};

const approved = new Set<string>(roster.map(([key]) => key).filter((key) => key !== 'aurit' && key !== 'medibrane'));
const month = phoenixMonthWindow(SNAPSHOT_DATE);
const comparison = comparisonWindows(SNAPSHOT_DATE, 14);

function uuidFor(key: string): string {
  const chars = createHash('sha256').update(`client-health-client-v1:${key}`).digest('hex').slice(0, 32).split('');
  chars[12] = '8';
  chars[16] = ['8', '9', 'a', 'b'][Number.parseInt(chars[16], 16) % 4];
  const value = chars.join('');
  return `${value.slice(0,8)}-${value.slice(8,12)}-${value.slice(12,16)}-${value.slice(16,20)}-${value.slice(20)}`;
}

function clickupFingerprint(clientKey: string, listId: string): string {
  const startMs = String(Date.parse(`${month.start}T07:00:00.000Z`));
  const cutoffMs = String(Date.parse(`${SNAPSHOT_DATE}T06:59:59.999Z`) + 86_400_000);
  return canonicalEvidenceHash({
    endpointFamily: 'team-time-entries-and-overdue-tasks',
    teamId: TEAM_ID,
    approvedListIds: [listId],
    timeEntries: {
      endpoint: '/team/{team_Id}/time_entries',
      inclusiveWindowMs: { start: startMs, end: cutoffMs },
      includeLocationNames: true,
      continuation: 'complete-data-array-no-page-or-cursor',
      listScope: 'local-task_location-list_id-filter',
    },
    filteredTeamTasks: {
      endpoint: '/team/{team_Id}/task',
      dueDateLtMs: String(Number(cutoffMs) + 1),
      includeClosed: false,
      subtasks: true,
      orderBy: 'due_date',
      reverse: false,
      listIds: [listId],
      pagination: { semantics: 'zero-based-page-with-explicit-last_page', fixedPageLimit: 100, maxPages: 100 },
    },
    contractVersion: SOURCE_VERSION,
    timezone: TIMEZONE,
    clientKey,
  });
}

type PerformanceContract = {
  sourceKey: string;
  project: 'eic' | 'prepass';
  relation: string;
  uniqueOrderColumn: string;
  spendColumn: string;
  resultsColumn: string;
  includeMonthSpend: boolean;
  maximumLagDays: number;
};

function supabaseFingerprint(clientKey: string, contract: PerformanceContract): string {
  const start = [month.start, comparison.current.start, comparison.previous.start].sort()[0];
  const columns = ['date', contract.uniqueOrderColumn, contract.spendColumn, contract.resultsColumn]
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort();
  return canonicalEvidenceHash({
    sourceKey: contract.sourceKey,
    project: contract.project,
    relation: contract.relation,
    columns,
    filters: [],
    inclusiveWindow: { start, end: SNAPSHOT_DATE },
    order: ['date', contract.uniqueOrderColumn],
    pageSize: 1000,
    sourceContractVersion: SOURCE_VERSION,
    clientKey,
    timezone: TIMEZONE,
  });
}

const normalized = (sourceKey: string, relation: string, options: Partial<PerformanceContract> = {}): PerformanceContract => ({
  sourceKey,
  project: 'eic',
  relation,
  uniqueOrderColumn: 'row_key',
  spendColumn: 'spend',
  resultsColumn: 'results',
  includeMonthSpend: true,
  maximumLagDays: 0,
  ...options,
});

const contracts: Record<string, PerformanceContract[]> = {
  prepass: [
    normalized('sqls', 'client_health_prepass_sql_daily', { project: 'prepass' }),
    normalized('won', 'client_health_prepass_won_daily', { project: 'prepass', includeMonthSpend: false }),
  ],
  nsi: [normalized('performance', 'client_health_nsi_daily')],
  spartaco: [
    normalized('leads', 'client_health_spartaco_leads_daily', { includeMonthSpend: false }),
    normalized('sales', 'client_health_spartaco_sales_daily', { includeMonthSpend: false }),
  ],
  durodyne: [normalized('performance', 'client_health_durodyne_daily')],
  goodgame: [normalized('performance', 'client_health_goodgame_ecommerce_daily')],
  bridgeway: [normalized('performance', 'client_health_bridgeway_daily')],
  arabella: [normalized('performance', 'client_health_arabella_daily')],
  kinsey: [normalized('performance', 'client_health_kinsey_daily')],
  state48: [{
    sourceKey: 'performance', project: 'eic', relation: 'state48_google', uniqueOrderColumn: 'id',
    spendColumn: 'cost', resultsColumn: 'revenue', includeMonthSpend: true, maximumLagDays: 0,
  }],
  cba: [normalized('performance', 'client_health_cba_daily')],
  bloom: [normalized('performance', 'client_health_bloom_daily', { maximumLagDays: 1 })],
  champagne: [normalized('performance', 'client_health_champagne_daily', { maximumLagDays: 1 })],
  ihh: [normalized('performance', 'client_health_ihh_daily')],
};

type Lane = {
  key: string;
  label: string;
  formula: 'cost_per_result' | 'roas';
  evaluation: 'period_over_period_change' | 'absolute_target';
  required: boolean;
  weight: number;
  direction: 'lower_is_better' | 'higher_is_better';
  greenThreshold: number;
  yellowThreshold: number;
  sourceKeys: string[];
};

function lanes(clientKey: string): Lane[] {
  switch (clientKey) {
    case 'prepass': return [
      { key:'cost-per-sql', label:'Cost per SQL', formula:'cost_per_result', evaluation:'period_over_period_change', required:true, weight:50, direction:'lower_is_better', greenThreshold:0, yellowThreshold:10, sourceKeys:['sqls'] },
      { key:'cost-per-won', label:'Cost per Won', formula:'cost_per_result', evaluation:'period_over_period_change', required:true, weight:50, direction:'lower_is_better', greenThreshold:0, yellowThreshold:10, sourceKeys:['won'] },
    ];
    case 'nsi': return [{ key:'cost-per-submittal', label:'Cost per Submittal', formula:'cost_per_result', evaluation:'absolute_target', required:true, weight:100, direction:'lower_is_better', greenThreshold:155, yellowThreshold:170.5, sourceKeys:['performance'] }];
    case 'spartaco': return [
      { key:'lead-cpl', label:'Lead Generation CPL', formula:'cost_per_result', evaluation:'period_over_period_change', required:true, weight:50, direction:'lower_is_better', greenThreshold:0, yellowThreshold:10, sourceKeys:['leads'] },
      { key:'sales-roas', label:'eCommerce ROAS', formula:'roas', evaluation:'absolute_target', required:true, weight:50, direction:'higher_is_better', greenThreshold:3, yellowThreshold:2, sourceKeys:['sales'] },
    ];
    case 'durodyne': return [{ key:'lead-cpl', label:'Cost per Lead', formula:'cost_per_result', evaluation:'absolute_target', required:true, weight:100, direction:'lower_is_better', greenThreshold:25, yellowThreshold:27.5, sourceKeys:['performance'] }];
    case 'goodgame': return [{ key:'ecommerce-roas', label:'eCommerce ROAS', formula:'roas', evaluation:'period_over_period_change', required:true, weight:100, direction:'higher_is_better', greenThreshold:0, yellowThreshold:-10, sourceKeys:['performance'] }];
    case 'arabella': return [{ key:'purchase-roas', label:'Purchase ROAS', formula:'roas', evaluation:'absolute_target', required:true, weight:100, direction:'higher_is_better', greenThreshold:10, yellowThreshold:8, sourceKeys:['performance'] }];
    case 'kinsey': return [{ key:'purchase-roas', label:'Purchase ROAS', formula:'roas', evaluation:'absolute_target', required:true, weight:100, direction:'higher_is_better', greenThreshold:3, yellowThreshold:2, sourceKeys:['performance'] }];
    case 'state48': return [{ key:'purchase-roas', label:'Purchase ROAS', formula:'roas', evaluation:'absolute_target', required:true, weight:100, direction:'higher_is_better', greenThreshold:3, yellowThreshold:2, sourceKeys:['performance'] }];
    case 'bridgeway': return [{ key:'primary-cpl', label:'Cost per verified 60-second call', formula:'cost_per_result', evaluation:'period_over_period_change', required:true, weight:100, direction:'lower_is_better', greenThreshold:0, yellowThreshold:10, sourceKeys:['performance'] }];
    case 'cba': return [{ key:'primary-cpl', label:'Cost per qualified lead', formula:'cost_per_result', evaluation:'period_over_period_change', required:true, weight:100, direction:'lower_is_better', greenThreshold:0, yellowThreshold:10, sourceKeys:['performance'] }];
    case 'bloom': return [{ key:'primary-cpl', label:'Cost per verified website chat', formula:'cost_per_result', evaluation:'period_over_period_change', required:true, weight:100, direction:'lower_is_better', greenThreshold:0, yellowThreshold:10, sourceKeys:['performance'] }];
    case 'champagne': return [{ key:'primary-cpl', label:'Cost per Lead', formula:'cost_per_result', evaluation:'period_over_period_change', required:true, weight:100, direction:'lower_is_better', greenThreshold:0, yellowThreshold:10, sourceKeys:['performance'] }];
    case 'ihh': return [{ key:'primary-cpl', label:'Cost per scheduled appointment', formula:'cost_per_result', evaluation:'period_over_period_change', required:true, weight:100, direction:'lower_is_better', greenThreshold:0, yellowThreshold:10, sourceKeys:['performance'] }];
    default: throw new Error(`No approved North Star lanes for ${clientKey}`);
  }
}

function metrics(northStarSourceKeys: string[], budgetSourceKeys: string[]) {
  return [
    { key:'budget_pacing', label:'Budget pacing', adapterKey:'fixed-budget-v2', required:false, weight:10, direction:'lower_is_better', greenThreshold:10, yellowThreshold:20, sourceKeys:budgetSourceKeys },
    { key:'north_star', label:'North Star', adapterKey:'north-star-lanes-v2', required:true, weight:35, direction:'higher_is_better', greenThreshold:1, yellowThreshold:0, sourceKeys:northStarSourceKeys },
    { key:'hours', label:'Hours utilization', adapterKey:'clickup-hours-v1', required:true, weight:20, direction:'lower_is_better', greenThreshold:90, yellowThreshold:110, sourceKeys:['clickup'] },
    { key:'overdue_tasks', label:'Overdue tasks', adapterKey:'clickup-overdue-v1', required:true, weight:15, direction:'lower_is_better', greenThreshold:0, yellowThreshold:2, sourceKeys:['clickup'] },
    { key:'margin', label:'Projected margin', adapterKey:'projected-margin-v1', required:true, weight:20, direction:'higher_is_better', greenThreshold:80, yellowThreshold:60, sourceKeys:['clickup'] },
  ];
}

const clients = roster.map(([clientKey, displayName, dashboardHref, monthlyRetainer, deliveryModel, listId, marginAliases]) => {
  const economics = {
    effectiveMonth: EFFECTIVE_MONTH,
    monthlyRetainer,
    deliveryModel,
    fulfillmentHourlyCost: deliveryModel === 'custom' ? 46 : 26,
    targetMarginPercent: 80,
  };
  const base = {
    clientId: uuidFor(clientKey), clientKey, displayName, dashboardHref,
    reportingTimezone: TIMEZONE, clickupListIds: [listId], marginAliases: [...marginAliases],
    economics, fixedValues: { monthlyBudget: budgets[clientKey] },
  };
  if (!approved.has(clientKey)) {
    return { ...base, fixedValues: { monthlyBudget: null }, configStatus:'configuration_required', metrics:[], sources:[], northStarLanes:[] };
  }
  const performance = contracts[clientKey];
  if (!performance) throw new Error(`No approved performance contract for ${clientKey}`);
  const northStarLanes = lanes(clientKey);
  const northStarSourceKeys = [...new Set(northStarLanes.flatMap((lane) => lane.sourceKeys))].sort();
  const budgetSourceKeys = performance.filter(({ includeMonthSpend }) => includeMonthSpend).map(({ sourceKey }) => sourceKey);
  const fallbackBudgetKeys = budgetSourceKeys.length > 0 ? budgetSourceKeys : northStarSourceKeys;
  const sources = [
    {
      sourceKey:'clickup', provider:'clickup', endpointFamily:'team-time-entries-and-overdue-tasks',
      requestFingerprint:clickupFingerprint(clientKey,listId), permittedFactFields:['hoursUsed','overdueTaskCount'],
      freshnessPolicy:{maximumLagDays:0}, permitsTasks:true, allowedListIds:[listId],
    },
    ...performance.map((contract) => ({
      sourceKey:contract.sourceKey, provider:'supabase', project:contract.project, relation:contract.relation,
      requestFingerprint:supabaseFingerprint(clientKey,contract),
      permittedFactFields:contract.includeMonthSpend ? ['currentRows','monthSpend','previousRows'] : ['currentRows','previousRows'],
      freshnessPolicy:{maximumLagDays:contract.maximumLagDays},
    })),
  ];
  return {
    ...base,
    configStatus:'approved',
    metrics:metrics(northStarSourceKeys, fallbackBudgetKeys),
    sources,
    northStarLanes,
  };
});

const revision = buildApprovedConfigRevision({
  schemaVersion:3,
  calculationVersion:CALCULATION_VERSION,
  sourceContractVersion:SOURCE_VERSION,
  clients,
});

const artifact = {
  snapshotDate:SNAPSHOT_DATE,
  provenance:{
    retainers:"Budget: Monthly - Projections, 2025 / September '26 (gid 1628605919), read 2026-09-03",
    budgets:'Approved September Client Health values; PrePass total 150000, NSI 29500, Good Game eCommerce 5000; Spartaco intentionally product/campaign-specific',
    normalization:'Reviewed service-role-only daily views; State Forty Eight remains Google-only to match its dashboard',
    excluded:['Canary','LiveWorld','EIC Agency'],
    configurationRequired:['aurit','medibrane'],
  },
  revision,
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const output = resolve(process.argv[2] ?? 'docs/client-health/normalized-september-2026.json');
  await writeFile(output, `${JSON.stringify(artifact,null,2)}\n`);
  console.log(`${output}\n${revision.id}\n${revision.hash}`);
}

export { artifact, revision };
