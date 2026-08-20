# Client Health Raw-Source QA and Release Gates

## Release standard

"110% accurate" means:

1. 100% reconciliation coverage for every active client, displayed metric, status, and date window.
2. Independent raw-native verification against each authoritative API, not only warehouse-to-dashboard agreement.
3. Deterministic repeatability: the same frozen inputs produce byte-equivalent normalized evidence and identical ratings.
4. Fail-closed missingness: unverified, stale, partial, or unavailable required data can never produce Healthy.
5. Evidence sufficient for a second reviewer to reproduce each result.

The dashboard remains under audit and not releasable until every hard gate passes.

## Hard gates

| Gate | Requirement | Pass condition |
|---|---|---|
| G0 Source contract | Every client metric has an approved source contract | Client, account/property/list, native metric, timezone, date window, grain, filters, aliases, and owner are documented |
| G1 Security | Sources use authenticated least-privilege server access | No public margin endpoint, no browser service-role access, no raw credentials or confidential payloads in UI/logs/Git |
| G2 Coverage | Every expected source period is present | Exact expected/available date sets are recorded; absent dates are unavailable, not zero |
| G3 Pagination | Retrieval is complete and deterministic | Stable unique ordering or database aggregation; page count and record IDs reconcile |
| G4 Native reconciliation | Headline values match authoritative APIs | All metrics meet the exact variance rules below |
| G5 Calculation | Snapshot formulas are deterministic | Frozen fixtures and live evidence reproduce statuses and scores exactly |
| G6 Missingness | Required source failures fail closed | Client is Incomplete, source badge is not green, and missing source is named |
| G7 Access/UI | Internal access and presentation are correct | Agency/super-admin allowed; unauthorized roles denied; desktop/mobile/console/request QA pass |
| G8 Deployment | Exact reviewed code is what is promoted | Final SHA, Vercel preview, environment names, migration readback, and production smoke test all match |

## Reconciliation chain

Every displayed value must reconcile across all four layers:

```text
Raw authoritative API
  -> normalized Supabase/source aggregate
  -> persisted client_health_snapshot
  -> rendered dashboard value and status
```

Agreement between only the final three layers is insufficient.

## Required windows per active client

1. Current month-to-date through the latest complete common source day.
2. Current approved north-star comparison window.
3. Previous comparison window.
4. Latest complete daily record.
5. At least three deterministic daily samples, including a zero-result day when available.
6. Month boundary, leap-year, and America/Phoenix boundary fixtures.

## Metric evidence

### Paid-media spend and outcomes

Record:

- Native platform account ID
- API resource and exact field names
- Campaign/product filters
- Timezone
- Date window
- Raw response/request fingerprint
- Spend numerator
- Result numerator
- Warehouse aggregate
- Snapshot aggregate
- UI value

### CRM-qualified outcomes

For SQL, Won, scheduled appointment, or qualified lead metrics:

- Record stable CRM IDs or a reproducible aggregate fingerprint.
- Document status/stage eligibility and event-date field.
- Prove duplicate and reopened-opportunity handling.
- Never relabel ad-platform conversions as CRM-qualified outcomes.

### ClickUp hours

- Fetch direct time-entry API data.
- Reconcile stable entry IDs, list IDs, task IDs, start/end, and exact duration milliseconds.
- Confirm entries assigned to unmapped lists are excluded visibly rather than reassigned.
- Compare exact milliseconds before converting to displayed hours.

### ClickUp overdue tasks

- Fetch direct task API data with complete pagination.
- Reconcile stable task IDs and approved list IDs.
- Apply the same due-time timezone and closed-status rules.
- Verify displayed top-five links are members of the exact reconciled overdue set.

### Budget and hours allotment

- Reconcile budget to the approved active-period source and aliases.
- Reconcile monthly hours to the authenticated current-month finance/allotment source.
- Preserve explicit configuration-required status for absent or conflicting rows.

### Margin

