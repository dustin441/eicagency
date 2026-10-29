import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TENANTS,
  allowedClientsFor,
  isClientAllowedForTenant,
  isPathAllowedForPartner,
  resolveTenant,
} from './tenant.ts';

const scott = TENANTS['scott-social'];
const eic = TENANTS.eic;
const ALL = ['prepass', 'spartaco', 'nsi', 'eicagency', 'aurit', 'arabella', 'kinsey', 'bloom', 'champagne', 'medibrane'];

test('unset tenant resolves to EIC on EIC hosts and locally', () => {
  for (const host of ['analytics.eic.agency', 'eic.agency', 'localhost:3000', '', null]) {
    const r = resolveTenant({ configured: undefined, host });
    assert.equal(r.ok && r.tenant.id, 'eic', String(host));
  }
});

test('scott tenant resolves on its domain, previews and localhost', () => {
  for (const host of ['analytics.scottsocialmarketing.com', 'scottsocial-git-feat-scott-x-dustin-2299s-projects.vercel.app', 'localhost:3000']) {
    const r = resolveTenant({ configured: 'scott-social', host });
    assert.equal(r.ok && r.tenant.id, 'scott-social', host);
  }
});

test('host / tenant mismatch fails closed in both directions', () => {
  assert.equal(resolveTenant({ configured: 'scott-social', host: 'analytics.eic.agency' }).ok, false);
  assert.equal(resolveTenant({ configured: 'scott-social', host: 'www.eic.agency' }).ok, false);
  assert.equal(resolveTenant({ configured: undefined, host: 'analytics.scottsocialmarketing.com' }).ok, false);
  assert.equal(resolveTenant({ configured: 'eic', host: 'ANALYTICS.SCOTTSOCIALMARKETING.COM:443' }).ok, false);
});

test('unknown configured tenant never falls back to EIC', () => {
  const r = resolveTenant({ configured: 'scott', host: 'localhost' });
  assert.equal(r.ok, false);
});

test('scott tenant only serves its own clients', () => {
  for (const id of ['aurit', 'arabella', 'kinsey', 'bloom', 'champagne']) assert.ok(isClientAllowedForTenant(scott, id), id);
  for (const id of ['prepass', 'spartaco', 'nsi', 'eicagency', 'medibrane', 'ihh']) assert.equal(isClientAllowedForTenant(scott, id), false, id);
  assert.ok(isClientAllowedForTenant(eic, 'prepass'));
});

test('agency-level roles on scott are capped to scott clients', () => {
  assert.deepEqual(allowedClientsFor(scott, { role: 'agency', client_access: null }, ALL), ['aurit', 'arabella', 'kinsey', 'bloom', 'champagne']);
  assert.deepEqual(allowedClientsFor(scott, { role: 'super_admin', client_access: null }, ALL), ['aurit', 'arabella', 'kinsey', 'bloom', 'champagne']);
});

test('an aurit-only client cannot reach arabella, kinsey or EIC clients', () => {
  assert.deepEqual(allowedClientsFor(scott, { role: 'client', client_access: ['aurit'] }, ALL), ['aurit']);
  // A profile granting EIC clients still gets nothing outside the scott cap.
  assert.deepEqual(allowedClientsFor(scott, { role: 'client', client_access: ['prepass', 'nsi'] }, ALL), []);
});

test('EIC behaviour is unchanged', () => {
  assert.deepEqual(allowedClientsFor(eic, { role: 'agency', client_access: null }, ALL), ALL);
  assert.deepEqual(allowedClientsFor(eic, { role: 'client', client_access: ['nsi'] }, ALL), ['nsi']);
  assert.ok(isPathAllowedForPartner(eic, '/dashboard/prepass'));
  assert.ok(isPathAllowedForPartner(eic, '/'));
});

test('scott route policy allows auth + its dashboards only', () => {
  for (const path of ['/login', '/forgot-password', '/reset-password', '/auth/callback', '/dashboard', '/dashboard/aurit', '/dashboard/aurit/creatives', '/dashboard/champagne/halloween']) {
    assert.ok(isPathAllowedForPartner(scott, path), path);
  }
  for (const path of ['/', '/about-us', '/dashboard/prepass', '/dashboard/spartaco/leads', '/dashboard/settings', '/dashboard/eicagency', '/dashboard/creatives', '/dashboard/aurit-evil', '/api/chat/arabella', '/api/dashboard/prepass/pdf', '/api/debug-prepass', '/api/creative-builder']) {
    assert.equal(isPathAllowedForPartner(scott, path), false, path);
  }
});
