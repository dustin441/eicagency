// Render real PrePass components; isolate charts/navigation/ad previews from this unit check.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }}).outputText;
  const localRequire = (id) => {
    if (id === '@/components/ChannelTable') return { __esModule: true, default: ({subtitle}) => React.createElement('p', null, subtitle) };
    if (/^@\/components\/(FilterBar|TrendChart|FleetSizeTable|AdPreviews)$/.test(id)) {
      return id.endsWith('AdPreviews') ? { MetaAdPreviews: () => null, GoogleAdPreviews: () => null } : { __esModule: true, default: () => null };
    }
    if (id.startsWith('@/')) {
      const base = path.join(root, 'src', id.slice(2));
      return load(['.tsx', '.ts'].map(ext => base + ext).find(fs.existsSync));
    }
    return require(id);
  };
  new Function('require', 'module', 'exports', source)(localRequire, mod, mod.exports);
  return mod.exports;
}
const overall = load(path.join(root, 'src/components/DashboardClient.tsx')).default;
const focus = load(path.join(root, 'src/components/FocusDashboardClient.tsx')).default;
const params = { start: '2026-09-14', end: '2026-09-15', compStart: '2026-09-12', compEnd: '2026-09-13', channel: 'all', focus: 'all' };
const readout = { currentStart: '2026-09-14', currentEnd: '2026-09-27', overallStory: ['Stored narrative, not recalculated'], wins: {smb:[],abm:[],fd360:[]}, opportunities: {smb:[],abm:[],fd360:[]}, executionContext:[], accomplishments:[], focusNextWeek:[] };
const data = { filterParams:params, focus:'SMB', totalSpend:1000, totalImpressions:10000, totalClicks:100, platformConversions:20, totalMqls:10, totalSqls:5, totalWon:2,
  prevSpend:800, prevImpressions:8000, prevClicks:80, prevConversions:8, prevMqls:8, prevSqls:4, prevWon:1,
  avgDaysMqlToSql:10, avgDaysSqlToWon:20, dailyData:[], channels:[], linkedinCampaigns:[], extensions:[], products:[], campaignPerformance:[], campaignTypes:[], metaCreatives:[], googleCreatives:[], fleetDistribution:[], fleetBands:[],
  budget:10000, googleBudgetSpent:1000, metaBudgetSpent:0, stackadaptBudgetSpent:0, totalCalls:0, prevTotalCalls:0, callMqls:0, callSqls:0, callWon:0, prevCallMqls:0, prevCallSqls:0, prevCallWon:0, enrollmentMqls:10,enrollmentSqls:5,enrollmentWon:2 };
