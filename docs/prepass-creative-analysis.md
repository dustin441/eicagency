# PrePass — Creative Analysis page

Reference for the `/dashboard/creatives` page (PrePass only). Explains the data
sources, the filter logic, and every block on the page so it can be maintained
without re-deriving it.

## What it is

A creative-level analysis page for PrePass: visual mockups of the real Meta and
Google ads, the AI creative insights the n8n deep dive already generates, and
ad-level funnel performance (MQL / SQL / Won) that elsewhere only lives in raw
tables. It answers "**which creatives** drive results", which the segment pages
(SMB/ABM/FD360) don't — they stop at campaign/adset level.

- **Route:** `src/app/dashboard/creatives/page.tsx` (Server Component).
- **Sidebar:** "Creative Analysis" under the PrePass client in `dashboard/layout.tsx`.
- **All UI text is English only** (standing rule — the user works in pt-BR but the
  dashboard is English-only).

## Architecture (same pattern as the rest of the dashboard)

```
page.tsx (server)  →  requireClientAccess('prepass')
                   →  paramsFromSearch(searchParams) + focus from ?focus=
                   →  fetchPrepassCreativeAnalysis(focus, params)   [services/analytics.ts]
                   →  <CreativeAnalysisClient data={...} />          [components/]
```

- All Supabase access is in `services/analytics.ts` via the **service-role** client
  (`createServerSupabaseClient`). No queries in the page or component.
- The client component is `'use client'` and does presentation + the two in-browser
  toggles only.

## Data sources (Supabase `hdaftbqteexugqakgdbx`)

| Block | Source | Notes |
|-------|--------|-------|
| Meta creatives + funnel | RPC **`prepass_meta_ad_performance(p_start, p_end)`** | One row per `ad_id` with creative fields + `spend, leads, clicks, impressions, mqls, sqls, won`. Already joins `"Meta MQL/SQL/WON"` by `utm_ad_id`. **MQL/SQL/Won are Meta-only.** |
| Focus → campaigns | RPC **`get_focus_period_stats(focus, start, end, null)`** | Aggregates server-side, so it bypasses the 1000-row PostgREST cap. Gives the `campaign_name` set per `focus`+`platform`; used to scope every block to the selected focus. |
| Google Search | `google_search_ads_creatives` | `headline_1..15`, `description_1..4`, clicks/impr/cost/results. Aggregated by `ad_id`. |
| Google Display | `google_display_creatives` | `image_url`, clicks/impr/cost/conversions. **Data only runs through ~2026-02-02** — recent ranges show the empty state. |
| AI insights | `clickup_comments`, `task_id = '86b7erdb6'`, latest `comment_text LIKE '%Creative Detail%'` | Written Mon+Thu by n8n workflow **`dhI5kUb0fFPmuf9X`** ("PrePass Creative Deep Dive"), which posts to ClickUp; ClickUp syncs into Supabase. No n8n change needed. |

### Why MQL/SQL/Won are Meta-only

PrePass attributes funnel conversions to a Meta `ad_id` through Marketo's
`utm_ad_id` (see the prepass-ad-attribution work). There is no equivalent per-ad
attribution for Google, so the Google blocks show only spend / clicks / CPC / CTR /
Cost-per-result.

## Filters

| Filter | State | Effect |
|--------|-------|--------|
| Date range | URL (`FilterBar`, `showChannel={false}`) | Server refetch. Default = last 30 days. |
| Focus (All / SMB / ABM / FD360) | URL `?focus=` | Server refetch; scopes every block via the campaign set from `get_focus_period_stats`. |
| Meta grouping (By Ad / By Campaign) | **client `useState`** | No refetch — the per-`ad_id` rows are a superset, so "By Campaign" just rolls them up in the browser. |

### Meta grouping logic (`aggregateByCampaign` in the client)

- **By Ad** — one card per `ad_id` (isolated; the same creative running in several
  campaigns/adsets shows as separate ads).
- **By Campaign** — condenses the **same ad name within a campaign** (key =
  `campaign + ad_name`), summing spend + all funnel metrics. The first row per key
  (highest spend, since the list is spend-sorted) supplies the preview image/copy.
  In this mode the cards/table swap the **Ad Set** column for **Campaign** via the
  optional `attributionMode='campaign'` prop on the shared `MetaAdPreviews`.

