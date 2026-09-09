#!/usr/bin/env node

/**
 * Persist full-resolution Meta creative images in Supabase Storage.
 *
 * Dry-run is the default. Writes require --apply. The script never upscales:
 * downloaded media is decoded and rejected unless it is large enough to render.
 *
 * Required env:
 *   META_GRAPH_VERSION (explicitly approved active Graph API version)
 *   META_ACCESS_TOKEN (or META_ACCESS_TOKEN_<CLIENT>)
 *   META_ACCOUNT_ID_<CLIENT> for every selected client (non-secret expected account ID)
 *   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (PrePass)
 *   SPARTACO_SUPABASE_URL + SPARTACO_SUPABASE_SERVICE_ROLE_KEY (other clients)
 */
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

const GRAPH_VERSION = clean(process.env.META_GRAPH_VERSION);
const GRAPH_ROOT = `https://graph.facebook.com/${GRAPH_VERSION}`;
const BUCKET = 'meta-creative-previews';
const PAGE_SIZE = 1000;
const MIN_LONG_EDGE = 600;
const MIN_SHORT_EDGE = 315;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_REDIRECTS = 4;
const BUDGET_EXHAUSTED = 'SYNC_BUDGET_EXHAUSTED';

export const CLIENTS = {
  prepass: { project: 'eic', table: 'meta_ads_creatives', target: 'permanent_image_url', id: true },
  ihh: { project: 'spartaco', table: 'ihh_meta_ads_creatives', target: 'permanent_image_url', id: true },
  arabella: { project: 'spartaco', table: 'arabella_meta_ads_creatives', target: 'permanent_image_url', id: true },
  cba: { project: 'spartaco', table: 'cba_meta_ads', target: 'permanent_image_url', id: true },
  bloom: { project: 'spartaco', table: 'bloom_meta_ads', target: 'permanent_image_url', id: true },
  durodyne: { project: 'spartaco', table: 'durodyne_meta_ads', target: 'permanent_image_url', id: true },
  kinsey: { project: 'spartaco', table: 'kinsey_meta_ads_creatives', target: 'permanent_image_url', id: true },
  champagne: { project: 'spartaco', table: 'champagne_meta_ads_creatives', target: 'final_creative_link', id: true },
  jameson: { project: 'spartaco', table: 'jameson_meta_ads', target: 'final_creative_link', id: true },
  huskie: { project: 'spartaco', table: 'huskie_meta_ads', target: 'final_creative_link', id: true },
  ronin: { project: 'spartaco', table: 'ronin_meta_ads', target: 'final_creative_link', id: true },
};

export function createSyncBudget({ maxCandidates, maxRequests, maxRuntimeMs, now = Date.now }) {
  const startedAt = now();
  let candidates = 0;
  let requests = 0;
  let reason = '';
  const withinTime = () => {
    if (now() - startedAt < maxRuntimeMs) return true;
    reason ||= 'time';
    return false;
  };
  return {
    claimCandidate() {
      if (!withinTime()) return false;
      if (candidates >= maxCandidates) { reason ||= 'candidates'; return false; }
      candidates += 1;
      return true;
    },
    claimRequest() {
      if (!withinTime()) return false;
      if (requests >= maxRequests) { reason ||= 'requests'; return false; }
      requests += 1;
      return true;
    },
    snapshot() { return { candidates, requests, maxCandidates, maxRequests, maxRuntimeMs, reason }; },
  };
}

function claimRequest(budget) {
  if (budget?.claimRequest()) return;
  throw new Error(BUDGET_EXHAUSTED);
}

function clean(value) {
  const text = String(value ?? '').trim();
  return text && text !== 'null' && text !== 'undefined' ? text : '';
}

export function explicitThumbnailDimensions(value) {
  const match = clean(value).match(/(?:^|[_?&])p(\d{2,4})x(\d{2,4})(?:_|[&]|$)/i);
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
}

