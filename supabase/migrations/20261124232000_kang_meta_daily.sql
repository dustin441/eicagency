-- Kang Foods Meta traffic facts. Service-role analytics access only.
BEGIN;
CREATE TABLE public.kang_meta_daily (
 account_id text NOT NULL CHECK(account_id = '1683292242584249'),
 date date NOT NULL,
 campaign_id text NOT NULL,
 campaign_name text NOT NULL,
 adset_id text NOT NULL,
 adset_name text NOT NULL,
 ad_id text NOT NULL,
 ad_name text NOT NULL,
 impressions bigint NOT NULL CHECK(impressions>=0),
 clicks bigint NOT NULL CHECK(clicks>=0),
 link_clicks bigint NOT NULL CHECK(link_clicks>=0),
 cost numeric(18,6) NOT NULL CHECK(cost>=0),
 landing_page_views bigint NOT NULL CHECK(landing_page_views>=0),
 actions jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(account_id,date,ad_id)
);
CREATE INDEX kang_meta_daily_date_idx ON public.kang_meta_daily(date,ad_id);
ALTER TABLE public.kang_meta_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kang_meta_daily FROM anon, authenticated;
GRANT ALL ON public.kang_meta_daily TO service_role;
CREATE TABLE public.kang_meta_sync_runs (
 execution_id text PRIMARY KEY,
 window_start date NOT NULL,
 window_end date NOT NULL,
 provider_rows integer NOT NULL CHECK(provider_rows>=0),
 written_rows integer NOT NULL CHECK(written_rows>=0),
 completed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.kang_meta_sync_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kang_meta_sync_runs FROM anon,authenticated;
GRANT ALL ON public.kang_meta_sync_runs TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
