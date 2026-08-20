# Client Health Live Source Inventory

Inventory date: 2026-08-20

All checks were read-only. Supabase Management API queries were run against the exact project references without printing credentials or customer row values.

## Project routing

| Project | Reference | Client-health role |
|---|---|---|
| PrePass Ad Assistant | `hdaftbqteexugqakgdbx` | PrePass paid/CRM aggregate, PrePass budget, PrePass ClickUp sync fallback |
| EIC Clients | `lozgnyxixzfxokllevtb` | All other client reporting sources, EIC budgets, EIC ClickUp sync fallbacks, and the proposed consolidated health foundation |
| Canary Data | `fehdonfrlsrrkzaemkxp` | None. Canary remains isolated from EIC client health. |

Mike's implementation routes every query through the PrePass/default client. Correct production routing requires explicit PrePass and EIC adapters.

## Performance-source coverage

| Project | Relation | Kind | Rows | Minimum date | Maximum date | Null dates | Release observation |
|---|---|---:|---:|---|---|---:|---|
| PrePass | `master_marketing_performance` | Materialized view | 18,533 | 2024-06-13 | 2026-08-20 | 65 | No stable row key; use database-side date/window aggregation and explicitly exclude null dates |
| EIC | `master_spartaco` | View | 5,966 | 2025-03-03 | 2026-08-20 | 0 | Contains `id`; approved reporting-lane filters still required |
| EIC | `nsi_master_campaign_daily` | Table | 29,158 | 2023-01-01 | 2026-08-19 | 0 | Stable `id`; source coverage currently through prior day |
| EIC | `turfli_master` | View | 457 | 2026-01-01 | 2026-06-25 | 0 | Stale; likely inactive or ingestion failure, so cannot score until resolved |
| EIC | `durodyne_master` | View | 2,875 | 2024-07-17 | 2026-08-20 | 0 | No stable row key; aggregate in database |
| EIC | `goodgame_master` | View | 2,083 | 2025-09-11 | 2026-08-19 | 0 | Must filter online sales separately from foot traffic/retail scope |
| EIC | `bridgeway_master` | View | 685 | 2025-02-04 | 2026-08-19 | 0 | Generic `conversions` does not prove a 60-second-visit definition |
| EIC | `arabella_master` | View | 464 | 2026-01-13 | 2026-08-20 | 0 | Purchase/booking definition needs approval |
| EIC | `kinsey_master` | View | 516 | 2026-01-01 | 2026-08-20 | 0 | Online purchase scope needs approval |
| EIC | `state48_google` | Table | 646 | 2026-01-01 | 2026-08-20 | 0 | Google-only source; confirm whether overall health needs additional channels |
| EIC | `cba_master` | View | 563 | 2025-01-01 | 2026-08-20 | 0 | Qualified-lead definition needs approval |
| EIC | `liferep_master` | View | 987 | 2026-02-10 | 2026-06-23 | 0 | Stale; likely inactive or ingestion failure, so cannot score until resolved |
| EIC | `bloom_meta_ads` | Table | 4,014 | 2026-05-01 | 2026-08-19 | 0 | Stable `id`; `website_chats` field exists and requires native-event verification |
| EIC | `eicagency_master` | View | 1,802 | 2025-01-01 | 2026-08-20 | 0 | Internal-only reporting scope |
| EIC | `champagne_google` | Table | 112 | 2026-06-29 | 2026-08-19 | 0 | Stable `id`; lead semantics require approval |
| EIC | `champagne_meta` | Table | 132 | 2026-07-21 | 2026-08-19 | 0 | Stable `id`; cross-platform lead deduplication must be defined |
| EIC | `ihh_master` | View | 637 | 2026-01-01 | 2026-08-20 | 0 | Use lead/scheduled-appointment evidence, not prototype purchase label |

## Budget schemas

### PrePass `public.budgets`

- `id`
- `client`
- `budget`
- `meta_spent`
- `google_spent`
- `linkedin_spent`
- `tiktok_spent`
- `bing_spent`
- `daily_budget`

The prototype's `period_start` and `period_end` query is invalid for PrePass.

### EIC Clients `public.budgets`

- `id`
- `client`
- `budget`
- `meta_spent`
- `google_spent`
- `linkedin_spent`
- `tiktok_spent`
- `bing_spent`
- `period_start`
- `period_end`

This is the dated budget source for EIC clients, subject to alias and active-period validation.

## Client-health schema gap

`public.client_health_settings` does not exist in PrePass, EIC Clients, or Canary. The proposed foundation replaces the underspecified prototype table with approved configuration, metric definitions, source runs, snapshots, task references, and a latest-snapshot view in EIC Clients only.

## ClickUp inventory

The direct ClickUp API returned 428 current-month time entries at inventory time. Fourteen mapped client lists had live entries; 171 entries belonged to other unmapped lists and will not be silently assigned.

Verified mapped lists include PrePass, Spartaco Group, NSI, HVAC/Duro Dyne, Good Game - Nappy Boy Dranks, Bridgeway Insurance, Arabella Hotels, Kinsey Designs, State Forty Eight, CBA Autoglass, Bloom Aesthetics, EIC Marketing, Champagne Haus, and IHH.

Current EIC sync-table inventory includes mappings for Spartaco, NSI, Turfli, Duro Dyne, Good Game, Bridgeway, Arabella, Kinsey, LifeRep, EIC Agency, and Champagne. State Forty Eight, CBA, Bloom, and IHH require direct API collection because a matching per-client sync table is not available or not used by the prototype.

The direct ClickUp API is authoritative. Sync tables are fallback/evidence sources only.

## Margin workbook

Authenticated Google Sheets API access succeeded for spreadsheet `Budget: Monthly - Projections, 2025` and the current tab `August '26`.

The current sheet has columns for client, monthly hours, hourly value, fulfillment cost, and margin. The production adapter must use authenticated Sheets API access and remove the anonymous `gviz` endpoint.

Verified aliases include:

- PrePass: `Prepass`
- Spartaco: `Spartaco`
- NSI: four business-line rows
- Good Game: `Nappy Boy`
- Bridgeway: `Bridgeway`
- State Forty Eight: `State Forty Eight`
- CBA: `CBA AutoGlass`
- Arabella: `Scott - Arabella`
- Kinsey: `Scott - Kinsey`
- Bloom: `Scott - Bloom`
- Champagne: `Scott - Champagne Haus`
- IHH: `Infinite Health`

Turfli, LifeRep, Duro Dyne, and EIC Agency do not have an obvious direct current-month alias and therefore cannot use inferred finance values.

## Deterministic collection requirement

Many source relations are views or materialized views without stable row keys. Page-range pagination ordered only by `date` is unsafe. The production collector will use database-side date/window aggregation or a normalized daily source contract, then persist immutable source-run evidence and one idempotent daily snapshot per client.
