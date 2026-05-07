# Agent Rules

## Next.js Version Warning

This project runs **Next.js 16.2.2** — not the version in your training data. Key breaking changes:

- `middleware.ts` is deprecated — use `proxy.ts` with `export function proxy(request)` instead
- `searchParams` and `params` in Server Components are **Promises** — always `await` them
- Turbopack is now the default bundler
- `fetch` is not cached by default — use `use cache` directive or `unstable_cache` explicitly

## Data Layer Rules

- **Never use the anon Supabase client for analytics data.** Always use `createServerSupabaseClient()` from `src/lib/supabase-server.ts` (service role key). Use `utils/supabase/server.ts` only for auth session checks.
- **All analytics queries belong in `src/services/analytics.ts`.** No Supabase queries in components or pages.
- **`master_marketing_performance` (MMP) is the primary analytics table.** All spend, impressions, clicks, leads, MQL, SQL, and Won metrics must come from MMP. It has `focus`, `platform`, and `date` columns for proper filtering. Do not use `google_campaigns` or `meta_campaigns` for top-level metrics.
- **LinkedIn is not in MMP.** `linkedin_campaign_data` is queried separately and only when `channel = 'all'`. LinkedIn has no funnel data (MQL/SQL/Won = 0).
- **`enrollment` / `enrollment_won` are used for time-between-stage calculations only.** Do not use them for MQL/SQL/Won counts — use MMP instead. These tables have no `focus` column.
- **MQL/WON/SQL attribution tables (`"Google MQL"`, `"Meta MQL"`, etc.) have TEXT date columns** — cannot be period-filtered. Never use them for any metric that requires a date range.

## Access Control Rules

- **Every client-specific page must call `await requireClientAccess('clientId')` before fetching data.** Import from `src/lib/auth-guard.ts`. This is the server-side guard — it redirects `client`-role users away from pages they're not authorized to see. `super_admin` and `agency` roles bypass all restrictions. The `clientId` values are: `'prepass'` (EIC dashboard), `'spartaco'`, `'nsi'`.
- **The dashboard layout (`layout.tsx`) also enforces access client-side**, but it is async/non-awaitable — the server-side guard is the authoritative control. Both must exist.
- **`profiles` table in EIC Supabase** (`hdaftbqteexugqakgdbx`) has `role` (`super_admin | agency | client`) and `client_access` (`text[] | null`) columns. Client users only see clients listed in their `client_access` array. RLS is enabled with `auth.uid() = id` policy.

## Filtering Rules

- **All filtering is URL-state.** FilterParams (`start`, `end`, `comp_start`, `comp_end`, `channel`, `focus`) live in URL search params. Server Components `await searchParams`, call `paramsFromSearch()`, and pass FilterParams to fetch functions.
- **Focus pages hard-code their focus at the server level.** `/dashboard/smb` always passes `focus: 'SMB'` to `fetchFocusData`. The FilterBar on these pages does not expose a focus selector.
- **Budget pacing always queries the current calendar month**, regardless of the user's selected date range. Do not apply the date filter to budget pacing queries.
- **`dashboard/page.tsx` (and smb/abm/fd360 page.tsx files) are Server Components.** Do not add `'use client'` to them. Interactive UI belongs in `DashboardClient.tsx`, `FocusDashboardClient.tsx`, or other client components.
- **Tiiger brand filter in `spartaco_master_products` requires an `.or()` clause.** Tiiger's ad spend is stored as `brand='Huskie'` / `product='Other'` in the DB and only remapped to Tiiger by `remapOtherRow()` in the service layer. A simple `.eq('brand', 'Tiiger')` returns only ~22 direct rows and near-zero totals. Always use `.or('brand.eq.Tiiger,and(brand.eq.Huskie,product.eq.Other)')` when `brandArg === 'Tiiger'`. See `applyProductFilters()` in `spartaco-product-analytics.ts`.
- **Filter option arrays must always include the currently-selected value**, even when the query returns zero rows. If they don't, the dropdown renders as "All" visually but React still holds the old value, creating a frozen select the user can't escape without a page refresh. Add the safety net: `if (brandArg && !allBrands.includes(brandArg)) { allBrands.push(brandArg); allBrands.sort(); }`

## UI Rules

- **Do not enable dark mode.** The dashboard is intentionally light-surface. `globals.css` forces white background.
- **Brand tokens:** `bg-brand-forest` = `#0B4A31`, `bg-brand-orange` = `#EB541E`, `bg-brand-dark` = `#0f172a`. Defined in `globals.css` @theme block.
- **Cost Per Won is the "North Star" KPI.** It gets a green highlight treatment and a "North Star" badge wherever it appears.
- **Closed Won is the "North Star" funnel stage.** Same green highlight + badge treatment in the funnel.
- **For cost metrics (CPC, CPL, Cost/MQL, Cost/Won), lower = better.** Invert the trend direction: `trendDir(prevValue, currValue)` instead of `trendDir(currValue, prevValue)`.

## Ad Creative Rules

