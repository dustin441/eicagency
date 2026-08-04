# Good Game Campaign Segment Pages Implementation Plan

> **For Hermes:** Implement this plan task-by-task and verify each behavior with executable checks.

**Goal:** Provide distinct All Data, Foot Traffic, and eCommerce Good Game dashboard views with one consistent campaign taxonomy.

**Architecture:** Add a pure shared campaign classifier, then apply it to the existing All/Foot analytics service and the eCommerce service. Preserve `/dashboard/goodgame` as All Data, add `/dashboard/goodgame/foot-traffic`, and retain `/dashboard/goodgame/sales` as the eCommerce route. Scope master rows, pacing, focus cards, video metrics, and Meta creatives consistently.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase, Node.js assertions.

---

### Task 1: Add and verify shared campaign classification

**Files:**
- Create: `src/lib/goodgame-campaign-scope.ts`
- Create: `scripts/check-goodgame-campaign-scope.ts`

1. Define `all`, `foot_traffic`, and `ecommerce` scopes.
2. Match eCommerce names containing `sales`, `ecommerce`, or `e-commerce` case-insensitively.
3. Add exact historical exceptions for Purchase, both Catalog variants, and IC Opt.
4. Verify known eCommerce and Foot Traffic campaign names with Node assertions.

### Task 2: Scope the All Data and Foot Traffic analytics service

**Files:**
- Modify: `src/services/goodgame-analytics.ts`

1. Add the selected scope to dashboard data.
2. Paginate master-row queries.
3. Filter current, comparison, pacing, and Meta creative rows with the shared classifier.
4. Derive scoped Meta focus and video metrics from paginated raw ad rows.
5. Use `goodgame` budget for All Data and `goodgame_foot_traffic` for Foot Traffic, with the existing Good Game budget as the initial fallback.

### Task 3: Expand the eCommerce service

**Files:**
- Modify: `src/services/goodgame-sales-analytics.ts`

1. Replace the `[SALES]`-only filter with the shared classifier.
2. Apply the classifier to current, comparison, and pacing rows.
3. Fetch and aggregate Meta creative rows directly so historical and newly named eCommerce campaigns use the same taxonomy.

### Task 4: Add Foot Traffic route and budget action

**Files:**
- Create: `src/app/dashboard/goodgame/foot-traffic/page.tsx`
- Modify: `src/app/dashboard/goodgame/actions.ts`

1. Add the protected Foot Traffic route.
2. Add an admin-only server action for `goodgame_foot_traffic` budget updates.
3. Revalidate the Foot Traffic route after updates.

### Task 5: Update presentation and navigation

**Files:**
- Modify: `src/components/GoodGameDashboardClient.tsx`
- Modify: `src/components/GoodGameSalesDashboardClient.tsx`
- Modify: `src/app/dashboard/layout.tsx`

1. Label the main route All Data.
2. Label the new route Foot Traffic.
3. Rename Sales navigation and page copy to eCommerce.
4. Keep the global weekly summary on All Data and the store-finder section on All Data and Foot Traffic.

### Task 6: Verify

1. Run the campaign-classification assertion script.
2. Run TypeScript/build validation with production environment aliases.
3. Run lint on changed files.
4. Inspect the final diff for unintended changes and secrets.
5. Verify protected routes redirect unauthenticated requests to `/login` after deployment.
