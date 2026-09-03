# Client Health Normalization and Editable Settings Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Normalize every launched Client Health account behind reviewed daily data contracts, correct budget pacing, and let agency account managers edit governed monthly budget, economics, and North Star settings through the existing immutable revision workflow.

**Architecture:** Keep the active signed Client Health revision as the single governed business-settings source. Add service-role-only normalized daily views for heterogeneous source tables and static adapter allowlist entries for those views. Extend the existing settings action/UI to revise monthly budget and North Star lane business fields without exposing relation names, credentials, or arbitrary formulas. Client-specific dashboards can consume a shared active-revision reader incrementally instead of creating a second mutable settings store.

**Tech Stack:** Next.js 16, React 19, TypeScript, Node test runner, Supabase/PostgreSQL, immutable signed config revisions, ClickUp adapters.

---

## Approved business rules

- Reporting timezone: `America/Phoenix`; snapshots include only the last complete day.
- September 2026 retainers come from spreadsheet `1w1XOdxRViV5VOx7Ek0e2LGOaK12Gu652gq2WmYAMx9s`, tab `September '26'` (`gid=1628605919`).
- Duro Dyne maps to the sheet row `NSI HVAC`, retainer `$1,500`.
- Bridgeway retainer remains `$500`.
- PrePass Client Health budget is total paid-media budget `$150,000`.
- NSI Client Health budget is `$29,500`.
- Good Game is eCommerce-only using the existing shared campaign classifier; retail/foot-traffic spend is excluded.
- Aurit and Medibrane remain `configuration_required` until launch.
- Spartaco remains multi-lane and campaign/product-specific; do not invent one blended budget.
- Technical source mappings remain code-reviewed and are never editable form inputs.

## Task 1: Correct budget pacing semantics

**Objective:** Score budget pacing as variance from expected spend to date, not variance as a percentage of the full monthly budget.

**Files:**
- Modify: `src/services/client-health/engine.ts`
- Modify: `src/services/client-health/engine.test.mts`

**Steps:**
1. Add a failing CBA-style test: budget `2000`, spend `176.89`, elapsed `2/30`; expected spend `133.333…`, pace variance `32.6675%`.
2. Verify the test fails against the current `2.1778%` behavior.
3. Change the denominator to `expectedSpend`; preserve exact decimal arithmetic, null semantics, and the zero-budget at-risk branch.
4. Add edge tests for day one, zero budget, zero spend, and exact on-pace spend.
5. Run `node --conditions=react-server --no-warnings --experimental-strip-types --test src/services/client-health/engine.test.mts`.

## Task 2: Add governed portfolio settings revision logic

**Objective:** Update economics, monthly budget, and North Star business settings together while preserving immutable revision hashes and optimistic activation concurrency.

**Files:**
- Create: `src/services/client-health/portfolio-settings.ts`
- Create: `src/services/client-health/portfolio-settings.test.mts`
- Modify: `src/app/dashboard/eicagency/client-health/settings/actions.ts`
- Modify: `src/services/client-health/config-revision.ts` only if a validator change is required
- Modify: `package.json`

**Steps:**
1. Define a bounded input contract containing `clientId`, `effectiveMonth`, retainer, delivery model, target margin, nullable monthly budget, and one-to-four lane edits.
2. Accept only the existing supported formula/evaluation pairs. Preserve lane `sourceKeys` from the reviewed active revision so the browser cannot choose data sources.
3. Reject edits for `configuration_required` clients that do not yet have reviewed lanes/sources; economics remain editable under the existing behavior.
4. Build a new full revision with `buildApprovedConfigRevision`.
5. Reuse the existing signed HMAC request, nonce, expected activation ID, and read-back verification. Do not add a second write API or mutable settings table.
6. Add tests for unknown clients, malformed numbers, unsupported lane pairs, source-key tampering, stale activation behavior, and deterministic revision identity.

## Task 3: Extend the agency settings UI

**Objective:** Let account managers edit business settings while clearly displaying source readiness and keeping technical bindings read-only.

