# Scott Social white-label deployment

One codebase (`dustin441/eicagency`), one Vercel project per agency tenant.
Tenant config and the security rules live in `src/lib/tenant.ts` (tests: `npm run test:tenant`).

## How isolation works

| Layer | What it enforces |
|---|---|
| `NEXT_PUBLIC_TENANT_ID` (Vercel project env) | Which tenant the deployment is. Unset = `eic` (EIC deployments unchanged). Unknown value = every request refused. |
| `src/proxy.ts` | Host owned by another tenant → 421 (fail closed). Partner tenants serve only `/login`, `/forgot-password`, `/reset-password`, `/auth/*` and `/dashboard/<own client>/**`; everything else (EIC marketing, agency tools, PDFs, chat APIs, other clients) → 404. |
| `requireClientAccess` / `requireAgencyIdentity` | Server-side tenant cap checked before any role bypass. Agency tools never render on a partner tenant. |
| Dashboard shell | Client switcher = tenant portfolio ∩ the user's profile. Chat, Settings and Creative Studio are EIC-only. |
| Supabase | The Scott deployment uses **only** project `lozgnyxixzfxokllevtb` for data **and** login (`profiles` in `supabase/scott_social_profiles.sql`). Nothing from `hdaftbqteexugqakgdbx`. |

Scott Social portfolio: `aurit`, `arabella`, `kinsey`, `bloom`, `champagne`.

## Vercel project `scottsocial` (Dustin's account)

- Git: `dustin441/eicagency`, framework Next.js, Node 24.x.
- Ignored Build Step (only Scott branches build):
  `if [[ "$VERCEL_GIT_COMMIT_REF" == feat/scott-* ]]; then exit 1; else exit 0; fi`
- Environment variables (Preview for now; Production at go-live):

| Key | Type | Value |
|---|---|---|
| `NEXT_PUBLIC_TENANT_ID` | Config | `scott-social` |
| `NEXT_PUBLIC_SUPABASE_URL` | Config | `https://lozgnyxixzfxokllevtb.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Config | anon key of `lozgnyxixzfxokllevtb` |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | service role of `lozgnyxixzfxokllevtb` |
| `SPARTACO_SUPABASE_URL` | Config | `https://lozgnyxixzfxokllevtb.supabase.co` |
| `SPARTACO_SUPABASE_SERVICE_ROLE_KEY` | Secret | service role of `lozgnyxixzfxokllevtb` |

Never copy EIC-only variables (Mixpanel, GSC, Instantly, Creative Studio, n8n bridge tokens).

## Pending (needs Dustin's approval)

1. Supabase `lozgnyxixzfxokllevtb` → Authentication → URL Configuration: add the preview URL and later
   `https://analytics.scottsocialmarketing.com` (Site URL + redirect `…/auth/callback`).
2. Create Scott users in `lozgnyxixzfxokllevtb` Auth + a `profiles` row each
   (`agency` = all Scott clients; `client` + `client_access` = one client). Existing Scott logins live in the
   EIC/PrePass project and do not carry over.
3. Official Scott logo files (Drive folder not accessible yet): put them in `public/tenants/scott-social/`
   and set `logo` / `favicon` in `src/lib/tenant.ts`. Until then a text wordmark is shown.
4. Domain: add `analytics.scottsocialmarketing.com` to the `scottsocial` project and a CNAME
   `analytics → cname.vercel-dns.com` at Scott's DNS provider.

## Rollback

Scott is a separate Vercel project: remove its domain or pause the project; EIC is unaffected.
In code, all tenant behaviour is gated by `NEXT_PUBLIC_TENANT_ID`; with it unset the app is plain EIC.

## Adding another agency

1. Add an entry to `TENANTS` in `src/lib/tenant.ts` (id, hostnames, `allowedClients`, colors, copy) and a
   `[data-tenant="<id>"]` block in `src/app/globals.css`.
2. Extend the tests in `src/lib/tenant.test.mts`.
3. New Vercel project from the same repo with `NEXT_PUBLIC_TENANT_ID=<id>` and the env table above.
