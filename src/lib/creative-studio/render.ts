
import { renderEditableHtml } from './editable-renderer.ts';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { RenderDeadline, RENDER_TIMEOUT_MS } from './render-deadline.ts';
import { resolveBrowserLaunch } from './browser-launch.ts';
import { renderConceptHtml } from './concept-renderer.ts';
import { renderMathHtml } from './math-renderer.ts';
import { renderNativeHtml, isNativeConcept } from './native-renderer.ts';
import { renderComparisonHtml, isComparisonConcept } from './comparison-renderer.ts';
import { OFFER, PLACEMENTS, SceneSchema, RatioSchema, validateSceneClaims, type Scene, type Ratio, type Placement } from './model.ts';

export type RenderAssets = {logoData:string;fontData:string};
export async function loadRenderAssets():Promise<RenderAssets> {
 const root=path.join(process.cwd(),'assets/creative-studio');
 const [logo,font]=await Promise.all([readFile(path.join(root,'eic-primary.svg')),readFile(path.join(root,'Montserrat.ttf'))]);
 return {logoData:`data:image/svg+xml;base64,${logo.toString('base64')}`,fontData:`data:font/ttf;base64,${font.toString('base64')}`};
}
function escapeHtml(text:string) { return text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)); }
export function renderSceneHtml(input:Scene,ratioInput:Ratio,assets:RenderAssets):string {
 const scene=SceneSchema.parse(input),ratio=RatioSchema.parse(ratioInput),p=PLACEMENTS[ratio];
 if(!/^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/.test(assets.logoData)|| !/^data:font\/ttf;base64,[A-Za-z0-9+/=]+$/.test(assets.fontData)) throw new Error('Invalid trusted render assets');
 if(scene.template==='editable-note-v2'||scene.template==='benefit-comparison-v2') return renderEditableHtml(scene,ratio);
 if(isComparisonConcept(scene.template)) return renderComparisonHtml(scene,ratio);
 if(isNativeConcept(scene.template)) return renderNativeHtml(scene,ratio);
 if(scene.template==='one-client-math') return renderMathHtml(scene,ratio,assets);
 if(scene.template!=='launch-tracker-v1') return renderConceptHtml(scene,ratio,assets);
 if(p.family!=='meta') return renderPlatformHtml(scene,ratio,assets);
 const landscape=ratio==='16:9',story=ratio==='9:16',square=ratio==='1:1';
 const headline=(landscape?100:story?86:square?66:78)*scene.headlineScale;
 const rows=OFFER.steps.map((step,i)=>`<div class="step" data-qa-box><div class="number">${String(i+1).padStart(2,'0')}</div><div class="step-copy"><h2 data-text>${escapeHtml(step.title)}</h2><p data-text>${escapeHtml(step.detail)}</p></div></div>`).join('');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>EIC creative draft</title><style>
 @font-face{font-family:Montserrat;src:url('${assets.fontData}') format('truetype');font-style:normal;font-weight:100 900;font-display:block}
 *{box-sizing:border-box}html,body{margin:0;width:${p.width}px;height:${p.height}px;background:#f8faf7;color:#17211d;font-family:Montserrat,Arial,sans-serif}body{overflow:hidden}
 #art{position:relative;width:${p.width}px;height:${p.height}px;background:linear-gradient(120deg,#fff 0%,#f3f7f4 100%);padding:${p.insetY}px ${p.insetX}px;overflow:hidden}
 #safe{height:100%;display:flex;flex-direction:column;gap:${square?22:32}px}
 header{display:flex;align-items:center;justify-content:space-between;gap:40px;flex-shrink:0;${scene.logoPosition==='right'?'flex-direction:row-reverse;':''}}
 .logo{width:${landscape?150:120}px;height:${landscape?110:82}px;object-fit:contain;display:block}
 .label{font-size:${landscape?22:18}px;letter-spacing:3px;font-weight:600;max-width:520px;text-align:${scene.logoPosition==='right'?'left':'right'}}
 .main{display:${landscape?'grid':'flex'};${landscape?'grid-template-columns:1.08fr 1fr;align-items:center;gap:95px;':'flex-direction:column;gap:'+ (square?14:24)+'px;'}flex:1;min-height:0}
 .intro{min-width:0}.eyebrow{font-size:${square?19:22}px;letter-spacing:3px;font-weight:600;color:#245744;margin:0 0 ${square?12:20}px}
 h1{font-size:${headline}px;line-height:1.06;padding-bottom:12px;letter-spacing:-2.8px;font-weight:600;margin:0;white-space:pre-line;overflow-wrap:break-word}
 .subhead{font-size:${square?24:landscape?30:28}px;line-height:1.45;margin:${square?18:26}px 0 0;white-space:pre-line;overflow-wrap:break-word}
 .tracker{background:#fff;border:1px solid #d4ddd7;border-radius:12px;padding:${square?16:28}px ${square?26:32}px;box-shadow:0 12px 40px #122f2010;min-width:0}
 .tracker-title{font-size:${square?17:20}px;letter-spacing:2px;font-weight:600;padding:0 0 ${square?12:20}px;border-bottom:1px solid #dce4de;display:flex;justify-content:space-between;gap:20px}
 .tracker-title span:last-child{color:#315d4a;font-size:${square?15:18}px;letter-spacing:0}
 .step{display:flex;gap:${square?19:26}px;align-items:center;padding:${square?13:landscape?24:18}px 0;position:relative;border-bottom:1px solid #e5ebe7}
 .step:last-child{border-bottom:none}.number{display:flex;align-items:center;justify-content:center;flex-shrink:0;width:${square?40:54}px;height:${square?40:54}px;background:#c8eee2;color:#153e2d;border-radius:50%;font-weight:600;font-size:${square?17:22}px}
 .step:last-child .number{background:#E84C00;color:#111}.step-copy{min-width:0}h2{font-size:${square?24:landscape?32:29}px;font-weight:600;line-height:1.2;margin:0 0 5px}p{margin:0}.step p{font-size:${square?18:landscape?23:21}px;line-height:1.4;color:#42574b}
 footer{flex-shrink:0;display:${landscape?'grid':'flex'};${landscape?'grid-template-columns:1fr 1fr;gap:95px;align-items:center;':'flex-direction:column;gap:16px;'}}
 .cta{display:inline-flex;align-items:center;justify-content:space-between;gap:30px;background:#172d22;color:#fff;padding:${square?17:22}px 28px;border-radius:8px;font-size:${square?25:30}px;font-weight:600;line-height:1.25;width:fit-content;max-width:100%;overflow-wrap:break-word}
 .cta b{font-size:30px;font-weight:400;flex-shrink:0}.terms{font-size:${square?16:19}px;line-height:1.5;color:#42574b}.terms strong{display:block;font-size:${square?19:23}px;font-weight:600;color:#17211d;margin-bottom:6px}
 </style></head><body><div id="art"><div id="safe"><header data-qa-box><img class="logo" alt="EIC" src="${assets.logoData}"><div class="label" data-text>YOUR AGENCY.<br>OUR PAID MEDIA TEAM.</div></header><div class="main"><section class="intro" data-qa-box><p class="eyebrow" data-text>${OFFER.kicker}</p><h1 data-text>${escapeHtml(scene.headline)}</h1><p class="subhead" data-text>${escapeHtml(scene.subhead)}</p></section><section class="tracker" data-qa-box><div class="tracker-title" data-text><span>YOUR LAUNCH PLAN</span><span>You stay in control</span></div>${rows}</section></div><footer data-qa-box><div class="cta" data-text><span>${escapeHtml(scene.cta)}</span><b aria-hidden="true">↗</b></div><div class="terms" data-text><strong>${OFFER.footer}</strong>${OFFER.disclosure}</div></footer></div></div></body></html>`;
}
function renderPlatformHtml(scene:Scene,ratio:Ratio,assets:RenderAssets):string {
 const p=PLACEMENTS[ratio];
 let css='',body='';
 if(p.family==='google-image') {
  // Abstract planning illustration, never a fabricated dashboard, testimonial or result.
  css='#safe{display:grid;place-items:center}svg{width:100%;height:100%}';
  body=`<svg viewBox="0 0 1000 850" role="img" aria-label="Abstract planning and collaboration illustration"><circle cx="500" cy="425" r="360" fill="#d9eee5"/><path d="M190 600 Q500 790 830 290" fill="none" stroke="#94cbb5" stroke-width="26"/><g transform="rotate(-9 400 400)"><rect x="155" y="180" width="420" height="490" rx="32" fill="#245744"/><rect x="183" y="205" width="364" height="430" rx="20" fill="white"/><rect x="230" y="260" width="185" height="20" rx="10" fill="#9fbfb0"/><rect x="230" y="315" width="265" height="15" rx="7" fill="#dae6df"/><rect x="230" y="355" width="225" height="15" rx="7" fill="#dae6df"/><rect x="230" y="415" width="105" height="145" rx="16" fill="#b8dfce"/><rect x="355" y="415" width="140" height="145" rx="16" fill="#e9f1ec"/></g><g transform="rotate(11 690 510)"><rect x="530" y="360" width="310" height="260" rx="28" fill="#fff" stroke="#a9c9ba" stroke-width="3"/><circle cx="610" cy="440" r="26" fill="#E84C00"/><rect x="662" y="424" width="120" height="18" rx="9" fill="#aacdbb"/><rect x="575" y="500" width="220" height="16" rx="8" fill="#dce8e1"/><rect x="575" y="542" width="160" height="16" rx="8" fill="#dce8e1"/></g><circle cx="780" cy="210" r="43" fill="#E84C00"/><circle cx="245" cy="730" r="22" fill="#009C77"/></svg>`;
 } else if(p.family==='logo') {
  css=`#art{background:white}#safe{display:grid;place-items:center;min-height:0;min-width:0}.logo{width:${p.width-2*p.insetX}px;height:${p.height-2*p.insetY}px;object-fit:contain}`;
  body=`<img data-qa-box class="logo" src="${assets.logoData}" alt="EIC original primary logo">`;
 } else {
  const tiny=ratio==='320x50',horizontal=p.height<=100,large=ratio==='970x250',narrow=ratio==='160x600';
  const headline=tiny?'Free media plan.':horizontal?'Approve launch. Then pay.':scene.headline;
  const font=tiny?17:horizontal?20:large?38:narrow?25:p.height>=600?36:26;
  css=`#safe{display:flex;${horizontal||large?'flex-direction:row;align-items:center;':'flex-direction:column;'}gap:${tiny?12:horizontal?16:14}px}.logo{object-fit:contain;flex-shrink:0;width:${tiny?42:horizontal?54:large?105:65}px;height:${tiny?34:horizontal?58:large?90:46}px}.copy{min-width:0;${horizontal||large?'flex:1;':''}}h1{font-size:${font*(!horizontal?scene.headlineScale:1)}px;line-height:1.12;margin:0;white-space:pre-line;overflow-wrap:anywhere;font-weight:600;letter-spacing:-.6px}p{font-size:${large?20:14}px;line-height:1.35;margin:12px 0 0}.terms{font-size:${large?16:12}px;line-height:1.4;margin-top:${horizontal?5:14}px}.accent{width:40px;height:5px;background:#E84C00;margin-bottom:12px}`;
  if(large) css+='.copy{display:grid;grid-template-columns:1.1fr 1fr;column-gap:24px;align-items:center}.accent{display:none}h1{grid-row:1 / 3}p,.terms{grid-column:2;margin:6px 0}';
  if(ratio==='300x250'||ratio==='336x280') css+='#safe{gap:8px}.logo{height:30px;width:48px}h1{font-size:22px}.accent{display:none}p{margin-top:7px;font-size:12px}.terms{margin-top:7px;font-size:11px}';
  body=`<img data-qa-box class="logo" src="${assets.logoData}" alt="EIC"><section class="copy" data-qa-box>${!horizontal?'<div class="accent"></div>':''}<h1 data-text>${escapeHtml(headline)}</h1>${!horizontal?'<p data-text>Free media plan.<br>Campaign setup, ads + tracking.</p>':''}${!tiny?`<div class="terms" data-text>${horizontal?'No obligation. Ad spend separate.':'Pay when you approve launch.<br>No obligation to launch.<br>Ad spend is separate.'}</div>`:''}</section>`;
 }
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>EIC static asset draft</title><style>@font-face{font-family:Montserrat;src:url('${assets.fontData}') format('truetype');font-style:normal;font-weight:100 900;font-display:block}*{box-sizing:border-box}html,body{margin:0;width:${p.width}px;height:${p.height}px;font-family:Montserrat,Arial,sans-serif;color:#17211d}#art{width:${p.width}px;height:${p.height}px;padding:${p.insetY}px ${p.insetX}px;background:#f3f7f4;overflow:hidden}#safe{width:100%;height:100%}${css}</style></head><body><div id="art"><div id="safe">${body}</div></div></body></html>`;
}
// Historical field name `png` holds encoded bytes; inspect mimeType/extension for JPEG banners.
export type RenderResult={png:Buffer;issues:string[];qaPassed:boolean;mimeType:'image/png'|'image/jpeg';extension:'png'|'jpg';sizeBytes:number;width:number;height:number};
export async function renderPng(scene:Scene,ratio:Ratio,savedHtml?:string,savedPlacement?:Placement,timeoutMs=RENDER_TIMEOUT_MS):Promise<RenderResult> {
 const deadline=new RenderDeadline(timeoutMs);
 try {
 SceneSchema.parse(scene);RatioSchema.parse(ratio);
 const p=savedPlacement??PLACEMENTS[ratio];
 const html=savedHtml??renderSceneHtml(scene,ratio,await deadline.run(loadRenderAssets));
 const launchOptions=await deadline.run(resolveBrowserLaunch);
 const browser=await deadline.run(async()=>{
  const launched=await puppeteer.launch({...launchOptions,signal:deadline.signal,timeout:timeoutMs});
  deadline.attach(launched);
  return launched;
 });
 return await deadline.run(async()=>{
  const page=await browser.newPage();await page.setViewport({width:p.width,height:p.height,deviceScaleFactor:1});
  await page.setRequestInterception(true);page.on('request',req=>req.url().startsWith('data:')||req.url()==='about:blank'?void req.continue():void req.abort());
  await page.setContent(html,{waitUntil:'load',timeout:20000});
  // Text-free image/logo placements do not trigger lazy @font-face loading.
  await page.evaluate(async()=>{await document.fonts.load('600 32px Montserrat');await document.fonts.ready;await Promise.all(Array.from(document.images).map(i=>i.decode()));});
  const issues=await page.evaluate(({width,height,insetX,insetY})=>{
   const problems:string[]=[];
   if(!document.fonts.check('600 32px Montserrat'))problems.push('Required font did not load');
   for(const img of Array.from(document.images))if(!img.complete||!img.naturalWidth)problems.push('Logo failed to load');
   for(const e of Array.from(document.querySelectorAll<HTMLElement>('[data-qa-box],[data-text]'))){
    const r=e.getBoundingClientRect();
    if(r.left<insetX-1||r.top<insetY-1||r.right>width-insetX+1||r.bottom>height-insetY+1)problems.push(`Outside draft safe zone: ${e.textContent?.slice(0,45)}`);
    if(e.scrollHeight>e.clientHeight+2||e.scrollWidth>e.clientWidth+2)problems.push(`Content overflow: ${e.textContent?.slice(0,45)}`);
   }
   const sections=Array.from(document.querySelectorAll('.intro,.tracker,footer,#safe > .logo,#safe > .copy')).map(e=>e.getBoundingClientRect());
   const overlap=(a:DOMRect,b:DOMRect)=>a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1;
   if(sections.some((a,i)=>sections.slice(i+1).some(b=>overlap(a,b))))problems.push('Creative sections overlap');
   // Concept artwork intentionally layers its stamp/bubbles; only copy regions must stay distinct.
   for(const [heading,art] of [['.job-head','.job-paper'],['.comm-head','.conversation-art']]) {
    const a=document.querySelector(heading)?.getBoundingClientRect(),b=document.querySelector(art)?.getBoundingClientRect();
    if(a&&b&&a.bottom>b.top)problems.push('Concept headline overlaps artwork');
   }
   const paper=document.querySelector('.paper');
   if(paper) {const bounds=paper.getBoundingClientRect();for(const e of paper.querySelectorAll('[data-text]'))if(e.getBoundingClientRect().bottom>bounds.bottom-20)problems.push('Receipt copy exceeds paper');}
   return problems;
  },p);
  issues.push(...validateSceneClaims(scene));
  const clip={x:0,y:0,width:p.width,height:p.height};
  let png:Buffer;
  if(p.mimeType==='image/jpeg') {
   png=Buffer.from(await page.screenshot({type:'jpeg',quality:85,clip}));
   for(const quality of [70,55,40]) {if(png.length<=p.maxBytes)break;png=Buffer.from(await page.screenshot({type:'jpeg',quality,clip}));}
  } else png=Buffer.from(await page.screenshot({type:'png',clip}));
  if(png.length>p.maxBytes) throw new Error('Encoded asset exceeds placement byte limit.');
  return {png,issues:[...new Set(issues)],qaPassed:issues.length===0,mimeType:p.mimeType,extension:p.extension,sizeBytes:png.length,width:p.width,height:p.height};
 });
 } finally{await deadline.close();}
}