## Page blocks (top → bottom)

**Meta**
1. KPI strip: Spend, Clicks, CPC, CTR, MQL, SQL, Won, Cost/MQL, Cost/SQL, Cost/Won
   (computed from `metaAds`; totals are unaffected by the grouping toggle).
2. **AI Creative Insights — Meta**: image-vs-video verdict + "what top ads have in
   common & what to test". Focus-scoped (see parsing below).
3. **Top Performers by Cost** (champion cards): the best ad by **CPL, Cost/MQL,
   Cost/SQL, Cost/Won**, among ads with **≥ $500 spend** only.
   - If no ad reached $500 → a "widen the date range" notice.
   - If a metric had no conversions in the period → that card is skipped.
4. Meta ad previews (`MetaAdPreviews`, `showFunnel`): Facebook-style mockups +
   Preview/Table toggle + conversion toggle (Cost/Lead · Cost/MQL · Cost/SQL ·
   Cost/Won · Volume) + Sort By (Spend · MQLs · SQLs · Won · CTR).

**Google**
5. KPI strip: Spend, Clicks, CPC, CTR, Cost/Result (no funnel — Meta-only).
6. **AI Creative Insights — Google**: search copy themes + what to test (focus-scoped).
7. Google Search SERP mockups — show every populated headline/description, ranked by spend.
8. Google Display image grid — empty state for recent ranges (data through Feb 2026).

## AI insight parsing (`parseCreativeInsight`)

The deep-dive comment is **one text blob** structured as: a per-focus section
(`📸 META Video-vs-Image`, `🏆 META Top Ads`, `🔍 GOOGLE Top Search Ads`) for SMB /
ABM / FD360, then a single cross-platform **`📝 Copywriter Note`**.

It is parsed into 3 fields, deliberately **without** the `🏆`/`🔍` "best ad" lists
(those are visible in the previews):

- `metaFormatVerdict` — the `📸` image-vs-video block of the selected focus.
- `metaTests` / `googleTests` — the copywriter-note bullets, split by platform
  (a bullet mentioning Google/Search → Google, else → Meta) so nothing shows twice.

**Focus scoping of the note:** the copywriter note is a single cross-focus block, so
when a specific focus is selected, a bullet is **kept only if it names the selected
focus or names no segment at all** — bullets naming a different segment (e.g. ABM
bullets under SMB) are dropped. When focus = All, all bullets show.

The parser is defensive: if the markers move, fields fall back to empty and the Meta
block can show the full raw comment rather than breaking.

## Shared component changes (`components/AdPreviews.tsx`)

`MetaAdPreviews` is shared across ~10 client dashboards, so all additions are
**optional and backward-compatible**:
- `showFunnel` (pre-existing) enables the MQL/SQL/Won conversion toggle.
- `attributionMode?: 'adset' | 'campaign'` — when `'campaign'`, cards hide the Ad Set
  line and the table shows a Campaign column.
- `won` / `cpwon` added to the conversion toggle, sort keys, Volume mode, and table.

## Known limitations

- **Google Display** has no data after ~Feb 2026 (the sync stopped); recent ranges
  show an empty state. Resuming it is a separate n8n task.
- **Insights depend on the deep-dive comment format.** If workflow `dhI5kUb0fFPmuf9X`
  changes its output structure, the parser degrades gracefully but may need updating.
- **MQL/SQL/Won are Meta-only** by design (no Google ad-level attribution).
- **RLS is disabled** on the `"Meta MQL/SQL/WON"`, `campaign_leads`, `budgets`, etc.
  tables — the page is safe (service-role reads) but it's a standing security item.

## Files

- `src/app/dashboard/creatives/page.tsx` — server page.
- `src/components/CreativeAnalysisClient.tsx` — all UI (filters, KPIs, insights,
  champions, Google mockups).
- `src/services/analytics.ts` — `fetchPrepassCreativeAnalysis`, `parseCreativeInsight`,
  and the `GoogleSearchAd` / `GoogleDisplayAd` / `CreativeInsight` / `PrepassCreativeAnalysis` types.
- `src/components/AdPreviews.tsx` — shared `MetaAdPreviews` (reused, with the optional props above).
- `src/app/dashboard/layout.tsx` — sidebar link.
