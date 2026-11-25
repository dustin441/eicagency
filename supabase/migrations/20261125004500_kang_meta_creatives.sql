BEGIN;
CREATE TABLE public.kang_meta_creatives (
 account_id text NOT NULL CHECK(account_id='1683292242584249'),
 ad_id text NOT NULL,
 creative_id text, ad_name text, headline text, primary_text text,
 image_url text, video_url text, video_id text,
 destination_url text, cta_type text, page_name text, page_profile_image_url text,
 preview_url text, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(account_id,ad_id)
);
ALTER TABLE public.kang_meta_creatives ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kang_meta_creatives FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.kang_meta_creatives TO service_role;
COMMENT ON TABLE public.kang_meta_creatives IS 'Current Meta creative metadata for Kang only. Selected-period metrics come exclusively from kang_meta_daily; assets are not historical creative snapshots.';
COMMIT;
