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
 *   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (PrePass)
 *   SPARTACO_SUPABASE_URL + SPARTACO_SUPABASE_SERVICE_ROLE_KEY (other clients)
 * Optional for legacy tables without ad_id:
 *   META_ACCOUNT_ID_CBA, META_ACCOUNT_ID_BLOOM
 */
import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'node:url';

const GRAPH_VERSION = clean(process.env.META_GRAPH_VERSION);
const GRAPH_ROOT = `https://graph.facebook.com/${GRAPH_VERSION}`;
const BUCKET = 'meta-creative-previews';
const PAGE_SIZE = 1000;
const MIN_LONG_EDGE = 480;
const MIN_SHORT_EDGE = 270;

export const CLIENTS = {
  prepass: { project: 'eic', table: 'meta_ads_creatives', target: 'permanent_image_url', id: true },
  ihh: { project: 'spartaco', table: 'ihh_meta_ads_creatives', target: 'permanent_image_url', id: true },
  arabella: { project: 'spartaco', table: 'arabella_meta_ads_creatives', target: 'permanent_image_url', id: true },
  cba: { project: 'spartaco', table: 'cba_meta_ads', target: 'permanent_image_url', id: false },
  bloom: { project: 'spartaco', table: 'bloom_meta_ads', target: 'permanent_image_url', id: false },
  kinsey: { project: 'spartaco', table: 'kinsey_meta_ads_creatives', target: 'permanent_image_url', id: true },
  champagne: { project: 'spartaco', table: 'champagne_meta_ads_creatives', target: 'final_creative_link', id: true },
  jameson: { project: 'spartaco', table: 'jameson_meta_ads', target: 'final_creative_link', id: true },
  huskie: { project: 'spartaco', table: 'huskie_meta_ads', target: 'final_creative_link', id: true },
  ronin: { project: 'spartaco', table: 'ronin_meta_ads', target: 'final_creative_link', id: true },
};

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
    return /(^|\.)(fbcdn\.net|[^.]*\.fna\.fbcdn\.net)$/i.test(parsed.hostname);
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

function accountFor(client) {
  return clean(process.env[`META_ACCOUNT_ID_${client.toUpperCase()}`]).replace(/^act_/, '');
}

