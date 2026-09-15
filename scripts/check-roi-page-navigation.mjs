import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), 'utf8');
}

const [originalPage, paidPage, landing, proxy] = await Promise.all([
  source('src/app/roicalculator/page.tsx'),
  source('src/app/roicalculator-paid/page.tsx'),
  source('src/components/roi-calculator/RoiCalculatorLanding.tsx'),
  source('src/proxy.ts'),
]);

assert.match(
  originalPage,
  /<RoiCalculatorLanding\s+navigation="site"\s*\/>/,
  'The original ROI route must use the existing site navigation.',
);

assert.match(
  paidPage,
  /<RoiCalculatorLanding\s+navigation="paid"\s*\/>/,
  'The paid ROI route must preserve the dedicated paid-traffic navigation.',
);

assert.match(
  landing,
  /navigation === 'site'\s*\?\s*<MarketingHeader\s*\/>\s*:\s*<RoiLandingHeader/,
  'The shared ROI landing must select the existing MarketingHeader only for the site route.',
);

assert.match(
  proxy,
  /pathname === '\/roicalculator-paid'/,
  'The paid ROI route must remain a public marketing route.',
);

console.log('ROI page navigation variants are wired correctly.');
