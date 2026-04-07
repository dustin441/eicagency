# Agent Rules

## Next.js Version Warning

This project runs **Next.js 16.2.2** — not the version in your training data. Breaking changes include:

- `middleware.ts` is deprecated — use `proxy.ts` with `export function proxy(request)` instead
- `searchParams` and `params` in Server Components are **Promises** — always `await` them
- Turbopack is now the default bundler for `next dev` and `next build`
- `fetch` is not cached by default — use `use cache` directive or `unstable_cache` explicitly
- Read `node_modules/next/dist/docs/` before writing any routing or data-fetching code

## Project-Specific Rules

- **Never use the anon Supabase client for analytics data.** Tables like `google_campaigns`, `meta_campaigns`, `linkedin_campaign_data` have RLS enabled with no public policies. Always use `createServerSupabaseClient()` from `src/lib/supabase-server.ts` (service role key) for data queries. Use `utils/supabase/server.ts` only for auth session checks.
- **All analytics data goes through `src/services/analytics.ts`.** Do not add Supabase queries directly in components or pages — add a function to the service layer.
- **`dashboard/page.tsx` is a Server Component.** Do not add `'use client'` to it. Interactive UI belongs in `DashboardClient.tsx` or other client components.
- **Period filtering uses URL searchParams, not React state.** The `PeriodSelector` component navigates to `?period=day|week|month|year`. The server page reads this param and passes it to `fetchDashboardData()`.
- **Table names with spaces** (`"Google MQL"`, `"Meta MQL"`, etc.) must be queried with `.from('Google MQL')`. Supabase JS client handles the quoting.
- **MQL/SQL/WON tables have TEXT date columns** — cannot do period-filtered queries on them. Use the `enrollment` table (proper timestamps) for period-specific funnel counts.
- **Do not enable dark mode** in the dashboard — the design is intentionally light-surface. `globals.css` forces white background in both color schemes.
- **Brand tokens:** `bg-brand-forest` = `#0B4A31`, `bg-brand-orange` = `#EB541E`, `bg-brand-dark` = `#0f172a`. Defined in `globals.css` @theme block.
