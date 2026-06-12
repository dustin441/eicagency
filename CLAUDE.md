@AGENTS.md

# EIC Agency — Client Portal

## NSI Paid Media Handoff

For the current NSI paid-media warehouse, automation, and QA rules, read:

- [docs/nsi-paid-media-handoff.md](docs/nsi-paid-media-handoff.md)

This is the cross-model handoff file for Supabase, n8n, master-table logic, and QA notes.

Recent NSI warehouse additions also include:

- `public.nsi_revenue` for monthly campaign revenue / spend / ROAS imports
- source file currently loaded: `NSI (DUD)(Delete this if seen) - Revenue (5).csv`

## What This Is

EIC Agency is a B2B performance marketing agency. This codebase is their internal + client-facing platform:

1. **Public marketing site** (`/`) — Agency homepage with animated hero, services, and value-prop. Converts SaaS/tech companies into agency clients.
2. **Client analytics portal** (`/dashboard`) — Secure, real-time cross-channel marketing performance dashboard. Built for EIC's clients to monitor Google, Meta, and LinkedIn campaign results, funnel health, and budget pacing in one place.

The portal is the primary focus of active development. It is deployed on Vercel, backed by Supabase, and accessed by EIC staff and invited clients.

## Brand

- **Colors:** Deep Forest Green `#0B4A31` (`brand-forest`) · Vibrant Orange `#EB541E` (`brand-orange`) · Dark `#0f172a` (`brand-dark`)
- **Feel:** Premium B2B — high-contrast, ultra-clean, smooth Framer Motion animations. Light surface only (no dark mode).
- **Font:** Inter (via `next/font/google`)
- **Design tokens** live in `src/app/globals.css` under `@theme`
- **Logo + Favicon:** White SVG (`/logo-white.svg`) used in sidebar + login. Favicon set in `src/app/layout.tsx` metadata.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16.2.2 — App Router, Turbopack, TypeScript |
| Styling | Tailwind CSS 4 with custom brand tokens |
| Animations | Framer Motion 12 |
| Charts | Recharts 3 |
| Tables | TanStack Table v8 |
| Auth + DB | Supabase (`@supabase/ssr` for SSR cookie-based auth) |
| Icons | Lucide React |
| Deployment | Vercel (auto-deploy from `main` branch) |

## File Structure

```
src/
├── app/
│   ├── layout.tsx                  # Root layout — Inter font, favicon metadata
│   ├── globals.css                 # Tailwind 4 @theme tokens, global resets
│   ├── page.tsx                    # Public marketing homepage ('use client', Framer Motion)
│   ├── login/
│   │   └── page.tsx                # Client portal login — Supabase email/password auth
│   └── dashboard/
│       ├── layout.tsx              # Dashboard shell — sidebar nav, header, auth guard
│       ├── error.tsx               # Error boundary (all dashboard routes) — "Data Overload" / retry UI for Supabase timeouts
│       ├── page.tsx                # Overall Performance — Server Component, reads searchParams
│       ├── smb/page.tsx            # SMB Segments — auto-filtered to focus='SMB'
│       ├── abm/page.tsx            # ABM Focus — auto-filtered to focus='ABM'
│       ├── fd360/page.tsx          # FD360 Campaigns — auto-filtered to focus='FD360'
│       └── settings/page.tsx       # Settings placeholder
├── components/
│   ├── DashboardClient.tsx         # Overall Performance client component — KPI cards, charts, funnel, channel table
│   ├── FocusDashboardClient.tsx    # Focus page client component (SMB/ABM/FD360) — budget pacing, KPIs, funnel, campaigns
│   ├── TrendChart.tsx              # Shared interactive Spend vs. Metrics chart — 7 togglable metric lines
│   ├── FilterBar.tsx               # URL-state filter bar — Looker Studio-style date picker + channel/focus/compare dropdowns
│   ├── ChannelTable.tsx            # TanStack Table — sortable channel ROI breakdown (Overall page)
│   ├── AdPreviews.tsx              # Ad creative previews — Meta card mockups + Google SERP mockups, Preview/Table toggle, inline video modal
│   ├── FunnelPanel.tsx             # (legacy standalone — not used in active pages)
│   ├── KpiCards.tsx                # (legacy standalone — not used in active pages)
│   ├── PeriodSelector.tsx          # (legacy standalone — not used in active pages)
│   └── SpendChart.tsx              # (legacy standalone — not used in active pages)
├── services/
│   └── analytics.ts                # ALL Supabase data fetching — fetchDashboardData + fetchFocusData
├── lib/
│   ├── supabase-server.ts          # Service role client factory (server-only, bypasses RLS)
│   ├── supabase.ts                 # Legacy browser client (kept for compatibility)
│   └── utils.ts                    # cn() helper (clsx + tailwind-merge)
├── utils/supabase/
│   ├── server.ts                   # SSR cookie-aware client (anon key) — for auth checks
│   ├── client.ts                   # Browser client (anon key) — for login page
│   └── middleware.ts               # updateSession helper — used by proxy.ts
└── proxy.ts                        # Next.js 16 proxy — redirects unauthenticated users to /login
```

