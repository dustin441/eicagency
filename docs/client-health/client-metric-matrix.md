# Client Health Mapping Approval Matrix

Status: **Review-ready proposal for Dustin approval**
Evidence refreshed: **2026-08-27**
Production activation: **None**

No row in this document is approved merely because a dashboard route or source exists. Every client remains `configuration_required` until Dustin approves the exact business definition and a fresh native-source reconciliation passes. Missing or stale data never becomes zero or Healthy.

## Approval boundary

Approval of this matrix would authorize preparation of an immutable configuration revision only. It would not authorize production DDL, credentials, collectors, schedules, publication, dashboard release, or client visibility. Those remain separately gated.

Live metadata checks performed for this revision:

- EIC and PrePass budget aliases and date coverage were read through the Supabase Management API without retrieving or recording budget amounts.
- All 14 proposed ClickUp list IDs were read through the direct ClickUp API. Every listed ID exists, matches the displayed list name, and is not archived.
- Dashboard routes were read from `src/app/dashboard/layout.tsx`.
- Margin aliases and monthly-hours source availability use the authenticated August 2026 workbook inventory. No financial values are stored here.
- Performance-source coverage uses the read-only source inventory dated 2026-08-20. A fresh native-source reconciliation is still mandatory immediately before activation.

## Shared calculation contract proposed for approval

| Item | Proposed definition | Approval state |
|---|---|---|
| Reporting time zone | `America/Phoenix` unless an approved client contract explicitly requires another zone | Proposed |
| Snapshot date | Latest complete required-source date, never the dashboard request time | Proposed |
| Comparison | Last 14 complete days through the snapshot date versus the immediately preceding 14 complete days | Proposed |
| Budget pacing | Absolute percentage-point variance between month spend percentage and elapsed calendar percentage | Proposed |
| North-star trend | Percentage change in ratio-of-sums cost per approved result; verified zero results are At Risk, not missing | Proposed |
| Hours pacing | Projected month-end ClickUp hours as a percentage of the approved monthly allotment | Proposed |
| Overdue execution | Count of open overdue tasks in the exact approved ClickUp list | Proposed |
| Margin | `(revenue - fulfillment cost) / revenue × 100`; zero revenue is unavailable rather than zero margin | Proposed |
| Missing required source | `incomplete`; no score and no inferred zero | Required gate |
| Unapproved definition | `configuration_required`; no collectors needed and no score | Required gate |
| Critical override | Required At Risk north-star or margin forces overall At Risk | Proposed |

## Shared thresholds and weights proposed for approval

| Dimension | Direction | Healthy | Watch | At Risk | Weight | Required default |
|---|---|---:|---:|---:|---:|---:|
| Budget pacing variance | Lower is better | `≤ 10` points | `> 10` and `≤ 20` | `> 20` | 20 | Yes for paid-media clients |
| North-star cost change | Lower is better | `≤ 5%` | `> 5%` and `≤ 15%` | `> 15%` | 20 | Yes |
| Projected hours use | Lower is better | `≤ 90%` | `> 90%` and `≤ 110%` | `> 110%` | 20 | Yes for retained-service clients |
| Overdue tasks | Lower is better | `0` | `1–2` | `≥ 3` | 20 | Yes when a ClickUp list is approved |
| Margin | Higher is better | `≥ 60%` | `≥ 40%` and `< 60%` | `< 40%` | 20 | Yes when an approved finance row exists |

Any client-specific threshold or weight exception must be written into that client's row before approval. No silent override is permitted.

## Per-client approval matrix

All rows currently have activation state **`configuration_required`**.