export function needsDurablePreview(value) {
  const url = clean(value);
  if (!url) return true;
  const dimensions = explicitThumbnailDimensions(url);
  if (dimensions && (Math.max(dimensions.width, dimensions.height) < MIN_LONG_EDGE
      || Math.min(dimensions.width, dimensions.height) < MIN_SHORT_EDGE)) return true;
  try {
    const parsed = new URL(url);
    const metaCdn = /(^|\.)(fbcdn\.net|[^.]*\.fna\.fbcdn\.net)$/i.test(parsed.hostname);
    const metaImageProxy = /(^|\.)facebook\.com$/i.test(parsed.hostname)
      && /^\/ads\/image\/?$/i.test(parsed.pathname);
    return metaCdn || metaImageProxy;
  } catch {
    return !url.startsWith('/');
  }
}

export function imageDimensions(buffer) {
  if (buffer.length >= 24 && buffer.subarray(1, 4).toString('ascii') === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length >= 10 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 8 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      offset += 2;
      if (marker === 0xd8 || marker === 0xd9) continue;
      if (offset + 2 > buffer.length) return null;
      const length = buffer.readUInt16BE(offset);
      if (length < 2 || offset + length > buffer.length) return null;
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7)
          || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        return { height: buffer.readUInt16BE(offset + 3), width: buffer.readUInt16BE(offset + 5) };
      }
      offset += length;
    }
  }
  return null;
}

export function isRenderableImage(dimensions) {
  return Boolean(dimensions
    && Math.max(dimensions.width, dimensions.height) >= MIN_LONG_EDGE
    && Math.min(dimensions.width, dimensions.height) >= MIN_SHORT_EDGE);
}

function tokenFor(client) {
  return clean(process.env[`META_ACCESS_TOKEN_${client.toUpperCase()}`]) || clean(process.env.META_ACCESS_TOKEN);
}

function expectedAccountFor(client) {
  return clean(process.env[`META_ACCOUNT_ID_${client.toUpperCase()}`]).replace(/^act_/, '');
}

export function assertExpectedMetaAccount(actual, expected, client) {
  if (!expected) throw new Error(`Missing expected Meta account for ${client}`);
  if (clean(actual) !== clean(expected).replace(/^act_/, '')) {
    throw new Error(`${client}: Meta account mismatch`);
  }
}


