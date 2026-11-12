import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('Bloom Performance renders server-provided individual ads and an honest empty state', () => {
 const source=readFileSync(new URL('./BloomDashboardClient.tsx',import.meta.url),'utf8');
 assert.ok(source.includes('<MetaAdPreviews'), 'Bloom needs a Performance creative gallery');
 assert.ok(source.includes('creatives={data.metaCreatives}'));
 assert.ok(source.includes('No Meta creative activity in the selected period.'));
});