- **`AdPreviews.tsx` is `'use client'`** — it handles all Meta and Google ad creative display. Pass `MetaCreative[]` and `GoogleCreative[]` from server data; never fetch inside this component.
- **`MetaCreative.finalCreativeLink` may be a compressed CDN thumbnail** — images can appear blurry. This is a source quality issue, not a CSS issue. Do not attempt to fix blurriness with `image-rendering` or upscaling CSS.
- **`MetaCreative.videoUrl` drives inline playback** — when populated (MP4 from Meta's `/{video_id}?fields=source`), the video modal renders a `<video>` element. When null, it falls back to a thumbnail lightbox + "Watch on Facebook" link. Never use Facebook iframe embeds for ad content — they are access-restricted and return "Video Unavailable".
- **CTA button labels come from `cta_type`** — the `ctaLabel()` helper in `AdPreviews.tsx` maps Meta API enums (e.g. `LEARN_MORE`, `SIGN_UP`) to human-readable text. Never hardcode "Learn More" as the default without checking `cta_type`.
- **Gradient fallbacks use inline `style={{}}`** — Tailwind JIT strips dynamic gradient classes built at runtime. Always use `style={{ background: 'linear-gradient(...)' }}` with the `AD_GRADIENTS` array of hex values.
- **`adGradient(name)` must handle empty `ad_name` strings** — Meta API can return ads with empty `ad_name`. An empty string produces `NaN` index → `undefined` gradient → crash when the no-image fallback branch renders. The function already guards this with `if (!name) return AD_GRADIENTS[0]`. Do not remove that guard.

## Vercel Deployment Rules

- **Auto-deploy is via GitHub webhook** — `git push origin main` triggers a Vercel build. The Vercel project is at `prj_1VUaTcLVBmAIAyPTeQ4YIG88Qaf1`, team `team_Sxyeod3LY9PSUrI7F0cev2lN`, repo `dustin441/eicagency`.
- **The Vercel MCP tool does not have team scope access.** It cannot list deployments or inspect builds for this project. Do not attempt to use it to check deployment status.
- **Vercel CLI is not installed.** For a manual deploy, instruct the user to run `! npx vercel --prod` in the terminal.
- **If a push to `main` doesn't trigger a Vercel build**, the GitHub → Vercel webhook has silently disconnected. Symptoms: git push succeeds but no new deployment appears in the Vercel dashboard.
  - **Diagnose:** GitHub → repo Settings → Webhooks → check for a Vercel entry with recent delivery failures (red ✗).
  - **Fix:** Vercel project → Settings → Git → Disconnect → reconnect the GitHub repo. This re-registers the webhook.
  - **Test:** Push an empty commit — `git commit --allow-empty -m "Trigger Vercel deploy after webhook reconnect" && git push origin main` — and confirm a build appears in Vercel within 30 seconds.
- **This has happened before.** The webhook disconnect is not caused by anything in the codebase — it's a Vercel/GitHub OAuth re-auth issue. Reconnecting via Vercel project settings is the permanent fix each time.

## n8n Workflow Rules

### Per-Client Meta Ads Workflow Registry

| Client | Workflow ID | Ad Account | Supabase Table | Start Date | Conversion Field |
|--------|-------------|------------|----------------|------------|-----------------|
| PrePass | `hq4AP24YUl9oRyam` | — | `meta_ads_creatives` | 2024-01-01 | `leads` |
| Duro Dyne | `rkS7LKHws2Z1RZTV` | `act_769908655487086` | `durodyne_meta_ads` | 2025-01-01 | `leads` |
| LifeRep | `lQLM6qfuEroG7bYu` | `act_233133238990306` | `liferep_meta_ads` | 2026-01-01 | `purchases` + `revenue` |
| Bloom | `U9IeCU0HIdYQunST` | `act_1311375376575941` | `bloom_meta_ads` | 2026-05-01 | `leads` |

All three run daily at 4 AM and use the 14-node creative enrichment pattern. See `docs/meta-ads-workflow-template.md` for the reusable SDK template.

### Adding a New Meta Client Workflow (Checklist)

Follow these steps every time a new client needs a Meta Ads → Supabase creative pipeline:

1. **Create the Supabase table** in `lozgnyxixzfxokllevtb` — run the standard DDL from `docs/meta-ads-workflow-template.md`. Table name pattern: `{client}_meta_ads`. Add matching columns for any client-specific conversion metric (e.g. `purchases`, `revenue`, `leads`).
2. **Copy the SDK template** from `docs/meta-ads-workflow-template.md`. Update the 4 client-specific variables at the top: `ACCOUNT_ID`, `START_DATE`, `TABLE_NAME`, `conversion action types`.
3. **Validate and create** via `mcp__claude_ai_n8n__validate_workflow` → `mcp__claude_ai_n8n__create_workflow_from_code`.
4. **Reconnect all 5 credentials manually** in the n8n UI (SDK never auto-assigns these):
   - `Pull Data` → Meta bearer token
   - `Pull Data1` → Meta bearer token
   - `Fetch Image URLs` → Meta bearer token
   - `Fetch Video Sources` → Meta bearer token
   - `Insert or update` → Postgres credential for `lozgnyxixzfxokllevtb` (not the EIC project)
5. **Publish** via `mcp__claude_ai_n8n__publish_workflow`.
6. **Run a manual test execution** and check Supabase row count to verify end-to-end.

### Critical Rules (Learned from Debugging)

- **After every n8n SDK workflow update**, ALL HTTP Request node credentials are disconnected. Always reconnect all 5 nodes above (4 × Meta bearer token + 1 × Postgres). Warn the user every time without exception.
- **Postgres node: always use `mode: "name"` for schema and table**, not `mode: "list"`. The `list` mode enumerates available tables via the credential — if the wrong credential is assigned it fails with `relation "public.{table}" does not exist` before the SQL even runs. `mode: "name"` skips enumeration and uses the literal string, so the credential only needs to be valid to execute.
- **The Postgres credential must point to `lozgnyxixzfxokllevtb`** (Spartaco/NSI/LifeRep project), not `hdaftbqteexugqakgdbx` (EIC auth project). The credential name in n8n is typically "Postgres account 3". Assigning the wrong credential causes `relation does not exist` even when `mode: "name"` is set.
- **Meta API field `spend` → Supabase column `cost`.** The Meta Insights API returns spend as `spend`; all Supabase `{client}_meta_ads` tables store it as `cost`. Always rename in the `Code in JavaScript` node: `cost: parseFloat(r.spend || 0)`. Forgetting this causes `Column 'spend' does not exist` at upsert.
- **`autoMapInputData` on the Postgres upsert node** auto-maps all Code node output fields to matching column names. Adding a new field to the Code node output + a matching Supabase column is sufficient — no manual field mapping needed.
- **Instagram Reels / portrait video ads do not expose `source` MP4 URLs** via the Graph API (`/{video_id}?fields=source`). The response returns `id`, `picture`, and `thumbnails` but no `source` field. `video_url` will be null for these ads. The dashboard correctly falls back to the preferred thumbnail + "Watch on Facebook" link. This is a Meta API permission restriction, not a workflow bug.
- **Fetch Video Sources uses `neverError: true`** — API errors are silently swallowed. A missing `source` field in the response is indistinguishable from a credential error. Always verify by checking `video_url` counts in Supabase after a test run.

## Supabase Infrastructure Rules

These apply to every Supabase project (EIC: `hdaftbqteexugqakgdbx`, Spartaco/NSI/Turfli: `lozgnyxixzfxokllevtb`).

- **`authenticator` statement timeout must be 60s.** The Supabase default is 8s, which kills any non-trivial query. Every new project needs: `ALTER ROLE authenticator SET statement_timeout = '60s';`
- **`master_marketing_performance` is a MATERIALIZED VIEW, not a regular view.** It was converted because the underlying `_mmp_source` view is a FULL OUTER JOIN across 8+ CTEs with regex normalization — too slow to evaluate live. The materialized version has indexes on `(date)`, `(focus)`, `(platform)`, `(date, focus)`, `(date, platform)`.
- **MMP data is refreshed daily at 6 AM UTC via pg_cron** (job name: `refresh-mmp-daily`). After any manual data load into the underlying tables, run `REFRESH MATERIALIZED VIEW master_marketing_performance;` in the Supabase SQL editor to see updated data immediately.
- **`_mmp_source` is the live computation view** — the original complex view, renamed. Do not query it directly in application code; it will timeout. It exists only as the source for `REFRESH MATERIALIZED VIEW`.
- **Materialize any view that uses FULL OUTER JOINs or joins 5+ tables.** UNION ALL views (like `turfli_master`, `goodgame_master`, `master_spartaco`) are fast enough as regular views. The threshold is cross-join work, not row count.
- **When adding a new Supabase project**, run these two migrations immediately:
  1. `ALTER ROLE authenticator SET statement_timeout = '60s';`
  2. Enable `pg_cron` and schedule a nightly refresh if any master view uses JOINs.

## TypeScript / Supabase Rules

- **Double-cast Supabase array responses** to avoid `GenericStringError[]` conflicts:
  ```typescript
  const rows = (data ?? []) as unknown as MyRowType[];
  ```
  A single `as MyRowType[]` will fail type-checking when the inferred type includes `GenericStringError[]`.
- **Table names with spaces** (`"Google MQL"`, etc.) use `.from('Google MQL')` — the Supabase JS client handles quoting.
- **Supabase caps all `.select()` responses at 1,000 rows — no error, data silently truncates.** For ad-level tables (`goodgame_meta_ads`, `meta_ads_creatives`, `spartaco_master_products`, `ad_change_history`) that can easily exceed this: (a) for aggregations/rollups, use an RPC that `GROUP BY`s server-side (see `goodgame_video_timeseries`, `goodgame_focus_rollup`, `goodgame_creative_rollup`); (b) for raw row fetches, use the `fetchPagedProductRows` pagination loop. The symptom is a metric showing 0 or suspiciously low totals in one widget while a parallel RPC-backed widget shows the correct number for the same period.
