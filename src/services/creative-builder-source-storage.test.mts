import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import sharp from 'sharp';
import {
  createCreativeBuilderSourceStorage,
  CreativeBuilderSourceStorageError,
  type BuilderImageReceipt,
  type CreativeBuilderImageCanonicalResolver,
  type CreativeBuilderPrivateObjectProvider,
} from './creative-builder-source-storage.ts';
import {fetchCreativeBuilderRemoteBytes, type ScannerRequest} from './creative-builder-page-scan.ts';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const PROJECT = '33333333-3333-4333-8333-333333333333';
const SCAN = '44444444-4444-4444-8444-444444444444';
const JOB = '55555555-5555-4555-8555-555555555555';
const ASSET = '66666666-6666-4666-8666-666666666666';
const input = {projectId: PROJECT, scanId: SCAN, candidateId: 'asset_landing_1'};
const context = Object.freeze({tenantId: 'eicagency' as const, ownerId: OWNER});
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

class MemoryObjects implements CreativeBuilderPrivateObjectProvider {
  readonly values = new Map<string, {bytes: Buffer; contentType: string}>();
  puts = 0;
  async putCreateOnly(_bucket: string, key: string, bytes: Uint8Array, options: {contentType: 'image/webp'}) {
    this.puts += 1;
    if (this.values.has(key)) return 'exists' as const;
    this.values.set(key, {bytes: Buffer.from(bytes), contentType: options.contentType});
    return 'created' as const;
  }
  async get(_bucket: string, key: string) { return this.values.get(key) ?? null; }
  async remove(_bucket: string, key: string) { return this.values.delete(key) ? 'removed' as const : 'not-found' as const; }
}

function fixture(mimeType: 'image/jpeg' | 'image/png' | 'image/webp', bytes: Buffer) {
  return async (_url: string, maxBytes: number) => {
    assert.ok(bytes.length <= maxBytes);
    return {bytes, mimeType, finalUrl: 'https://example.com/final'};
  };
}
function receipt(bytes: Buffer, width: number, height: number): BuilderImageReceipt {
  return {sha256: hash(bytes), mimeType: 'image/webp', width, height, sizeBytes: bytes.length};
}
function harness(source: Buffer, mimeType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/png') {
  const objects = new MemoryObjects();
  let finalized: {assetId: string; receipt: BuilderImageReceipt} | undefined;
  let failAfterFinalize = false;
  let fetches = 0;
  let remoteAvailable = true;
  const target = {objectKey: `eicagency/${OWNER}/${PROJECT}/${JOB}/7/import.webp`, jobId: JOB, fencingGeneration: 7};
  const canonical: CreativeBuilderImageCanonicalResolver = {
    context,
    async resolveCandidate(value) {
      assert.deepEqual({projectId: value.projectId, scanId: value.scanId, candidateId: value.candidateId}, input);
      return {sourceUrl: 'https://example.com/private-source.png', target, ...(finalized ? {finalized} : {})};
    },
    async finalizePreview(value) { return value.receipt; },
    async finalizeImport(value) {
      finalized = {assetId: ASSET, receipt: value.receipt};
      if (failAfterFinalize) throw new Error('simulated response loss');
      return finalized;
    },
    async resolvePreview() { if (!finalized) throw new Error('missing'); return {...finalized.receipt, objectKey: target.objectKey}; },
    async resolveAsset() { if (!finalized) throw new Error('missing'); return {...finalized.receipt, objectKey: target.objectKey}; },
    async resolveExpiredImport() { return {objectKey: target.objectKey}; },
  };
  const storage = createCreativeBuilderSourceStorage(context, {objects, canonical, fetchRemote: async (...args) => { fetches += 1; if (!remoteAvailable) throw new Error('source unavailable'); return fixture(mimeType, source)(...args); }});
  return {storage, objects, canonical, target, get finalized() { return finalized; }, set finalized(value: {assetId: string; receipt: BuilderImageReceipt} | undefined) { finalized = value; }, get fetches() { return fetches; }, set remoteAvailable(value: boolean) { remoteAvailable = value; }, set failAfterFinalize(value: boolean) { failAfterFinalize = value; }};
}

const png = await sharp({create: {width: 1200, height: 600, channels: 4, background: {r: 30, g: 90, b: 180, alpha: 1}}}).png().toBuffer();
const jpegWithOrientation = await sharp({create: {width: 1200, height: 600, channels: 3, background: {r: 200, g: 80, b: 20}}}).jpeg().withMetadata({orientation: 6}).toBuffer();

