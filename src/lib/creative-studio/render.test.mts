import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { DEFAULT_SCENE, RATIOS, LEGACY_RATIOS, PLACEMENTS } from './model.ts';
import { renderSceneHtml, loadRenderAssets, renderPng } from './render.ts';
test('Meta retains escaped editable text; Google images contain no ad copy; original logos are embedded',async()=>{
 const assets=await loadRenderAssets();
 for(const ratio of LEGACY_RATIOS) {
  const html=renderSceneHtml({...DEFAULT_SCENE,headline:'<img src=x onerror=alert(1)> Review first'},ratio,assets);
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt; Review first'));
  assert.ok(html.includes('Payment starts when you approve launch.'));
 }
 for(const ratio of RATIOS){
  const html=renderSceneHtml(DEFAULT_SCENE,ratio,assets);
  assert.ok(html.includes(`width:${PLACEMENTS[ratio].width}px`));
  assert.ok(!html.includes('<script'));assert.ok(!html.includes('https://'));
  if(PLACEMENTS[ratio].family==='google-image') {
   assert.ok(!html.includes(DEFAULT_SCENE.cta));assert.ok(!html.includes(assets.logoData));
   assert.ok(!html.includes('data-text'));assert.ok(!html.includes('<text'));
  }
  if(PLACEMENTS[ratio].family==='logo') {assert.ok(html.includes(assets.logoData));assert.ok(html.includes('object-fit:contain'));}
 }
});
test('real Chromium exports every registry placement with exact dimensions, format and budget',{skip:process.env.CREATIVE_STUDIO_RENDER_TEST!=='1'},async()=>{
 for(const ratio of RATIOS){
  const result=await renderPng(DEFAULT_SCENE,ratio);
  assert.equal(result.qaPassed,true,JSON.stringify({ratio,issues:result.issues}));
  const p=PLACEMENTS[ratio],metadata=await sharp(result.png).metadata();
  assert.equal(metadata.width,p.width);assert.equal(metadata.height,p.height);
  assert.equal(metadata.format,p.extension==='jpg'?'jpeg':'png');
  assert.equal(result.mimeType,p.mimeType);assert.ok(result.png.length<=p.maxBytes);
 }
});
test('large banner editable headline fails QA rather than silently clipping',{skip:process.env.CREATIVE_STUDIO_RENDER_TEST!=='1'},async()=>{
 const result=await renderPng({...DEFAULT_SCENE,headline:'W'.repeat(90)},'300x250');
 assert.equal(result.qaPassed,false);assert.ok(result.issues.some(i=>/overflow|safe zone|overlap/.test(i)));
});
