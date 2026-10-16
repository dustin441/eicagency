import {createHash} from 'node:crypto';
import sharp, {type Metadata} from 'sharp';
import {z} from 'zod';
import type {VerifiedCreativeBuilderContext} from './creative-builder-repository.ts';
import {fetchCreativeBuilderRemoteBytes, type SafeRemoteByteResult} from './creative-builder-page-scan.ts';

const BUCKET = 'creative-builder-private';
const THUMBNAIL_INPUT_LIMIT = 2 * 1024 * 1024;
const IMPORT_INPUT_LIMIT = 8 * 1024 * 1024;
const THUMBNAIL_OUTPUT_LIMIT = 256 * 1024;
const IMPORT_OUTPUT_LIMIT = 8 * 1024 * 1024;
const MAX_INPUT_DIMENSION = 8192;
const MAX_INPUT_PIXELS = 40_000_000;
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const Id = z.string().uuid();
const Handle = z.string().min(1).max(96).regex(/^[A-Za-z0-9_-]+$/);
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const Context = z.object({tenantId: z.literal('eicagency'), ownerId: Id}).strict();
const CandidateInput = z.object({projectId: Id, scanId: Id, candidateId: Handle}).strict();
const PreviewReadInput = CandidateInput;
const AssetReadInput = z.object({projectId: Id, assetId: Id}).strict();
const Target = z.object({objectKey: z.string().min(1).max(1024), jobId: Id, fencingGeneration: z.number().int().positive()}).strict();
const Receipt = z.object({sha256: Hash, mimeType: z.literal('image/webp'), width: z.number().int().positive().max(1600), height: z.number().int().positive().max(1600), sizeBytes: z.number().int().positive().max(IMPORT_OUTPUT_LIMIT)}).strict();
const LocatedReceipt = Receipt.extend({objectKey: z.string().min(1).max(1024)}).strict();

export type BuilderImageReceipt = Readonly<z.infer<typeof Receipt>>;
export type BuilderObjectTarget = Readonly<z.infer<typeof Target>>;
export interface CandidateWriteResolution {sourceUrl: string; target: BuilderObjectTarget; finalized?: {assetId: string; receipt: BuilderImageReceipt}; finalizedPreview?: BuilderImageReceipt}
export interface PrivateImageRead {bytes: Buffer; headers: Readonly<Record<'Content-Type' | 'Cache-Control' | 'Content-Length', string>>}

export interface CreativeBuilderPrivateObjectProvider {
  putCreateOnly(bucket: string, key: string, bytes: Uint8Array, options: {contentType: 'image/webp'; cacheControl: 'private, no-store'}): Promise<'created' | 'exists'>;
  get(bucket: string, key: string): Promise<{bytes: Uint8Array; contentType: string} | null>;
  remove(bucket: string, key: string): Promise<'removed' | 'not-found'>;
}

/** Trusted canonical resolver. It must authorize the owner and derive URLs/keys from DB state. */
export interface CreativeBuilderImageCanonicalResolver {
  readonly context: VerifiedCreativeBuilderContext;
  resolveCandidate(input: Readonly<{projectId: string; scanId: string; candidateId: string; purpose: 'preview' | 'import'}>): Promise<CandidateWriteResolution>;
  finalizePreview(input: Readonly<{projectId: string; scanId: string; candidateId: string; target: BuilderObjectTarget; receipt: BuilderImageReceipt}>): Promise<BuilderImageReceipt>;
  finalizeImport(input: Readonly<{projectId: string; scanId: string; candidateId: string; target: BuilderObjectTarget; receipt: BuilderImageReceipt}>): Promise<{assetId: string; receipt: BuilderImageReceipt}>;
  resolvePreview(input: Readonly<{projectId: string; scanId: string; candidateId: string}>): Promise<z.infer<typeof LocatedReceipt>>;
  resolveAsset(input: Readonly<{projectId: string; assetId: string}>): Promise<z.infer<typeof LocatedReceipt>>;
  resolveExpiredImport(input: Readonly<{projectId: string; scanId: string; candidateId: string}>): Promise<{objectKey: string} | null>;
}

export type CreativeBuilderSafeImageFetch = (url: string, maxBytes: number) => Promise<SafeRemoteByteResult>;
export interface CreativeBuilderSourceStorageDependencies {
  objects: CreativeBuilderPrivateObjectProvider;
  canonical: CreativeBuilderImageCanonicalResolver;
  fetchRemote?: CreativeBuilderSafeImageFetch;
}