**Files:**
- Replace or extend: `src/app/dashboard/eicagency/client-health/settings/ClientEconomicsSettingsForm.tsx`
- Modify: `src/app/dashboard/eicagency/client-health/settings/page.tsx`
- Modify: `src/app/dashboard/eicagency/client-health/settings/actions.ts`

**Steps:**
1. Rename the page and form to Client Health settings/portfolio settings.
2. Add monthly budget and North Star fields with current values populated from the active revision.
3. Limit North Star UI to label, formula, evaluation, required flag, weight, direction-compatible thresholds, and target/trend semantics.
4. Display source readiness, data relation labels, ClickUp list IDs, and activation status as read-only metadata.
5. Retain mandatory change reason, effective month, optimistic activation ID, signed mutation, and success/error feedback.
6. Revalidate Client Health and affected client-specific routes after a successful mutation.
7. Verify keyboard labels, number inputs, disabled states, and responsive rendering.

## Task 4: Add normalized EIC daily source views

**Objective:** Expose one deterministic `row_key`, `date`, `spend`, `results` relation per reviewed North Star lane.

**Files:**
- Create: `supabase/client_health_normalized_source_views.sql`
- Create: `supabase/client_health_normalized_source_views_verify.sql`
- Create: `supabase/client_health_normalized_source_views_rollback.sql`
- Create: `scripts/check-client-health-normalized-source-sql.mjs`
- Modify: `package.json`

**Planned EIC views:**
- `client_health_bloom_daily`: `bloom_meta_ads.cost / website_chats`
- `client_health_nsi_daily`: `nsi_master_campaign_daily.cost / conversions` from the reliable 2026 submittal period
- `client_health_durodyne_daily`: `durodyne_master.cost / conversions`
- `client_health_kinsey_daily`: `kinsey_master.cost / revenue`
- `client_health_arabella_daily`: `arabella_master.cost / revenue`
- `client_health_champagne_daily`: daily union of `champagne_google` and `champagne_meta`, `cost / conversions`
- `client_health_goodgame_ecommerce_daily`: `goodgame_master.cost / revenue` for the exact shared eCommerce taxonomy and exception set
- Existing Bridgeway, IHH, CBA, and Spartaco lane views remain authoritative.
- State Forty Eight remains Google-only to match its existing dashboard contract.

**Steps:**
1. Add direct-postgres and exact-project preflights.
2. Validate required source ownership, column types, nonnegative finite measures, and non-null dates.
3. Aggregate by date so `row_key = YYYY-MM-DD` is globally unique in each view.
4. Make every view `security_barrier`, postgres-owned, service-role-only, and fully revoked from public/anon/authenticated.
5. Encode Good Game’s campaign classifier and four exact exceptions in SQL, with a static check that compares it to `src/lib/goodgame-campaign-scope.ts`.
6. Add verification SQL for object identity, ACLs, uniqueness, source-to-view total parity, and September 2026 readback.
7. Add rollback that refuses if active config references any view.
8. Do not apply production SQL until Dustin approves the named objects and behavior.

## Task 5: Add normalized PrePass daily source views

**Objective:** Expose total paid spend and separate SQL/Won daily outcome lanes in the PrePass Supabase project without double counting attribution.

**Files:**
- Create: `supabase/prepass_client_health_source_views.sql`
- Create: `supabase/prepass_client_health_source_views_verify.sql`
- Create: `supabase/prepass_client_health_source_views_rollback.sql`

**Steps:**
1. Use `master_marketing_performance` for total paid spend across SMB, ABM, and FD360.
2. Use the existing Marketo/Dynamics-derived SQL and Won fields already reconciled into that relation or a reviewed CRM aggregate relation.
3. Create separate daily ratio relations for Cost per SQL and Cost per Won if one source cannot safely serve both without duplicate scalar spend ownership.
4. Ensure each lane uses the same approved campaign/focus universe as the total `$150,000` budget.
5. Add direct-postgres, project, schema, finite-value, ACL, uniqueness, and parity checks.
6. Do not apply production SQL until Dustin approves the named objects and behavior.

