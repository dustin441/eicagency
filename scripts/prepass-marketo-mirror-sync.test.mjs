import assert from 'node:assert/strict';
import test from 'node:test';
import { checksum, normalizeRows, parseCsv } from './prepass-marketo-mirror-sync.mjs';

test('parseCsv preserves quoted commas, escaped quotes, and blank values', () => {
  const rows = parseCsv('\uFEFFid,updatedAt,email,utmcampaign\r\n101,2026-10-09T01:00:00Z,a@example.test,"Search, ABM"\r\n202,2026-10-09T02:00:00Z,,"A ""quoted"" campaign"\r\n');
  assert.deepEqual(rows, [
    { id: '101', updatedAt: '2026-10-09T01:00:00Z', email: 'a@example.test', utmcampaign: 'Search, ABM' },
    { id: '202', updatedAt: '2026-10-09T02:00:00Z', email: '', utmcampaign: 'A "quoted" campaign' },
  ]);
});

test('parseCsv fails closed on malformed structure', () => {
  assert.throws(() => parseCsv('id,email\n1,"unterminated'), /Unterminated/);
  assert.throws(() => parseCsv('id,id\n1,2\n'), /Duplicate/);
  assert.throws(() => parseCsv('id,email\n1,a,extra\n'), /expected 2/);
});

test('normalizeRows keeps the latest complete row per Marketo ID and sorts IDs', () => {
  const rows = normalizeRows([
    { id: '202', updatedAt: '2026-10-09T01:00:00Z', dateMQL: '2026-10-08' },
    { id: '101', updatedAt: '2026-10-09T01:00:00Z', dateMQL: '2026-10-07' },
    { id: '202', updatedAt: '2026-10-09T02:00:00Z', dateMQL: '' },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, '101');
  assert.equal(rows[1].id, '202');
  assert.equal(rows[1].dateMQL, '');
  assert.ok(Object.hasOwn(rows[1], 'dateClosedWon'));
});

test('normalizeRows fails closed on missing IDs or updatedAt', () => {
  assert.throws(() => normalizeRows([{ id: '', updatedAt: '2026-10-09T01:00:00Z' }]), /Invalid Marketo ID/);
  assert.throws(() => normalizeRows([{ id: '101', updatedAt: '' }]), /Invalid updatedAt/);
});

test('checksum is deterministic', () => {
  assert.equal(checksum('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