export type CreativeBuilderSourceStorageErrorCode = 'invalid' | 'denied' | 'integrity' | 'unavailable' | 'conflict';
export class CreativeBuilderSourceStorageError extends Error {
  readonly code: CreativeBuilderSourceStorageErrorCode;
  constructor(code: CreativeBuilderSourceStorageErrorCode) {
    super(`Creative Builder source storage: ${code}`);
    this.name = 'CreativeBuilderSourceStorageError';
    this.code = code;
  }
}

function parse<S extends z.ZodType>(schema: S, value: unknown, code: CreativeBuilderSourceStorageErrorCode = 'invalid'): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw new CreativeBuilderSourceStorageError(code);
  return result.data;
}
function sha256(bytes: Uint8Array): string { return createHash('sha256').update(bytes).digest('hex'); }
function sameReceipt(left: BuilderImageReceipt, right: BuilderImageReceipt): boolean {
  return left.sha256 === right.sha256 && left.mimeType === right.mimeType && left.width === right.width && left.height === right.height && left.sizeBytes === right.sizeBytes;
}
function expectedPrefix(ownerId: string, projectId: string, target: z.infer<typeof Target>): string {
  return `eicagency/${ownerId}/${projectId}/${target.jobId}/${target.fencingGeneration}/`;
}
function validateKey(ownerId: string, projectId: string, target: z.infer<typeof Target>): void {
  if (!target.objectKey.startsWith(expectedPrefix(ownerId, projectId, target)) || target.objectKey.includes('..') || target.objectKey.includes('\\')) throw new CreativeBuilderSourceStorageError('denied');
}
function signatureMime(bytes: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  throw new CreativeBuilderSourceStorageError('invalid');
}

async function normalizeImage(remote: SafeRemoteByteResult, maxDimension: 400 | 1600, maxOutput: number): Promise<{bytes: Buffer; receipt: BuilderImageReceipt}> {
  const input = Buffer.from(remote.bytes);
  const signature = signatureMime(input);
  if (signature !== remote.mimeType) throw new CreativeBuilderSourceStorageError('invalid');
  let metadata: Metadata;
  try { metadata = await sharp(input, {failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS, animated: true}).metadata(); }
  catch { throw new CreativeBuilderSourceStorageError('invalid'); }
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!width || !height || width > MAX_INPUT_DIMENSION || height > MAX_INPUT_DIMENSION || width * height > MAX_INPUT_PIXELS || (metadata.pages ?? 1) !== 1 || !['jpeg', 'png', 'webp'].includes(metadata.format ?? '')) throw new CreativeBuilderSourceStorageError('invalid');
  let output: Buffer | undefined;
  for (const quality of [82, 72, 62, 52, 42]) {
    try {
      output = await sharp(input, {failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS})
        .rotate().resize({width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true})
        .webp({quality, effort: 4, smartSubsample: true}).toBuffer();
    } catch { throw new CreativeBuilderSourceStorageError('invalid'); }
    if (output.length <= maxOutput) break;
  }
  if (!output || output.length > maxOutput) throw new CreativeBuilderSourceStorageError('invalid');
  let normalized: Metadata;
  try { normalized = await sharp(output, {failOn: 'error'}).metadata(); }
  catch { throw new CreativeBuilderSourceStorageError('integrity'); }
  if (normalized.format !== 'webp' || !normalized.width || !normalized.height || normalized.width > maxDimension || normalized.height > maxDimension || (normalized.pages ?? 1) !== 1) throw new CreativeBuilderSourceStorageError('integrity');
  const receipt = Object.freeze({sha256: sha256(output), mimeType: 'image/webp' as const, width: normalized.width, height: normalized.height, sizeBytes: output.length});
  return {bytes: output, receipt};
}

