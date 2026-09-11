BEGIN;
SET LOCAL lock_timeout='3s';
CREATE TABLE public.ihh_meta_paid_original_cohort (
 location_id text NOT NULL CHECK(location_id='m1hqL3irI6uiyW5tCGhR'),
 contact_id text NOT NULL, contact_key text NOT NULL CHECK(contact_key='ghl:'||contact_id),
 lead_at timestamptz NOT NULL, quiz_taker boolean NOT NULL CHECK(quiz_taker),
 appointment_scheduled boolean, appointment_at timestamptz,
 opportunity_id text NOT NULL,
 attribution_channel text NOT NULL CHECK(attribution_channel='paid_social'),
 attribution_source text NOT NULL CHECK(attribution_source IN ('facebook','instagram')),
 snapshot_at timestamptz NOT NULL, snapshot_schema_version text NOT NULL CHECK(length(snapshot_schema_version)>0),
 source_table text NOT NULL CHECK(source_table='ihh_funnel_contacts'),
 lifecycle_tracking_start date NOT NULL, payload jsonb NOT NULL,
 export_sha256 text NOT NULL CHECK(export_sha256 ~ '^[a-f0-9]{64}$'),
 imported_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(location_id,export_sha256,contact_id)
);
CREATE TABLE public.ihh_meta_paid_cohort_manifests (
 location_id text NOT NULL CHECK(location_id='m1hqL3irI6uiyW5tCGhR'),
 export_sha256 text NOT NULL CHECK(export_sha256 ~ '^[a-f0-9]{64}$'),
 status text NOT NULL CHECK(status='published'),
 source_table text NOT NULL CHECK(source_table='ihh_funnel_contacts'),
 classifier_version text NOT NULL CHECK(classifier_version='preserved_native_snapshots'),
 classification_evidence text NOT NULL,
 cohort_start timestamptz NOT NULL, cohort_end_exclusive timestamptz NOT NULL,
 observation_cutoff timestamptz NOT NULL, published_at timestamptz NOT NULL DEFAULT now(),
 row_count integer NOT NULL CHECK(row_count>=0),coverage jsonb NOT NULL,
 PRIMARY KEY(location_id,export_sha256),
 CHECK(cohort_start<cohort_end_exclusive AND cohort_end_exclusive<=observation_cutoff AND observation_cutoff<=published_at)
);
CREATE INDEX ihh_meta_paid_manifests_latest ON public.ihh_meta_paid_cohort_manifests(location_id,published_at DESC,export_sha256);
ALTER TABLE public.ihh_meta_paid_original_cohort ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ihh_meta_paid_cohort_manifests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ihh_meta_paid_original_cohort,public.ihh_meta_paid_cohort_manifests FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.ihh_meta_paid_original_cohort,public.ihh_meta_paid_cohort_manifests TO service_role;
COMMENT ON TABLE public.ihh_meta_paid_cohort_manifests IS 'IHH-only immutable completed reporting batches. Privileged publisher inserts rows and manifest in one transaction. No upstream writes. Native snapshot classification versions preserved.';
COMMENT ON TABLE public.ihh_meta_paid_original_cohort IS 'IHH-only original acknowledged quiz-lead Meta-paid subset. One coherent manifest per read. No update/delete granted to runtime roles.';
COMMIT;
