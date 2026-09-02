# Durable Meta creative previews

## Why this exists

Meta CDN links are signed and can expire. They may also include explicit transforms such as `p64x64` or `p160x120`. Those URLs must not be treated as permanent assets or enlarged in the dashboard.

The durable sync resolves each ad through the Graph API, downloads the best available image/poster, verifies its decoded dimensions, uploads it to the public `meta-creative-previews` Supabase Storage bucket, and updates the table's existing preview field. It never upscales or stores an image below 480px on its long edge or 270px on its short edge.

## Safety

- Dry-run is the default.
- `--apply` is required for Storage uploads and row updates.
- Meta usage headers are logged on each Graph request.
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

Required variables are documented at the top of `scripts/sync-meta-creative-previews.mjs`. `META_GRAPH_VERSION` must be set explicitly to the currently approved Graph API version; the script intentionally has no guessed fallback. CBA and Bloom are legacy tables without immutable `ad_id`; their exact ad identity is resolved from the account using `META_ACCOUNT_ID_CBA` and `META_ACCOUNT_ID_BLOOM`.

## Recurring sync

`.github/workflows/sync-meta-creative-previews.yml` runs after the normal daily Meta ingestion window. It skips safely when repository secrets are absent. The scheduled write job must not be enabled/merged until its production-side effects and repository secrets are approved under EIC change control.

## Verification

```bash
npm run check:creative-deep-dive-rollout
npm run lint
npm run build
```

After a successful applied run, inspect the Creative Analysis pages and verify rendered image `naturalWidth`/`naturalHeight` are at least the dimensions required by the card. Missing or unresolvable assets must use the existing neutral fallback, not a fake catalog state.