| Client ID / display | Dashboard route / current UI | Proposed performance and north star | Budget source / alias status | Hours, ClickUp, and margin mapping | Required dimensions / exceptions | Decision required before approval |
|---|---|---|---|---|---|---|
| `prepass` / PrePass | `/dashboard`; visible | PrePass `master_marketing_performance`; Cost per Won is primary and Cost per SQL is supporting. Preserve SMB, ABM, FD360, and brand/non-brand Search scope. | PrePass `budgets`; aliases `PrePass`, `SMB`, `ABM`, `FD360` verified. Table has no period columns, so exact current-month row-selection and aggregation must be approved. | ClickUp `PrePass` (`240062401`) verified. Workbook alias `Prepass`; monthly hours and margin come from that exact row. | All five required. Client-specific north-star presentation has Won primary. | Approve budget alias aggregation, Cost/Won primary status logic, and whether SQL is a second scored metric or supporting evidence only. |
| `spartaco` / Spartaco | `/dashboard/spartaco/leads`; visible | EIC `master_spartaco`. Health cannot combine Brand Health, Lead Gen, and eCommerce. Proposed scored lane is approved lead-generation outcome only; Brand Health remains all/product including brand, while Lead Gen/eCommerce excludes general brand. | No matching current EIC `budgets` alias found. | ClickUp `Spartaco Group` (`901407399216`) verified. Workbook alias `Spartaco`. | All five only after a budget alias exists. | Approve the one scored lead-generation numerator and campaign scope; supply/approve the current budget alias. |
| `nsi` / NSI | `/dashboard/nsi`; visible | EIC `nsi_master_campaign_daily`; Cost per qualified lead. Preserve Electrical, Direct Electrical, Data Electrical, and HVAC lines. | No matching current EIC `budgets` alias found. | ClickUp `NSI` (`900900564386`) verified. Workbook has four NSI business-line rows. | All five only after budget and aggregation rules exist. | Decide account-level versus separately weighted business-line health, exact qualified-lead field, finance aggregation, and budget alias. |
| `durodyne` / Duro Dyne | `/dashboard/durodyne`; visible | EIC `durodyne_master`; proposed Cost per qualified lead. Confirm Duro Dyne, Dura-Line, and Dyn-O-Mite scope. | EIC aliases `durodyne_duraline` and `durodyne_dynatite` exist only through July 2026; no current August budget row. | ClickUp `HVAC` (`901415478138`) verified. No obvious direct August workbook alias. | Budget, hours, and margin cannot be required until sources are approved; otherwise row remains configuration required. | Confirm entity aggregation, qualified-lead field, current budget, monthly-hours source, and margin source. |
| `goodgame` / Good Game / Nappy Boy | `/dashboard/goodgame/sales`; visible | EIC `goodgame_master`; Online Cost per Purchase. Online health excludes retail/foot-traffic spend and wholesale/draft orders. | Use the online-only August alias `goodgame_sales`, subject to native reconciliation. Do not use `goodgame_foot_traffic`; generic `goodgame` requires classification before use. | ClickUp `Good Game - Nappy Boy Dranks` (`901414768821`) verified. Workbook alias `Nappy Boy`. | All five required once the online budget filter is proven. | Approve `goodgame_sales` as the exact online budget alias and the source filters excluding retail, foot traffic, wholesale, and draft orders. |
| `bridgeway` / Bridgeway | `/dashboard/bridgeway`; visible | EIC `bridgeway_master`; either verified 60-second visit or qualified lead, but not generic conversions. | EIC `Bridgeway` has an August 2026 row. | ClickUp `Bridgeway Insurance` (`901413196484`) verified. Workbook alias `Bridgeway`. | All five required after the result field is proven. | Confirm current business/entity and choose exactly one north-star numerator with native-field proof. |
| `arabella` / Arabella Hotels | `/dashboard/arabella`; visible | EIC `arabella_master`; verified booking or purchase within approved campaign scope. | EIC `Arabella` budget exists only for March 2026 and is stale. | ClickUp `Arabella Hotels` (`901414345904`) verified. Workbook alias `Scott - Arabella`. | Budget cannot score until a current row exists; remaining dimensions can be configured only after north-star approval. | Approve booking/purchase field and scope; supply a current budget row. |
| `kinsey` / Kinsey Design | `/dashboard/kinsey`; visible | EIC `kinsey_master`; verified online Cost per Purchase. | EIC `Kinsey` has an August 2026 row. | ClickUp `Kinsey Designs` (`901414385622`) verified. Workbook alias `Scott - Kinsey`. | All five required after purchase scope is proven. | Approve online purchase numerator and included campaign/product scope. |
| `state48` / State Forty Eight | `/dashboard/state-forty-eight`; visible | EIC `state48_google`; proposed verified Cost per Purchase. Current performance source is Google-only. | EIC `State48` budget exists only for March 2026 and is stale. | ClickUp `State Forty Eight` (`900500452322`) verified. Workbook alias `State Forty Eight`. | Budget cannot score until current. North star cannot be called account-wide until channel completeness is approved. | Decide Google-only versus all-channel health, approve purchase field, and supply current budget coverage. |
| `cba` / CBA Glass | `/dashboard/cba`; visible | EIC `cba_master`; Cost per Qualified Lead with approved platform/source scope. | EIC has `CBA` March-only plus lowercase `cba` beginning April with null end date. The open-ended alias must be explicitly approved as current rather than inferred. | ClickUp `CBA Autoglass` (`901400944748`) verified. Workbook alias `CBA AutoGlass`. | All five required after alias and lead semantics are approved. | Approve lowercase open-ended budget row, qualified-lead numerator, and platform scope. |
| `liferep` / LifeRep | `/dashboard/liferep`; hidden from reporting dropdown | EIC `liferep_master` was stale in the source inventory. Active status and qualified-lead definition are unresolved. | EIC `liferep` budget ends May 2026 and is stale. | No approved ClickUp list. No direct August workbook alias. | None may be activated. | Confirm whether the client is active. If active, supply fresh performance, current budget, ClickUp, hours, margin, and north-star mappings. |
| `bloom` / Bloom Aesthetics | `/dashboard/bloom`; visible | EIC `bloom_meta_ads`; proposed Cost per verified Website Chat. | EIC `bloom` has an August 2026 row. | ClickUp `Bloom Aesthetics` (`901414401917`) verified. Workbook alias `Scott - Bloom`. | All five required after event semantics are natively reconciled. | Approve the exact Meta event/API field and verify that it represents a real website chat without duplication. |
| `turfli` / Turfli | `/dashboard/turfli`; hidden from reporting dropdown | EIC `turfli_master` was stale in the source inventory. Active status and qualified-lead definition are unresolved. | EIC `Turfli` budget ends April 2026 and is stale. | No approved ClickUp list. No direct August workbook alias. | None may be activated. | Confirm whether the client is active. If active, supply every required source and definition. |
| `eicagency` / EIC Agency | `/dashboard/eicagency`; visible internal route | EIC `eicagency_master`; proposed Cost per Qualified EIC Lead for internal marketing only. | `EIC` is March-only; `EICAgency` has null period dates. Neither is an approved current mapping. | ClickUp `EIC Marketing` (`900901846441`) verified. No direct August workbook alias. | Must be a separate internal configuration or excluded; do not mix with paying-client health. | Decide inclusion versus separate internal section, then approve budget, lead definition, monthly-hours policy, and margin treatment. |
| `champagne` / Champagne Haus | `/dashboard/champagne`; visible | EIC `champagne_google` plus `champagne_meta`; proposed Cost per Qualified Lead. Cross-platform outcomes must be deduplicated or one system designated authoritative. | EIC `Champagne` has an August 2026 row. | ClickUp `Champagne Haus` (`901417128015`) verified. Workbook alias `Scott - Champagne Haus`. | All five required after cross-platform outcome semantics are resolved. | Approve one deduplicated numerator, source-of-truth system, and included campaign scope. |
| `ihh` / InfiniteHeart Health | `/dashboard/ihh`; visible | EIC `ihh_master` plus CRM/CAPI evidence; Cost per Lead and scheduled appointment. Do not use purchase. Native lead and schedule events are authoritative. | EIC `IHH` has an August 2026 row. | ClickUp `IHH` (`901418534831`) verified. Workbook alias `Infinite Health`. | All five required after deciding which outcome drives the single scored north-star dimension. | Approve whether scheduled appointment is primary and lead is supporting, plus exact attribution and thresholds. |