export function createCreativeBuilderSourceStorage(context: VerifiedCreativeBuilderContext, dependencies: CreativeBuilderSourceStorageDependencies) {
  if (typeof window !== 'undefined') throw new CreativeBuilderSourceStorageError('denied');
  const actor = Object.freeze(parse(Context, context, 'denied'));
  const fetchRemote = dependencies.fetchRemote ?? ((url, maxBytes) => fetchCreativeBuilderRemoteBytes(url, {maxBytes, acceptedMimeTypes: IMAGE_MIMES}));
  function authorize(): void {
    const bound = parse(Context, dependencies.canonical.context, 'denied');
    if (bound.ownerId !== actor.ownerId || bound.tenantId !== actor.tenantId) throw new CreativeBuilderSourceStorageError('denied');
  }
  authorize();

  async function fetchAndNormalize(sourceUrl: string, inputLimit: number, maxDimension: 400 | 1600, outputLimit: number) {
    let remote: SafeRemoteByteResult;
    try { remote = await fetchRemote(sourceUrl, inputLimit); }
    catch (error) { if (error instanceof CreativeBuilderSourceStorageError) throw error; throw new CreativeBuilderSourceStorageError('unavailable'); }
    if (remote.bytes.length < 1 || remote.bytes.length > inputLimit || !IMAGE_MIMES.has(remote.mimeType)) throw new CreativeBuilderSourceStorageError('invalid');
    return normalizeImage(remote, maxDimension, outputLimit);
  }
  async function verifyStored(key: string, receipt: BuilderImageReceipt): Promise<Buffer> {
    let stored;
    try { stored = await dependencies.objects.get(BUCKET, key); }
    catch { throw new CreativeBuilderSourceStorageError('unavailable'); }
    if (!stored) throw new CreativeBuilderSourceStorageError('unavailable');
    const bytes = Buffer.from(stored.bytes);
    if (stored.contentType !== receipt.mimeType || bytes.length !== receipt.sizeBytes || sha256(bytes) !== receipt.sha256) throw new CreativeBuilderSourceStorageError('integrity');
    return bytes;
  }
  async function recoverStored(target: z.infer<typeof Target>, maxDimension: 400 | 1600, maxOutput: number): Promise<BuilderImageReceipt | null> {
    let stored;
    try { stored = await dependencies.objects.get(BUCKET, target.objectKey); }
    catch { throw new CreativeBuilderSourceStorageError('unavailable'); }
    if (!stored) return null;
    const bytes = Buffer.from(stored.bytes);
    let storedMime: 'image/jpeg' | 'image/png' | 'image/webp';
    try { storedMime = signatureMime(bytes); } catch { throw new CreativeBuilderSourceStorageError('integrity'); }
    if (stored.contentType !== 'image/webp' || bytes.length < 1 || bytes.length > maxOutput || storedMime !== 'image/webp') throw new CreativeBuilderSourceStorageError('integrity');
    let metadata: Metadata;
    try { metadata = await sharp(bytes, {failOn: 'error', animated: true}).metadata(); }
    catch { throw new CreativeBuilderSourceStorageError('integrity'); }
    if (metadata.format !== 'webp' || !metadata.width || !metadata.height || metadata.width > maxDimension || metadata.height > maxDimension || (metadata.pages ?? 1) !== 1 || metadata.exif || metadata.icc || metadata.xmp || metadata.iptc) throw new CreativeBuilderSourceStorageError('integrity');
    return Object.freeze({sha256: sha256(bytes), mimeType: 'image/webp' as const, width: metadata.width, height: metadata.height, sizeBytes: bytes.length});
  }
  async function createOnly(target: z.infer<typeof Target>, bytes: Buffer, receipt: BuilderImageReceipt, maxDimension: 400 | 1600, maxOutput: number): Promise<BuilderImageReceipt> {
    let result: 'created' | 'exists';
    try { result = await dependencies.objects.putCreateOnly(BUCKET, target.objectKey, bytes, {contentType: 'image/webp', cacheControl: 'private, no-store'}); }
    catch { throw new CreativeBuilderSourceStorageError('unavailable'); }
    if (result === 'created') { await verifyStored(target.objectKey, receipt); return receipt; }
    const recovered = await recoverStored(target, maxDimension, maxOutput);
    if (!recovered) throw new CreativeBuilderSourceStorageError('unavailable');
    return recovered;
  }
  async function resolveCandidate(input: unknown, purpose: 'preview' | 'import') {
    authorize();
    const value = parse(CandidateInput, input);
    let resolution: CandidateWriteResolution;
    try { resolution = await dependencies.canonical.resolveCandidate({...value, purpose}); }
    catch { throw new CreativeBuilderSourceStorageError('denied'); }
    if (!resolution || typeof resolution.sourceUrl !== 'string') throw new CreativeBuilderSourceStorageError('integrity');
    const target = parse(Target, resolution.target, 'integrity');
    validateKey(actor.ownerId, value.projectId, target);
    return {value, resolution: {...resolution, target}};
  }
  async function readLocated(locatedValue: unknown, projectId: string): Promise<PrivateImageRead> {
    const located = parse(LocatedReceipt, locatedValue, 'integrity');
    const match = located.objectKey.match(/^eicagency\/([^/]+)\/([^/]+)\//);
    if (!match || match[1] !== actor.ownerId || match[2] !== projectId) throw new CreativeBuilderSourceStorageError('denied');
    const receipt = parse(Receipt, {sha256: located.sha256, mimeType: located.mimeType, width: located.width, height: located.height, sizeBytes: located.sizeBytes}, 'integrity');
    const bytes = await verifyStored(located.objectKey, receipt);
    return Object.freeze({bytes, headers: Object.freeze({'Content-Type': receipt.mimeType, 'Cache-Control': 'private, no-store, max-age=0', 'Content-Length': String(bytes.length)})});
  }

  return Object.freeze({
    async createCandidatePreview(input: z.input<typeof CandidateInput>): Promise<BuilderImageReceipt> {
      const {value, resolution} = await resolveCandidate(input, 'preview');
      if (resolution.finalizedPreview) {
        const receipt = parse(Receipt, resolution.finalizedPreview, 'integrity');
        await verifyStored(resolution.target.objectKey, receipt);
        return Object.freeze(receipt);
      }
      let receipt = await recoverStored(resolution.target, 400, THUMBNAIL_OUTPUT_LIMIT);
      if (!receipt) {
        const normalized = await fetchAndNormalize(resolution.sourceUrl, THUMBNAIL_INPUT_LIMIT, 400, THUMBNAIL_OUTPUT_LIMIT);
        receipt = await createOnly(resolution.target, normalized.bytes, normalized.receipt, 400, THUMBNAIL_OUTPUT_LIMIT);
      }
      let finalized: BuilderImageReceipt;
      try { finalized = parse(Receipt, await dependencies.canonical.finalizePreview({...value, target: resolution.target, receipt}), 'integrity'); }
      catch (error) { if (error instanceof CreativeBuilderSourceStorageError) throw error; throw new CreativeBuilderSourceStorageError('unavailable'); }
      if (!sameReceipt(finalized, receipt)) throw new CreativeBuilderSourceStorageError('integrity');
      return Object.freeze(finalized);
    },
    async importSourceAsset(input: z.input<typeof CandidateInput>): Promise<Readonly<{assetId: string; receipt: BuilderImageReceipt}>> {
      const {value, resolution} = await resolveCandidate(input, 'import');
      if (resolution.finalized) {
        const assetId = parse(Id, resolution.finalized.assetId, 'integrity');
        const receipt = parse(Receipt, resolution.finalized.receipt, 'integrity');
        await verifyStored(resolution.target.objectKey, receipt);
        return Object.freeze({assetId, receipt: Object.freeze(receipt)});
      }
      let receipt = await recoverStored(resolution.target, 1600, IMPORT_OUTPUT_LIMIT);
      if (!receipt) {
        const normalized = await fetchAndNormalize(resolution.sourceUrl, IMPORT_INPUT_LIMIT, 1600, IMPORT_OUTPUT_LIMIT);
        receipt = await createOnly(resolution.target, normalized.bytes, normalized.receipt, 1600, IMPORT_OUTPUT_LIMIT);
      }
      try {
        const finalized = await dependencies.canonical.finalizeImport({...value, target: resolution.target, receipt});
        const assetId = parse(Id, finalized.assetId, 'integrity');
        const finalizedReceipt = parse(Receipt, finalized.receipt, 'integrity');
        if (!sameReceipt(finalizedReceipt, receipt)) throw new CreativeBuilderSourceStorageError('integrity');
        return Object.freeze({assetId, receipt: Object.freeze(finalizedReceipt)});
      } catch (error) {
        if (error instanceof CreativeBuilderSourceStorageError) throw error;
        throw new CreativeBuilderSourceStorageError('unavailable');
      }
    },
    async readCandidatePreview(input: z.input<typeof PreviewReadInput>): Promise<PrivateImageRead> {
      authorize();
      const value = parse(PreviewReadInput, input);
      let located; try { located = await dependencies.canonical.resolvePreview(value); } catch { throw new CreativeBuilderSourceStorageError('denied'); }
      return readLocated(located, value.projectId);
    },
    async readSourceAsset(input: z.input<typeof AssetReadInput>): Promise<PrivateImageRead> {
      authorize();
      const value = parse(AssetReadInput, input);
      let located; try { located = await dependencies.canonical.resolveAsset(value); } catch { throw new CreativeBuilderSourceStorageError('denied'); }
      return readLocated(located, value.projectId);
    },
    async cleanupExpiredImport(input: z.input<typeof CandidateInput>): Promise<'removed' | 'not-found'> {
      authorize();
      const value = parse(CandidateInput, input);
      let orphan; try { orphan = await dependencies.canonical.resolveExpiredImport(value); } catch { throw new CreativeBuilderSourceStorageError('denied'); }
      if (!orphan) return 'not-found';
      const prefix = `eicagency/${actor.ownerId}/${value.projectId}/`;
      if (!orphan.objectKey.startsWith(prefix) || orphan.objectKey.includes('..') || orphan.objectKey.includes('\\')) throw new CreativeBuilderSourceStorageError('denied');
      try { return await dependencies.objects.remove(BUCKET, orphan.objectKey); }
      catch { throw new CreativeBuilderSourceStorageError('unavailable'); }
    },
  });
}
