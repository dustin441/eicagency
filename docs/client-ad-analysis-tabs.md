# Ad Analysis tabs — Kinsey, Arabella, CBA, Bloom, Duro Dyne (+ Good Game fix)

Reference for the new `/dashboard/{client}/creatives` pages added to the five
single-brand, Meta-only clients, and the accompanying fix to Good Game's
Paid Media Performance tab. Branch: `feat/client-ad-analysis-tabs`.

## Why this exists

Two rules were established for every client's ad-creative previews:

- **Paid Media Performance tab** — ad cards must stay individual (keyed by
  `ad_id`/`adset`/`campaign`), never merged just because two ads share an
  `ad_name`.
- **Ad Analysis tab** — the same creatives, but aggregated by `ad_name` (a
  creative running across multiple ad sets/campaigns collapses into one
  card), plus the daily AI Creative Insight (Claude vision) that already
  existed in Supabase but had no UI home.

This mirrors the pattern already live for Spartaco (`docs/spartaco-creative-analysis.md`)
and NSI — this doc covers the second wave: **Kinsey Design, Arabella Hotels,
CBA Glass, Bloom Aesthetics, Duro Dyne**.

## What's new per client

- **Route:** `src/app/dashboard/{client}/creatives/page.tsx` (Server
  Component) — `await requireClientAccess('{client}')`, fetch, render.
- **Sidebar:** "Ad Analysis" tab added under each client in
  `src/app/dashboard/layout.tsx`, right after "Performance".
