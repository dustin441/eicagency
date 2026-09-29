import test from 'node:test';
import assert from 'node:assert/strict';
import type { Browser } from 'puppeteer-core';
import { RenderDeadline, RenderTimeoutError } from './render-deadline.ts';
function fake(hung=false){const events:string[]=[];const browser={process:()=>({kill:()=>events.push('kill')}),disconnect:async()=>{events.push('disconnect')},close:async()=>{events.push('close');if(hung)await new Promise(()=>{})}} as unknown as Browser;return {browser,events};}
test('deadline rejects invalid bounds',()=>{for(const n of [0,-1,NaN,Infinity,45001])assert.throws(()=>new RenderDeadline(n));});
test('normal completion closes owned browser',async()=>{const d=new RenderDeadline(1000),f=fake();d.attach(f.browser);assert.equal(await d.run(async()=>42),42);await d.close();assert.deepEqual(f.events,['close']);});
test('hung stage terminates owned browser and prevents later work',async()=>{const d=new RenderDeadline(20),f=fake();d.attach(f.browser);await assert.rejects(d.run(()=>new Promise(()=>{})),RenderTimeoutError);let ran=false;await assert.rejects(d.run(async()=>{ran=true}),RenderTimeoutError);assert.equal(ran,false);assert.ok(f.events.includes('kill'));await assert.rejects(d.close(),RenderTimeoutError);});
test('hung graceful close cannot escape overall deadline',async()=>{const d=new RenderDeadline(20),f=fake(true);d.attach(f.browser);await assert.rejects(d.close(),RenderTimeoutError);assert.ok(f.events.includes('kill'));});
test('late browser attachment after expiry terminates immediately',async()=>{const d=new RenderDeadline(20),f=fake();await assert.rejects(d.run(()=>new Promise(()=>{})),RenderTimeoutError);assert.throws(()=>d.attach(f.browser),RenderTimeoutError);assert.ok(f.events.includes('kill'));await assert.rejects(d.close(),RenderTimeoutError);});