function dbFor(project) {
  const url = project === 'eic' ? process.env.NEXT_PUBLIC_SUPABASE_URL : process.env.SPARTACO_SUPABASE_URL;
  const key = project === 'eic' ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.SPARTACO_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error(`Missing ${project} Supabase credentials`);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function graph(path, token, params = {}, budget) {
  const url = new URL(`${GRAPH_ROOT}/${path.replace(/^\//, '')}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  url.searchParams.set('access_token', token);
  claimRequest(budget);
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  return parseMetaJsonResponse(response);
}

export async function parseMetaJsonResponse(response, usageHandler = respectMetaUsage) {
  const body = await response.json();
  await usageHandler(response);
  if (!response.ok || body.error) throw new Error(body.error?.message || `Meta HTTP ${response.status}`);
  return body;
}

export function maximumMetaUsage(raw) {
  const percentageFields = new Set(['call_count', 'total_cputime', 'total_time', 'acc_id_util_pct']);
  let maximum = 0;
  const visit = (value) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        if (percentageFields.has(key) && typeof child === 'number') maximum = Math.max(maximum, child);
        else if (child && typeof child === 'object') visit(child);
      }
    }
  };
  visit(JSON.parse(raw));
  return maximum;
}

async function respectMetaUsage(response) {
  const rawHeaders = ['x-business-use-case-usage', 'x-app-usage', 'x-ad-account-usage']
    .map((name) => [name, response.headers.get(name)])
    .filter((entry) => entry[1]);
  let maximum = 0;
  for (const [name, raw] of rawHeaders) {
    console.error(`Meta usage (${name}): ${raw}`);
    try {
      maximum = Math.max(maximum, maximumMetaUsage(raw));
    } catch {
      // A malformed optional header must not hide valid usage data in another header.
    }
  }
  if (maximum >= 80) throw new Error(`META_USAGE_LIMIT: usage reached ${maximum}%`);
  if (maximum >= 60) await new Promise((resolve) => setTimeout(resolve, 30_000));
}

async function fetchRows(db, config, startDate) {
  const columns = new Set(['ad_name', 'adset_name', 'campaign_name', config.target, 'final_creative_link', 'video_id', 'video_url', 'date']);
  columns.add('ad_id');
  const select = [...columns].join(',');
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = db.from(config.table).select(select)
      .gte('date', startDate).order('date', { ascending: false });
    query = query.order('ad_id', { ascending: true });
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < PAGE_SIZE) break;
  }
  return rows;
}


function collectImageUrls(value, out = new Set(), key = '', maxUrls = 100) {
  if (out.size >= maxUrls) return out;
  if (typeof value === 'string' && /^(https?):\/\//i.test(value)
      && /(image|picture|thumbnail|url)/i.test(key)) out.add(value);
  else if (Array.isArray(value)) value.forEach((item) => collectImageUrls(item, out, key, maxUrls));
  else if (value && typeof value === 'object') {
    for (const [childKey, child] of Object.entries(value)) {
      collectImageUrls(child, out, childKey, maxUrls);
      if (out.size >= maxUrls) break;
    }
  }
  return out;
}

export function isAllowedMetaImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && !url.username
      && !url.password
      && (!url.port || url.port === '443')
      && (url.hostname === 'facebook.com' || url.hostname.endsWith('.facebook.com')
        || url.hostname === 'fbcdn.net' || url.hostname.endsWith('.fbcdn.net'));
  } catch {
    return false;
  }
}

export function resolveAllowedMetaRedirect(currentUrl, location) {
  const resolved = new URL(location, currentUrl).toString();
  if (!isAllowedMetaImageUrl(resolved)) throw new Error(`disallowed Meta image redirect: ${resolved}`);
  return resolved;
}

export async function readResponseBodyWithLimit(response, limit = MAX_IMAGE_BYTES) {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    throw new Error(`image exceeds ${limit} bytes`);
  }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new Error(`image exceeds ${limit} bytes`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

export async function decodeImageDimensions(buffer) {
  if (!imageDimensions(buffer)) throw new Error('unsupported image payload');
  try {
    const image = sharp(buffer, { failOn: 'error', limitInputPixels: 25_000_000, sequentialRead: true });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || !metadata.format) throw new Error('missing decoded metadata');
    await image.clone().resize(1, 1, { fit: 'inside' }).raw().toBuffer();
    return { width: metadata.width, height: metadata.height, format: metadata.format };
  } catch (error) {
    throw new Error(`invalid image payload: ${error.message}`);
  }
}

async function fetchAllowedMetaImage(initialUrl, budget) {
  let currentUrl = initialUrl;
  for (let redirectCount = 0; redirectCount <= MAX_IMAGE_REDIRECTS; redirectCount += 1) {
    if (!isAllowedMetaImageUrl(currentUrl)) throw new Error(`disallowed Meta image URL: ${currentUrl}`);
    claimRequest(budget);
    const response = await fetch(currentUrl, { redirect: 'manual', signal: AbortSignal.timeout(30_000) });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get('location');
    if (!location) throw new Error(`Meta image redirect ${response.status} has no location`);
    if (redirectCount === MAX_IMAGE_REDIRECTS) throw new Error('too many Meta image redirects');
    currentUrl = resolveAllowedMetaRedirect(currentUrl, location);
  }
  throw new Error('too many Meta image redirects');
}

async function creativeMedia(adId, token, expectedAccountId, client, budget) {
  const ad = await graph(adId, token, {
    fields: 'account_id,creative{id,image_url,thumbnail_url,image_hash,video_id,object_story_spec,asset_feed_spec}',
  }, budget);
  assertExpectedMetaAccount(ad.account_id, expectedAccountId, client);
  const creative = ad.creative || {};
  const urls = collectImageUrls(creative);
  const hashes = new Set();
  if (creative.image_hash) hashes.add(creative.image_hash);
  for (const image of creative.asset_feed_spec?.images || []) if (image.hash) hashes.add(image.hash);
  if (hashes.size && ad.account_id) {
    const images = await graph(`act_${ad.account_id}/adimages`, token, {
      fields: 'hash,url,url_128,width,height', hashes: JSON.stringify([...hashes]), limit: 100,
    }, budget);
    for (const image of images.data || []) if (image.url) urls.add(image.url);
  }
  const videoId = clean(creative.video_id || creative.object_story_spec?.video_data?.video_id);
  let videoUrl = '';
  if (videoId) {
    try {
      const video = await graph(videoId, token, { fields: 'source,picture,thumbnails' }, budget);
      videoUrl = clean(video.source);
      if (video.picture) urls.add(video.picture);
      for (const item of video.thumbnails?.data || []) if (item.uri) urls.add(item.uri);
    } catch (error) {
      if (error.message === BUDGET_EXHAUSTED || String(error.message).startsWith('META_USAGE_LIMIT')) throw error;
      console.error(`video ${videoId}: ${error.message}`);
    }
  }
  return { urls: [...urls], videoUrl };
}

async function downloadBest(urls, budget) {
  let best = null;
  for (const url of [...urls].slice(0, 100)) {
    if (!isAllowedMetaImageUrl(url)) continue;
    try {
      const response = await fetchAllowedMetaImage(url, budget);
      if (!response.ok) continue;
      const responseContentType = (response.headers.get('content-type') || '').split(';')[0];
      if (!responseContentType.startsWith('image/')) continue;
      const buffer = await readResponseBodyWithLimit(response);
      const decoded = await decodeImageDimensions(buffer);
      const dimensions = { width: decoded.width, height: decoded.height };
      if (!isRenderableImage(dimensions)) continue;
      const contentType = ({ jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' })[decoded.format];
      if (!contentType) continue;
      const area = dimensions.width * dimensions.height;
      if (!best || area > best.area) best = { buffer, contentType, dimensions, area };
    } catch (error) {
      if (error.message === BUDGET_EXHAUSTED) throw error;
      console.error(`download skipped: ${error.message}`);
    }
  }
  return best;
}

function extension(contentType) {
  return ({ 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' })[contentType] || 'jpg';
}

async function ensureBucket(db) {
  const { data } = await db.storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await db.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 20 * 1024 * 1024 });
    if (error && !/already exists/i.test(error.message)) throw error;
  }
}

async function persist(db, client, config, row, adId, media) {
  const digest = createHash('sha256').update(media.buffer).digest('hex').slice(0, 24);
  const objectPath = `${client}/${adId}/${digest}.${extension(media.contentType)}`;
  const { error: uploadError } = await db.storage.from(BUCKET)
    .upload(objectPath, media.buffer, { contentType: media.contentType, upsert: false, cacheControl: '31536000' });
  const created = !uploadError;
  const alreadyExists = String(uploadError?.statusCode ?? uploadError?.status ?? '') === '409';
  if (uploadError && !alreadyExists) throw uploadError;
  const publicUrl = db.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
  const update = { [config.target]: publicUrl };
  if (media.videoUrl) update.video_url = media.videoUrl;
  let query = db.from(config.table).update(update);
  query = query.eq('ad_id', adId);
  query = query.eq('date', row.date);
  const { data, error } = await query.select('date');
  if (error || !data?.length) {
    if (created) await db.storage.from(BUCKET).remove([objectPath]);
    if (error) throw error;
    throw new Error(`No ${config.table} row matched ${adId} on ${row.date}`);
  }
  return publicUrl;
}

async function runClient(client, config, options) {
  const token = tokenFor(client);
  if (!token) throw new Error(`Missing Meta token for ${client}`);
  const expectedAccountId = expectedAccountFor(client);
  if (!expectedAccountId) throw new Error(`Missing expected Meta account for ${client}`);
  const db = dbFor(config.project);
  const rows = (await fetchRows(db, config, options.start)).filter((row) =>
    needsDurablePreview(clean(row[config.target]) || clean(row.final_creative_link)));
  if (options.apply) await ensureBucket(db);
  const mediaByAdId = new Map();
  let updated = 0;
  let unresolved = 0;
  let attempted = 0;
  let deferred = 0;
  let checkpoint = '';
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const adId = clean(row.ad_id);
    if (!options.budget.claimCandidate()) {
      deferred = rows.length - index;
      checkpoint = `${client}:${row.date}:${adId || 'missing-ad-id'}`;
      break;
    }
    attempted += 1;
    if (!adId) { unresolved += 1; console.error(`${client}: unresolved ad ${row.ad_name}`); continue; }
    try {
      let mediaPromise = mediaByAdId.get(adId);
      if (!mediaPromise) {
        mediaPromise = (async () => {
          const creative = await creativeMedia(adId, token, expectedAccountId, client, options.budget);
          const image = await downloadBest(creative.urls, options.budget);
          if (!image) throw new Error('no renderable image');
          return { creative, image };
        })();
        mediaByAdId.set(adId, mediaPromise);
      }
      const { creative, image } = await mediaPromise;
      if (options.apply) await persist(db, client, config, row, adId, { ...image, videoUrl: creative.videoUrl });
      updated += 1;
      console.log(`${options.apply ? 'updated' : 'would update'} ${client}/${adId} ${row.date} ${image.dimensions.width}x${image.dimensions.height}`);
    } catch (error) {
      if (error.message === BUDGET_EXHAUSTED) {
        mediaByAdId.delete(adId);
        deferred = rows.length - index;
        checkpoint = `${client}:${row.date}:${adId}`;
        break;
      }
      if (String(error.message).startsWith('META_USAGE_LIMIT')) throw error;
      unresolved += 1;
      console.error(`${client}/${adId}/${row.date}: ${error.message}`);
    }
  }
  return { client, candidates: rows.length, attempted, updated, unresolved, deferred, checkpoint, applied: options.apply };
}

function positiveIntegerArg(argv, name, fallback) {
  const raw = argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`--${name} must be a positive integer`);
  return value;
}

function parseArgs(argv) {
  if (!GRAPH_VERSION || !/^v\d+\.\d+$/.test(GRAPH_VERSION)) {
    throw new Error('META_GRAPH_VERSION is required (for example, vXX.0)');
  }
  const apply = argv.includes('--apply');
  const clientArg = argv.find((arg) => arg.startsWith('--client='))?.split('=')[1] || '';
  const daysArg = Number(argv.find((arg) => arg.startsWith('--days='))?.split('=')[1] || 120);
  if (!Number.isFinite(daysArg) || daysArg < 1) throw new Error('--days must be a positive number');
  const start = new Date(Date.now() - daysArg * 86400000).toISOString().slice(0, 10);
  const clients = clientArg ? clientArg.split(',').map((v) => v.trim()) : Object.keys(CLIENTS);
  for (const client of clients) if (!CLIENTS[client]) throw new Error(`Unknown client: ${client}`);
  return {
    apply,
    clients,
    start,
    maxCandidates: positiveIntegerArg(argv, 'max-candidates', process.env.META_SYNC_MAX_CANDIDATES || 500),
    maxRequests: positiveIntegerArg(argv, 'max-requests', process.env.META_SYNC_MAX_REQUESTS || 2000),
    maxRuntimeMs: positiveIntegerArg(argv, 'max-runtime-seconds', process.env.META_SYNC_MAX_RUNTIME_SECONDS || 2400) * 1000,
  };
}

export async function runClients(options, runner = runClient) {
  const budget = options.budget ?? createSyncBudget({
    maxCandidates: options.maxCandidates ?? Number.MAX_SAFE_INTEGER,
    maxRequests: options.maxRequests ?? Number.MAX_SAFE_INTEGER,
    maxRuntimeMs: options.maxRuntimeMs ?? Number.MAX_SAFE_INTEGER,
  });
  const results = [];
  const failures = [];
  for (const client of options.clients) {
    try {
      results.push(await runner(client, CLIENTS[client], { ...options, budget }));
    } catch (error) {
      failures.push({ client, error: error.message });
      console.error(`${client}: ${error.message}`);
    }
  }
  const deferred = results.reduce((total, result) => total + (result.deferred ?? 0), 0);
  const checkpoint = results.find((result) => result.checkpoint)?.checkpoint ?? '';
  return { results, failures, deferred, checkpoint, complete: failures.length === 0 && deferred === 0, budget: budget.snapshot() };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.apply) console.error('DRY RUN: pass --apply to upload and update rows');
  const outcome = await runClients(options);
  console.log(JSON.stringify(outcome, null, 2));
  const { results, failures } = outcome;
  if (!outcome.complete) process.exitCode = 2;
  if (failures.length > 0 || results.some((result) => result.unresolved > 0)) process.exitCode = 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