- **Shared UI:** one component, `src/components/CreativeAnalysisClient.tsx`,
  used by all 5 (they're structurally identical — single brand, Meta only).
  Renders a KPI strip, the `CreativeAiInsightCard` (if the client has a
  populated `has_data=true` row), and the shared `MetaAdPreviews` (reused
  from `AdPreviews.tsx`, same component the Performance tabs use).
- **Metric mode matches each client's existing Performance tab exactly:**

  | Client | metricMode | conversionLabel | AI insights table | brand key |
  |---|---|---|---|---|
  | Kinsey | `sales` | default (ROAS) | `kinsey_creative_ai_insights` | `Kinsey` |
  | Arabella | `sales` | default (ROAS) | `arabella_creative_ai_insights` | `Arabella` |
  | CBA | `leads` | default (Leads/CPL) | `cba_creative_ai_insights` | `CBA` |
  | Bloom | `leads` | `{ conversion: 'Chats', cpa: 'Cost/Chat' }` | `bloom_creative_ai_insights` | `Bloom Aesthetic` |
  | Duro Dyne | `leads` | default (Leads/CPL) | `durodyne_creative_ai_insights` | `Duro Dyne` |

## Architecture

```
page.tsx (server) → requireClientAccess('{client}')
                  → fetch{Client}CreativeAnalysis(params)   [services/{client}-analytics.ts]
                  → <CreativeAnalysisClient data={...} />    [components/CreativeAnalysisClient.tsx]
```

`fetch{Client}CreativeAnalysis` reuses the same paginated raw-row fetch as the
Performance tab, then:

1. Maps rows → `MetaCreative[]` via a shared per-client `build{Client}MetaCreatives`
   helper (extracted so both tabs use identical field-mapping logic).
2. Aggregates by ad NAME via the new shared
   `aggregateMetaCreativesByName()` (`src/services/analytics.ts`) — same
   dedupe logic as Spartaco's `aggregateMetaAdsByName`, but operating
   directly on the generic `MetaCreative` shape so all 5 clients share one
   function instead of 5 near-identical copies.
3. Rolls up KPI totals via the new shared `summarizeMetaCreatives()`
   (`src/services/analytics.ts`).
4. Reads the latest AI insight row via `fetchCreativeAiInsight()`
   (`src/services/creative-ai-insights.ts`).

No slice cap is applied on the Ad Analysis tab (unlike the Performance tab's
top-30); `MetaAdPreviews` already shows the top 12 in card view and everything
in table view.

## Key files

- `src/services/analytics.ts` — `aggregateMetaCreativesByName`,
  `summarizeMetaCreatives`, `MetaCreativeSummary` type.
- `src/services/creative-ai-insights.ts` — `fetchCreativeAiInsight(db, table, brand)`.
- `src/services/creative-analysis-types.ts` — shared `CreativeAnalysis` type.
- `src/components/CreativeAiInsightCard.tsx` — renders one client's AI insight
  (mirrors Spartaco's `BrandAiInsightCard`).
- `src/components/CreativeAnalysisClient.tsx` — the shared Ad Analysis page UI.
- `src/services/{kinsey,arabella,cba,bloom,durodyne}-analytics.ts` — each adds
  one `fetch{Client}CreativeAnalysis` export + a `build{Client}MetaCreatives`
  helper (extracted from the existing Performance-tab mapping code, now
  shared by both tabs).
- `src/app/dashboard/{client}/creatives/page.tsx` — one per client.
- `src/app/dashboard/layout.tsx` — nav entries.

## Bugs found and fixed along the way

### 1. Ad-image fallback collapsed to zero height (`AdPreviews.tsx`)

The no-image gradient fallback used only `absolute`-positioned children with
no height on the parent `<div>`, so whenever an ad's image failed to load
(broken/expired CDN link), the entire image area collapsed to nothing instead
of showing the gradient + headline fallback. Fixed by giving the wrapper an
explicit `aspect-[4/3]` when there's no image. This is shared code — the fix
applies to every client's ad cards, not just the new tabs.

### 2. Meta Ad Library redirect button removed from the fallback

The no-image fallback also had an "Open ad preview" button linking to
`facebook.com/ads/library/...` (every client's `preview_url` points there).
Once the zero-height bug above was fixed, this button became visible for the
first time and wasn't wanted — removed so the fallback is just the gradient +
headline, consistent across all clients.

### 3. Stale/expired creative image links (the real "missing preview" cause)

All 6 clients' `build{Client}MetaCreatives` functions kept whichever row's
`final_creative_link`/video fields were seen **first** (`||=`), i.e. the
**oldest** date in the fetch window. Meta's signed CDN image/video URLs
expire after a few days, so any ad running for most of a 30-day window ended
up pinned to an already-expired link, which fails to load client-side and
falls back to the gradient placeholder — reading as "the preview is broken."

Fix: since rows are fetched oldest-first (`.order('date', { ascending: true })`),
switched from `||=` (keep first non-empty) to unconditional overwrite (skip
only when the new value is empty), so the **latest** row wins instead — far
less likely to be expired by the time the page renders. Added the same
explicit date ordering to CBA/Bloom/Duro Dyne's Performance-tab query (they
were missing it; Kinsey/Arabella's shared paginated fetcher already had it).
Good Game's manual `goodgame_ad_hires` override still takes precedence over
the raw (dated) link when present.

**This affects every client using these build functions — not just the new
Ad Analysis tabs.** The Performance tabs benefit from the freshness fix too.

## Good Game — Paid Media Performance fix (not a new tab)

Good Game does **not** get a new dedicated Ad Analysis route. Its existing
Sales tab already has an ad-name-aggregated creatives section
(`goodgame_sales_creative_rollup` RPC) that serves the same purpose — left
untouched.

What *was* wrong: the Paid Media Performance tab
(`src/services/goodgame-analytics.ts`) was calling `goodgame_creative_rollup`,
an RPC that aggregates **by `ad_name`** (`group by g.ad_name` in SQL) — the
same violation the other clients were checked for. Fixed by replacing the RPC
call with:

- `fetchPagedGoodGameMetaAdRows()` — paginated raw fetch from `goodgame_meta_ads`
  (2 ad accounts, ~8–9k rows in a 30-day window, well over Supabase's 1,000-row
  default — hence pagination, not a single query).
- `fetchGoodGameAdHiresMap()` — reads `goodgame_ad_hires` (manual hi-res image
  overrides keyed by `ad_name`), same override the old RPC applied via SQL join.
- `buildGoodGameMetaCreatives()` — dedupes by `ad_id`/`adset`/`campaign` (fine-grained,
  matching every other client's Performance tab), with the hi-res override
  taking priority and falling back to the freshest raw `final_creative_link`.

## Verification

- Vercel preview build is the typecheck (no local `node_modules`/build in this repo).
- Per client: `/dashboard/{client}/creatives` shows one card per ad name
  (spend/impressions/clicks summed across ad sets); `/dashboard/{client}`
  (Performance) is unchanged — still one card per ad_id/adset/campaign combo.
- Good Game: `/dashboard/goodgame` (Performance) now shows individual ad
  cards — an ad running in 2+ ad sets appears as 2+ cards there, while the
  Sales tab's aggregated section still shows it once.
- Spot-check that ad images render (not stuck on the gradient fallback) for
  ads that have been running most of the selected date range — this was the
  stale-link bug's symptom.
