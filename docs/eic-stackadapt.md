# EIC StackAdapt dashboard integration

## Scope and source

- `/dashboard/eicagency`: StackAdapt added to channel filter, overall delivery KPIs, daily trend, channel and campaign performance, freshness, and current-calendar-month budget pacing.
- Official GraphQL only: `https://api.stackadapt.com/graphql`, `campaignDelivery`, `TABLE`, `DAILY`.
- Verified advertiser: **150300 / EIC Agency**. No fallback to the old archived EIC advertiser, Nappy Boy, or PrePass tokens.
- Server-only secret: `STACKADAPT_EIC_API_TOKEN`. Never use a `NEXT_PUBLIC_` name.
- Existing Meta/Google storage and all other client dashboards remain unchanged. No Supabase schema/data or n8n changes.
- MOF and fixed lead-magnet campaigns retain their existing analysis scope; their shared all-channel pacing includes StackAdapt.

## Metric and date contract

- API `cost` is preserved at source precision; presentation rounds only at display time. Impressions/clicks use `impressionsBigint` / `clicksBigint`.
- Generic StackAdapt conversions are **not verified leads/appointments**. StackAdapt leads/CPL and unavailable GA4 campaign metrics display N/A. Combined lead count and CPL use the existing measured Meta/Google scope, explicitly labeled; total delivery spend includes all three channels.
- Dashboard date ranges are inclusive. GraphQL `DateRangeInput.to` is exclusive, so the adapter sends the day after the selected end, then validates every returned daily date against the inclusive UI window. Adjacent live queries verified this boundary.
- Current and comparison periods are independently queried. Pacing always uses the current calendar month and is independent of the selected dates/channel.
- StackAdapt reads bypass the Next fetch cache so transient provider failures cannot be retained. Dates are source reporting dates. Recent delivery may be revised by StackAdapt; the freshness line reflects the last returned delivery date, not a guarantee of source finalization.
- Cursor pagination, `totalCount`, exact advertiser identity and campaign advertiser IDs are checked. Duplicate campaign/date records, missing metrics, invalid ranges and partial provider responses are rejected. StackAdapt failure is isolated from Meta/Google: the dashboard explicitly labels their limited scope, displays unavailable rather than zero for DSP-only metrics, disables affected period comparisons, and suppresses incomplete pacing projections. Source errors still use the generic EIC boundary; missing StackAdapt configuration and HTTP status have secret-free server diagnostics.

## Verification

```sh
node --no-warnings --experimental-strip-types --test src/services/eic-stackadapt-core.test.mts src/services/eicagency-stackadapt-dashboard.test.mts
npx tsc --noEmit
npx eslint src/services/eic-stackadapt.ts src/services/eic-stackadapt-core.ts src/services/eicagency-analytics.ts src/components/EicAgencyDashboardClient.tsx src/app/dashboard/eicagency/error.tsx
npm run build
```

Live advertiser discovery confirmed the three current EIC Display campaigns. For 2026-10-01 through 2026-10-29 inclusive, daily delivery reconciled with TOTAL at API exclusive end 2026-10-30: cost $249.207789, 46,607 impressions and 45 clicks. The more recent 2026-10-30 snapshot had a DAILY-versus-TOTAL source difference; do not claim those recent aggregates are finalized or perfectly reconciled.

## Release and rollback

Requires branch-specific encrypted Vercel preview environment variable `STACKADAPT_EIC_API_TOKEN` on the analytics project. Set the production variable only during the separately approved production release. Do not publish or merge without Dustin's final review. Revert the feature commit to restore the prior Meta/Google dashboard; the feature does not mutate warehouse records or advertising campaigns.
