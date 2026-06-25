import assert from 'node:assert/strict';
import { fetchSpartacoProductData } from '../src/services/spartaco-product-analytics';

async function main() {
  const params = {
    brand: 'Huskie',
    product: 'all',
    channel: 'all',
    campaign: 'all',
    focus: 'all',
    channelGroup: 'all',
    sourceMedium: 'all',
    start: '2026-01-07',
    end: '2026-02-20',
    compStart: '2025-11-23',
    compEnd: '2026-01-06',
  } as const;

  const allProducts = await fetchSpartacoProductData(params);
  assert.ok(
    allProducts.filterOptions.products.includes('New Cutting Tools'),
    `Expected Huskie product dropdown to include "New Cutting Tools". Got: ${allProducts.filterOptions.products.join(', ')}`,
  );

  const newCuttingTools = await fetchSpartacoProductData({ ...params, product: 'New Cutting Tools' });
  assert.ok(
    newCuttingTools.summary.ad_impressions > 0,
    'Expected New Cutting Tools selection to return paid ad impressions',
  );
  assert.ok(
    newCuttingTools.summary.ad_clicks > 0,
    'Expected New Cutting Tools selection to return paid ad clicks',
  );
  assert.ok(
    newCuttingTools.summary.ad_conversions > 0,
    'Expected New Cutting Tools selection to return tracked leads/conversions',
  );
  assert.ok(
    newCuttingTools.summary.email_total_sent > 0,
    'Expected New Cutting Tools selection to include the product-specific Act-On email',
  );

  const rowLabels = newCuttingTools.productRows.map((row) => row.product);
  assert.ok(
    rowLabels.includes('New Cutting Tools'),
    `Expected product rows to include "New Cutting Tools". Got: ${rowLabels.join(', ')}`,
  );

  console.log('Huskie New Cutting Tools dropdown alignment checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
