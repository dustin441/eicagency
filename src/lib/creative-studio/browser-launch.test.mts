import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import puppeteer from 'puppeteer-core';
import { RenderDeadline, RenderTimeoutError } from './render-deadline.ts';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { shouldUsePackagedBrowser, resolveBrowserLaunch } from './browser-launch.ts';
import { DEFAULT_SCENE } from './model.ts';
import { renderPng } from './render.ts';

test('packaged defaults and explicit local/acceptance overrides', () => {
 assert.equal(shouldUsePackagedBrowser({}), false);
 assert.equal(shouldUsePackagedBrowser({NODE_ENV:'production'}), true);
 assert.equal(shouldUsePackagedBrowser({VERCEL:'1'}), true);
 assert.equal(shouldUsePackagedBrowser({NODE_ENV:'production',PUPPETEER_EXECUTABLE_PATH:'/local'}), false);
 assert.equal(shouldUsePackagedBrowser({CREATIVE_STUDIO_PACKAGED_BROWSER:'1',PUPPETEER_EXECUTABLE_PATH:'/invalid'}), true);
});

test('packaged binary exports real square with font/logo and passing QA', {skip:process.env.CREATIVE_STUDIO_PACKAGED_BROWSER!=='1'}, async () => {
 const started=Date.now();
 const originalEnv={...process.env};
 const sharedBinary=join(tmpdir(),'chromium');
 const sharedBefore=await stat(sharedBinary).catch(()=>undefined);
 // One cold extraction serves simultaneous resolves/renders, even when another
 // request expires while waiting. A timed-out caller must not remove the cache.
 const deadline=new RenderDeadline(1);
 const expired=assert.rejects(deadline.run(resolveBrowserLaunch),RenderTimeoutError);
 const [result,first,second]=await Promise.all([renderPng(DEFAULT_SCENE,'1:1'),resolveBrowserLaunch(),resolveBrowserLaunch()]);
 await expired;await deadline.close();
 assert.ok(JSON.stringify({...process.env})===JSON.stringify(originalEnv),'resolver must not mutate parent environment');
 assert.equal(first.executablePath,second.executablePath);
 assert.notEqual(first.executablePath,sharedBinary);
 assert.equal(dirname(first.executablePath!),first.env!.TMPDIR);
 assert.equal((await stat(dirname(first.executablePath!))).mode & 0o777,0o700);
 assert.deepEqual(await stat(sharedBinary).catch(()=>undefined),sharedBefore);
 const coldMs=Date.now()-started;
 const warmStarted=Date.now();
 const warm=await renderPng(DEFAULT_SCENE,'1:1');
 assert.equal(warm.qaPassed,true,JSON.stringify(warm.issues));
 assert.deepEqual(warm.png,result.png);
 const parallel=await Promise.all([renderPng(DEFAULT_SCENE,'1:1'),renderPng(DEFAULT_SCENE,'1:1')]);
 for(const output of parallel){assert.equal(output.qaPassed,true);assert.deepEqual(output.png,result.png);}
 assert.ok(JSON.stringify({...process.env})===JSON.stringify(originalEnv),'resolver must not mutate parent environment');
 const warmAndParallelMs=Date.now()-warmStarted;
 const metadata=await sharp(result.png).metadata();
 assert.equal(result.qaPassed,true,JSON.stringify(result.issues));
 assert.equal(metadata.format,'png');assert.equal(metadata.width,1080);assert.equal(metadata.height,1080);
 const launch=await resolveBrowserLaunch();
 assert.notEqual(launch.executablePath,process.env.PUPPETEER_EXECUTABLE_PATH);
 assert.equal(launch.headless,'shell');
 const executable=launch.executablePath!;
 const evidence={coldMs,warmAndParallelMs,elapsedMs:Date.now()-started,executable,browserVersion:execFileSync(executable,['--version'],{encoding:'utf8',env:{...process.env,...launch.env}}).trim(),binaryBytes:(await stat(executable)).size,binarySha256:createHash('sha256').update(await readFile(executable)).digest('hex'),pngSha256:createHash('sha256').update(result.png).digest('hex'),sizeBytes:result.sizeBytes,metadata,issues:result.issues,qaPassed:result.qaPassed,node:process.version,platform:process.platform,arch:process.arch};
 if(process.env.CREATIVE_STUDIO_RENDER_EVIDENCE_DIR){const dir=process.env.CREATIVE_STUDIO_RENDER_EVIDENCE_DIR;await mkdir(dir,{recursive:true});await writeFile(`${dir}/square.png`,result.png);await writeFile(`${dir}/evidence.json`,JSON.stringify(evidence,null,2)+'\n');}
 console.log(JSON.stringify(evidence));
});

test('real packaged browser is killed on deadline and warm cache remains usable', {skip:process.env.CREATIVE_STUDIO_PACKAGED_BROWSER!=='1'}, async () => {
 const launch=await resolveBrowserLaunch();
 const browser=await puppeteer.launch(launch);
 const child=browser.process()!;
 const page=await browser.newPage();
 const deadline=new RenderDeadline(100);
 deadline.attach(browser);
 try {
  await assert.rejects(deadline.run(()=>page.evaluate(()=>new Promise(()=>{}))),RenderTimeoutError);
  await assert.rejects(deadline.close(),RenderTimeoutError);
  await new Promise<void>((resolve,reject)=>{
   if(child.exitCode!==null||child.signalCode!==null)return resolve();
   const timer=setTimeout(()=>reject(new Error('Browser did not exit after deadline')),5000);
   child.once('exit',()=>{clearTimeout(timer);resolve();});
  });
  assert.equal(child.signalCode,'SIGKILL');
  assert.equal((await resolveBrowserLaunch()).executablePath,launch.executablePath);
  assert.equal((await renderPng(DEFAULT_SCENE,'1:1')).qaPassed,true);
  console.log(JSON.stringify({deadlineCleanup:true,pid:child.pid,signal:child.signalCode,warmRecovery:true}));
 } finally {await browser.close().catch(()=>{});}
});
