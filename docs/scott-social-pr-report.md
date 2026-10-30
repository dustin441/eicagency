# PR report: Scott Social white-label dashboard

Branch `feat/scott-social-white-label` (includes `feat/aurit-dashboard`).

## What ships

- **Tenant model** (`src/lib/tenant.ts`): `NEXT_PUBLIC_TENANT_ID` picks the tenant per Vercel project; EIC is the default and unchanged.
- **Isolation**: proxy (421 on host mismatch, 404 outside the Scott allow-list), server guards with the tenant cap before any role bypass, client switcher limited to Scott clients.
- **Branding**: Scott logo mark, colors, favicon, login background, metadata; no EIC strings, GTM or JSON-LD on the Scott deployment.
- **Auth**: Scott deployment uses only Supabase `lozgnyxixzfxokllevtb` (data + login), `profiles` table there.
- **Permissions**: Master Admin / Client Admin / Viewer per dashboard (`client_memberships`, RLS), enforced on pages, APIs and actions.
- **Home** with dashboard cards; Master Settings (all users) from Home; per-dashboard Settings for Client Admins. Invites send a Supabase email.
- **Exports**: XLSX metadata from the tenant config (no Scott client has exports yet).
- **Chat APIs + budget actions**: per-client access check on every call (closes an existing EIC gap: any signed-in user could call any client's chat API or budget action).
- **Aurit** pilot dashboard (Performance + Ad Analysis) and its n8n workflows.

## Checks run

- `npm run test:tenant`: 11/11 pass (tenant resolution, host mismatch, portfolio cap, partner_admin, Team access, route policy).
- `tsc --noEmit` clean; eslint clean on changed files (2 pre-existing `<img>` warnings).
- `next build` with the Scott tenant env: passes.
- Local logged-out checks on the Scott tenant: `/dashboard/team` and `/dashboard/aurit` → login; `/dashboard/settings`, `/api/chat/*`, unknown paths → 404; EIC host → 421.
- Not yet run: logged-in QA on the Scott preview (Master, Client Admin, Viewer).

## Changes outside the repo (need sign-off)

- Vercel project `scottsocial` (Dustin's team), Preview env vars.
- Supabase `lozgnyxixzfxokllevtb`: Aurit tables, `profiles` table (+ `partner_admin` role), `client_memberships` table, profiles for adolfo@ / dustin@eic.agency (`agency`).
- Supabase Auth config of `lozgnyxixzfxokllevtb`: invite/recovery templates, Site URL, redirect allow-list.
- n8n: 5 active Aurit workflows (Meta, Google, Meta Ad Creatives, Creative Vision Insights, Weekly Executive Summary).

## Before go-live

- Custom SMTP + DNS for a Scott sender (default Supabase sender is limited to ~2 emails/hour).
- Domain `analytics.scottsocialmarketing.com` on the `scottsocial` project + CNAME at Scott's DNS.
- First Scott `partner_admin` login (e.g. Mike).
- Production env vars on `scottsocial`.