## Environment Variables

Required in `.env.local` (never commit):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://hdaftbqteexugqakgdbx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
SUPABASE_SERVICE_ROLE_KEY=<secret key>
```

Same three vars must be set in Vercel → Project → Settings → Environment Variables.

## Auth Architecture

```
Request → proxy.ts (updateSession) → refreshes Supabase session cookie
                                    → redirects to /login if no session
                                    → (excludes /, /login, /auth paths)

Login page → supabase.auth.signInWithPassword() → sets session cookie → redirect to /dashboard

Dashboard layout → supabase.auth.getUser() (client-side) → shows loading spinner briefly
                 → middleware already guaranteed auth by this point
```

**Two Supabase clients:**
- `utils/supabase/server.ts` — anon key + cookies — auth checks only
- `lib/supabase-server.ts` — **service role key** — all data queries in `analytics.ts` (bypasses RLS)

## Data Layer

All analytics data flows through `src/services/analytics.ts`. There are two primary fetch functions:

### `fetchDashboardData(params: FilterParams) → DashboardStats`
Powers the Overall Performance page. Pulls all segments together.

```
master_marketing_performance  → primary metrics (spend, clicks, impressions, conversions, mqls, sqls, closed_won)
                              → filtered by: date range, focus (optional), platform/channel (optional)
linkedin_campaign_data        → spend/clicks only, added to totals when channel = 'all'
google_geo_state              → geographic breakdown (Google only)
enrollment                    → avg days MQL → SQL (last 12 months)
enrollment_won                → avg days SQL → Close (last 12 months)
```

### `fetchFocusData(focus: string, params: FilterParams) → FocusStats`
Powers SMB, ABM, and FD360 pages. Always filtered to the specific focus segment.

```
master_marketing_performance  → all metrics, always eq('focus', focus)
budgets                       → monthly budget for the segment
master_marketing_performance  → this-month spend by platform for budget pacing (ignores date filter)
meta_adset                    → ad set breakdown
meta_ads_creatives            → Meta creative performance (ad_name, headline, primary_text,
                                final_creative_link, destination_url, cta_type, is_video,
                                video_id, video_url, spend, leads, clicks, impressions)
