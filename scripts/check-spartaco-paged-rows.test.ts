import assert from 'node:assert/strict';
import test from 'node:test';
import { collectSpartacoRows } from '../src/lib/spartaco-paged-rows';

test('collects more than the provider cap without omission, including exact page multiples', async () => {
  for (const count of [0, 499, 500, 501, 1500, 1501]) {
    const source = Array.from({length:count}, (_, id) => ({id}));
    const rows = await collectSpartacoRows(async (from,to) => ({data:source.slice(from,to+1),error:null}));
    assert.deepEqual(rows,source);
  }
});
test('a later-page error or missing payload fails instead of returning a partial report', async () => {
  const failure = new Error('Synthetic page failure');
  await assert.rejects(collectSpartacoRows(async from => from === 0
    ? {data:[1,2],error:null} : {data:null,error:failure},2), failure);
  await assert.rejects(collectSpartacoRows(async () => ({data:null,error:null})), /returned no data/);
});