test('thumbnail normalizes, rotates/strips metadata, bounds output, and uses a private create-only fenced key', async () => {
  const h = harness(jpegWithOrientation, 'image/jpeg');
  const result = await h.storage.createCandidatePreview(input);
  assert.equal(result.mimeType, 'image/webp');
  assert.ok(result.width <= 400 && result.height <= 400 && result.sizeBytes <= 256 * 1024);
  assert.equal(h.objects.puts, 1);
  const stored = h.objects.values.get(h.target.objectKey)!;
  const metadata = await sharp(stored.bytes).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.orientation, undefined);
  assert.equal(metadata.exif, undefined);
});

test('preview finalization reconciles an ambiguous response without refetching or rewriting', async () => {
  const h = harness(png);
  const resolve = h.canonical.resolveCandidate.bind(h.canonical);
  let finalizedPreview: BuilderImageReceipt | undefined;
  h.canonical.resolveCandidate = async value => ({...(await resolve(value)), ...(finalizedPreview ? {finalizedPreview} : {})});
  h.canonical.finalizePreview = async value => { finalizedPreview = value.receipt; throw new Error('simulated response loss'); };
  await assert.rejects(h.storage.createCandidatePreview(input), /unavailable/);
  assert.equal(h.fetches, 1);
  assert.equal(h.objects.puts, 1);
  const replay = await h.storage.createCandidatePreview(input);
  assert.deepEqual(replay, finalizedPreview);
  assert.equal(h.fetches, 1);
  assert.equal(h.objects.puts, 1);
});

test('import normalizes to bounded WebP and finalizes immutable SHA-256 receipt after upload', async () => {
  const h = harness(png);
  const result = await h.storage.importSourceAsset(input);
  assert.equal(result.assetId, ASSET);
  assert.ok(result.receipt.width <= 1600 && result.receipt.height <= 1600 && result.receipt.sizeBytes <= 8 * 1024 * 1024);
  const stored = h.objects.values.get(h.target.objectKey)!;
  assert.equal(hash(stored.bytes), result.receipt.sha256);
  assert.deepEqual(h.finalized, result);
});

test('object-write-before-database failure retries the exact deterministic object and then finalizes', async () => {
  const h = harness(png);
  const finalize = h.canonical.finalizeImport.bind(h.canonical);
  h.canonical.finalizeImport = async () => { throw new Error('database unavailable before commit'); };
  await assert.rejects(h.storage.importSourceAsset(input), /unavailable/);
  assert.equal(h.objects.puts, 1);
  assert.equal(h.finalized, undefined);
  h.canonical.finalizeImport = finalize;
  h.remoteAvailable = false;
  const replay = await h.storage.importSourceAsset(input);
  assert.equal(replay.assetId, ASSET);
  assert.equal(h.objects.puts, 1, 'retry finalizes the prior deterministic object without rewriting');
  assert.equal(h.fetches, 1, 'retry does not depend on the mutable remote source');
});

test('write-before-finalize failure is reconciled idempotently and finalized retries avoid network', async () => {
  const h = harness(png);
  h.failAfterFinalize = true;
  await assert.rejects(h.storage.importSourceAsset(input), (error: unknown) => error instanceof CreativeBuilderSourceStorageError && error.code === 'unavailable');
  assert.equal(h.objects.puts, 1);
  h.failAfterFinalize = false;
  const replay = await h.storage.importSourceAsset(input);
  assert.equal(replay.assetId, ASSET);
  assert.equal(h.fetches, 1, 'finalized retry probes exact object and does not refetch source');
  assert.equal(h.objects.puts, 1);
});

test('create-only collision probes exact bytes and fails closed on hash mismatch', async () => {
  const h = harness(png);
  h.objects.values.set(h.target.objectKey, {bytes: Buffer.from('wrong'), contentType: 'image/webp'});
  await assert.rejects(h.storage.importSourceAsset(input), (error: unknown) => error instanceof CreativeBuilderSourceStorageError && error.code === 'integrity');
  assert.equal(h.finalized, undefined);
});

