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

## Validation and protected reporting evidence

Actual financial totals, native snapshots, row counts and reconciliation evidence belong in protected reporting storage, not this public source document. The authorized dashboard retains source-coverage disclosures. Removing this block does not remove prior Git history; repository visibility or historical remediation requires owner approval.

- Channels, audiences, subcampaigns and campaign types reconcile their measures to portfolio totals.
- Native delivery checks and known ingestion/tagging exceptions remain separate from causal attribution claims.
- LinkedIn/publisher parity and GA4 property-level reconciliation remain incomplete.
- These disclosures do not authorize source repairs, changes to existing Monthly/Revenue reporting or workflow mutations.

## Modeled return and media presentation

The approved model is `0.01 * reported business revenue / matching family media spend`, not actual ad-attributed return or ROI. Combined uses BPT + POL only; CMP remains nested and nonadditive. Current and prior windows use independent matching denominators. Unavailable or zero model inputs produce unavailable output.

`NSI_YTD_MEDIA_SNAPSHOT_JSON` holds the native social/video snapshot as encrypted server-only configuration. The route authorizes NSI access before reading it, validates exact reporting dates and projects only known reporting fields. Do not commit real snapshot values or source exports. Missing configuration is explicitly unavailable; malformed configuration fails closed.

Video definitions remain platform-specific. YouTube placement spend is within Google totals; mixed-format spend is not inferred as video-only. Facebook content views are not legacy impressions. Follower change uses boundary stocks, and daily unique reach is never summed into YTD reach. LinkedIn is not represented as zero when unconnected.

## Verification commands

```sh
npm run test:nsi-ytd
npm run test:nsi-conversion-metrics
node --no-warnings --experimental-strip-types --test src/lib/nsi-ytd-email.test.mts src/lib/nsi-ytd-presentation.test.mts
npm run check:nsi-ytd
npx tsc --noEmit
npx eslint src/components/NsiYtdClient.tsx src/components/NsiYtdEmailSection.tsx src/app/dashboard/nsi/ytd/page.tsx src/lib/nsi-ytd-core.ts src/lib/nsi-ytd-email.ts src/lib/nsi-ytd-presentation.ts src/services/nsi-ytd.ts src/services/nsi-ytd-email.ts scripts/check-nsi-ytd.mts
npm run build
git diff --check
```

`check:nsi-ytd` requires the existing SPARTACO Supabase server environment. Native reconciliation is distinct from that script's warehouse consistency checks.

Authenticated Chromium acceptance covers an NSI viewer, agency viewer, denied unrelated-client viewer, anonymous redirect, family selection, expandable detail and mobile overflow. An existing third-party NivaAI marketing tag can emit a fetch error; record it separately from application errors rather than suppressing all browser errors.

## Version two presentation and native email snapshot

- Keeps the fixed periods, existing reporting services, Monthly and Revenue pages unchanged. After `requireClientAccess('nsi')`, the YTD route reads protected server configuration through its server-only email loader. Authorized response props include projected campaign identities and per-group metrics. They are not embedded in public JavaScript or committed data files.
- Revenue-first pillar cards retain BPT + POL as the total, with CMP explicitly nested. November 4 role/scoring/handoff status is separated from Jan-Oct outcomes and cites the source call and dated ClickUp evidence.
- Default activity tables always include total conversions. Four shared optional-column choices affect presentation only. Zero-spend conversions remain visible; historical/inactive rows remain expandable and are included when printing.
- Print / Save PDF opens report-local details, preserves the selected family table, includes overall pillar cards and campaign-email scope, splits wide activity tables into three narrower print tables, and restores prior expansion states after printing.
- Email is a frozen native HubSpot Campaigns-table snapshot for Jan-Oct in each year. The exact approved CCF-/CON-/NEL- campaign union and extraction metadata are retained in private audit evidence. Missing groups remain null, not zero. Historical-only rows are retained. Schema validation checks shape and reporting windows, not completeness against the independently approved campaign union.
- Email sent/delivered are sums of returned native campaign groups, not unique people. Opens/clicks and rates stay at native group grain. Internal, test, sales/rep and automated activity can remain; EZL is explicitly internal-associated. No clean external-only, paid-attributed, qualified-lead, or deduplicated-audience claim is made.
- Native campaign-filtered asset cohorts overlap and differ from grouped rows. Current email metadata is not used to reallocate historical native facts. A separate unresolved 2025 whole-portal email-list/overview control discrepancy remains documented in private audit evidence and is outside this section's grouped facts.
- No source repairs, campaign edits, ClickUp changes or automation changes are included. Social/video and sales-qualified outcomes have no invented data panels.

## Protected email configuration

- `NSI_YTD_EMAIL_SNAPSHOT_JSON` is required server-only configuration, never a `NEXT_PUBLIC_` variable. Store the approved private JSON as protected deployment configuration, not in this public repository, test fixtures, PR text, public assets, or logs.
- Missing or invalid configuration fails the YTD request closed with a generic error. The rest of the dashboard's routes do not depend on this new setting.
- Before provisioning, verify the exact analytics project, repository, production branch and target environments. Check that the key does not already exist, respect value-size limits, and do not overwrite unrelated settings or credentials.
- Reconcile the configured payload with the approved private snapshot. The parser projects only expected fields and preserves explicit nulls. Its shape checks do not replace native-source reconciliation or campaign-union verification.
- After configuration, build and test the final revision. Check anonymous HTML/RSC and unrelated-client denial, public bundle absence, authenticated full-metric parity, optional columns, historical rows, mobile layout, and actual PDF output before release.

## Release boundary

Dustin authorized publishing this additive route as a clearly labeled first draft for review. Release goes through the analytics `main` pull-request workflow and exact-SHA deployment verification. Monthly/revenue page code, source records, campaigns, budgets, automation, and ClickUp tasks remain unchanged. Audience tables show historical values with a noncomparable label, but withhold YoY percentages.
