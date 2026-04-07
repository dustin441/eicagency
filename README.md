# EIC Agency Platform

Premium B2B lead-generation agency platform — public marketing site and secure client analytics portal.

## Overview

| Route | Description |
|-------|-------------|
| `/` | Public marketing homepage |
| `/login` | Client portal login (Supabase auth) |
| `/dashboard` | Analytics dashboard (authenticated) |

## Tech Stack

- **Framework:** Next.js 16.2.2 (App Router, Turbopack, TypeScript)
- **Styling:** Tailwind CSS 4 with custom brand tokens
- **Charts:** Recharts 3
- **Tables:** TanStack Table v8
- **Animations:** Framer Motion 12
- **Backend/Auth:** Supabase (`@supabase/ssr`)

## Local Development

**1. Install dependencies**
```bash
npm install
```

**2. Set up environment variables**

Create `.env.local` in the project root:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://hdaftbqteexugqakgdbx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your publishable key>
SUPABASE_SERVICE_ROLE_KEY=<your secret key>
```

**3. Run the dev server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment (Vercel)

1. Push this repo to GitHub
2. Import the repo in the [Vercel dashboard](https://vercel.com/new)
3. Add all three environment variables under **Project → Settings → Environment Variables**
4. Deploy — Vercel auto-detects Next.js, no `vercel.json` needed

## Project Structure

```
src/
├── app/
│   ├── page.tsx                # Marketing homepage
│   ├── login/page.tsx          # Auth login
│   └── dashboard/
│       ├── layout.tsx          # Dashboard shell (sidebar + header)
│       └── page.tsx            # Main analytics view (Server Component)
├── components/
│   ├── DashboardClient.tsx     # KPI cards, charts, funnel
│   ├── ChannelTable.tsx        # Sortable channel breakdown table
│   └── PeriodSelector.tsx      # Day/Week/Month/Year filter
├── services/
│   └── analytics.ts            # All Supabase data fetching
├── lib/
│   └── supabase-server.ts      # Service role client (server-only)
├── utils/supabase/
│   ├── server.ts               # SSR cookie client (auth checks)
│   └── client.ts               # Browser client (login page)
└── proxy.ts                    # Auth proxy (redirects to /login)
```

## Brand

- Forest Green: `#0B4A31`
- Vibrant Orange: `#EB541E`

## Data Sources

Dashboard data comes from Supabase project `hdaftbqteexugqakgdbx`. Key tables:

- `google_campaigns` — daily Google Ads performance
- `meta_campaigns` — daily Meta Ads performance
- `linkedin_campaign_data` — daily LinkedIn performance
- `enrollment` — form-fill MQLs (with proper timestamps)
- `enrollment_won` — closed-won records

See `CLAUDE.md` for full schema documentation and known issues.
