# Spartaco — Ad Analysis (Creative Analysis) page

Reference for the `/dashboard/spartaco/creatives` page. It is the Spartaco
equivalent of the PrePass `/dashboard/creatives` page, adapted to Spartaco's
three ad accounts and its **Leads-only** (no MQL/SQL/WON) funnel.

## What it is

A creative-level, ad-by-ad analysis for Spartaco's three accounts —
**Jameson**, **Huskie**, and **Ronin** — showing the real Meta + Google
Search ad creatives, KPI rollups, top performers, and the AI verdict from the
Creative Deep Dive. PrePass = one account / three focuses; Spartaco = three
accounts, each its own ad accounts and Supabase tables.

- **Route:** `src/app/dashboard/spartaco/creatives/page.tsx` (Server Component).
- **Sidebar / tab:** "Ad Analysis" under Spartaco (sidebar in `dashboard/layout.tsx`,
  tab in `SpartacoFilterBar`).
- **Leads only.** There is no Sales toggle — the page is lead-gen focused.
- **Meta + Google Search** creatives per account.
- **English-only UI** (standing rule).

## Architecture

```
page.tsx (server) → requireClientAccess('spartaco')
                  → spartacoParamsFromSearch(searchParams)
                  → fetchSpartacoCreativeAnalysis('LEAD', params)  [services/spartaco-analytics.ts]
                  → <SpartacoCreativeAnalysisClient data={...} />   [components/]
```

All Supabase access is in `spartaco-analytics.ts` via the service-role client
(`createSpartacoSupabaseClient`). No queries in the page or component.

## Data sources (Spartaco Supabase `lozgnyxixzfxokllevtb`)

| Block | Source | Notes |
|-------|--------|-------|
| Meta creatives + metrics | `jameson_meta_ads` / `huskie_meta_ads` / `ronin_meta_ads` | One block per account. Filtered to `LEAD` campaigns, rolled up by `ad_id`, then **aggregated by ad NAME** (see below). |
| Google Search creatives | `spartaco_google_search` (col `brand`) | Per account, rolled up by `ad_id` → `GoogleCreative` (`headline_1 \| headline_2`, `description_1`). Populated by n8n workflow `WiRjyuxAz9CoLV5W`. |
| AI insight (primary) | `spartaco_creative_ai_insights` (one row per brand/day, latest by `as_of_date`) | **Vision-based**, structured per-brand insight written daily by n8n workflow **`yAmZDthBvVV4RKFV`** ("Spartaco Creative Vision Insights"). Claude **Sonnet 4.6** actually *sees* the ad creatives — static images (`final_creative_link`) and video frames (Meta `thumbnails` edge) of the last 30 days — and returns `summary`, `video_vs_image`, `what_works[]`, `improvements[]`, `next_creative_brief`. Read by `fetchSpartacoAiInsights`. |
| AI insight (legacy fallback) | `spartaco_clickup_comments`, `clickup_task_id = '86b8axxp4'`, latest `comment_text LIKE '%Creative Detail%'` | The text-only `📊 Creative Detail — Spartaco` comment from `Ml9nbWcwWqkUNsfc` (Creative Deep Dive, Mon+Thu). Only rendered when no `spartaco_creative_ai_insights` row exists for any brand. |

### Leads only + ad-name aggregation

The page is **Leads only** — `rollupMetaAds` keeps `LEAD` campaigns and shows
Leads + Cost/Lead (no Sales toggle, no ROAS). After the `ad_id` rollup,
`aggregateMetaAdsByName` merges variants that share the same **ad name**
(case-insensitive), summing metrics across campaigns/ad sets so the same creative
appears **once**. The highest-spend variant supplies the display name/campaign/
creative; if it has no usable image, a variant that does wins the preview.

## Filters

| Filter | State | Effect |
|--------|-------|--------|
| Date range / comparison | URL (`SpartacoFilterBar`) | Server refetch. Default = last 30 days. |
| Brand (account) | URL `?brand=` | Scopes to one account; `all` shows all three blocks. |

The `creatives` tab hides the Channel/Campaign selects (account-scoped).

## Page blocks (top → bottom)

1. **AI Creative Insights** (once): a banner explaining the insights are generated
   daily from the real creatives, with an "as of <date>" label (latest
   `as_of_date` across brands). Falls back to the legacy cross-account `📝 Copywriter
   Note` only when no `spartaco_creative_ai_insights` rows exist.
2. **Per account** (Jameson / Huskie / Ronin):
   - **KPI strip** — Spend, Impressions, Clicks, CTR, CPC, Leads, Cost/Lead
     (North Star = Cost/Lead).
   - **AI Creative Insight** (`BrandAiInsightCard`) — the structured vision insight
     for that brand: `summary`, Video-vs-Image verdict, "What's working"
     (point + evidence), "Improvements to test" (point + why), "Next creative to test".
     Falls back to the legacy `📸` deep-dive verdict if no AI row for the brand.
   - **Top Performers by Cost** — champion cards among ads with ≥ $200 spend:
     Best Cost/Lead · Most Leads · Best CTR. Thumbnails use `object-contain` (no
     crop) with a graceful fallback when the image is missing/broken. Shows a
     "widen the range" notice when nothing qualifies.
   - **Meta Ad Creatives** — shared `MetaAdPreviews`: Facebook-style mockups +
     Preview/Table toggle + Sort By + inline video modal.
   - **Google Search Ads** — shared `GoogleAdPreviews` (per-account `title`):
     SERP-style mockups + Preview/Table toggle. Only renders when the account has
     Google data.

