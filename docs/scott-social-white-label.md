# Scott Social white-label deployment

One codebase (`dustin441/eicagency`), one Vercel project per agency tenant.
Tenant config and the security rules live in `src/lib/tenant.ts` (tests: `npm run test:tenant`).

## How isolation works

| Layer | What it enforces |
|---|---|
| `NEXT_PUBLIC_TENANT_ID` (Vercel project env) | Which tenant the deployment is. Unset = `eic` (EIC deployments unchanged). Unknown value = every request refused. |
| `src/proxy.ts` | Host owned by another tenant → 421 (fail closed). Partner tenants serve only `/login`, `/forgot-password`, `/reset-password`, `/auth/*` and `/dashboard/<own client>/**`; everything else (EIC marketing, agency tools, PDFs, chat APIs, other clients) → 404. |
| `requireClientAccess` / `requireAgencyIdentity` | Server-side tenant cap checked before any role bypass. Agency tools never render on a partner tenant. |
| Dashboard shell | Client switcher = tenant portfolio ∩ the user's profile. Chat, Settings and Creative Studio are EIC-only. Team page only for team admins on partner tenants. |
| Chat APIs / budget actions | `denyClientApiAccess` / `checkClientAccess` check the user's client access on every call (also on EIC). |
| Supabase | The Scott deployment uses **only** project `lozgnyxixzfxokllevtb` for data **and** login (`profiles` in `supabase/scott_social_profiles.sql`). Nothing from `hdaftbqteexugqakgdbx`. |

Scott Social portfolio: `aurit`, `arabella`, `kinsey`, `bloom`, `champagne`.

## Roles (profiles in `lozgnyxixzfxokllevtb`)

| Role | Sees | Team page |
|---|---|---|
| `agency` / `super_admin` | All Scott clients | Yes (EIC staff; rows managed by EIC, read-only on the Team page) |
| `partner_admin` | All Scott clients | Yes: add users, change role/clients, remove users |
| `client` | Only `client_access` (Scott clients only) | No |

`partner_admin` only grants anything on a partner tenant; on the EIC deployment it is treated like `client`.
Team admins can assign only `partner_admin` / `client`, only Scott clients, and cannot change their own access.

## Team page (`/dashboard/team`)

- **Add user:** sends a Supabase invite email ("You're invited to Scott Social Analytics") + creates the profile.
  The link goes to `/auth/callback?token_hash=…&type=invite` → `/reset-password`, where the person picks a password.
  An email that already has a login in this auth project just gets access (no email).
- **Email setup (done 2026-10-30, `lozgnyxixzfxokllevtb` → Auth):** invite + recovery templates link to
  `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=…`; links valid 24h; Site URL
  `https://analytics.scottsocialmarketing.com`; redirect allow-list = that domain, `scottsocial-*-dustin-2299s-projects.vercel.app`
  and `localhost:3000`.
- **Limits until custom SMTP:** sent from Supabase's default sender, about 2 emails per hour for the whole project.
  For a Scott sender (e.g. `no-reply@scottsocialmarketing.com`) set up SMTP (Resend/SendGrid) + DNS records at go-live.
- **Edit:** role and clients. **Remove:** deletes the profile and the login.
- Only users with a row in `profiles` are listed.

## Exports

No Scott client has PDF/XLSX exports today. XLSX workbook metadata (creator/company) comes from the tenant
config, so any export added later is branded per deployment. PDF routes (`/api/dashboard/*/pdf`) are EIC
clients only and blocked on partner tenants.

## Checklist: new client for Scott

1. Data: tables in `lozgnyxixzfxokllevtb` + n8n workflows (see `AGENTS.md` checklist).
2. Dashboard pages under `/dashboard/<client>` with `requireClientAccess('<client>')`, registered in
   `auth-guard.ts` (`CLIENT_DEFAULTS`) and `dashboard/layout.tsx` (`CLIENTS`).
3. Add the id to `SCOTT_SOCIAL_CLIENTS` in `src/lib/tenant.ts` and its label in `src/app/dashboard/team/page.tsx`;
   extend `tenant.test.mts`.
4. Grant access on the Team page.

## Security notes

- Tenant is a build-time project env, never a request value; host mismatch → 421; unknown tenant → nothing served.
- Partner tenants serve only auth pages, `/dashboard/team` and their own client dashboards (everything else 404).
- Tenant cap is checked before any role bypass, server-side, on pages, APIs and actions.
- Team actions re-check the caller on every call and never touch `agency` / `super_admin` rows.
- Data still lives in the shared `lozgnyxixzfxokllevtb` project and is read with the service role; isolation is
  enforced in the app, not by RLS.

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

1. Custom SMTP for Scott-branded emails (see Team page section); Supabase URL config is already set.
2. Scott users: a first `partner_admin` for Scott (e.g. Mike), who then adds the rest on the Team page.
   Existing Scott logins live in the EIC/PrePass project and do not carry over.
3. Brand assets in `public/tenants/scott-social/` come from the Scott Social brand kit (Icon + Patterns
   folders, Brand Deck): `mark.png` (Solid Gradient Light icon), `favicon.png` / `icon-512.png` (Primary
   icon), `login-bg.jpg` (Gradient Dark 01). The kit has no full "Scott Social" lockup file, so the UI shows
   icon + tracked-caps text; if Scott sends one, set `logo.dark` in `src/lib/tenant.ts`. Haboro Contrast
   (heading font) has no verified web license, so headings use Source Sans 3.
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
