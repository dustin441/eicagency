# IHH Meta-paid historical-baseline + forward funnel

Scope: original acknowledged quiz-lead records with existing immutable opportunity snapshots explicitly identifying Facebook/Instagram + paid_social. Retains native schema versions; does not recompute attribution. Organic/direct/unknown/ambiguous records are excluded. This is a verified source subset, not a complete native quiz census or Meta platform-attributed conversions.

The usable baseline is the immutable, hash-pinned local-secure audit: **202** verified Meta-paid contacts from the original **624** Aug 12–Sep 10 cohort (**200 v2, 2 v3**). Appointment enrichment adds only the **13** separately audited timestamps to copied output rows, producing **67** scheduled flags, **59** timestamped appointments, and **8** unresolved timestamps. Neither secure source file is edited or committed. Forward collection remains bounded from `2026-09-11T20:53:10Z`; the gap from `2026-09-11T00:00:00Z` to that instant is explicitly recorded in each manifest and is never inferred.

## Dashboard

All four chronological unique-contact stages: Quiz lead → Appointment scheduled → Closer scheduled → Closed won. Complete-period percentages use the preceding nested stage. Each connector also shows the median elapsed time from the preceding verified stage and the matched-contact sample size. Where historical coverage is partial, the UI displays one consolidated notice that complete funnel-stage collection began September 11, 2026; verified observed-minimum labels remain on affected stage values and rates rather than claiming complete conversion. Zero denominators are unavailable rather than fabricated percentages. Appointment Scheduled remains the optimization KPI.

The existing media panels and their default date range remain unchanged. With no explicit date selection, this additional funnel defaults to the full verified collection window. Explicit selected dates clip to available coverage. The panel states its exact cohort window and observation cutoff. Older-than-six-hour source batches show stale rather than current metrics. Internal identifiers/evidence are removed before client serialization. Source failure affects only this panel.

## Collection / database

Dedicated public tables: `ihh_meta_paid_original_cohort` and `ihh_meta_paid_cohort_manifests`. Both have RLS; anon/authenticated receive no access, dashboard service_role SELECT only. Privileged publisher inserts a new immutable hashed batch and its completed manifest in one transaction; no runtime UPDATE/DELETE permissions. Latest completed publication is read once, then every page is pinned to that hash and exact count. Native snapshot versions remain unchanged. Each collector run replaces embedded baseline and forward lifecycle payloads from one complete current non-QA `ihh_lifecycle_events` scan through the observation cutoff. Publication coverage JSON records baseline, explicit gap, forward counts, and lifecycle-refresh counts. Closer/won coverage remains partial because tracking began Aug 28; observed counts are minimums, not claims of complete history.

Deployment artifacts are under `/opt/data/qa/ihh-funnel-20260911/forward-collector/` on the collector host. `publish.py --publish` performs GET-only source collection then writes ONLY dedicated reporting tables. A separate root cron entry runs every15minutes. Existing n8n workflows and cron entries are untouched. Credentials remain in existing protected environment files, never in git. The baseline remains under the existing local-secure QA directory; only its paths and SHA-256 digests are in code. `publish.py --skip-collect --secure-root <isolated-secure-dir>` validates a batch without database writes.

Source scans are bounded, not a transactional upstream snapshot. Full forward replay retries missing attribution but will eventually need partitioned checkpointing as volume grows; request-budget or baseline-integrity failure preserves the last completed publication and dashboard staleness gate. The collector fails closed on altered baseline/enrichment hashes, count drift, non-Meta attribution, unexpected baseline schema versions, identity mismatch, overlap, or incomplete ledger pagination.

## Verification / operations

- `node --experimental-strip-types --test src/services/ihh-contact-cohort.test.mts`
- `node scripts/check-ihh-contact-cohort-panel.mjs`
- `node scripts/check-ihh-cohort-source.cjs`
- `python3 -m unittest discover -s scripts/ihh-forward-collector -p 'test_*.py'`
- `node node_modules/typescript/bin/tsc --noEmit`
- `next build --webpack` (worktree symlink requires webpack locally; production normal dependency install is not symlinked).

Publisher failure exits nonzero; cron logs are on collector host. Stop only the marked `IHH_META_PAID_FORWARD_REPORTING` cron entry to pause. UI rollback reverts only IHH integration, preserving existing media reporting. Do not drop tables or modify upstream records as rollback.
