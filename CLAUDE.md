@AGENTS.md

# EIC Agency Platform — AI Context

## What This Is

A two-part web application for EIC Agency:

1. **Public marketing site** (`/`) — Premium B2B lead-gen agency homepage with animated hero, services grid, and value-prop section. Designed to convert SaaS/tech companies into agency clients.
2. **Client analytics portal** (`/dashboard`) — Secure SaaS dashboard showing real-time cross-channel marketing performance (Google, Meta, LinkedIn) pulled live from Supabase.

## Brand

- **Colors:** Deep Forest Green `#0B4A31` (`brand-forest`) · Vibrant Orange `#EB541E` (`brand-orange`)
- **Feel:** Premium B2B, KlientBoost-inspired — high-contrast, ultra-clean, smooth animations
- **Font:** Inter (via `next/font/google`)
- **Design tokens** are in `src/app/globals.css` under `@theme`

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

## File Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout — Inter font, metadata
│   ├── globals.css             # Tailwind 4 @theme tokens, global resets
│   ├── page.tsx                # Public marketing homepage ('use client', Framer Motion)
│   ├── login/
│   │   └── page.tsx            # Client portal login — Supabase auth
│   └── dashboard/
│       ├── layout.tsx          # Dashboard shell — sidebar, header, auth guard (client)
│       └── page.tsx            # Main analytics view — Server Component, reads searchParams
├── components/
│   ├── DashboardClient.tsx     # Client component — KPI cards, charts, funnel, wires PeriodSelector
│   ├── ChannelTable.tsx        # TanStack Table — sortable channel ROI breakdown
│   ├── PeriodSelector.tsx      # URL-based period filter (Day/Week/Month/Year)
│   ├── KpiCards.tsx            # Animated KPI card grid (standalone, not currently used)
│   ├── SpendChart.tsx          # Recharts combo chart (standalone, not currently used)
│   └── FunnelPanel.tsx         # Animated funnel bars (standalone, not currently used)
├── services/
│   └── analytics.ts            # ALL Supabase data fetching — uses service role client
├── lib/
│   ├── supabase-server.ts      # Service role client factory (server-only, bypasses RLS)
│   ├── supabase.ts             # Legacy browser client (kept for compatibility)
│   └── utils.ts                # cn() helper (clsx + tailwind-merge)
├── utils/supabase/
│   ├── server.ts               # SSR cookie-aware client (anon key) — for auth checks
│   ├── client.ts               # Browser client (anon key) — for login page
│   └── middleware.ts           # updateSession helper — used by proxy.ts
└── proxy.ts                    # Next.js 16 proxy (replaces deprecated middleware.ts)
                                # Redirects unauthenticated users to /login
```

## Environment Variables

Required in `.env.local` (never commit — already in `.gitignore`):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://hdaftbqteexugqakgdbx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
SUPABASE_SERVICE_ROLE_KEY=<secret key>
```

All three must also be set in the Vercel dashboard under Project → Settings → Environment Variables.

## Auth Architecture

```
Request → proxy.ts (updateSession) → refreshes Supabase session cookie
                                    → redirects to /login if no session
                                    → (excludes /, /login, /auth paths)

Login page → supabase.auth.signInWithPassword() → sets session cookie → redirect to /dashboard

Dashboard layout → supabase.auth.getUser() (client-side) → shows loading spinner briefly
                 → middleware already guaranteed auth by this point
```

**Two Supabase clients in use:**
- `utils/supabase/server.ts` — anon key + cookies — used for session/auth checks
- `lib/supabase-server.ts` — **service role key** — used exclusively in `services/analytics.ts` for data queries (bypasses RLS on reporting tables)

## Data Layer

All analytics data flows through `src/services/analytics.ts`:

```
fetchDashboardData(period: string) → DashboardStats
  ├── google_campaigns        → spend, clicks, impressions (current + prev period)
  ├── meta_campaigns          → spend, clicks, impressions, leads (current + prev period)
  ├── linkedin_campaign_data  → spend, clicks (current + prev period)
  ├── enrollment              → MQL count, SQL count (period-filtered by date_mql/date_sql)
  ├── enrollment_won          → Won count (period-filtered by date_won)
  ├── "Google MQL" + "Meta MQL"  → all-time channel attribution counts
  └── "Google WON" + "Meta WON"  → all-time channel won counts
```

**Period selector** (`PeriodSelector.tsx`) updates `?period=day|week|month|year` in the URL → page re-renders as Server Component → fresh data fetch.

**Trend chart** always shows last 30 days of daily data (Google + Meta merged by date), regardless of period filter.

## Supabase Schema — Key Tables