- Fetch through the authenticated Google Sheets API.
- Record spreadsheet ID, tab name, row alias, source columns, and retrieval timestamp.
- Recompute margin from revenue and fulfillment cost where both are available.
- Compare sheet-provided margin with the recomputed value and fail unexplained discrepancies.

## Variance rules

| Metric | Allowed variance |
|---|---|
| Spend, budget, revenue, fulfillment cost | Maximum unexplained absolute variance of $0.01 after documented source-precision rounding |
| Leads, purchases, SQL, Won, appointments, overdue tasks | Exact integer match |
| ClickUp time | Exact milliseconds before display rounding |
| Rates, pacing, cost per result, margin | Recompute from matched raw numerators/denominators; only documented display rounding may differ |
| Date coverage | Exact expected date set |
| Stable source IDs | Exact set equality after documented deduplication |

Any unexplained variance fails release. Percentage tolerances cannot hide material integer or currency mismatches.

## Missingness and freshness

- Required source missing: overall `incomplete`.
- Source request failed: source badge failed/unknown, never healthy.
- Latest source date older than the approved cadence: stale and incomplete.
- Missing prior comparison period: trend unavailable, not infinite improvement.
- True zero with verified source coverage: retain zero.
- Zero without verified source coverage: unavailable.
- One missing required dimension cannot be averaged away by other green metrics.

## Evidence artifact

Each QA run creates a machine-readable evidence bundle outside Git when values are confidential.

Required top-level fields:

- `qa_run_id`
- `generated_at`
- `reviewed_sha`
- `calculation_version`
- `source_contract_version`
- `client_results`
- `environment`
- `overall_pass`

Each metric result includes:

- Client and metric key
- Native account/property/list ID
- Native API resource and field names
- Timezone and exact date range
- Request fingerprint and retrieval timestamp
- Native value and source-record count
- Supabase aggregate
- Snapshot value
- Rendered value
- Absolute and percentage variance
- Coverage and freshness evidence
- Pass/fail disposition and reason

Hash the canonical evidence JSON. Store the hash and QA run ID with the release record so the reviewed evidence cannot be silently replaced.

## Automated tests

Required deterministic fixtures:

1. More than 1,000 rows sharing one date.
2. Duplicate source rows and duplicate stable IDs.
3. Empty source versus verified zero.
4. Missing current day.
5. Missing prior period.
6. Stale source timestamp.
7. Partial ClickUp page failure.
8. Margin alias collision or missing alias.
9. Retry after snapshot write.
10. Conflicting active budget rows.
11. Boundary values for every green/yellow/red threshold.
12. One red critical dimension with otherwise green metrics.
13. One missing required dimension with otherwise green metrics.

## Authenticated UI QA

- Verify the agency role can load the route.
- Verify super-admin can load the route.
- Verify every unauthorized role is rejected server-side.
- Inspect desktop and mobile layouts.
- Click all visible client and ClickUp links safely.
- Inspect browser console and failed network requests.
- Confirm no raw API errors, tokens, internal payloads, or confidential finance fields leak to the browser.
- Confirm all visible date labels state the exact period or data-through date.
- Confirm source badges reflect live source-run status.

## Final release procedure

1. Freeze the final candidate SHA.
2. Run complete source collection and save the evidence bundle.
3. Reconcile 100% of active clients and metrics.
4. Have a second reviewer independently reproduce selected native requests and all aggregate formulas.
5. Run tests, typecheck, lint, production build, dependency audit, and diff checks.
6. Validate the authenticated Vercel preview at the exact SHA.
7. Verify migration objects, RLS, grants, runtime environment names, and rollback.
8. Obtain Dustin's approval for the exact SHA and preview.
9. Merge through protected `main`.
10. Wait for the production deployment to reach Ready.
11. Run production smoke and raw-source spot reconciliation.
12. If any gate regresses, roll back the deployment or mark the page unavailable rather than showing unverified health.
