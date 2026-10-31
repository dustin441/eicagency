import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { proxy } from '../proxy.ts';

process.env.NEXT_PUBLIC_TENANT_ID = 'scott-social';

function request(host?: string) {
  return new NextRequest('https://request.invalid/dashboard/not-allowed', {
    headers: host === undefined ? {} : { host },
  });
}

test('proxy rejects missing and malformed Host authorities with 421', async () => {
  for (const host of [
    undefined,
    '',
    ':443',
    'analytics.scottsocialmarketing.com:',
    'analytics.scottsocialmarketing.com:443:evil',
    'analytics.scottsocialmarketing.com:notaport',
    'analytics.scottsocialmarketing.com:65536',
    'scottsocial-attacker.vercel.app',
  ]) {
    const response = await proxy(request(host));
    assert.equal(response.status, 421, String(host));
  }
});

test('proxy accepts exact Scott production and stable aliases', async () => {
  for (const host of [
    'analytics.scottsocialmarketing.com',
    'analytics.scottsocialmarketing.com:443',
    'project-r8itd.vercel.app',
    'scottsocial-git-feat-scott-x-dustin-2299s-projects.vercel.app',
  ]) {
    const response = await proxy(request(host));
    assert.equal(response.status, 404, host);
  }
});