### Platform Data (RLS enabled — requires service role for reads)
| Table | Rows | Key Columns |
|-------|------|-------------|
| `google_campaigns` | 6,123 | `date`, `campaign_name`, `cost`, `clicks`, `impressions`, `conversions`, `Product` (generated) |
| `meta_campaigns` | 7,082 | `date`, `campaign_name`, `spend`, `clicks`, `impressions`, `leads`, `Product` (generated) |
| `linkedin_campaign_data` | 4,636 | `date`, `campaign_name`, `spend`, `clicks`, `impressions` (leads = 0, pipeline broken) |
| `Asset Group Performance` | 174 | `date`, `campaign_name`, `asset_group_name`, `cost`, `conversions` |
| `Asset Performance` | 62,009 | `date`, `campaign_name`, `asset_type`, `performance_label` (BEST/GOOD/LOW/LEARNING) |
| `google_geo_state` | 40,875 | `date`, `campaign_id`, `state_name`, `impressions`, `clicks`, `cost` |
| `google_geo_city` | 529,324 | `date`, `campaign_id`, `city_name`, `impressions`, `clicks`, `cost` |

### Funnel Data (RLS disabled — anon key can read — contains PII)
| Table | Rows | Key Columns |
|-------|------|-------------|
| `enrollment` | 14,767 | `email`, `gclid`, `FBCLID`, `date_mql` (timestamp), `date_sql` (timestamp), `dateClosedWon` |
| `enrollment_won` | 7,431 | `email`, `gclid`, `fbclid`, `date_mql`, `date_sql`, `date_won` (all timestamps) |
| `calls` | 8,692 | `email`, `gclid`, `fbclid`, `date_mql`, `date_sql`, `date_closed_won` |
| `calls_won` | 7,333 | Same structure as calls |
| `"Google MQL"` | 967 | `id_marketo`, `email`, `gclid`, `date_mql` **(TEXT — can't filter by period)** |
| `"Meta MQL"` | 15,611 | `id_marketo`, `email`, `FBCLID`, `date_mql` **(TEXT — can't filter by period)** |
| `"Google WON"` | 257 | `id_marketo`, `email`, `gclid`, `date_won` **(TEXT)** |
| `"Meta WON"` | 408 | `id_marketo`, `email`, `FBCLID`, `date_won` **(TEXT)** |
| `"Google SQL"` | 426 | `id_marketo`, `email`, `gclid`, `date_sql` **(TEXT)** |
| `"Meta SQL"` | 3,231 | `id_marketo`, `email`, `FBCLID`, `date_sql` **(TEXT)** |

### Operational
| Table | Rows | Purpose |
|-------|------|---------|
| `budgets` | 4 | Per-client monthly budget + spent-to-date (PrePass $150k, SMB $110k, FD360 $25k, ABM $10k) |
| `ad_change_history` | 8,215 | Campaign change log (platform, changed_by, object, old/new value) |
| `call_google` | 1,235 | Inbound call tracking with recording URLs |
| `clickup_tasks` | 587 | ClickUp task sync |
| `clickup_comments` | 1,433 | ClickUp comment sync |

### Product Segmentation (generated column on google_campaigns + meta_campaigns)
`Product` column auto-classifies campaigns: `Bypass` · `Tolls` · `Toll Management` · `Plus` · `Toll Verification` · `INFORM` · `GPS Toll Verification` · `Partners` · `Mobile App` · `Other`

## Known Issues

1. **RLS not enabled on funnel/PII tables** — `enrollment`, `enrollment_won`, `calls`, `calls_won`, `"Google MQL"`, `"Meta MQL"`, `"Google WON"`, `"Meta WON"`, `budgets`, `ad_change_history` all have RLS OFF. Must enable with policies before any real client access.
2. **LinkedIn leads pipeline broken** — `linkedin_campaign_data.leads` = 0 despite $170k in spend. Data pipeline issue upstream.
3. **MQL/WON/SQL tables have TEXT date columns** — `"Google MQL"`, `"Meta MQL"` etc. store `date_mql` as `text`, not `timestamp`. Cannot do reliable period filtering on these tables. Use `enrollment`/`enrollment_won` instead (which have proper timestamps).
4. **Sidebar links 404** — `/dashboard/smb`, `/dashboard/abm`, `/dashboard/analytics`, `/dashboard/settings` pages don't exist yet.
5. **User avatar hardcoded** — Shows "JD" initials in dashboard header, not derived from authenticated user.
6. **Decorative UI elements** — Search bar, notification bell are not functional.

## Untapped Data (Ready to Build)

- **Budget pacing widget** — `budgets` table has current-month budget vs. spent-to-date per client. Easy to build a progress bar widget.
- **Activity feed** — `ad_change_history` has 8k campaign changes (who changed what, old/new value). Drop-in for a sidebar activity log.
- **Geographic heatmap** — `google_geo_state` / `google_geo_city` ready for a US map or top-states table.
- **Creative performance** — `Asset Performance` has `performance_label` (BEST/GOOD/LOW) per creative. Ready for a creative analysis panel.
- **Product/segment breakdown** — `google_campaigns.Product` generated column maps campaigns to product lines. Powers the `/dashboard/smb` and `/dashboard/abm` sidebar pages.

## Client Segments (from `budgets` table)

| Client | Monthly Budget | Google Spent | Meta Spent |
|--------|---------------|-------------|------------|
| PrePass | $150,000 | $35,132 | $103,682 |
| SMB | $110,000 | $12,851 | $92,880 |
| FD360 | $25,000 | $14,331 | $9,305 |
| ABM | $10,000 | $7,949 | $1,498 |
