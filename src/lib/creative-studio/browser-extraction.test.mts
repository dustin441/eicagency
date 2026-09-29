import test from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { stat } from 'node:fs/promises';
import { resolveBrowserLaunch } from './browser-launch.ts';

test('failed or killed extraction removes only its own directory and permits retry', {skip:process.env.CREATIVE_STUDIO_PACKAGED_BROWSER!=='1'}, async t => {
 const directories:string[]=[];
 let calls=0;
 const mock=t.mock.method(childProcess,'execFile',(_file:string, _args:string[], options:{env:{TMPDIR:string};timeout:number;killSignal:string}, callback:(error:Error,stdout:string)=>void)=>{
  calls++;
  directories.push(options.env.TMPDIR);
  assert.equal(options.timeout,40000);
  assert.equal(options.killSignal,'SIGKILL');
  setImmediate(()=>callback(Object.assign(new Error('simulated extraction timeout'),{killed:true}),''));
 });
 syncBuiltinESMExports();
 try {
  const results=await Promise.allSettled([resolveBrowserLaunch(),resolveBrowserLaunch()]);
  assert.ok(results.every(result=>result.status==='rejected'));
  assert.equal(calls,1,'concurrent callers must share one extraction');
  await assert.rejects(stat(directories[0]),{code:'ENOENT'});
  await assert.rejects(resolveBrowserLaunch(),/simulated extraction timeout/);
  assert.equal(calls,2,'failure must reset the single-flight cache');
  assert.notEqual(directories[0],directories[1]);
  await assert.rejects(stat(directories[1]),{code:'ENOENT'});
 } finally {mock.mock.restore();syncBuiltinESMExports();}
});
