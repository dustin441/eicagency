import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as zod from 'zod';
import * as serviceModule from './creative-studio.ts';
import * as modelModule from '../lib/creative-studio/model.ts';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createStudioService } from './creative-studio.ts';
import { DEFAULT_BRIEF, DEFAULT_SCENE, getPack } from '../lib/creative-studio/model.ts';
import type { StudioState, Scene, Ratio } from '../lib/creative-studio/model.ts';

// TEST FIXTURE ONLY: bytes below are intentionally NOT a production PNG renderer.
const fixture = Buffer.from('TEST FIXTURE — fake renderer output');
const owner = { userId: randomUUID(), role: 'agency' as const };
const other = { userId: randomUUID(), role: 'super_admin' as const };
const create = { op: 'create', brief: DEFAULT_BRIEF, scene: DEFAULT_SCENE };

test('pack lifecycle: JPEG metadata, byte cap, pack revision, and legacy missing-pack reads',async t=>{
 const saved={...process.env};
 Object.assign(process.env,{CREATIVE_STUDIO_LOCAL_REVIEW:'1',NODE_ENV:'test'});delete process.env.VERCEL;
 const dataDir=await mkdtemp(path.join(tmpdir(),'eic-pack-test-'));
 t.after(async()=>{process.env=saved;await rm(dataDir,{recursive:true,force:true});});
 let oversized=false;
 const service=createStudioService({dataDir,render:async(_scene,_ratio,html)=>{
  assert.ok(html?.startsWith('<!doctype html>'));
  return {png:oversized?Buffer.alloc(150*1024+1):fixture,qaPassed:true,issues:[]};
 }});
 let project=await service.execute(owner,{...create,brief:{...DEFAULT_BRIEF,pack:'google-banners'}});
 const versionId=project.versions[0].id,projectId=project.id;
 const command={op:'render',projectId,versionId,ratio:'300x250'};
 oversized=true;
 project=await service.execute(owner,command);assert.equal(project.versions[0].exports['300x250']?.status,'failed');
 oversized=false;
 for(const ratio of getPack(project.versions[0].brief).placements){
  project=await service.execute(owner,{...command,ratio});
  const exp=project.versions[0].exports[ratio]!;
  assert.equal(exp.mimeType,'image/jpeg');assert.equal(exp.extension,'jpg');assert.equal(exp.sizeBytes,fixture.length);assert.match(exp.filename!,/\.jpg$/);
  assert.deepEqual(await service.readAsset(owner,projectId,versionId,ratio),fixture);
  await service.execute(owner,{op:'review',projectId,versionId,ratio,approved:true});
 }
 project=await service.execute(owner,{op:'approve',projectId,versionId});assert.ok(project.versions[0].approval);
 const html=await service.readPreview(owner,projectId,versionId,'300x250');
 project=await service.execute(owner,{op:'revise',projectId,expectedVersionId:versionId,brief:{...DEFAULT_BRIEF,pack:'google-assets'},scene:DEFAULT_SCENE});
 assert.equal(project.versions[1].approval,null);assert.deepEqual(project.versions[1].exports,{});
 assert.equal(await service.readPreview(owner,projectId,versionId,'300x250'),html);
 await assert.rejects(service.execute(owner,command),/Version changed/);
 for(const ratio of getPack(project.versions[1].brief).placements) assert.ok(await service.readPreview(owner,projectId,project.versions[1].id,ratio));
 // Emulate a pre-pack persisted brief; old saved HTML/assets remain readable.
 const legacy=await service.execute(owner,create);
 const filename=path.join(dataDir,`${owner.userId}.json`);
 const disk=JSON.parse(await readFile(filename,'utf8'));
 delete disk.projects.at(-1).versions[0].brief.pack;
 await writeFile(filename,JSON.stringify(disk));
 assert.equal((await service.list(owner)).projects.at(-1)!.versions[0].brief.pack,undefined);
 assert.ok(await service.readPreview(owner,legacy.id,legacy.versions[0].id,'1:1'));
});