function dbFor(project) {
  const url = project === 'eic' ? process.env.NEXT_PUBLIC_SUPABASE_URL : process.env.SPARTACO_SUPABASE_URL;
  const key = project === 'eic' ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.SPARTACO_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error(`Missing ${project} Supabase credentials`);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function graph(path, token, params = {}) {
  const url = new URL(`${GRAPH_ROOT}/${path.replace(/^\//, '')}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  url.searchParams.set('access_token', token);
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  await respectMetaUsage(response);
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(body.error?.message || `Meta HTTP ${response.status}`);
  return body;
}

async function respectMetaUsage(response) {
  const raw = response.headers.get('x-business-use-case-usage') || response.headers.get('x-app-usage');
  if (!raw) return;
  console.error(`Meta usage: ${raw}`);
  let maximum = 0;
  try {
    const visit = (value) => {
      if (typeof value === 'number') maximum = Math.max(maximum, value);
      else if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') Object.values(value).forEach(visit);
    };
    visit(JSON.parse(raw));
  } catch {
    return;
  }
  if (maximum >= 80) throw new Error(`META_USAGE_LIMIT: usage reached ${maximum}%`);
  if (maximum >= 60) await new Promise((resolve) => setTimeout(resolve, 30_000));
}

async function fetchRows(db, config, startDate) {
  const columns = new Set(['ad_name', 'adset_name', 'campaign_name', config.target, 'final_creative_link', 'video_id', 'video_url', 'date']);
  if (config.id) columns.add('ad_id');
  const select = [...columns].join(',');
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db.from(config.table).select(select)
      .gte('date', startDate).order('date', { ascending: false }).range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < PAGE_SIZE) break;
  }
  const unique = new Map();
  for (const row of rows) {
    const key = clean(row.ad_id) || `${clean(row.ad_name)}\u0000${clean(row.adset_name)}\u0000${clean(row.campaign_name)}`;
    if (key && !unique.has(key)) unique.set(key, row);
  }
  return [...unique.values()];
}

async function accountAdMap(accountId, token) {
  if (!accountId) throw new Error('Legacy table requires META_ACCOUNT_ID_<CLIENT>');
  const out = new Map();
  let next = `${GRAPH_ROOT}/act_${accountId}/ads?fields=id,name,campaign{id,name},adset{id,name}&limit=500&access_token=${encodeURIComponent(token)}`;
  while (next) {
    const response = await fetch(next, { signal: AbortSignal.timeout(30_000) });
    await respectMetaUsage(response);
    const body = await response.json();
    if (!response.ok || body.error) throw new Error(body.error?.message || `Meta HTTP ${response.status}`);
    for (const ad of body.data || []) {
      const key = `${clean(ad.name)}\u0000${clean(ad.adset?.name)}\u0000${clean(ad.campaign?.name)}`;
      if (key) out.set(key, clean(ad.id));
    }
    next = clean(body.paging?.next);
  }
  return out;
}

function collectImageUrls(value, out = new Set(), key = '') {
  if (typeof value === 'string' && /^(https?):\/\//i.test(value)
      && /(image|picture|thumbnail|url)/i.test(key)) out.add(value);
  else if (Array.isArray(value)) value.forEach((item) => collectImageUrls(item, out, key));
  else if (value && typeof value === 'object') {
    for (const [childKey, child] of Object.entries(value)) collectImageUrls(child, out, childKey);
  }
  return out;
}

export function isAllowedMetaImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && (url.hostname === 'facebook.com' || url.hostname.endsWith('.facebook.com')
        || url.hostname === 'fbcdn.net' || url.hostname.endsWith('.fbcdn.net'));
  } catch {
    return false;
  }
}

async function creativeMedia(adId, token) {
  const ad = await graph(adId, token, {
    fields: 'account_id,creative{id,image_url,thumbnail_url,image_hash,video_id,object_story_spec,asset_feed_spec}',
  });
  const creative = ad.creative || {};
  const urls = collectImageUrls(creative);
  const hashes = new Set();
  if (creative.image_hash) hashes.add(creative.image_hash);
  for (const image of creative.asset_feed_spec?.images || []) if (image.hash) hashes.add(image.hash);
  if (hashes.size && ad.account_id) {
    const images = await graph(`act_${ad.account_id}/adimages`, token, {
      fields: 'hash,url,url_128,width,height', hashes: JSON.stringify([...hashes]), limit: 100,
    });
    for (const image of images.data || []) if (image.url) urls.add(image.url);
  }
  const videoId = clean(creative.video_id || creative.object_story_spec?.video_data?.video_id);
  let videoUrl = '';
  if (videoId) {
    try {
      const video = await graph(videoId, token, { fields: 'source,picture,thumbnails' });
      videoUrl = clean(video.source);
      if (video.picture) urls.add(video.picture);
      for (const item of video.thumbnails?.data || []) if (item.uri) urls.add(item.uri);
    } catch (error) {
      if (String(error.message).startsWith('META_USAGE_LIMIT')) throw error;
      console.error(`video ${videoId}: ${error.message}`);
    }
  }
  return { urls: [...urls], videoUrl };
}

async function downloadBest(urls) {
  let best = null;
  for (const url of urls) {
    if (!isAllowedMetaImageUrl(url)) continue;
    try {
      const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30_000) });
      if (!response.ok) continue;
      const contentType = (response.headers.get('content-type') || '').split(';')[0];
      if (!contentType.startsWith('image/')) continue;
      const buffer = Buffer.from(await response.arrayBuffer());
      const dimensions = imageDimensions(buffer);
      if (!isRenderableImage(dimensions)) continue;
      const area = dimensions.width * dimensions.height;
      if (!best || area > best.area) best = { buffer, contentType, dimensions, area };
    } catch (error) {
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
  const objectPath = `${client}/${adId}.${extension(media.contentType)}`;
  const { error: uploadError } = await db.storage.from(BUCKET)
    .upload(objectPath, media.buffer, { contentType: media.contentType, upsert: true, cacheControl: '31536000' });
  if (uploadError) throw uploadError;
  const publicUrl = db.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
  const update = { [config.target]: publicUrl };
  if (media.videoUrl) update.video_url = media.videoUrl;
  let query = db.from(config.table).update(update);
  if (config.id) query = query.eq('ad_id', adId);
  else query = query.eq('ad_name', row.ad_name).eq('adset_name', row.adset_name).eq('campaign_name', row.campaign_name);
  const { error } = await query;
  if (error) throw error;
  return publicUrl;
}

async function runClient(client, config, options) {
  const token = tokenFor(client);
  if (!token) throw new Error(`Missing Meta token for ${client}`);
  const db = dbFor(config.project);
  const rows = (await fetchRows(db, config, options.start)).filter((row) =>
    needsDurablePreview(clean(row[config.target]) || clean(row.final_creative_link)));
  const adMap = config.id ? null : await accountAdMap(accountFor(client), token);
  if (options.apply) await ensureBucket(db);
  let updated = 0;
  let unresolved = 0;
  for (const row of rows) {
    const lookup = `${clean(row.ad_name)}\u0000${clean(row.adset_name)}\u0000${clean(row.campaign_name)}`;
    const adId = clean(row.ad_id) || clean(adMap?.get(lookup));
    if (!adId) { unresolved += 1; console.error(`${client}: unresolved ad ${row.ad_name}`); continue; }
    try {
      const creative = await creativeMedia(adId, token);
      const image = await downloadBest(creative.urls);
      if (!image) { unresolved += 1; console.error(`${client}/${adId}: no renderable image`); continue; }
      if (options.apply) await persist(db, client, config, row, adId, { ...image, videoUrl: creative.videoUrl });
      updated += 1;
      console.log(`${options.apply ? 'updated' : 'would update'} ${client}/${adId} ${image.dimensions.width}x${image.dimensions.height}`);
    } catch (error) {
      if (String(error.message).startsWith('META_USAGE_LIMIT')) throw error;
      unresolved += 1;
      console.error(`${client}/${adId}: ${error.message}`);
    }
  }
  return { client, candidates: rows.length, updated, unresolved, applied: options.apply };
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
  return { apply, clients, start };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.apply) console.error('DRY RUN: pass --apply to upload and update rows');
  const results = [];
  for (const client of options.clients) results.push(await runClient(client, CLIENTS[client], options));
  console.log(JSON.stringify(results, null, 2));
  if (results.some((result) => result.unresolved > 0)) process.exitCode = 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
