import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const scope = read('src/lib/prepass-ata-scope.ts');
const service = read('src/services/prepass-ata-event.ts');
const analytics = read('src/services/analytics.ts');
const action = read('src/app/dashboard/actions.ts');
const page = read('src/app/dashboard/ata-event/page.tsx');
const layout = read('src/app/dashboard/layout.tsx');
const client = read('src/components/AtaEventDashboardClient.tsx');

assert.match(scope, /24301231161/);
assert.match(scope, /24301231173/);
assert.match(scope, /ATA_BUDGET_MONTH_START = '2026-10-01'/);
assert.match(scope, /ATA_BUDGET_MONTH_END = '2026-10-31'/);
assert.match(service, /\.in\('campaign_id', googleIds\)/);
assert.match(service, /status: 'No period data'/);
assert.match(service, /ATA_BUDGET_MONTH_LABEL/);
assert.match(service, /monthStart: ATA_BUDGET_MONTH_START/);
assert.match(analytics, /rows\.filter\(row => !isAtaEventCampaignName\(row\.campaign_name\)\)/);
assert.match(analytics, /\.select\('platform,spend,campaign_name'\)/);
assert.match(analytics, /const pacingData = rowsWithoutAta/);
assert.match(analytics, /scopedAtaSmbTrendRows/);
assert.match(action, /new Set\(\['SMB', 'ABM', 'FD360', 'ATA'\]\)/);
assert.match(action, /requireBudgetAdmin/);
assert.match(page, /requireClientAccess\('prepass'\)/);
assert.match(page, /ATA_BUDGET_MONTH_START/);
assert.match(layout, /href: '\/dashboard\/ata-event'/);
assert.match(client, /separate \$6,000 GroundTruth plan billed to EIC is excluded/);
assert.match(client, /Metrics remain unavailable, not zero/);

console.log('PASS: ATA event dashboard scope, fixed budget month, SMB exclusion, auth, and missing-data contract');