## Approval decisions requested from Dustin

Approve or revise each item explicitly:

1. Shared 14-day windows, Phoenix time zone, thresholds, equal 20-point weights, and critical north-star/margin override.
2. PrePass Cost/Won primary logic and exact aggregation of `PrePass`, `SMB`, `ABM`, and `FD360` budgets.
3. Spartaco's single scored Lead Gen definition while preserving separate Brand Health and eCommerce scopes.
4. NSI account-level versus business-line scoring and finance aggregation.
5. Duro Dyne entity aggregation and missing current finance/budget sources.
6. Good Game online-only alias and exclusions.
7. Bridgeway's exact 60-second-visit versus qualified-lead numerator.
8. Arabella, Kinsey, State Forty Eight, CBA, Bloom, Champagne, and IHH north-star definitions and noted source constraints.
9. Whether Turfli and LifeRep are inactive or require restored mappings.
10. Whether EIC Agency is excluded or shown in a separate internal section.

## Fail-closed activation checklist

A client can leave `configuration_required` only when all boxes for that row are supported by exact immutable revision content:

- [ ] Active/inactive disposition approved
- [ ] Dashboard route approved
- [ ] Performance project, relation, date field, stable collection contract, and freshness verified
- [ ] Exactly one scored north-star outcome and numerator approved
- [ ] Campaign/product/channel scope approved
- [ ] Current budget source and exact alias approved
- [ ] 14-day comparison or written client-specific exception approved
- [ ] ClickUp list ID and current unarchived state verified
- [ ] Monthly hours source and exact finance alias approved
- [ ] Margin alias and required/optional treatment approved
- [ ] Required dimensions, thresholds, weights, and critical overrides approved
- [ ] Native-source reconciliation passes for latest complete period
- [ ] Immutable revision hash/UUID generated and independently reviewed
- [ ] No production action before exact-SHA migration approval and backup
