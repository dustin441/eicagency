import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const root = process.argv[2] || '/tmp/goodgame-social';
const url = process.env.EIC_CONTENT_SUPABASE_URL;
const key = process.env.EIC_CONTENT_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Missing EIC_CONTENT_SUPABASE_URL/EIC_CONTENT_SUPABASE_SERVICE_ROLE_KEY');
const db = createClient(url, key, { auth: { persistSession: false } });

function parseCsv(text) {
  const rows = [];
  let cell = '', row = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') { cell += '"'; i++; } else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) { row.push(cell); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !inQuotes) { if (ch === '\r' && next === '\n') i++; row.push(cell); if (row.some(v => v.trim())) rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  row.push(cell); if (row.some(v => v.trim())) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.replace(/^\uFEFF/, '').trim());
  return rows.slice(1).map(values => Object.fromEntries(headers.map((h, i) => [h, (values[i] || '').trim()])));
}
const text = (r,k) => { const v = (r[k] || '').trim(); return v && v !== '--' ? v : null; };
const n = (r,k) => { const v = text(r,k); if (!v) return 0; const x = Number.parseFloat(v.replace(/[$,%x,\s]/g,'')); return Number.isFinite(x) ? x : 0; };
const i = (r,k) => Math.trunc(n(r,k));
const on = (r,k) => text(r,k) ? n(r,k) : null;
function parseDate(value) { const m = value?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}` : value; }
function parseDateTime(value) { const m = value?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/); return m ? `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}T${m[4].padStart(2,'0')}:${m[5]}:00-07:00` : value; }
function rangeFromName(fileName) { const months = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'}; const m = fileName.match(/([A-Z][a-z]{2})-(\d{2})-(\d{4})_([A-Z][a-z]{2})-(\d{2})-(\d{4})/); return m ? {start:`${m[3]}-${months[m[1]]}-${m[2]}`,end:`${m[6]}-${months[m[4]]}-${m[5]}`} : {start:null,end:null}; }
async function walk(dir) { const out=[]; for (const ent of await fs.readdir(dir,{withFileTypes:true})) { const p=path.join(dir, ent.name); if (ent.isDirectory()) out.push(...await walk(p)); else if (p.toLowerCase().endsWith('.csv')) out.push(p); } return out; }

const files = await walk(root);
let contentFileNames=[], profileFileNames=[], postRows=[], dailyRows=[], brand=null, start=null, end=null;
for (const file of files) {
  const rows = parseCsv(await fs.readFile(file, 'utf8'));
  if (!rows.length) continue;
  const headers = Object.keys(rows[0]);
  const rel = path.relative(root, file);
  const r = rangeFromName(path.basename(file)); start ||= r.start; end ||= r.end;
  if (headers.includes('Post ID') && headers.includes('Publish time')) {
    contentFileNames.push(rel);
    for (const row of rows) {
      const pageName = text(row,'Page name'); const b = pageName || path.dirname(rel).split(path.sep)[0] || 'Good Game'; brand ||= b;
      if (!text(row,'Post ID')) continue;
      postRows.push({brand:b,platform:'Facebook',post_id:text(row,'Post ID'),page_id:text(row,'Page ID'),page_name:pageName,title:text(row,'Title'),duration_seconds:i(row,'Duration (sec)'),publish_time:parseDateTime(text(row,'Publish time')),permalink:text(row,'Permalink'),post_type:text(row,'Post type'),data_comment:text(row,'Data comment'),comments:i(row,'Comments'),distribution:on(row,'Distribution'),approximate_earnings:n(row,'Approximate earnings (USD)'),content_monetization:n(row,'Content monetization (USD)'),in_stream_ads:n(row,'In-stream ads (USD)'),stars:n(row,'Stars (USD)'),impressions:i(row,'Impressions'),interactions:i(row,'Interactions'),net_follows:i(row,'Net follows'),reactions:i(row,'Reactions'),saves:i(row,'Saves'),shares:i(row,'Shares'),viewers:i(row,'Viewers'),views:i(row,'Views'),average_seconds_viewed:on(row,'Average Seconds viewed'),seconds_viewed:on(row,'Seconds viewed'),raw:row});
    }
  } else if (headers.includes('Comments and replies')) {
    profileFileNames.push(rel);
    for (const row of rows) {
      const pageName = text(row,'Page name'); const b = pageName || path.dirname(rel).split(path.sep)[0] || 'Good Game'; brand ||= b;
      dailyRows.push({brand:b,platform:'Facebook',page_id:text(row,'Page ID'),page_name:pageName,metric_date:parseDate(text(row,'Date')),data_comment:text(row,'Data comment'),approximate_earnings:n(row,'Approximate earnings (USD)'),content_monetization:n(row,'Content monetization (USD)'),in_stream_ads:n(row,'In-stream ads (USD)'),stars:n(row,'Stars (USD)'),impressions:i(row,'Impressions'),interactions:i(row,'Interactions'),net_follows:i(row,'Net follows'),reactions:i(row,'Reactions'),shares:i(row,'Shares'),comments_and_replies:i(row,'Comments and replies'),viewers:i(row,'Viewers'),views:i(row,'Views'),raw:row});
    }
  }
}
const {data: batch, error: batchError} = await db.from('goodgame_organic_social_imports').insert({source_label:`${brand || 'Good Game'} organic social sample import`,brand,report_start_date:start,report_end_date:end,content_file_names:contentFileNames,profile_file_names:profileFileNames,created_by:'Hermes import from provided Drive folder'}).select('id').single();
if (batchError) throw batchError;
const stamp = new Date().toISOString();
if (postRows.length) { const {error} = await db.from('goodgame_organic_social_posts').upsert(postRows.map(r=>({...r,import_id:batch.id,updated_at:stamp})), {onConflict:'platform,page_id,post_id,publish_time'}); if (error) throw error; }
if (dailyRows.length) { const {error} = await db.from('goodgame_organic_social_daily_metrics').upsert(dailyRows.map(r=>({...r,import_id:batch.id,updated_at:stamp})), {onConflict:'platform,page_id,metric_date'}); if (error) throw error; }
console.log(JSON.stringify({files:files.length, brand, postRows:postRows.length, dailyRows:dailyRows.length, importId:batch.id}, null, 2));