test('HTTP handlers: TEST FIXTURE auth/render adapters, real disk, no network', async t => {
  const saved = { ...process.env };
  const dataDir = await mkdtemp(path.join(tmpdir(), 'eic-api-test-'));
  Object.assign(process.env, { CREATIVE_STUDIO_LOCAL_REVIEW: '1', CREATIVE_STUDIO_DATA_DIR: dataDir, NODE_ENV: 'test' }); delete process.env.VERCEL;
  t.after(async () => { process.env = saved; await rm(dataDir, { recursive: true, force: true }); });
  let user: { id: string } | null = { id: owner.userId };
  let profile: { role: string; client_access?: string[] } | null = { role: 'agency' };
  const query = { select() { return query; }, eq() { return query; }, async single() { return { data: profile, error: null }; } };
  const modules: Record<string, unknown> = {
    zod,
    '@/services/creative-studio': serviceModule,
    '@/lib/creative-studio/hosted-access': await import('../lib/creative-studio/hosted-access.ts'),
    '@/services/creative-studio-server': await import('./creative-studio-server.ts'),
    '@/lib/creative-studio/model': modelModule,
    '@/utils/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) }, from: () => query }) },
    '@/lib/creative-studio/render': { renderPng: async () => ({ png: fixture, issues: [], qaPassed: true }), loadRenderAssets: async () => ({}), renderSceneHtml: () => '<html>TEST FIXTURE</html>' },
  };
  const source = await readFile(new URL('../app/api/creative-studio/route.ts', import.meta.url), 'utf8');
  const exports: Record<string, (r: Request) => Promise<Response>> = {};
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: (name: string) => { assert.ok(name in modules); return modules[name]; }, process, Buffer, Response, Request, URL, Uint8Array, SyntaxError });
  const get = (query = '') => exports.GET(new Request(`http://localhost/api/creative-studio${query}`));
  const post = (body: unknown, origin = 'http://localhost', extra: Record<string, string> = {}) => exports.POST(new Request('http://localhost/api/creative-studio', { method: 'POST', headers: { origin, 'content-type': 'application/json', ...extra }, body: JSON.stringify(body) }));
  delete process.env.CREATIVE_STUDIO_LOCAL_REVIEW; assert.equal((await get()).status, 404); process.env.CREATIVE_STUDIO_LOCAL_REVIEW = '1';
  user = null; assert.equal((await get()).status, 401); user = { id: owner.userId };
  profile = null; assert.equal((await get()).status, 403);
  profile = { role: 'client' }; assert.equal((await get()).status, 403);
  profile = { role: 'client', client_access: ['nsi'] }; assert.equal((await get()).status, 403);
  profile = { role: 'client', client_access: ['eicagency'] }; assert.equal((await get()).status, 200);
  profile = { role: 'super_admin' }; assert.equal((await get()).status, 200);
  profile = { role: 'agency' };
  assert.equal((await post(create, 'https://attacker.example')).status, 403);
  assert.equal((await post(create, '')).status, 403);
  assert.equal((await post({ text: 'a'.repeat(21000) })).status, 413);
  assert.equal((await post(create, 'http://localhost', { 'content-length': '21000' })).status, 413);
  assert.equal((await post({ ...create, ownerId: other.userId })).status, 400);
  const response = await post(create); assert.equal(response.status, 200);
  const project = await response.json(); const versionId = project.versions[0].id;
  const assetQuery = `?projectId=${project.id}&versionId=${versionId}&ratio=1%3A1`;
  assert.equal((await get(`${assetQuery}&format=png`)).status, 404);
  assert.equal((await post({ op: 'render', projectId: project.id, versionId, ratio: '1:1' })).status, 200);
  const png = await get(`${assetQuery}&format=png`); assert.equal(png.status, 200); assert.equal(png.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await png.arrayBuffer()), fixture);
  const html = await get(`${assetQuery}&format=html`); assert.equal(html.status, 200); assert.match(html.headers.get('content-security-policy')!, /sandbox/);
  assert.equal((await get('?projectId=..%2Fescape')).status, 400);
  user = { id: other.userId };
  assert.equal((await get(`${assetQuery}&format=png`)).status, 404);
  assert.equal((await get(`${assetQuery}&format=html`)).status, 404);
});

