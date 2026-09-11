# IHH Meta-paid forward funnel

Scope: original acknowledged quiz-lead records with existing immutable opportunity snapshots explicitly identifying Facebook/Instagram + paid_social. Retains native schema versions; does not recompute attribution. Organic/direct/unknown/ambiguous records are excluded. This is a verified source subset, not a complete native quiz census or Meta platform-attributed conversions.

## Dashboard

All four chronological unique-contact stages: Quiz lead → Appointment scheduled → Closer scheduled → Closed won. Percentages use the preceding nested stage; zero denominators are unavailable rather than fabricated percentages. Missing tracking is distinct from zero observed events. Appointment Scheduled remains the optimization KPI.

The existing media panels and their default date range remain unchanged. With no explicit date selection, this additional funnel defaults to the full verified collection window. Explicit selected dates clip to available coverage. The panel states its exact cohort window and observation cutoff. Older-than-six-hour source batches show stale rather than current metrics. Internal identifiers/evidence are removed before client serialization. Source failure affects only this panel.

## Collection / database

Dedicated public tables: `ihh_meta_paid_original_cohort` and `ihh_meta_paid_cohort_manifests`. Both have RLS; anon/authenticated receive no access, dashboard service_role SELECT only. Privileged publisher inserts a new immutable hashed batch and its completed manifest in one transaction; no runtime UPDATE/DELETE permissions. Latest completed publication is read once, then every page is pinned to that hash and exact count. Native snapshot versions remain unchanged.

Deployment artifacts are under `/opt/data/qa/ihh-funnel-20260911/forward-collector/` on the collector host. `publish.py --publish` performs GET-only source collection then writes ONLY dedicated reporting tables. A separate root cron entry runs every15minutes. Existing n8n workflows and cron entries are untouched. Credentials remain in existing protected environment files, never in git. Production coverage begins `2026-09-11T20:53:10Z` (September11 at1:53PM Arizona).

Initial live validation exercised a complete empty window. Positive cohort, exclusion, chronology and pagination paths have synthetic regression tests; an actual new qualifying lead has not yet traversed all stages. Source scans are bounded, not a transactional upstream snapshot. Full forward replay retries missing attribution but will eventually need partitioned checkpointing as volume grows; request budget failure preserves the last completed publication and dashboard staleness gate.

## Verification / operations

- `node --experimental-strip-types --test src/services/ihh-contact-cohort.test.mts`
- `node scripts/check-ihh-contact-cohort-panel.mjs`
- `node scripts/check-ihh-cohort-source.cjs`
- `python3 -m unittest discover -s scripts/ihh-forward-collector -p 'test_*.py'`
- `node node_modules/typescript/bin/tsc --noEmit`
- `next build --webpack` (worktree symlink requires webpack locally; production normal dependency install is not symlinked).

Publisher failure exits nonzero; cron logs are on collector host. Stop only the marked `IHH_META_PAID_FORWARD_REPORTING` cron entry to pause. UI rollback reverts only IHH integration, preserving existing media reporting. Do not drop tables or modify upstream records as rollback.
