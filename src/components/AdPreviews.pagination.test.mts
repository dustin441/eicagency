import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('./AdPreviews.tsx', import.meta.url), 'utf8');
test('shared Meta gallery exposes ads beyond the initial preview limit', () => {
 assert.ok(source.includes('Show all {sortedCreatives.length} ads'));
 assert.ok(source.includes('setShowAllCreatives(true)'));
 assert.ok(source.includes('previewLimit === null || showAllCreatives'));
});
test('shared Google gallery exposes creatives beyond the initial twelve', () => {
 const google=source.slice(source.indexOf('export function GoogleAdPreviews'));
 assert.ok(google.includes('Show all {creatives.length} ads'));
 assert.ok(google.includes('showAllCreatives ? creatives : creatives.slice(0, 12)'));
});
test('Meta gallery header stacks its controls on narrow screens', () => {
 assert.ok(source.includes('flex flex-col sm:flex-row sm:items-start justify-between gap-4'), 'Mobile gallery header must not squeeze title beside controls');
});
