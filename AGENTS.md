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

## Filtering Rules

- **All filtering is URL-state.** FilterParams (`start`, `end`, `comp_start`, `comp_end`, `channel`, `focus`) live in URL search params. Server Components `await searchParams`, call `paramsFromSearch()`, and pass FilterParams to fetch functions.
- **Focus pages hard-code their focus at the server level.** `/dashboard/smb` always passes `focus: 'SMB'` to `fetchFocusData`. The FilterBar on these pages does not expose a focus selector.
- **Budget pacing always queries the current calendar month**, regardless of the user's selected date range. Do not apply the date filter to budget pacing queries.
- **`dashboard/page.tsx` (and smb/abm/fd360 page.tsx files) are Server Components.** Do not add `'use client'` to them. Interactive UI belongs in `DashboardClient.tsx`, `FocusDashboardClient.tsx`, or other client components.

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

## n8n Workflow Rules

- **Workflow ID `hq4AP24YUl9oRyam`** is the Meta Ads Puller. It runs daily at 4 AM, pulls Jan 1 → today, and upserts `meta_ads_creatives` in Supabase.
- **After every n8n SDK workflow update**, HTTP Request node credentials are disconnected. The user must manually reconnect the Meta API bearer token on: `Pull Data`, `Pull Data1`, `Fetch Video Sources`. Always warn the user after any workflow update.
- **`autoMapInputData` on the Postgres upsert node** auto-maps all Code node output fields to matching column names. Adding a new field to the Code node output + a matching column in Supabase is sufficient — no manual field mapping needed.

## TypeScript / Supabase Rules

- **Double-cast Supabase array responses** to avoid `GenericStringError[]` conflicts:
  ```typescript
  const rows = (data ?? []) as unknown as MyRowType[];
  ```
  A single `as MyRowType[]` will fail type-checking when the inferred type includes `GenericStringError[]`.
- **Table names with spaces** (`"Google MQL"`, etc.) use `.from('Google MQL')` — the Supabase JS client handles quoting.