test('local disk lifecycle, strict ownership, immutable revisions, retry and approval gates', async t => {
  const saved = { ...process.env };
  process.env.CREATIVE_STUDIO_LOCAL_REVIEW = '1'; Object.assign(process.env, { NODE_ENV: 'test' }); delete process.env.VERCEL;
  const dataDir = await mkdtemp(path.join(tmpdir(), 'eic-studio-test-'));
  t.after(async () => { process.env = saved; await rm(dataDir, { recursive: true, force: true }); });
  let calls = 0; let fail = false; let qa = true;
  const render = async (_scene: Scene, _ratio: Ratio, savedHtml?: string) => {
    assert.ok(savedHtml?.includes('data:font/ttf;base64,'), 'renderer receives immutable saved recipe, not regenerated HTML');
    calls++;
    const state: StudioState = JSON.parse(await readFile(path.join(dataDir, `${owner.userId}.json`), 'utf8'));
    assert.ok(state.projects.some(p => p.versions.some(v => v.jobs.some(j => j.status === 'running'))), 'intent saved before rendering');
    if (fail) throw new Error('TEST FIXTURE failure with secret path');
    return { png: fixture, issues: qa ? [] : ['TEST FIXTURE QA failure'], qaPassed: qa };
  };
  let service = createStudioService({ dataDir, render });
  let project = await service.execute(owner, create);
  const projectId = project.id; const versionId = project.versions[0].id;
  const command = { op: 'render', projectId, versionId, ratio: '1:1' };
  await t.test('reject malformed IDs, injected tenant/status, unsupported claims and stage', async () => {
    await assert.rejects(service.execute(owner, { ...command, projectId: '../escape' }));
    await assert.rejects(service.readAsset(owner, '../escape', versionId, '1:1'));
    await assert.rejects(service.execute(owner, { ...create, tenantId: 'another' }));
    await assert.rejects(service.execute(owner, { ...create, status: 'approved' }));
    await assert.rejects(service.execute(owner, { ...create, brief: { ...DEFAULT_BRIEF, stage: 'Interest' } }));
    await assert.rejects(service.execute(owner, { ...create, scene: { ...DEFAULT_SCENE, headline: 'Guaranteed results now' } }));
  });
  const initialHtml = await service.readPreview(owner, projectId, versionId, '1:1');
  await t.test('inactive placements cannot render or review and are not composed',async()=>{
    await assert.rejects(service.execute(owner,{...command,ratio:'16:9'}),/pack/);
    await assert.rejects(service.execute(owner,{op:'review',projectId,versionId,ratio:'google-square',approved:false}),/pack/);
    await assert.rejects(service.readPreview(owner,projectId,versionId,'16:9'),/missing/);
  });
  await t.test('exact HTML recipes and source provenance are saved at composition', async () => {
    assert.ok(initialHtml.includes(DEFAULT_SCENE.cta));
    assert.equal(project.versions[0].sourceSnapshot?.sources.length, DEFAULT_BRIEF.sourceIds.length);
    assert.ok(project.versions[0].sourceSnapshot?.warnings.length);
    for (const ratio of getPack(DEFAULT_BRIEF).placements) assert.ok((await service.readPreview(owner, projectId, versionId, ratio)).includes('data:image/svg+xml;base64,'));
    await assert.rejects(service.readPreview(other, projectId, versionId, '1:1'), /not found/);
  });
  await t.test('owner separation including super admin', async () => {
    assert.deepEqual((await service.list(other)).projects, []);
    await assert.rejects(service.execute(other, command), /not found/);
    await assert.rejects(service.readAsset(other, projectId, versionId, '1:1'), /not found/);
  });
  await t.test('explicit review and all ratios required; serialized duplicate render cache', async () => {
    await assert.rejects(service.execute(owner, { op: 'approve', projectId, versionId }));
    await assert.rejects(service.execute(owner, { op: 'review', projectId, versionId, ratio: '1:1', approved: true }));
    await Promise.all([service.execute(owner, command), createStudioService({ dataDir, render }).execute(owner, command)]);
    assert.equal(calls, 1);
    assert.deepEqual(await service.readAsset(owner, projectId, versionId, '1:1'), fixture);
    for (const ratio of getPack(DEFAULT_BRIEF).placements) await service.execute(owner, { ...command, ratio });
    await assert.rejects(service.execute(owner, { op: 'approve', projectId, versionId }));
    for (const ratio of getPack(DEFAULT_BRIEF).placements) await service.execute(owner, { op: 'review', projectId, versionId, ratio, approved: true });
    project = await service.execute(owner, { op: 'approve', projectId, versionId });
    assert.equal(project.versions[0].approval?.userId, owner.userId);
  });
  await t.test('reopen persistence, immutable historical content, fresh revision and stale rejection', async () => {
    service = createStudioService({ dataDir, render });
    assert.deepEqual((await service.list(owner)).projects[0], project);
    const historical = structuredClone(project.versions[0]);
    project = await service.execute(owner, { op: 'revise', projectId, expectedVersionId: versionId, brief: DEFAULT_BRIEF, scene: { ...DEFAULT_SCENE, logoPosition: 'right' } });
    assert.deepEqual(project.versions[0], historical);
    assert.equal(await service.readPreview(owner, projectId, versionId, '1:1'), initialHtml);
    assert.notEqual(await service.readPreview(owner, projectId, project.versions[1].id, '1:1'), initialHtml);
    assert.deepEqual(project.versions[1].exports, {}); assert.deepEqual(project.versions[1].reviews, {});
    assert.equal(project.versions[1].approval, null); assert.deepEqual(project.versions[1].jobs, []);
    await assert.rejects(service.execute(owner, { op: 'revise', projectId, expectedVersionId: versionId, brief: DEFAULT_BRIEF, scene: DEFAULT_SCENE }), /Version changed/);
    await assert.rejects(service.execute(owner, { op: 'approve', projectId, versionId }), /Version changed/);
  });
  await t.test('render failures persist visibly, block approval and can retry', async () => {
    fail = true;
    const current = project.versions[1].id;
    project = await service.execute(owner, { ...command, versionId: current });
    assert.equal(project.versions[1].jobs[0].status, 'failed');
    assert.equal(project.versions[1].exports['1:1']?.status, 'failed');
    assert.ok(!JSON.stringify(project).includes('secret path'));
    assert.equal((await createStudioService({ dataDir, render }).list(owner)).projects[0].versions[1].jobs[0].status, 'failed');
    await assert.rejects(service.execute(owner, { op: 'approve', projectId, versionId: current }));
    fail = false;
    project = await service.execute(owner, { ...command, versionId: current });
    assert.equal(project.versions[1].exports['1:1']?.status, 'complete');
  });
  await t.test('QA failure disallows human pass and approval', async () => {
    qa = false;
    const current = project.versions[1].id;
    await service.execute(owner, { ...command, versionId: current, ratio: '4:5' });
    await assert.rejects(service.execute(owner, { op: 'review', projectId, versionId: current, ratio: '4:5', approved: true }));
    qa = true;
  });
  await t.test('restart recovers persisted running job', async () => {
    const filename = path.join(dataDir, `${owner.userId}.json`);
    const disk: StudioState = JSON.parse(await readFile(filename, 'utf8'));
    const version = disk.projects[0].versions[1];
    version.jobs.push({ id: randomUUID(), versionId: version.id, ratio: '9:16', status: 'running', provider: 'chromium', costUsd: 0, startedAt: new Date().toISOString() });
    await writeFile(filename, JSON.stringify(disk));
    const before = calls;
    const recovered = await createStudioService({ dataDir, render }).list(owner);
    assert.equal(calls, before + 1);
    assert.equal(recovered.projects[0].versions[1].jobs.at(-1)?.status, 'complete');
    await service.list(owner); assert.equal(calls, before + 1);
  });
  await t.test('environment and storage fail closed', async () => {
    delete process.env.CREATIVE_STUDIO_LOCAL_REVIEW;
    await assert.rejects(service.list(owner), /disabled/);
    process.env.CREATIVE_STUDIO_LOCAL_REVIEW = '1'; Object.assign(process.env, { NODE_ENV: 'production' });
    await assert.rejects(service.list(owner), /disabled/);
    Object.assign(process.env, { NODE_ENV: 'test' }); process.env.VERCEL = '0';
    await assert.rejects(service.list(owner), /disabled/); delete process.env.VERCEL;
    assert.throws(() => createStudioService({ dataDir: 'relative', render }), /absolute/);
    await assert.rejects(createStudioService({ dataDir: path.join(process.cwd(), 'disallowed-data'), render }).list(owner), /outside/);
    await assert.rejects(service.list({ userId: owner.userId, role: 'unknown' } as never));
  });
});
