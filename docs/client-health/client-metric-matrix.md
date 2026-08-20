# Client Health Metric Mapping Matrix

Status: **Draft for source inventory and Dustin approval**

A client remains `configuration_required` until every required source and metric definition is approved and reconciled. No unapproved row may score Healthy.

| Client ID | Display name | Performance project/source | Proposed north star | Scope requirement | ClickUp list | Margin workbook alias | Current decision state |
|---|---|---|---|---|---|---|---|
| `prepass` | PrePass | PrePass / `master_marketing_performance` | Cost per SQL and Cost per Won, with Won primary | Preserve SMB, ABM, and FD360 separation; brand and non-brand Search remain separate | PrePass `240062401` | `Prepass` | Needs threshold and primary/secondary card approval |
| `spartaco` | Spartaco | EIC Clients / `master_spartaco` | Cost per approved outcome by reporting lane | Do not combine Brand Health, Lead Gen, and eCommerce objectives into one ambiguous conversion total | Spartaco Group `901407399216` | `Spartaco` | Needs exact health-lane outcome approval |
| `nsi` | NSI | EIC Clients / `nsi_master_campaign_daily` | Cost per qualified lead | Preserve approved product/business-line segmentation where needed | NSI `900900564386` | NSI Electrical, NSI Direct Electrical, NSI Data Electrical, NSI HVAC | Needs aggregate-versus-line-level decision |
| `durodyne` | Duro Dyne | EIC Clients / `durodyne_master` | Cost per qualified lead | Confirm Duro Dyne/Dura-Line/Dyn-O-Mite aggregation | HVAC `901415478138` | Not present under a direct August 2026 alias | Needs ClickUp-list and margin-source confirmation |
| `goodgame` | Good Game / Nappy Boy | EIC Clients / `goodgame_master` | Online cost per purchase | Exclude foot-traffic and retail spend from online purchase efficiency | Good Game - Nappy Boy Dranks `901414768821` | `Nappy Boy` | Proposed scope is approved by established reporting rule; verify table filter |
| `bridgeway` | Bridgeway | EIC Clients / `bridgeway_master` | Cost per verified 60-second visit or approved lead | Do not use generic conversions unless proven to equal the label | Bridgeway Insurance `901413196484` | `Bridgeway` | Needs exact business/entity and result-field confirmation |
| `arabella` | Arabella Hotels | EIC Clients / `arabella_master` | Cost per verified purchase or booking | Confirm purchase/booking field and campaign scope | Arabella Hotels `901414345904` | `Scott - Arabella` | Needs north-star field approval |
| `kinsey` | Kinsey Designs | EIC Clients / `kinsey_master` | Cost per verified purchase | Confirm online purchase scope | Kinsey Designs `901414385622` | `Scott - Kinsey` | Needs north-star field approval |
| `state48` | State Forty Eight | EIC Clients / `state48_google` | Cost per verified purchase | Confirm whether Meta or other channels belong in total health | State Forty Eight `900500452322` | `State Forty Eight` | Needs channel-completeness approval |
| `cba` | CBA Autoglass | EIC Clients / `cba_master` | Cost per qualified lead | Preserve approved platform/source scope | CBA Autoglass `901400944748` | `CBA AutoGlass` | Needs qualified-lead definition approval |
| `liferep` | LifeRep | EIC Clients / `liferep_master` | Cost per qualified lead | Confirm current active-client status and reporting source | No mapped list in Mike's prototype | No direct August 2026 alias | Needs active status, ClickUp, and margin confirmation |
| `bloom` | Bloom Aesthetics | EIC Clients / `bloom_meta_ads` | Cost per verified website chat | Confirm website-chat event semantics | Bloom Aesthetics `901414401917` | `Scott - Bloom` | Needs event-field approval |
| `turfli` | Turfli | EIC Clients / `turfli_master` | Cost per qualified lead | Confirm current active-client status | No mapped list in Mike's prototype | No direct August 2026 alias | Needs active status, ClickUp, and margin confirmation |
| `eicagency` | EIC Agency | EIC Clients / `eicagency_master` | Cost per qualified EIC lead | Internal marketing only; do not mix client delivery metrics | EIC Marketing `900901846441` | No direct August 2026 alias | Needs inclusion decision and internal hours rule |
| `champagne` | Champagne Haus | EIC Clients / `champagne_google` plus `champagne_meta` | Cost per qualified lead | Deduplicate cross-platform outcomes if the same lead can appear in both sources | Champagne Haus `901417128015` | `Scott - Champagne Haus` | Needs lead-deduplication rule approval |
| `ihh` | Infinite Heart Health | EIC Clients / `ihh_master` plus CRM/CAPI evidence | Cost per lead and scheduled appointment | Do not use purchase unless explicitly approved; native lead/schedule events are authoritative | IHH `901418534831` | `Infinite Health` | Proposed lead/schedule definition needs final threshold approval |

## Dimensions and default release behavior

| Dimension | Required default | Source-of-truth expectation | Missing behavior |
|---|---:|---|---|
| Budget pacing | Yes for paid-media clients | Approved monthly budget configuration plus native/source-table spend | `incomplete` |
| North-star trend | Yes | Approved native outcome and exact current/prior windows | `incomplete` |
| Hours utilization | Yes for retained-service clients | ClickUp time-entry API plus approved monthly allotment | `incomplete` |
| Overdue execution | Yes when ClickUp list is approved | ClickUp task API by stable list/task ID | `incomplete` |
| Margin | Yes when finance row exists; otherwise explicitly optional | Authenticated Google Sheets API | `incomplete` if configured required; visible unavailable otherwise |

## Proposed defaults requiring Dustin approval

1. Comparison windows: current last 14 complete days versus immediately preceding 14 complete days.
2. Budget pacing time zone: America/Phoenix unless the client's approved reporting contract requires another zone.
3. Overall status labels: Healthy, Watch, At Risk, Incomplete, Configuration Required.
4. A missing required source always produces Incomplete.
5. A critical red north-star or margin status caps the overall status at At Risk.
6. Currency reconciliation tolerance: $0.01 after source-precision rounding.
7. Integer outcomes, overdue tasks, and ClickUp entry IDs must match exactly.
8. ClickUp duration must match exact milliseconds before display rounding.

## Information currently needed from Dustin

Only unresolved business definitions should require manual input. Source schemas, IDs, aliases, budgets, and API values will be discovered directly where available.

1. Confirm whether Turfli and LifeRep are active and should appear.
2. Confirm whether EIC Agency should appear alongside paying clients or in a separate internal section.
3. Confirm whether Bridgeway is the current Insurance entity and whether the north star is a 60-second visit or qualified lead.
4. Approve the proposed PrePass primary status based on SQL/Won, with Cost/Won emphasized.
5. Approve the remaining client-specific north-star and campaign-scope decisions after the live source inventory is attached.