function render(Component, overrides = {}, weeklyReadout = readout) {
  return renderToStaticMarkup(React.createElement(Component, { initialData:{...data,...overrides}, data:{...data,...overrides}, weeklyReadout, isAdmin:false }))
    .replace(/<[^>]*>/g,' ').replace(/&#x27;/g,"'").replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
}
test('mismatched saved summary prominently identifies both scopes without rewriting narrative', () => {
  const text = render(overall);
  assert.match(text, /Different scope from selected metrics/);
  assert.match(text, /Saved summary: Sep 14, 2026 – Sep 27, 2026 · All channels · All segments/);
  assert.match(text, /Selected metrics: Sep 14, 2026 – Sep 15, 2026 · All channels · All segments/);
  assert.match(text, /does not recalculate when filters change/);
  assert.match(text, /Stored narrative, not recalculated/);
});
test('matching dates still distinguish saved narrative from live metrics', () => {
  const text = render(overall, {filterParams:{...params,end:'2026-09-27'}});
  assert.match(text, /Saved weekly summary/);
  assert.doesNotMatch(text, /Different scope from selected metrics/);
  assert.match(text, /does not recalculate when filters change/);
});
test('channel and segment mismatch is flagged even with matching dates', () => {
  for (const change of [{channel:'Google'}, {focus:'SMB'}]) {
    const text = render(overall, {filterParams:{...params,end:'2026-09-27',...change}});
    assert.match(text, /Different scope from selected metrics/);
    assert.match(text, new RegExp(`Selected metrics:.*${Object.values(change)[0]}`));
  }
});
test('missing summary dates are unknown, not implicitly in scope; empty narrative stays absent', () => {
  assert.match(render(overall, {}, {...readout,currentEnd:''}), /Summary dates unavailable/);
  assert.doesNotMatch(render(overall, {}, {...readout,overallStory:[]}), /Weekly Executive Summary/);
});
for (const [name, Component] of [['Overall',overall],['SMB',focus]]) {
  test(`${name}: CPL badge uses current vs previous (50 vs 100 = -50%, not +100%)`, () => {
    assert.match(render(Component), /-50\.0% \$50 Cost Per Lead/);
  });
  test(`${name}: CTR, CPC, cost/stage and stage ratios render from common totals`, () => {
    const text = render(Component);
    assert.match(text, /1\.00% CTR/);
    assert.match(text, /\$10\.00 CPC/);
    assert.match(text, /Cost Per MQL.*?\$100/);
    assert.match(text, /Cost Per SQL.*?\$200/);
    assert.match(text, /Cost Per Won.*?\$500/);
    assert.match(text, /50\.0%/); assert.match(text, /40\.0%/);
  });
  test(`${name}: undefined CPL comparison renders a dash instead of a invented percent`, () => {
    for (const change of [{prevConversions:0},{platformConversions:0},{prevSpend:0}]) {
      const text = render(Component, change);
      assert.match(text, /— (?:\$50|—) Cost Per Lead/);
      assert.doesNotMatch(text, /NaN|Infinity/);
    }
  });
  test(`${name}: funnel timing explicitly discloses separate historical scope`, () => {
    assert.match(render(Component), /Stage-event ratios, not an acquisition cohort/);
    assert.match(render(Component), /Timing: last 12 months, all channels and segments/);
  });
}
test('Overall page heading reflects active filters rather than claiming all channels', () => {
  assert.match(render(overall,{filterParams:{...params,channel:'Meta',focus:'SMB'}}), /Sep 14 – Sep 15 · Meta · SMB/);
});
test('ABM labels distinguish qualified lifetime membership from paid period stages', () => {
  for (const channel of ['all', 'Google', 'Meta']) {
    const text = render(focus, {focus:'ABM', filterParams:{...params,channel}});
    assert.match(text, /Attributed paid-channel period stages; all fleet sizes; excludes Unattributed/);
    assert.match(text, /Mixed-Scope Stage Distribution/);
    assert.match(text, /not a conversion funnel/);
    assert.match(text, /Fleets 101–500 and 500\+/);
    assert.match(text, /selected-period ABM form cohort/);
    assert.match(text, /lifetime stage membership; all channels/);
    assert.match(text, /ratio \(mixed scopes\)/);
    assert.doesNotMatch(text, /converted|Stage-event ratios, not an acquisition cohort/);
  }
});
test('SMB and FD360 preserve their existing funnel labels', () => {
  for (const name of ['SMB','FD360']) {
    const text = render(focus, {focus:name});
    assert.match(text, /Funnel Distribution/);
    assert.match(text, /Stage-event ratios, not an acquisition cohort/);
    assert.doesNotMatch(text, /Mixed-Scope Stage Distribution/);
  }
});
test('historical saved narrative is never presented as refreshed live metrics', () => {
  assert.match(render(overall, {filterParams:{...params,end:readout.currentEnd}}), /Historical summary — not refreshed from current source data/);
});
test('ABM channel subtitle explicitly excludes Unattributed without hardcoded totals', () => {
  const source = fs.readFileSync(path.join(root,'src/components/FocusDashboardClient.tsx'),'utf8');
  assert.match(source, /Attributed paid-channel period stages; all fleet sizes; excludes Unattributed/);
});
test('focus budget pacing explicitly discloses all-channel current-month scope', () => {
  assert.match(render(focus), /Current month through yesterday · All channels · Independent of date and channel filters/);
});
