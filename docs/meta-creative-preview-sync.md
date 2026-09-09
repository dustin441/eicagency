# Durable Meta creative previews

## Why this exists

Meta CDN links and `facebook.com/ads/image` proxy links are transient and can expire. They may also include explicit transforms such as `p64x64` or `p160x120`. Those URLs must not be treated as permanent assets or enlarged in the dashboard.

The durable sync resolves each ad through the Graph API, downloads the best available image/poster, verifies its decoded dimensions, uploads it to the public `meta-creative-previews` Supabase Storage bucket, and updates the table's existing preview field. It never upscales or stores an image below 600px on its long edge or 315px on its short edge.

## Safety

- Dry-run is the default.
- `--apply` is required for Storage uploads and row updates.
- Downloads are HTTPS-only and restricted to approved Meta/Facebook hosts. Every redirect hop is revalidated, response bodies are capped at 20 MiB, and `sharp` fully decodes each payload before upload.
- Storage object names include a content hash, and existing content-addressed objects are never overwritten or deleted by a failed retry.
- Every transient daily row in the requested window is processed; Graph and media resolution are cached once per `ad_id`.
- Database updates are scoped to the fetched `ad_id` and daily row date, and a zero-row update is treated as an error.
- The Graph response `account_id` must match the configured `META_ACCOUNT_ID_<CLIENT>` before media is accepted.
- App, business-use-case, and ad-account usage headers are logged and enforced using only Meta's documented percentage fields.
- One client failure does not prevent later clients from running, but the workflow still finishes nonzero with a failure summary.
- Videos keep using `video_url`; if Meta does not expose an MP4, the durable poster remains the fallback.
- Confirmed catalog ads remain catalog previews; URL appearance alone never labels an ad as catalog.
- Search ads are not processed.

## Commands

```bash
# Dry-run selected clients
npm run sync:meta-creative-previews -- --client=ihh,bloom,prepass --days=120

# Apply after reviewing the dry-run
npm run sync:meta-creative-previews -- --apply --client=ihh,bloom,prepass --days=120
```

Required variables are documented at the top of `scripts/sync-meta-creative-previews.mjs`. `META_GRAPH_VERSION` must be set explicitly to the currently approved Graph API version; the script intentionally has no guessed fallback. `META_ACCESS_TOKEN` is the shared fallback, while `META_ACCESS_TOKEN_<CLIENT>` can provide account-specific access without exposing tokens in code. Each scheduled client also requires a non-secret repository variable named `META_ACCOUNT_ID_<CLIENT>` for cross-account isolation. Every configured table, including CBA, Bloom, and Duro Dyne, uses its immutable `ad_id`; the sync does not depend on mutable ad, ad-set, or campaign names.

## Recurring sync

`.github/workflows/sync-meta-creative-previews.yml` runs after the normal daily Meta ingestion window and limits scheduled work to the current 30-day creative window; wider historical backfills remain explicit manual runs. It supports a shared Meta token or client-specific token secrets. It fails visibly when required repository secrets or variables are absent so a skipped sync cannot look successful. The scheduled write job must not be enabled/merged until its production-side effects and repository secrets are approved under EIC change control.

## Verification

```bash
npm run check:creative-deep-dive-rollout
npm run check:meta-creative-previews
npm run lint
npm run build
```

After a successful applied run, inspect the Creative Analysis pages and verify rendered image `naturalWidth`/`naturalHeight` are at least the dimensions required by the card. Missing or unresolvable assets must use the existing neutral fallback, not a fake catalog state.
