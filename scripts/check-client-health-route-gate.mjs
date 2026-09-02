import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const pagePath = 'src/app/dashboard/client-health/page.tsx';
const layoutPath = 'src/app/dashboard/layout.tsx';
const componentPath = 'src/components/ClientHealthDashboardClient.tsx';
const servicePath = 'src/services/client-health.ts';
for (const path of [pagePath, layoutPath, componentPath, servicePath]) {
  assert.equal(existsSync(path), true, `required client-health file is missing: ${path}`);
}

const page = readFileSync(pagePath, 'utf8');
const layout = readFileSync(layoutPath, 'utf8');
const component = readFileSync(componentPath, 'utf8');
const service = readFileSync(servicePath, 'utf8');

assert.match(page, /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/);
assert.match(page, /export\s+default\s+async\s+function\s+ClientHealthPage/);
assert.match(page, /await\s+requireAgencyAccess\(\)/);
assert.match(page, /await\s+fetchClientHealthDashboard\(\)/);
assert.ok(
  page.indexOf('await requireAgencyAccess()') < page.indexOf('await fetchClientHealthDashboard()'),
  'agency authorization must happen before the snapshot repository-backed service read',
);
assert.match(page, /<ClientHealthDashboardClient\s+data={data}\s*\/>/);
assert.doesNotMatch(page, /notFound|createEicClientHealthRepository|readLatest/);

assert.match(service, /createEicClientHealthRepository\(\)/);
assert.match(service, /await\s+repository\.readLatest\(\)/);
assert.match(service, /no_published_snapshots/);
assert.match(service, /record\.client\.key\.toLowerCase\(\)\s*!==\s*['"]canary['"]/);
for (const key of ['budget_pacing', 'north_star', 'hours', 'overdue_tasks', 'margin']) {
  assert.ok(service.includes(`'${key}'`), `snapshot dimension must be validated: ${key}`);
}
assert.doesNotMatch(service, /services\/analytics|\.\/analytics|client-health-sources|fetchClickUp|fetchCurrentMargin|CLICKUP_API|Google Sheets/i);
assert.doesNotMatch(service, /client-health-rating|classifyBudgetPacing|scoreClientHealth/);

assert.match(layout, /pathname\s*===\s*['"]\/dashboard\/client-health['"][^\n]*return\s+null/);
assert.match(layout, /profile\?\.role\s*===\s*['"]agency['"]\s*\|\|\s*profile\?\.role\s*===\s*['"]super_admin['"]/);
assert.match(layout, /href=["']\/dashboard\/client-health["']/);
assert.match(layout, />Client Health</);

for (const label of ['Healthy', 'Watch', 'At Risk', 'Incomplete', 'Configuration Required', 'Unavailable (optional)']) {
  assert.ok(component.includes(`label: '${label}'`), `component must distinctly label ${label}`);
}
assert.match(component, /statusAllowsScore\(status\)/);
assert.match(component, /status\s*!==\s*['"]incomplete['"]\s*&&\s*status\s*!==\s*['"]configuration_required['"]/);
for (const label of ['Snapshot date:', 'Current window:', 'Prior window:', 'Data through:', 'Calculated:']) {
  assert.ok(component.includes(label), `component must render exact snapshot metadata label: ${label}`);
}
assert.match(component, /row\.sourceFreshness\.map/);
assert.match(component, /row\.dashboardHref\s*===\s*null/);
assert.match(component, /task\.href\s*\?/);
assert.match(component, /hidden overflow-x-auto lg:block/);
assert.match(component, /lg:hidden/);
assert.doesNotMatch(component, /absolute right-0 z-30|max-w-\[80vw\]/);
assert.doesNotMatch(component, /Weighted:\s*budget|client_health_settings|CLICKUP_API|Current-month margin sheet/);
assert.match(component, /No published client-health snapshots/);
assert.match(component, /No clients match the current search or status filter/);
assert.match(component, /clientHealthSourcePresentationStatus\(source\)/);
assert.match(service, /source\.status\s*===\s*['"]succeeded['"]\)\s*return source\.stale\s*===\s*true\s*\?\s*['"]watch['"]\s*:\s*['"]healthy['"]/);

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
