# NSI YTD review draft

Route: `/dashboard/nsi/ytd`, guarded by `requireClientAccess('nsi')` before data loading.

## Review scope

- Fixed January 1 through October 31, 2026 versus the identical calendar months in 2025. This review snapshot deliberately does not drift with the current month.
- Executive readout calculated from the same request's data, not a stale saved monthly AI readout.
- Combined business revenue is Bridgeport plus Polaris only. Compression is a nested Polaris breakout, not an additional total.
- Product-family selector filters only the revenue/family-spend table. Portfolio KPIs and the monthly comparison remain all activity.
- All current and previous warehouse activity is retained. Residual rows expose untagged subcampaigns, publisher/other campaign types and historical audience classification differences.
- Contractor/distributor YoY is withheld because the audience taxonomy changed. Conversions have no pre-2026 comparison. Fractional platform conversion credit is retained to two decimals.
- Sessions and engaged sessions follow the existing campaign-attributed warehouse definition. No distinct users are summed or displayed, and property-level GA4 parity is not claimed.
- Proposed 2027 tests: AI-assisted creative production, greater creative-testing cadence, connected TV and audio. These are unapproved strategic options, not launches or claims of completed work.

## Sources and grouping

Revenue: `nsi_revenue`, one valid row per family per month required. Missing, null or duplicate family-month rows produce unavailable revenue rather than a partial total or zero.

Media: the same `fetchNsiDashboardData` service used by the existing main dashboard. Narrow independently paginated fact reads check family/month spend and fail when totals diverge during a read. Source paging uses date and unique id ordering.

Family media classification prefers `sub_campaign`, falling back to campaign name only if unclassified:

- Bridgeport: BPT, LQT, PEN-100, OOPS, EZL.
- Polaris: POL, CMP, LSS, MCH.
- Compression: CMP, already included in Polaris.
- Other: all remaining media, with no invented company revenue linkage.

Google account: NSI Industries `2580549250`, USD, America/Chicago. Meta account: NSI Industries `1189511575368694`, USD, America/New_York. Local account-day reporting is retained. Separate NSI HVAC Google account is outside this reporting boundary.

## November 4, 2026 validation

- Current warehouse window: 9,217 distinct fact rows, ten observed months.
- Prior warehouse window: 7,318 distinct fact rows, ten observed months.
- Both years have all ten monthly revenue records for each of Bridgeport, Polaris and Compression.
- Combined current revenue: $376,631,260.06.
- Current warehouse media spend: $179,899.67048076232. Prior spend: $129,621.41946803988.
- Channels, audiences, subcampaigns and campaign types reconcile current/previous spend and current conversions, clicks, impressions and engaged sessions to the portfolio.
- Native Google spend, clicks and impressions reconcile for both YTD windows, including daily delivery checks.
- Native Meta 2025 reconciles. The 2026 warehouse remains short by $71.16, 82 clicks and 4,957 impressions, isolated to October 7.
- Five October OOPS rows contain 22 conversions and $104.50 spend outside the named OOPS bucket. Channel/portfolio totals contain those actions. Draft family-level spend includes identifiable OOPS through name fallback, while subcampaign detail preserves the untagged residual.
- LinkedIn/publisher native parity and GA4 property-level reconciliation remain incomplete. Full-year native conversion taxonomy was not re-audited.

These are draft disclosures, not authorization to repair production ingestion, campaigns, existing monthly/revenue reporting, or n8n workflows.

## Verification commands

```sh
npm run test:nsi-ytd
npm run test:nsi-conversion-metrics
npm run check:nsi-ytd
npx tsc --noEmit
npx eslint src/components/NsiYtdClient.tsx src/app/dashboard/nsi/ytd/page.tsx src/lib/nsi-ytd-core.ts src/services/nsi-ytd.ts scripts/check-nsi-ytd.mts
npm run build
git diff --check
```

`check:nsi-ytd` requires the existing SPARTACO Supabase server environment. Native reconciliation is distinct from that script's warehouse consistency checks.

Authenticated Chromium acceptance covers an NSI viewer, agency viewer, denied unrelated-client viewer, anonymous redirect, family selection, expandable detail and mobile overflow. An existing third-party NivaAI marketing tag can emit a fetch error; record it separately from application errors rather than suppressing all browser errors.

## Release boundary

Dustin authorized publishing this additive route as a clearly labeled first draft for review. Release goes through the analytics `main` pull-request workflow and exact-SHA deployment verification. Monthly/revenue page code, source records, campaigns, budgets, automation, and ClickUp tasks remain unchanged. Audience tables show historical values with a noncomparable label, but withhold YoY percentages.
