// Node-only browser resolver. Never import from client components.
import type { LaunchOptions } from 'puppeteer-core';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';

import { tmpdir } from 'node:os';
import { join } from 'node:path';

type BrowserLaunch = Pick<LaunchOptions, 'executablePath' | 'args' | 'headless' | 'env'>;
let packagedLaunch: Promise<BrowserLaunch> | undefined;

async function extractPackagedBrowser(): Promise<BrowserLaunch> {
 // Sparticuz uses os.tmpdir() and changes Lambda environment variables on import.
 // Run that unmodified package in a child, never changing the server's process.env.
 // mkdtemp isolates different workers; the cached promise serializes this runtime.
 const directory = await mkdtemp(join(tmpdir(), 'eic-creative-chromium-'));
 try {
  // Resolve in native Node: Next rewrites parent require.resolve into module IDs.
  const source = `
   const chromium = require('@sparticuz/chromium');
   chromium.executablePath().then(executablePath => {
    // The packaged config hardcodes /tmp/fonts; remap it to this isolated extraction.
    const fs = require('node:fs');
    const path = require('node:path');
    const fontConfig = path.join(process.env.TMPDIR, 'fonts', 'fonts.conf');
    fs.writeFileSync(fontConfig, fs.readFileSync(fontConfig, 'utf8').replaceAll('/tmp/fonts', path.join(process.env.TMPDIR, 'fonts')));
    console.log(JSON.stringify({executablePath, args: chromium.args,
     env: Object.fromEntries(['FONTCONFIG_PATH','LD_LIBRARY_PATH','HOME'].filter(k => process.env[k] !== undefined).map(k => [k, process.env[k]]))}));
   }).catch(error => { console.error(error); process.exitCode = 1; });
  `;
  const env = { ...process.env, TMPDIR: directory, TMP: directory, TEMP: directory,
   FONTCONFIG_PATH: join(directory, 'fonts'), HOME: directory };
  const output = await new Promise<string>((resolve, reject) => {
   execFile(process.execPath, ['-e', source], {
    cwd: process.cwd(), env, timeout: 40_000, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024,
   }, (error, stdout) => error ? reject(error) : resolve(stdout));
  });
  const extracted = JSON.parse(output) as { executablePath: string; args: string[]; env: Record<string, string> };
  return { executablePath: extracted.executablePath, args: extracted.args, headless: 'shell',
   env: { ...env, ...extracted.env } };
 } catch (error) {
  // execFile settles after child exit: no extractor can still write into this tree.
  await rm(directory, { recursive: true, force: true });
  throw error;
 }
 // Successful extraction is a warm runtime cache, not request-owned state. Never
 // delete it on a request deadline: another render may already be using it.
}

export function shouldUsePackagedBrowser(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
 // Explicit opt-in also overrides a developer's local executable for acceptance tests.
 return env.CREATIVE_STUDIO_PACKAGED_BROWSER === '1' ||
  (!env.PUPPETEER_EXECUTABLE_PATH && (env.VERCEL === '1' || env.NODE_ENV === 'production'));
}

export async function resolveBrowserLaunch(): Promise<BrowserLaunch> {
 if (!shouldUsePackagedBrowser()) return {
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/local/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'], headless: true,
 };
 // The full npm package ships Linux x64 binaries; no remote pack URL or download.
 if (process.platform !== 'linux' || process.arch !== 'x64') {
  throw new Error('Packaged creative renderer requires Linux x64; use an explicit local Chrome executable for development.');
 }
 packagedLaunch ??= extractPackagedBrowser().catch(error => {
  packagedLaunch = undefined;
  throw error;
 });
 const launch = await packagedLaunch;
 // Callers cannot mutate the cached args or child environment for other renders.
 return { ...launch, args: [...launch.args!], env: { ...launch.env } };
}