## Insight parsing (`parseSpartacoCreativeInsight`)

The deep-dive comment is one text blob: per-account sections split by `---`, each
headed `*Jameson*` / `*Huskie*` / `*Ronin*` with a `📸 META — Video vs Image`
verdict, a `🏆 META Top Ads` list, and a `🔍 GOOGLE` list, then a single
cross-account `📝 Copywriter Note`. The parser extracts:

- `brandVerdicts[brand]` — the `📸` block up to the next `🏆` (the `🏆`/`🔍` lists
  are skipped since the previews already show the top ads).
- `copywriterNote` — the `📝` block, one entry per line/bullet.

Defensive: if the markers move, fields fall back to empty rather than throwing.

## Key files

- `src/services/spartaco-analytics.ts` — `fetchSpartacoCreativeAnalysis`,
  `parseSpartacoCreativeInsight`, the `Spartaco Creative*` types, and a `limit`
  param added to the shared `rollupMetaAds` (default 20; the page passes ∞).
- `src/app/dashboard/spartaco/creatives/page.tsx` — server page.
- `src/components/SpartacoCreativeAnalysisClient.tsx` — all UI.
- `src/components/AdPreviews.tsx` — shared `MetaAdPreviews` + `GoogleAdPreviews`
  (reused). Two small backward-compatible additions: `GoogleAdPreviews` takes an
  optional `title`, and `MetaAdCard` falls back to its gradient when the creative
  image fails to load (`onError`) — fixes broken/expired Meta CDN thumbnails.
- `src/components/SpartacoFilterBar.tsx` — "Ad Analysis" tab + creatives-tab filter.
- `src/app/dashboard/layout.tsx` — sidebar link.

## AI insight workflow — "Spartaco Creative Vision Insights" (`yAmZDthBvVV4RKFV`)

Daily (cron `0 9 * * *`, ~9AM UTC) n8n workflow that gives Claude **vision** over
the real creatives — the thing the old text-only Deep Dive could not do.

Node flow:

```
Daily 9AM UTC (schedule)
  ├─ Get Meta Ads (Postgres) ── reads jameson/huskie/ronin_meta_ads, last 30d,
  │     rollup by ad_id, top 10 per brand by spend (>= $10)
  │       └─ Collect Video IDs (Code) → Fetch Video Thumbnails (HTTP, Meta token)
  │            └─ Build Brand Requests (Code) → assembles 1 Anthropic Messages
  │                 request per brand: metrics + image blocks (image-by-URL).
  │                 Static ads use final_creative_link; video ads use 1–2 frames
  │                 from Meta's /{video_id}?fields=thumbnails edge (no ffmpeg needed).
  │                   └─ Has Data? (IF)
  │                        ├─ true → Claude Vision (HTTP → api.anthropic.com,
  │                        │           model claude-sonnet-4-6) → Parse Insight
  │                        │           (Code, builds upsert SQL) → Run Upsert SQL
  │                        └─ false → No-Data Row (Code) → Run Upsert SQL
  └─ Get Google (Postgres) ── top Search ads per brand (text context for the prompt)
```

- Writes one row per `(brand, as_of_date)` into `spartaco_creative_ai_insights`
  (upsert). Brands with no qualifying ads get a `has_data=false` row.
- **Credentials:** Postgres `Postgres account 3` (Spartaco DB), Meta
  `EIC Facebook Data Puller API Token` (httpBearerAuth) on *Fetch Video Thumbnails*,
  Anthropic `Anthropic (Claude)` (`anthropicApi`) on *Claude Vision*. After any
  REST/SDK workflow update, **re-verify** these three HTTP/Postgres creds.
- **Testing:** the n8n public API has no execute endpoint — run it manually from the
  n8n UI ("Execute Workflow") and check the `spartaco_creative_ai_insights` row
  count. The workflow ships **inactive**; activate after a green manual run.
- Built locally from `scratch_wf/vision/*.js` + `skeleton.json`, assembled into
  `vision_workflow.json` (Code nodes injected as JSON-escaped strings to avoid the
  PowerShell `ConvertTo-Json` pitfall), then POSTed to the n8n REST API.

## Known limitations

- **Insight reflects the deep dive's own last-30-day window**, not the page's
  selected date range — hence the "as of <date>" label.
- **No period-over-period deltas** on the KPI strip (the page fetches the current
  window only).
- **Google Search mockup chrome** (the SERP favicon/site name in `GoogleAdCard`)
  is the shared generic one; only the section `title` is per-account.
