# Spartaco — Ad Analysis (Creative Analysis) page

Reference for the `/dashboard/spartaco/creatives` page. It is the Spartaco
equivalent of the PrePass `/dashboard/creatives` page, adapted to Spartaco's
three ad accounts and its Leads/Sales (no MQL/SQL/WON) funnel.

## What it is

A creative-level, ad-by-ad analysis for Spartaco's three Meta accounts —
**Jameson**, **Ruski (Huskie)**, and **Ronin** — showing the real ad creatives,
KPI rollups, top performers, and the AI verdict from the Creative Deep Dive.
PrePass = one account / three focuses; Spartaco = three accounts, each its own
Meta ad account and Supabase table.

- **Route:** `src/app/dashboard/spartaco/creatives/page.tsx` (Server Component).
- **Sidebar / tab:** "Ad Analysis" under Spartaco (sidebar in `dashboard/layout.tsx`,
  tab in `SpartacoFilterBar`).
- **Meta only** for now. Google blocks are intentionally omitted.
- **English-only UI** (standing rule).

## Architecture

```
page.tsx (server) → requireClientAccess('spartaco')
                  → spartacoParamsFromSearch(searchParams)
                  → mode from ?mode= ('SALES' else 'LEAD')
                  → fetchSpartacoCreativeAnalysis(mode, params)   [services/spartaco-analytics.ts]
                  → <SpartacoCreativeAnalysisClient data={...} /> [components/]
```

All Supabase access is in `spartaco-analytics.ts` via the service-role client
(`createSpartacoSupabaseClient`). No queries in the page or component.

## Data sources (Spartaco Supabase `lozgnyxixzfxokllevtb`)

| Block | Source | Notes |
|-------|--------|-------|
| Meta creatives + metrics | `jameson_meta_ads` / `huskie_meta_ads` / `ronin_meta_ads` | One block per account. Rolled up by `ad_id`. Columns: creative fields + `impressions, clicks, cost, leads, purchases, revenue, preview_url`. |
| AI insight | `spartaco_clickup_comments`, `clickup_task_id = '86b8axxp4'`, latest `comment_text LIKE '%Creative Detail%'` | The `📊 Creative Detail — Spartaco` comment posted by n8n workflow `Ml9nbWcwWqkUNsfc` (Spartaco Creative Deep Dive, Mon+Thu) → ClickUp → synced into Supabase. No n8n change needed. |

### Lead vs Sales

Spartaco campaigns are tagged in `campaign_name` with `LEAD` or `SALES`. The page
has a **Leads | Sales toggle** (`?mode=`, default `LEAD`):

- **Leads** — `rollupMetaAds` keeps `LEAD` campaigns; KPIs/cards show Leads + Cost/Lead.
- **Sales** — keeps `SALES` campaigns; KPIs/cards show Purchases, Revenue, ROAS,
  Cost/Sale. ROAS is computed per ad in `MetaAdPreviews`'s `metricMode='sales'`.

> **Sales data is uneven.** Only Jameson currently carries meaningful `purchases`
> / `revenue`; Huskie and Ronin show clean empty states in Sales mode. Recent-30d
> Meta rows are also sparse for Huskie/Ronin — that's an upstream sync matter, not
> a page bug. Widen the date range to see history.

## Filters

| Filter | State | Effect |
|--------|-------|--------|
| Date range / comparison | URL (`SpartacoFilterBar`) | Server refetch. Default = last 30 days. |
| Brand (account) | URL `?brand=` | Scopes to one account; `all` shows all three blocks. |
| Leads / Sales | URL `?mode=` | Server refetch; switches the metric set. |

The `creatives` tab hides the Channel/Campaign selects (Meta-only, account-scoped).

## Page blocks (top → bottom)

1. **AI Creative Insights** (once): the cross-account `📝 Copywriter Note` from the
   deep dive, with an "as of <date>" label. Hidden when no deep-dive comment exists.
2. **Per account** (Jameson / Ruski(Huskie) / Ronin):
   - **KPI strip** — Spend, Impressions, Clicks, CTR, CPC + (Leads: Leads, Cost/Lead)
     / (Sales: Purchases, Revenue, ROAS, Cost/Sale). North Star = Cost/Lead (Leads)
     or ROAS (Sales).
   - **Video vs Image verdict** — the `📸` block for that account from the deep dive.
   - **Top Performers by Cost** — champion cards among ads with ≥ $200 spend:
     Leads → Best Cost/Lead · Most Leads · Best CTR; Sales → Best ROAS · Best
     Cost/Sale · Most Revenue. Shows a "widen the range" notice when nothing qualifies.
   - **Meta Ad Creatives** — shared `MetaAdPreviews`: Facebook-style mockups +
     Preview/Table toggle + Sort By + inline video modal.

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
- `src/components/AdPreviews.tsx` — shared `MetaAdPreviews` (reused; already
  supports `metricMode='sales'` / ROAS — no changes needed).
- `src/components/SpartacoFilterBar.tsx` — "Ad Analysis" tab + creatives-tab filter.
- `src/app/dashboard/layout.tsx` — sidebar link.

## Known limitations

- **Meta only.** No Google creative blocks yet.
- **Sales sparse** outside Jameson (see note above).
- **Insight reflects the deep dive's own last-30-day window**, not the page's
  selected date range — hence the "as of <date>" label.
- **No period-over-period deltas** on the KPI strip (the page fetches the current
  window only).