test('rejects raw URL/object-key fields, MIME confusion, SVG, animation, malformed and oversized input', async () => {
  const h = harness(png);
  await assert.rejects(h.storage.importSourceAsset({...input, sourceUrl: 'https://attacker.invalid/x'} as never), /invalid/);
  await assert.rejects(h.storage.readSourceAsset({projectId: PROJECT, assetId: ASSET, objectKey: h.target.objectKey} as never), /invalid/);
  const confused = harness(png, 'image/jpeg');
  await assert.rejects(confused.storage.importSourceAsset(input), /invalid/);
  for (const bytes of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), Buffer.from('GIF89a animation'), Buffer.from('not an image')]) {
    const bad = harness(bytes, 'image/png');
    await assert.rejects(bad.storage.importSourceAsset(input), /invalid/);
  }
  const oversized = harness(Buffer.alloc(2 * 1024 * 1024 + 1), 'image/png');
  await assert.rejects(oversized.storage.createCandidatePreview(input));
});

test('frozen owner context is checked on construction and every call; cross-owner keys are denied', async () => {
  const h = harness(png);
  assert.throws(() => createCreativeBuilderSourceStorage(context, {objects: h.objects, canonical: {...h.canonical, context: {tenantId: 'eicagency', ownerId: OTHER}}, fetchRemote: fixture('image/png', png)}), /denied/);
  (h.canonical as {context: {tenantId: 'eicagency'; ownerId: string}}).context = {tenantId: 'eicagency', ownerId: OTHER};
  await assert.rejects(h.storage.importSourceAsset(input), /denied/);

  const h2 = harness(png);
  h2.finalized = {assetId: ASSET, receipt: receipt(await sharp(png).webp().toBuffer(), 1200, 600)};
  h2.canonical.resolveAsset = async () => ({...h2.finalized!.receipt, objectKey: `eicagency/${OTHER}/${PROJECT}/${JOB}/7/import.webp`});
  await assert.rejects(h2.storage.readSourceAsset({projectId: PROJECT, assetId: ASSET}), /denied/);
});

test('private reads verify receipt bytes and return no-store headers without URLs or keys', async () => {
  const h = harness(png);
  const imported = await h.storage.importSourceAsset(input);
  const read = await h.storage.readSourceAsset({projectId: PROJECT, assetId: imported.assetId});
  assert.equal(read.headers['Cache-Control'], 'private, no-store, max-age=0');
  assert.equal(read.headers['Content-Type'], 'image/webp');
  assert.equal(hash(read.bytes), imported.receipt.sha256);
  assert.equal(JSON.stringify(read).includes('example.com'), false);
  assert.equal(JSON.stringify(read).includes(h.target.objectKey), false);
  h.objects.values.get(h.target.objectKey)!.bytes[0] ^= 1;
  await assert.rejects(h.storage.readSourceAsset({projectId: PROJECT, assetId: imported.assetId}), /integrity/);
});

test('expired unfinalized cleanup is exact, owner-fenced, and idempotent', async () => {
  const h = harness(png);
  await h.storage.importSourceAsset(input);
  assert.equal(await h.storage.cleanupExpiredImport(input), 'removed');
  assert.equal(await h.storage.cleanupExpiredImport(input), 'not-found');
});

test('safe byte fetch reuses DNS/redirect pinning, identity encoding, MIME and byte limits', async () => {
  const requested: string[] = [];
  const request: ScannerRequest = async (url, options) => {
    requested.push(url.href);
    assert.equal((options.headers as Record<string, string>)['Accept-Encoding'], 'identity');
    if (requested.length === 1) return {statusCode: 302, headers: {location: 'https://internal.example/image.png'}, body: Readable.from([])};
    return {statusCode: 200, headers: {'content-type': 'image/png'}, body: Readable.from([png])};
  };
  await assert.rejects(fetchCreativeBuilderRemoteBytes('https://example.com/image.png', {maxBytes: 2 * 1024 * 1024, acceptedMimeTypes: new Set(['image/png'])}, {
    request,
    resolve: async hostname => hostname === 'internal.example' ? [{address: '169.254.169.254', family: 4}] : [{address: '93.184.216.34', family: 4}],
  }), /non-public/);
  assert.equal(requested.length, 1);

  await assert.rejects(fetchCreativeBuilderRemoteBytes('https://example.com/image.png', {maxBytes: 16, acceptedMimeTypes: new Set(['image/png'])}, {
    request: async () => ({statusCode: 200, headers: {'content-type': 'image/png', 'content-length': '100'}, body: Readable.from([png])}),
    resolve: async () => [{address: '93.184.216.34', family: 4}],
  }), /byte limit/);
});