google_search_ads_creatives   → Google search ad creative performance
google_geo_state              → geographic breakdown
enrollment                    → avg days MQL → SQL
enrollment_won                → avg days SQL → Close
```

### FilterParams
URL-state drives all server-side data fetching:
```typescript
type FilterParams = {
  start: string;      // YYYY-MM-DD — current period start
  end: string;        // YYYY-MM-DD — current period end
  compStart: string;  // YYYY-MM-DD — comparison period start
  compEnd: string;    // YYYY-MM-DD — comparison period end
  channel?: string;   // 'all' | 'Google' | 'Meta'
  focus?: string;     // 'all' | 'SMB' | 'ABM' | 'FD360' (Overall page only)
}
```

The `FilterBar` component reads/writes these as URL search params. Pages are Server Components that `await searchParams`, then call `paramsFromSearch()` to build FilterParams and pass to the fetch functions.

## Dashboard Pages

### Overall Performance (`/dashboard`)
- **KPI cards:** Impressions, Clicks, CTR, Spend, CPC, Leads, Cost Per Lead (7 cards, with vs-prior-period delta)
- **Cost Efficiency:** Cost Per Lead, Cost Per MQL, Cost Per SQL, Cost Per Won — with count delta badges. Cost Per Won is the "North Star" KPI.
- **Spend vs. Metrics chart:** Interactive — Spend bars + toggleable lines for MQLs, Leads, SQLs, CTR, CPC, CPL, Cost/MQL
- **Funnel:** 4 stages (Lead → MQL → SQL → Closed Won) with conversion % and avg time-to-deal between stages
- **Channel Breakdown Table:** Google, Meta, LinkedIn sortable by spend/clicks/mqls
- **Geographic Performance:** Top states by Google Ads spend
- **LinkedIn Campaigns:** Campaign-level table when LinkedIn data exists

### Focus Pages (`/dashboard/smb`, `/dashboard/abm`, `/dashboard/fd360`)
Each page hard-codes `focus` at the server level — the `FilterBar` on these pages does NOT show a focus selector.

- **Budget Pacing:** Always uses current calendar month vs monthly budget. Shows over/under by dollar amount + platform split (Google/Meta).
- **KPI cards:** Same 7 cards as Overall, scoped to the focus segment
- **Cost Efficiency:** Same 4 cards
- **Spend vs. Metrics chart:** Same interactive chart, defaults to MQLs line
- **Funnel:** Same 4-stage funnel with time-to-deal
- **Platform Breakdown:** Google vs Meta side-by-side cards
- **Campaign Performance table:** Top 25 campaigns by spend for the focus
- **Meta Ad Sets table**
- **Meta Ad Creatives (`AdPreviews.tsx`):** Preview/Table toggle. Card view shows Facebook-style mockups with real ad image, primary text, headline, CTA button (real label from `cta_type`), and engagement bar. Metrics: Spend, Leads, CTR, CPL with vs-avg delta badges. Video ads show a play button; clicking opens an inline `<video>` modal using the stored MP4 URL (`video_url`). Falls back to thumbnail + Watch on Facebook link if no MP4 available.
- **Google Search Creatives (`AdPreviews.tsx`):** Google SERP-style mockups with Ad badge, headline, description, sitelink pills, and performance metrics.
- **Geographic Performance:** Google geo by state

## Key Design Decisions

**MMP as single source of truth** — `master_marketing_performance` is the primary table for all spend, impressions, clicks, leads, MQL, SQL, and Won metrics. It has `focus`, `platform`, and `date` columns enabling proper filtering. Raw platform tables (`google_campaigns`, `meta_campaigns`) are only used for creative/adset breakdowns, not for top-level metrics. **MMP is a MATERIALIZED VIEW** (converted from a regular view to fix statement timeout errors). The underlying computation lives in `_mmp_source`. It refreshes daily at 6 AM UTC via pg_cron. After any manual data load, run `REFRESH MATERIALIZED VIEW master_marketing_performance;` to see changes immediately.

**LinkedIn is not in MMP** — LinkedIn data lives only in `linkedin_campaign_data`. It is fetched separately and only included in totals when `channel = 'all'`. LinkedIn has no MQL/SQL/Won data (broken pipeline upstream).

**Budget pacing always uses current month** — Regardless of the selected date filter, budget pacing queries MMP for the current calendar month. This ensures the pacing widget always reflects real MTD spend.

**Funnel time data is cross-segment** — `enrollment` and `enrollment_won` tables have no `focus` column, so avg days MQL→SQL and SQL→Close are global averages, not segment-specific.

**Comparison period** — FilterBar computes a default comparison period (same-length window immediately before the selected start). Users can override via the "Compare" dropdown. Comparison period is used only for KPI card deltas and cost efficiency badges.

## Supabase Schema — Key Tables

### Primary Analytics
| Table | Key Columns | Notes |
|-------|-------------|-------|
| `master_marketing_performance` | `date`, `platform`, `focus`, `campaign_name`, `spend`, `impressions`, `clicks`, `platform_conversions`, `mqls`, `sqls`, `closed_won`, `call_mqls`, `enrollment_mqls`, `call_sqls`, `enrollment_sqls`, `call_won`, `enrollment_won` | **Primary table for all top-level metrics** |
| `linkedin_campaign_data` | `date`, `campaign_name`, `spend`, `clicks`, `impressions`, `leads` | leads = 0 (pipeline broken) |
| `google_geo_state` | `date`, `campaign_id`, `state_name`, `impressions`, `clicks`, `cost` | |
| `meta_adset` | `date`, `adset_name`, `campaign_name`, `spend`, `clicks`, `leads`, `impressions` | |
| `meta_ads_creatives` | `date`, `ad_id`, `ad_name`, `campaign_name`, `adset_name`, `headline`, `primary_text`, `final_creative_link`, `destination_url`, `cta_type`, `is_video`, `video_id`, `video_url`, `ad_status`, `spend`, `leads`, `clicks`, `impressions` | Populated by n8n workflow `hq4AP24YUl9oRyam`; `video_url` is MP4 source for inline playback |
| `google_search_ads_creatives` | `date`, `ad_id`, `campaign_name`, `headline_1`, `headline_2`, `description_1`, `clicks`, `impressions`, `cost`, `results` | |

### Funnel / CRM
| Table | Key Columns | Notes |
|-------|-------------|-------|
| `enrollment` | `email`, `gclid`, `FBCLID`, `date_mql` (timestamp), `date_sql` (timestamp) | Used for avg MQL→SQL time |
| `enrollment_won` | `email`, `gclid`, `fbclid`, `date_mql`, `date_sql`, `date_won` (timestamps) | Used for avg SQL→Close time |
| `calls` | `email`, `date_mql`, `date_sql`, `date_closed_won` | Call-sourced leads |
| `calls_won` | Same structure as `calls` | Call-sourced wins |

### Operational
| Table | Key Columns | Notes |
|-------|-------------|-------|
| `budgets` | `client`, `budget` | Monthly budget per segment (SMB, ABM, FD360) |
| `ad_change_history` | `date`, `platform`, `changed_by`, `campaign`, `field`, `old_value`, `new_value` | 8k+ campaign change events |

## Known Issues

1. **RLS not enabled on funnel/PII tables** — `enrollment`, `enrollment_won`, `calls`, `calls_won`, `budgets`, `ad_change_history` have RLS OFF. Enable with policies before any external client access.
2. **LinkedIn leads = 0** — `linkedin_campaign_data.leads` is always 0 due to a broken upstream pipeline. LinkedIn contributes spend/clicks/impressions but no funnel metrics.
3. **User avatar hardcoded** — Shows "JD" initials in the dashboard header. Should be derived from the authenticated Supabase user.
4. **Search bar and notification bell are decorative** — Not wired to any functionality.
5. **Settings page is a placeholder** — `/dashboard/settings` renders a stub.
6. **Funnel time data is not segment-filtered** — `enrollment`/`enrollment_won` have no `focus` column, so time-to-deal is a global average across all segments.
7. **Meta ad images are low-resolution** — `final_creative_link` stores Meta's compressed CDN thumbnail (`t45.1600-4` format), not the full-res creative. Images appear blurry at card size. Fix requires fetching a higher-res image source from Meta API (e.g. via `ad_image` endpoint or `image_hash`) — roadmap item.
8. **Supabase connection timeouts (largely resolved)** — The root cause was `master_marketing_performance` being a live view with a FULL OUTER JOIN across 8+ CTEs, which exceeded the 8s `authenticator` timeout. Fixed by: (a) materializing MMP with indexes, (b) raising `authenticator` timeout to 60s on both Supabase projects. Transient `Promise.all` failures can still occur under heavy connection pool load — `error.tsx` catches these and shows "Data Overload / refresh to try again".

## Roadmap / Untapped Data

- **Higher-res Meta ad images** — Update n8n workflow (`hq4AP24YUl9oRyam`) to fetch full-res image URL from Meta's `ad_image` endpoint using `image_hash`, replacing the compressed `final_creative_link` CDN thumbnail. Fixes blurriness on ad preview cards.
- **Activity Feed** — `ad_change_history` (8k+ events) is ready for a sidebar or dedicated page showing campaign changes with who/what/when.
- **Creative Performance Panel** — Google `Asset Performance` table has `performance_label` (BEST/GOOD/LOW) per creative asset. Ready for a creative analysis view.
- **Real user avatar** — Pull name/email from `supabase.auth.getUser()` to personalize the dashboard header.
- **RLS + per-client access** — Enable RLS on funnel tables, add policies so each client only sees their own data. Enables safe multi-tenant access.
- **LinkedIn pipeline fix** — If upstream lead data is restored, LinkedIn can contribute full-funnel metrics.
- **Settings page** — Account settings, notification preferences, white-label options per client.

## Data Sync (n8n)

Ad creative data is populated by an n8n workflow, not by the Next.js app directly.

| Workflow | ID | Schedule | What it does |
|----------|----|----------|--------------|
| Meta Ads Puller Creatives to Supabase ✅ | `hq4AP24YUl9oRyam` | Daily 4 AM | Pulls Meta Ads Insights (Jan 1 → today) + creative data per ad, fetches MP4 source for video ads, upserts to `meta_ads_creatives` |

### Workflow node overview
```
Schedule Trigger → Format Date → Pull Data (Insights API, paginated)
  → Array By Day → Get Unique Ad IDs → Pull Data1 (creative per ad)
  → Code in JavaScript (merge perf + creative)
  → Prep Video Lookups → Fetch Video Sources (/{video_id}?fields=source)
  → Inject Video URLs → Loop Over Items → Insert or update (Postgres upsert) → Wait → (loop)
```

**Credential reconnect warning:** Every SDK-based workflow update in n8n disconnects HTTP Request node credentials. After any future workflow update, manually reconnect the Meta API bearer token on: `Pull Data`, `Pull Data1`, `Fetch Video Sources`.

## Client Segments

| Segment | `focus` value | Monthly Budget |
|---------|--------------|----------------|
| SMB | `SMB` | $110,000 |
| ABM | `ABM` | $10,000 |
| FD360 | `FD360` | $15,000 |
