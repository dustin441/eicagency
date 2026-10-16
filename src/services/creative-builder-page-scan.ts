import {randomUUID} from 'node:crypto';
import {lookup as dnsLookup} from 'node:dns/promises';
import * as http from 'node:http';
import type {IncomingHttpHeaders, RequestOptions} from 'node:http';
import * as https from 'node:https';
import {Readable} from 'node:stream';
import {createBrotliDecompress, createGunzip, createInflate} from 'node:zlib';
import ipaddr from 'ipaddr.js';
import {parse, type DefaultTreeAdapterMap} from 'parse5';
import {
  LandingPageReceiptSchema,
  type AssetCandidate,
  type LandingPageReceipt,
  type ScannedPage,
  type SourceExcerpt,
} from '../lib/creative-studio/strategy.ts';

const MAX_REDIRECTS = 3;
const DEADLINE_MS = 10_000;
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_COMPRESSED_BYTES = 1024 * 1024;
const HTML_MIME_TYPES = new Set(['text/html', 'application/xhtml+xml']);
const METADATA_ADDRESSES = new Set(['168.63.129.16', '169.254.169.254', '169.254.170.2', '100.100.100.200']);
const OMIT_ELEMENTS = new Set(['script', 'style', 'form', 'noscript', 'template', 'svg', 'canvas', 'iframe', 'object', 'embed']);

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
type Document = DefaultTreeAdapterMap['document'];
type AddressFamily = 4 | 6;

export interface ResolvedAddress {address: string; family: AddressFamily}
export interface ScannerResponse {
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: AsyncIterable<Uint8Array>;
  cancel?: () => void;
}
export type ScannerRequest = (url: URL, options: RequestOptions, signal: AbortSignal) => Promise<ScannerResponse>;
export interface ScannerClock {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  clearTimeout(handle: ReturnType<typeof setTimeout>): void;
}
export interface CreativeBuilderPageScanDependencies {
  resolve?: (hostname: string) => Promise<ResolvedAddress[]>;
  request?: ScannerRequest;
  clock?: ScannerClock;
  randomUUID?: () => string;
}
export interface SafeRemoteByteFetchOptions {
  maxBytes: number;
  acceptedMimeTypes: ReadonlySet<string>;
  deadlineMs?: number;
}
export interface SafeRemoteByteResult {bytes: Buffer; mimeType: string; finalUrl: string}

const defaultClock: ScannerClock = {
  now: Date.now,
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: clearTimeout,
};

function scannerError(message: string): Error {
  return new Error(`Creative Builder page scan rejected: ${message}`);
}

function withAbort<T>(promise: Promise<T>, signal: AbortSignal, cancel?: () => void): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const aborted = () => {
      cancel?.();
      reject(signal.reason);
    };
    signal.addEventListener('abort', aborted, {once: true});
    promise.then(
      value => { signal.removeEventListener('abort', aborted); resolve(value); },
      error => { signal.removeEventListener('abort', aborted); reject(error); },
    );
  });
}

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
}

export function isPublicAddress(address: string): boolean {
  try {
    let parsed = ipaddr.parse(address);
    if (parsed.kind() === 'ipv6') {
      const ipv6 = parsed as ipaddr.IPv6;
      if (ipv6.isIPv4MappedAddress()) parsed = ipv6.toIPv4Address();
    }
    if (METADATA_ADDRESSES.has(parsed.toString())) return false;
    return parsed.range() === 'unicast';
  } catch {
    return false;
  }
}

