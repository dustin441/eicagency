import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function renderDashboard({ startsCount = 9, fillsCount = 2 }: { startsCount?: number; fillsCount?: number } = {}) {
  const source = readFileSync(new URL('../components/AuritDashboardClient.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const exports: any = {};
  vm.runInNewContext(code, {
    exports,
    Date,
    Map,
    Set,
    require(id: string) {
      if (id.includes('FilterBar')) return { default: () => React.createElement('div', {}, 'Date filters'), __esModule: true };
      if (id.includes('aurit-metrics')) return require('./aurit-metrics.ts');
      return require(id);
    },
  });

  const starts = 'Meta|offsite_conversion.fb_pixel_custom.Consultation Form Started';
  const fills = 'Meta|offsite_conversion.fb_pixel_custom.Form Submitted';
  const data = {
    channelRows: [
      { channel: 'Meta', spend: 200, prevSpend: 0, impressions: 1000, prevImpressions: 0, clicks: 100, prevClicks: 0 },
      { channel: 'Google', spend: 50, prevSpend: 0, impressions: 500, prevImpressions: 0, clicks: 5, prevClicks: 0 },
    ],
    conversionTypes: [
      { key: starts, channel: 'Meta', conversionType: 'offsite_conversion.fb_pixel_custom.Consultation Form Started', label: 'Consultation Form Started', conversions: startsCount, prevConversions: 0 },
      { key: fills, channel: 'Meta', conversionType: 'offsite_conversion.fb_pixel_custom.Form Submitted', label: 'Form Submitted', conversions: fillsCount, prevConversions: 0 },
    ],
    campaignRows: [
      {
        key: 'Meta__1', campaignId: '1', campaign: 'BOF Free Consultation', channel: 'Meta', campaignType: null,
        spend: 200, prevSpend: 0, impressions: 1000, clicks: 100,
        conversionsByType: { [starts]: startsCount, [fills]: fillsCount }, prevConversionsByType: {},
      },
      {
        key: 'Google__2', campaignId: '2', campaign: 'YouTube Service Introduction', channel: 'Google', campaignType: 'VIDEO',
        spend: 50, prevSpend: 0, impressions: 500, clicks: 5,
        conversionsByType: {}, prevConversionsByType: {},
      },
    ],
    timeSeries: [
      { label: '2026-10-31', spend: 250, conversionsByType: { [starts]: startsCount, [fills]: fillsCount } },
    ],
    filterParams: { start: '2026-10-01', end: '2026-10-31', compStart: '2026-09-01', compEnd: '2026-09-30', channel: 'all' },
    lastSyncedDate: '2026-10-31',
    weeklyReadout: null,
  };
  return renderToStaticMarkup(React.createElement(exports.default, { data }));
}

test('renders form-fill-only lead and CPL metrics while keeping starts as funnel diagnostics', () => {
  const html = renderDashboard();
  assert.match(html, /Lead definition:/);
  assert.match(html, /Form Starts<\/p><p[^>]*>9<\/p>/);
  assert.match(html, /Form Fills \(Leads\)<\/p><p[^>]*>2<\/p>/);
  assert.match(html, /Start → Fill Rate<\/p><p[^>]*>22\.22%<\/p>/);
  assert.match(html, /Cost \/ Lead<\/p><p[^>]*>\$125\.00<\/p>/);
  assert.match(html, /Spend vs\. Form Fills/);
  assert.doesNotMatch(html, /Cost \/ Conversion/);
  assert.doesNotMatch(html, /All Conversions/);
});

test('labels Aurit creative outcomes as form fills and cost per lead', () => {
  const source = readFileSync(new URL('../components/AuritCreativeAnalysisClient.tsx', import.meta.url), 'utf8');
  assert.match(source, /conversion: 'Form Fills'/);
  assert.match(source, /cpa: 'Cost \/ Lead'/);
  assert.match(source, /completed website form fills as leads/);
  assert.doesNotMatch(source, /conversion: 'Conversions'/);
});

test('shows unavailable CPL rather than zero dollars when there are no completed form fills', () => {
  const html = renderDashboard({ startsCount: 9, fillsCount: 0 });
  assert.match(html, /Cost \/ Lead<\/p><p[^>]*>—<\/p>/);
  assert.doesNotMatch(html, /Cost \/ Lead<\/p><p[^>]*>\$0\.00<\/p>/);
});
