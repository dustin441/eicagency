import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getPrivateSpartacoWrapups } from '../src/services/spartaco-private-wrapups';
import { getSpartacoWrapups, loadSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

async function main() {
  const path = process.env.SPARTACO_WRAPUP_QA_EXPECTATIONS;
  if (!path) throw new Error('Private source-backed QA expectations file required');
  const expected = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(getSpartacoWrapups().length, expected.inventoryCount);
  assert.equal(getPrivateSpartacoWrapups().length, expected.reports.length);
  for (const fixture of expected.reports) {
    const report = await loadSpartacoProductWrapup(fixture.slug);
    assert.ok(report);
    assert.deepEqual(report.config.campaignNames, fixture.campaignNames);
    assert.deepEqual(report.config.sourceMediumPagePaths, fixture.pagePaths);
    assert.deepEqual(report.periods.map(p => [p.start, p.end]), fixture.windows);
    for (const [index, period] of report.periods.entries()) {
      for (const [metric, value] of Object.entries(fixture.periods[index])) {
        assert.equal(period.summary[metric as keyof typeof period.summary], value, `period ${index}: ${metric}`);
      }
    }
    assert.equal(Math.round(report.paidOverview.cpl * 100), fixture.cplCents);
    assert.ok(Math.abs(report.paidOverview.roas - fixture.roas) < 1e-9, 'ROAS reconciles within floating-point tolerance');
    assert.equal(Math.round(report.paidOverview.cost * 100), fixture.costCents);
    assert.equal(report.sourceMediumRows.reduce((sum, row) => sum + row.ga4_sessions, 0), fixture.periods[1].ga4_sessions);
    assert.deepEqual(report.emailDetails.map(email => [email.name, email.date, email.totalSent, email.opens, email.clicks]), fixture.emails);
    assert.deepEqual(report.leadCaptureBreakdown.map(row => [row.label, row.leads]).sort(), fixture.leads.sort());
    assert.equal(report.metaAds.length, fixture.metaAdCount);
    for (const ad of report.metaAds) assert.match(ad.previewUrl ?? '', /^https:\/\/www.facebook.com\/ads\/library\//);
    assert.equal(report.periods[2].label, '4w After');
    assert.equal(report.config.status, 'Ready for Review');
  }
  // Guard shared scorecard behavior for legacy website-lead flights with attributed revenue.
  for (const config of getSpartacoWrapups().filter(report => report.includeLeadCampaignPurchases)) {
    const legacy = await loadSpartacoProductWrapup(config.slug);
    assert.ok(legacy);
    const paid = legacy.paidOverview;
    if (!paid.hasSalesCampaign && paid.cost > 0 && paid.revenue > 0) {
      assert.equal(paid.roas, paid.revenue / paid.cost);
      assert.ok(paid.roas > 0);
    }
  }
  console.log('Private saved reports: source-backed scope, inventory, metrics, email, attribution and date checks PASS');
}
main().catch(() => { console.error('Private saved-report reconciliation failed, inspect protected evidence'); process.exit(1); });