export function validatePageUrl(value: string | URL): URL {
  let url: URL;
  try {
    url = value instanceof URL ? new URL(value.href) : new URL(value);
  } catch {
    throw scannerError('invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw scannerError('only HTTP and HTTPS are allowed');
  if (url.username || url.password) throw scannerError('URL credentials are forbidden');
  if (url.port && !((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443'))) {
    throw scannerError('nonstandard ports are forbidden');
  }
  const hostname = normalizeHost(url.hostname);
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === 'local' || hostname.endsWith('.local')) {
    throw scannerError('local hostnames are forbidden');
  }
  if (ipaddr.isValid(hostname)) throw scannerError('IP-literal URLs are forbidden');
  url.hash = '';
  return url;
}

async function resolveAndPin(url: URL, resolve: (hostname: string) => Promise<ResolvedAddress[]>): Promise<ResolvedAddress> {
  const answers = await resolve(normalizeHost(url.hostname));
  if (!answers.length) throw scannerError('hostname did not resolve');
  for (const answer of answers) {
    if ((answer.family !== 4 && answer.family !== 6) || !isPublicAddress(answer.address)) {
      throw scannerError('hostname resolved to a non-public address');
    }
  }
  return answers[0];
}

const defaultResolve = async (hostname: string): Promise<ResolvedAddress[]> => {
  const answers = await dnsLookup(hostname, {all: true, verbatim: true});
  return answers.map(({address, family}) => ({address, family: family as AddressFamily}));
};

const defaultRequest: ScannerRequest = (url, options, signal) => new Promise((resolve, reject) => {
  const transport = url.protocol === 'https:' ? https : http;
  const request = transport.request({...options, signal}, response => {
    resolve({
      statusCode: response.statusCode ?? 0,
      headers: response.headers,
      body: response,
      cancel: () => response.destroy(),
    });
  });
  request.once('error', reject);
  request.end();
});

function pinnedRequestOptions(url: URL, pinned: ResolvedAddress, accept = 'text/html, application/xhtml+xml;q=0.9', acceptEncoding = 'gzip, deflate, br'): RequestOptions {
  const lookup: NonNullable<RequestOptions['lookup']> = (_hostname, options, callback) => {
    const all = typeof options === 'object' && options.all;
    if (all) {
      (callback as (error: NodeJS.ErrnoException | null, addresses: ResolvedAddress[]) => void)(null, [pinned]);
    } else {
      (callback as (error: NodeJS.ErrnoException | null, address: string, family: number) => void)(null, pinned.address, pinned.family);
    }
  };
  return {
    protocol: url.protocol,
    hostname: normalizeHost(url.hostname),
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    method: 'GET',
    path: `${url.pathname}${url.search}`,
    headers: {
      Accept: accept,
      'Accept-Encoding': acceptEncoding,
      'User-Agent': 'EIC-Creative-Builder-Scanner/1.0',
      Host: url.host,
    },
    lookup,
    // Never use Node's shared global pool: an idle socket can bypass this
    // request's validated, pinned lookup because lookup is not part of the
    // global agent's socket key.
    agent: false,
    ...(url.protocol === 'https:' ? {servername: normalizeHost(url.hostname)} : {}),
  };
}

function firstHeader(headers: IncomingHttpHeaders, name: string): string {
  const value = headers[name];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

async function boundedBody(response: ScannerResponse): Promise<string> {
  const encoding = firstHeader(response.headers, 'content-encoding').trim().toLowerCase();
  let source = Readable.from(response.body);
  let compressedBytes = 0;
  source.on('data', (chunk: Buffer) => {
    compressedBytes += chunk.length;
    if (compressedBytes > MAX_COMPRESSED_BYTES) source.destroy(scannerError('compressed body exceeds one MiB'));
  });
  if (encoding && encoding !== 'identity') {
    if (encoding === 'gzip' || encoding === 'x-gzip') source = source.pipe(createGunzip());
    else if (encoding === 'deflate') source = source.pipe(createInflate());
    else if (encoding === 'br') source = source.pipe(createBrotliDecompress());
    else {
      response.cancel?.();
      throw scannerError('unsupported content encoding');
    }
  }
  const chunks: Buffer[] = [];
  let decodedBytes = 0;
  try {
    for await (const rawChunk of source) {
      const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
      decodedBytes += chunk.length;
      if (decodedBytes > MAX_BODY_BYTES) {
        source.destroy();
        throw scannerError('decoded HTML exceeds one MiB');
      }
      chunks.push(chunk);
    }
  } finally {
    response.cancel?.();
  }
  return Buffer.concat(chunks, decodedBytes).toString('utf8');
}

interface FetchedHtml {requestedUrl: URL; finalUrl: URL; html: string; warnings: string[]}

async function fetchHtml(
  requestedUrl: URL,
  resolve: (hostname: string) => Promise<ResolvedAddress[]>,
  request: ScannerRequest,
  signal: AbortSignal,
  assertDeadline: () => void,
): Promise<FetchedHtml> {
  let current = requestedUrl;
  const warnings: string[] = [];
  for (let redirects = 0; ; redirects += 1) {
    assertDeadline();
    const pinned = await withAbort(resolveAndPin(current, resolve), signal);
    assertDeadline();
    const response = await withAbort(request(current, pinnedRequestOptions(current, pinned), signal), signal);
    assertDeadline();
    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      response.cancel?.();
      if (redirects >= MAX_REDIRECTS) throw scannerError('too many redirects');
      const location = firstHeader(response.headers, 'location');
      if (!location) throw scannerError('redirect omitted Location');
      current = validatePageUrl(new URL(location, current));
      continue;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      response.cancel?.();
      throw scannerError(`HTTP status ${response.statusCode}`);
    }
    const mime = firstHeader(response.headers, 'content-type').split(';', 1)[0].trim().toLowerCase();
    if (!HTML_MIME_TYPES.has(mime)) {
      response.cancel?.();
      throw scannerError('response is not an allowed HTML MIME type');
    }
    const html = await withAbort(boundedBody(response), signal, response.cancel);
    assertDeadline();
    if (redirects) warnings.push(`Followed ${redirects} redirect${redirects === 1 ? '' : 's'} to ${current.origin}.`);
    return {requestedUrl, finalUrl: current, html, warnings};
  }
}

function isElement(node: Node): node is Element {
  return 'tagName' in node;
}

function attr(element: Element, name: string): string {
  return element.attrs.find(item => item.name.toLowerCase() === name)?.value.trim() ?? '';
}

function hasAttr(element: Element, name: string): boolean {
  return element.attrs.some(item => item.name.toLowerCase() === name);
}

const MAX_DOM_NODES = 20_000;
const MAX_HTML_NESTING = 256;

function preflightHtmlComplexity(html: string): void {
  const voidElements = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  const stack: string[] = [];
  const lowerHtml = html.toLowerCase();
  let tags = 0;
  let index = 0;

  while (index < html.length) {
    const start = html.indexOf('<', index);
    if (start < 0) break;

    if (html.startsWith('<!--', start)) {
      const end = html.indexOf('-->', start + 4);
      if (end < 0) break;
      index = end + 3;
      continue;
    }

    let cursor = start + 1;
    while (cursor < html.length && /\s/.test(html[cursor])) cursor += 1;
    let closing = false;
    if (html[cursor] === '/') {
      closing = true;
      cursor += 1;
      while (cursor < html.length && /\s/.test(html[cursor])) cursor += 1;
    }
    if (!/[A-Za-z]/.test(html[cursor] ?? '')) {
      index = start + 1;
      continue;
    }

    const nameStart = cursor;
    cursor += 1;
    while (cursor < html.length && /[\w:-]/.test(html[cursor])) cursor += 1;
    const name = lowerHtml.slice(nameStart, cursor);

    let quote: '"' | "'" | undefined;
    let end = cursor;
    for (; end < html.length; end += 1) {
      const character = html[end];
      if (quote) {
        if (character === quote) quote = undefined;
      } else if (character === '"' || character === "'") quote = character;
      else if (character === '>') break;
    }
    // An unterminated tag consumes the remaining suffix once and cannot cause
    // repeated rescans from every later '<'.
    if (end >= html.length) break;

    tags += 1;
    if (tags > MAX_DOM_NODES) throw scannerError('HTML exceeds tag limit');
    let beforeEnd = end - 1;
    while (beforeEnd > cursor && /\s/.test(html[beforeEnd])) beforeEnd -= 1;
    const selfClosing = html[beforeEnd] === '/' || voidElements.has(name);

    if (closing) {
      const stackIndex = stack.lastIndexOf(name);
      if (stackIndex >= 0) stack.length = stackIndex;
    } else if (!selfClosing) {
      stack.push(name);
      if (stack.length > MAX_HTML_NESTING) throw scannerError('HTML exceeds nesting limit');
      if (name === 'script' || name === 'style') {
        const rawClose = lowerHtml.indexOf(`</${name}`, end + 1);
        if (rawClose < 0) break;
        index = rawClose;
        continue;
      }
    }
    index = end + 1;
  }
}

function isOmittedElement(element: Element): boolean {
  return OMIT_ELEMENTS.has(element.tagName.toLowerCase()) || hasAttr(element, 'hidden') || attr(element, 'aria-hidden').toLowerCase() === 'true';
}

function walk(node: Node, callback: (element: Element) => void): void {
  const stack: Array<{node: Node; omitted: boolean}> = [{node, omitted: false}];
  let visited = 0;
  while (stack.length) {
    const current = stack.pop()!;
    visited += 1;
    if (visited > MAX_DOM_NODES) throw scannerError('HTML DOM exceeds node limit');
    const omitted = current.omitted || (isElement(current.node) && isOmittedElement(current.node));
    if (isElement(current.node) && !omitted) callback(current.node);
    if ('childNodes' in current.node) {
      for (let index = current.node.childNodes.length - 1; index >= 0; index -= 1) {
        stack.push({node: current.node.childNodes[index], omitted});
      }
    }
  }
}

function textContent(node: Node, maxChars = 12_000): string {
  const stack: Array<{node: Node; omitted: boolean}> = [{node, omitted: false}];
  const chunks: string[] = [];
  let length = 0;
  let visited = 0;
  while (stack.length && length < maxChars) {
    const current = stack.pop()!;
    visited += 1;
    if (visited > MAX_DOM_NODES) throw scannerError('HTML DOM exceeds node limit');
    const omitted = current.omitted || (isElement(current.node) && isOmittedElement(current.node));
    if (!omitted && 'nodeName' in current.node && current.node.nodeName === '#text') {
      const value = (current.node as DefaultTreeAdapterMap['textNode']).value.slice(0, maxChars - length);
      chunks.push(value);
      length += value.length;
    }
    if ('childNodes' in current.node) {
      for (let index = current.node.childNodes.length - 1; index >= 0; index -= 1) {
        stack.push({node: current.node.childNodes[index], omitted});
      }
    }
  }
  return chunks.join(' ');
}

function cleanText(value: string, max: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max).trim();
}

function resolveSafeUrl(value: string, base: URL): URL | undefined {
  if (!value) return undefined;
  try {
    const resolved = validatePageUrl(new URL(value, base));
    return resolved;
  } catch {
    return undefined;
  }
}

interface ParsedPage {
  page: ScannedPage;
  excerpts: SourceExcerpt[];
  assets: AssetCandidate[];
  brandName?: string;
  hasBrandContext: boolean;
  warnings: string[];
}

function parsePage(fetched: FetchedHtml, kind: ScannedPage['kind'], uuid: () => string, assertDeadline: () => void): ParsedPage {
  assertDeadline();
  preflightHtmlComplexity(fetched.html);
  assertDeadline();
  const document = parse(fetched.html) as Document;
  assertDeadline();
  const elements: Element[] = [];
  let visitedElements = 0;
  walk(document, element => {
    elements.push(element);
    visitedElements += 1;
    if (visitedElements % 2_048 === 0) assertDeadline();
  });
  assertDeadline();
  const first = (tag: string) => elements.find(element => element.tagName.toLowerCase() === tag);
  const metas = elements.filter(element => element.tagName.toLowerCase() === 'meta');
  const meta = (...keys: string[]) => {
    for (const key of keys) {
      const match = metas.find(element => [attr(element, 'name'), attr(element, 'property')].some(value => value.toLowerCase() === key));
      if (match) return attr(match, 'content');
    }
    return '';
  };
  const warnings = [...fetched.warnings];
  let baseUrl = fetched.finalUrl;
  const baseHref = attr(first('base') ?? ({attrs: []} as unknown as Element), 'href');
  if (baseHref) {
    const candidate = resolveSafeUrl(baseHref, fetched.finalUrl);
    if (candidate && candidate.origin === fetched.finalUrl.origin) baseUrl = candidate;
    else warnings.push('Ignored an unsafe or cross-origin base URL.');
  }
  const titleElement = first('title');
  const title = cleanText(titleElement ? textContent(titleElement) : '', 200) || cleanText(meta('og:title', 'twitter:title'), 200);
  const description = cleanText(meta('description', 'og:description', 'twitter:description'), 500);
  const canonicalElement = elements.find(element => element.tagName.toLowerCase() === 'link' && attr(element, 'rel').toLowerCase().split(/\s+/).includes('canonical'));
  const canonical = resolveSafeUrl(canonicalElement ? attr(canonicalElement, 'href') : '', baseUrl);
  const pageId = uuid();
  const page: ScannedPage = {
    id: pageId,
    kind,
    requestedUrl: fetched.requestedUrl.href,
    finalUrl: fetched.finalUrl.href,
    ...(canonical ? {canonicalUrl: canonical.href} : {}),
    title,
    description,
  };
  const excerpts: SourceExcerpt[] = [];
  const addExcerpt = (excerptKind: SourceExcerpt['kind'], text: string) => {
    const cleaned = cleanText(text, 1000);
    if (!cleaned || excerpts.length >= 24 || excerpts.some(item => item.text === cleaned)) return;
    excerpts.push({id: `excerpt_${kind.replace('-', '_')}_${excerpts.length + 1}`, pageId, kind: excerptKind, text: cleaned});
  };
  addExcerpt('title', title);
  addExcerpt('description', description);
  for (const heading of elements.filter(element => /^h[1-6]$/i.test(element.tagName)).slice(0, 10)) addExcerpt('heading', textContent(heading));
  const body = first('body');
  const bodyText = cleanText(body ? textContent(body) : '', 6000);
  for (let offset = 0; offset < bodyText.length && excerpts.length < 24; offset += 1000) addExcerpt('body', bodyText.slice(offset, offset + 1000));

  const brandName = cleanText(meta('og:site_name', 'application-name'), 120) || undefined;
  const rawCandidates: Array<{url: string; alt: string; kind: AssetCandidate['kind']; width?: number; height?: number}> = [];
  const pushCandidate = (url: string, alt: string, candidateKind: AssetCandidate['kind'], width?: string, height?: string) => {
    const parsedWidth = Number.parseInt(width ?? '', 10);
    const parsedHeight = Number.parseInt(height ?? '', 10);
    rawCandidates.push({
      url,
      alt: cleanText(alt, 300),
      kind: candidateKind,
      ...(parsedWidth > 0 && parsedWidth <= 10000 ? {width: parsedWidth} : {}),
      ...(parsedHeight > 0 && parsedHeight <= 10000 ? {height: parsedHeight} : {}),
    });
  };
  const ogImage = meta('og:image', 'og:image:url', 'twitter:image');
  if (ogImage) pushCandidate(ogImage, meta('og:image:alt', 'twitter:image:alt'), 'hero');
  for (const element of elements) {
    const tag = element.tagName.toLowerCase();
    if (tag === 'img') {
      const marker = `${attr(element, 'id')} ${attr(element, 'class')} ${attr(element, 'alt')} ${attr(element, 'src')}`.toLowerCase();
      const candidateKind: AssetCandidate['kind'] = marker.includes('logo') ? 'logo' : marker.includes('hero') ? 'hero' : marker.includes('product') ? 'product' : 'other';
      pushCandidate(attr(element, 'src'), attr(element, 'alt'), candidateKind, attr(element, 'width'), attr(element, 'height'));
    } else if (tag === 'link' && /(?:^|\s)(?:icon|apple-touch-icon)(?:\s|$)/.test(attr(element, 'rel').toLowerCase())) {
      pushCandidate(attr(element, 'href'), attr(element, 'title'), 'logo');
    }
  }
  const seen = new Set<string>();
  const assets: AssetCandidate[] = [];
  for (const candidate of rawCandidates) {
    const url = resolveSafeUrl(candidate.url, baseUrl);
    if (!url || url.origin !== fetched.finalUrl.origin || seen.has(url.href) || assets.length >= 24) continue;
    seen.add(url.href);
    assets.push({
      id: `asset_${kind.replace('-', '_')}_${assets.length + 1}`,
      pageId,
      sourceUrl: url.href,
      kind: candidate.kind,
      alt: candidate.alt,
      ...(candidate.width ? {width: candidate.width} : {}),
      ...(candidate.height ? {height: candidate.height} : {}),
      sourceExcerptIds: [],
    });
  }
  return {page, excerpts, assets, brandName, hasBrandContext: Boolean(brandName || assets.some(asset => asset.kind === 'logo')), warnings};
}

export async function scanCreativeBuilderLandingPage(
  inputUrl: string,
  dependencies: CreativeBuilderPageScanDependencies = {},
): Promise<LandingPageReceipt> {
  const resolve = dependencies.resolve ?? defaultResolve;
  const request = dependencies.request ?? defaultRequest;
  const clock = dependencies.clock ?? defaultClock;
  const uuid = dependencies.randomUUID ?? randomUUID;
  const startedAt = clock.now();
  const controller = new AbortController();
  const timer = clock.setTimeout(() => controller.abort(scannerError('ten-second deadline exceeded')), DEADLINE_MS);
  const assertDeadline = () => {
    if (controller.signal.aborted || clock.now() - startedAt >= DEADLINE_MS) throw scannerError('ten-second deadline exceeded');
  };
  try {
    const landingUrl = validatePageUrl(inputUrl);
    const landing = parsePage(await fetchHtml(landingUrl, resolve, request, controller.signal, assertDeadline), 'landing', uuid, assertDeadline);
    const parsedPages = [landing];
    const landingFinalUrl = new URL(landing.page.finalUrl);
    if (!landing.hasBrandContext && landingFinalUrl.pathname !== '/') {
      const homepageUrl = validatePageUrl(new URL('/', landingFinalUrl));
      try {
        parsedPages.push(parsePage(await fetchHtml(homepageUrl, resolve, request, controller.signal, assertDeadline), 'homepage-fallback', uuid, assertDeadline));
      } catch (error) {
        if (controller.signal.aborted) throw error;
        const message = error instanceof Error ? error.message : 'unknown failure';
        landing.warnings.push(cleanText(`Homepage fallback was unavailable: ${message}`, 300));
      }
    }
    assertDeadline();
    const receipt = {
      id: uuid(),
      scannedAt: new Date(startedAt).toISOString(),
      brandName: parsedPages.map(page => page.brandName).find(Boolean),
      pages: parsedPages.map(item => item.page),
      excerpts: parsedPages.flatMap(item => item.excerpts).slice(0, 24),
      assets: parsedPages.flatMap(item => item.assets).sort((left, right) => Number(right.kind === 'logo') - Number(left.kind === 'logo')).slice(0, 24),
      warnings: [...new Set(parsedPages.flatMap(item => item.warnings))].slice(0, 10),
    };
    return LandingPageReceiptSchema.parse(receipt);
  } catch (error) {
    if (controller.signal.aborted && !(error instanceof Error && error.message.includes('deadline'))) throw scannerError('ten-second deadline exceeded');
    throw error;
  } finally {
    clock.clearTimeout(timer);
  }
}