## Task 6: Expand the static production adapter allowlist

**Objective:** Permit only the newly reviewed normalized relations and preserve fail-closed source/evidence identity.

**Files:**
- Modify: `src/services/client-health/adapters/supabase-production.ts`
- Modify: `src/services/client-health/adapters/supabase-production.test.mts`
- Modify: `src/services/client-health/production-refresh-planner.test.mts`

**Steps:**
1. Add one static adapter key per approved client/lane.
2. Set `project: 'prepass'` only for PrePass sources; all others remain `eic`.
3. Use `includeMonthSpend: true` on exactly one non-overlapping source per client. Lane-only sources must set it false.
4. Verify unknown relation names, client/source substitution, cross-project substitution, and arbitrary raw identifiers remain rejected.
5. Verify every source binding fingerprint matches the config generator output.

## Task 7: Generate and verify the September portfolio revision

**Objective:** Activate all launched clients with approved budgets, economics, ClickUp, and North Star sources while keeping pre-launch or product-specific gaps explicit.

**Files:**
- Modify: `scripts/generate-client-health-baseline-v3.mts` or create a v4/revision update generator if required
- Create: `docs/client-health/normalized-september-2026.json`
- Modify: corresponding generator tests/checks

**Rules:**
- Populate retainers from the authoritative September sheet, including Duro Dyne `$1,500`.
- Populate PrePass budget `$150,000` and NSI budget `$29,500`.
- Import verified current budgets for Bridgeway, State Forty Eight, Bloom, CBA, IHH, Kinsey, Duro Dyne, Arabella, Champagne, and Good Game eCommerce.
- Keep Spartaco budget pacing unavailable until a campaign/product-specific aggregate policy is approved.
- Keep Aurit and Medibrane `configuration_required`.
- Add ClickUp sources for every launched client.
- North Stars: NSI CPS, Duro CPL, Kinsey Purchase ROAS, Arabella Purchase ROAS, Champagne CPL, Good Game eCommerce ROAS, plus existing approved client lanes; PrePass uses required Cost per SQL and Cost per Won lanes.

**Steps:**
1. Generate deterministic source fingerprints from static contracts.
2. Run config normalization/hash checks.
3. Materialize a September 2 snapshot plan for every client.
4. Confirm launched clients have exactly five dimensions and no empty required source references.
5. Confirm Aurit/Medibrane remain explicitly unscored and Spartaco has no fabricated blended budget.

## Task 8: Add a shared active reporting-settings reader

**Objective:** Provide a server-only helper that client-specific dashboards can use instead of independently reading mutable budget rows.

**Files:**
- Create: `src/services/client-reporting-settings.ts`
- Create: `src/services/client-reporting-settings.test.mts`
- Initially modify the Good Game eCommerce, NSI, Duro Dyne, and PrePass dashboard budget readers after parity tests

**Steps:**
1. Read and normalize the active signed Client Health revision.
2. Resolve a client by static key and return only bounded business fields, never source credentials or internal auth metadata.
3. Fail closed on missing/malformed revisions.
4. Add parity tests against existing budgets before replacing dashboard reads.
5. Migrate dashboards incrementally, starting with the explicitly approved Good Game, NSI, Duro Dyne, and PrePass rules.

## Task 9: Full review and release gates

**Objective:** Prove the code and migrations are safe before production activation.

**Steps:**
1. Run every Client Health Node test and SQL static check.
2. Run ESLint on changed files and `npm run build`.
3. Inspect `git diff --check`, secret patterns, route auth, and source allowlists.
4. Obtain independent spec-compliance review.
5. Obtain independent code-quality/security review.
6. Present the exact EIC and PrePass schema objects for Dustin’s approval.
7. After approval, apply EIC migration and verification, then PrePass migration and verification.
8. Deploy exact reviewed commit, confirm Vercel READY and production SHA.
9. Activate the signed September revision with expected activation ID.
10. Run a production refresh through September 2, read back the published snapshot, and compare normalized totals to source SQL.
11. QA the protected live settings and Client Health pages, then provide the verified URL and review notes for Mike.
