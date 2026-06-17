# Spartaco — Ad Analysis (Creative Analysis) page

Reference for the `/dashboard/spartaco/creatives` page. It is the Spartaco
equivalent of the PrePass `/dashboard/creatives` page, adapted to Spartaco's
three ad accounts and its **Leads-only** (no MQL/SQL/WON) funnel.

## What it is

A creative-level, ad-by-ad analysis for Spartaco's three accounts —
**Jameson**, **Ruski (Huskie)**, and **Ronin** — showing the real Meta + Google
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
| AI insight | `spartaco_clickup_comments`, `clickup_task_id = '86b8axxp4'`, latest `comment_text LIKE '%Creative Detail%'` | The `📊 Creative Detail — Spartaco` comment posted by n8n workflow `Ml9nbWcwWqkUNsfc` (Spartaco Creative Deep Dive, Mon+Thu) → ClickUp → synced into Supabase. No n8n change needed. |

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

1. **AI Creative Insights** (once): the cross-account `📝 Copywriter Note` from the
   deep dive, with an "as of <date>" label. Hidden when no deep-dive comment exists.
2. **Per account** (Jameson / Ruski(Huskie) / Ronin):
   - **KPI strip** — Spend, Impressions, Clicks, CTR, CPC, Leads, Cost/Lead
     (North Star = Cost/Lead).
   - **Video vs Image verdict** — the `📸` block for that account from the deep dive.
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

## Known limitations

- **Insight reflects the deep dive's own last-30-day window**, not the page's
  selected date range — hence the "as of <date>" label.
- **No period-over-period deltas** on the KPI strip (the page fetches the current
  window only).
- **Google Search mockup chrome** (the SERP favicon/site name in `GoogleAdCard`)
  is the shared generic one; only the section `title` is per-account.
