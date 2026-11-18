import test from 'node:test';
import assert from 'node:assert/strict';
import { consolidateVideoRows, type VideoRow } from './nsi-ytd-media.ts';
const row = (id: string, spendScope: VideoRow['spendScope'], views: number | null, spend: number | null): VideoRow => ({ id, platform: 'Google Ads', label: id, spendScope, viewDefinition: 'TrueView views', source: 'Synthetic native source', current: { spend, impressions: spend === null ? null : 1000, views, thruplays: null, completeViews: null }, previous: null });
test('consolidates only known disjoint Google native subsets without inventing all-inventory delivery', () => {
 const source = [row('google-youtube','placement',80,100),row('google-other-video','unavailable',20,null)];
 const result = consolidateVideoRows(source);
 assert.equal(result.length,1); assert.equal(result[0].current?.views,100); assert.equal(result[0].current?.spend,100); assert.equal(result[0].current?.impressions,1000);
 assert.match(result[0].deliveryScope,/YouTube only/); assert.equal(source[0].current?.views,80); assert.equal(result[0].previous,null);
});
test('missing view values stay missing, not a misleading partial total', () => {
 const source=[row('google-youtube','placement',80,100),row('google-other-video','unavailable',null,null)];
 assert.equal(consolidateVideoRows(source)[0].current?.views,null);
});
test('unknown Google rows are not silently merged and Meta metrics are unchanged', () => {
 const meta={...row('meta','ad',4,3),platform:'Meta' as const};
 const source=[row('google-youtube','placement',80,100),row('google-custom','campaign',12,20),meta];
 const result=consolidateVideoRows(source); assert.equal(result.length,3); assert.deepEqual(result[2],{...meta,deliveryScope:'Ads with reported video plays; delivery can include mixed formats'});
});
test('duplicate recognized subsets prevent consolidation',()=>{
 const source=[row('google-youtube','placement',80,100),row('google-youtube','placement',30,40),row('google-other-video','unavailable',20,null)];
 assert.equal(consolidateVideoRows(source).length,3);
});
