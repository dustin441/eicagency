import assert from 'node:assert/strict';
import test from 'node:test';
import { getPrivateSpartacoWrapups } from '../src/services/spartaco-private-wrapups';
import { getSpartacoWrapups } from '../src/services/spartaco-product-wrapups';

const original = process.env.SPARTACO_PRIVATE_WRAPUPS_JSON;
const fixture = {
  slug: 'synthetic-report', brand: 'Huskie', product: 'Synthetic product', parentProduct: 'Synthetic product',
  campaignGroupName: 'Synthetic campaign', campaignNames: ['Synthetic campaign'], sourceMediumPagePaths: ['/synthetic'],
  beforeStart: '2026-01-01', beforeEnd: '2026-01-28', campaignStart: '2026-01-29', campaignEnd: '2026-02-25',
  afterStart: '2026-02-26', afterEnd: '2026-03-25', status: 'Draft', executiveSummary: 'Synthetic summary',
  canClaim: [], cannotClaim: [], recommendations: [], caveats: [],
};
test('private configuration is validated, additive, and fails closed without leaking its content', () => {
  try {
    delete process.env.SPARTACO_PRIVATE_WRAPUPS_JSON;
    const baseline = getSpartacoWrapups();
    assert.deepEqual(getPrivateSpartacoWrapups(), []);
    process.env.SPARTACO_PRIVATE_WRAPUPS_JSON = JSON.stringify([fixture]);
    assert.deepEqual(getPrivateSpartacoWrapups(), [fixture]);
    assert.equal(getSpartacoWrapups().length, baseline.length + 1);
    for (const raw of ['private invalid JSON', '{}', JSON.stringify([{...fixture, campaignNames: []}]), JSON.stringify([{...fixture, afterEnd:'2026-02-30'}]), JSON.stringify([{...fixture, afterStart:fixture.campaignStart}]), JSON.stringify([fixture, fixture]), JSON.stringify([{...fixture, unexpected:'confidential'}])]) {
      process.env.SPARTACO_PRIVATE_WRAPUPS_JSON = raw;
      assert.throws(getPrivateSpartacoWrapups, {message:'Invalid private saved report configuration'});
    }
    process.env.SPARTACO_PRIVATE_WRAPUPS_JSON = JSON.stringify([{...fixture, slug:baseline[0].slug}]);
    assert.throws(getSpartacoWrapups, {message:'Invalid saved report configuration'});
  } finally {
    if (original === undefined) delete process.env.SPARTACO_PRIVATE_WRAPUPS_JSON;
    else process.env.SPARTACO_PRIVATE_WRAPUPS_JSON = original;
  }
});
