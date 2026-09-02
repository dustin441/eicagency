import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const pagePath = 'src/app/dashboard/client-health/page.tsx';
const layoutPath = 'src/app/dashboard/layout.tsx';
const componentPath = 'src/components/ClientHealthDashboardClient.tsx';
const page = readFileSync(pagePath, 'utf8');
const layout = readFileSync(layoutPath, 'utf8');

assert.doesNotMatch(layout, /dashboard\/client-health|value=["']client-health["']|router\.push\([^)]*client-health/);
assert.doesNotMatch(page, /fetchClientHealthDashboard|services\/client-health|ClientHealthDashboardClient/);
assert.match(page, /import\s*{\s*notFound\s*}\s*from\s*['"]next\/navigation['"]/);
assert.match(page, /notFound\(\)/);
assert.equal(existsSync(componentPath), true, 'the future client-health UI component must remain present');

const preservedClientRoutes = [
  '/dashboard',
  '/dashboard/smb',
  '/dashboard/abm',
  '/dashboard/fd360',
  '/dashboard/creatives',
  '/dashboard/monthly-report',
  '/dashboard/monthly-report/ga4-performance',
  '/dashboard/spartaco/leads',
  '/dashboard/spartaco/ecommerce',
  '/dashboard/spartaco/products',
  '/dashboard/spartaco/brand-health',
  '/dashboard/spartaco/wrapups',
  '/dashboard/spartaco/creatives',
  '/dashboard/nsi',
  '/dashboard/nsi/monthly',
  '/dashboard/nsi/h1-recap',
  '/dashboard/nsi/revenue',
  '/dashboard/nsi/creatives',
  '/dashboard/turfli',
  '/dashboard/durodyne',
  '/dashboard/durodyne/creatives',
  '/dashboard/goodgame/sales',
  '/dashboard/goodgame/foot-traffic',
  '/dashboard/goodgame/creatives',
  '/dashboard/goodgame',
  '/dashboard/goodgame/organic-social',
  '/dashboard/bridgeway',
  '/dashboard/arabella',
  '/dashboard/arabella/creatives',
  '/dashboard/kinsey',
  '/dashboard/kinsey/creatives',
  '/dashboard/state-forty-eight',
  '/dashboard/cba',
  '/dashboard/cba/creatives',
  '/dashboard/liferep',
  '/dashboard/bloom',
  '/dashboard/bloom/creatives',
  '/dashboard/eicagency',
  '/dashboard/eicagency/mof',
  '/dashboard/eicagency/social',
  '/dashboard/eicagency/dustins-social',
  '/dashboard/champagne',
  '/dashboard/champagne/creatives',
  '/dashboard/ihh',
  '/dashboard/ihh/creatives',
];

for (const route of preservedClientRoutes) {
  assert.ok(layout.includes(`'${route}'`), `unrelated client route must remain present: ${route}`);
}

console.log('client-health route gate static check passed');
