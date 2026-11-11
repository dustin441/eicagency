-- Isolated current-state reporting snapshots. CRM records are never mutated.
create table if not exists public.duroline_pipeline_snapshots (
  id bigint generated always as identity primary key,
  captured_at timestamptz not null,
  payload jsonb not null,
  constraint duroline_pipeline_snapshot_scope check (
    payload->>'schemaVersion' = '1'
    and payload->>'ghlLocationId' = 'KU4RlCj1mDVF6eNxwqcZ'
    and payload->>'ghlPipelineId' = 'DAtuQG1i9iWE5JGvK0a5'
    and payload->>'mmcOrganizationId' = '75'
    and payload->>'mmcFunnelId' = '14159165'
    and jsonb_typeof(payload->'leads') = 'array'
    and jsonb_typeof(payload->'deals') = 'array'
  )
);
create index if not exists duroline_pipeline_snapshots_latest
  on public.duroline_pipeline_snapshots (captured_at desc, id desc);
alter table public.duroline_pipeline_snapshots enable row level security;
revoke all on public.duroline_pipeline_snapshots from anon, authenticated;
grant select, insert on public.duroline_pipeline_snapshots to service_role;
grant usage, select on sequence public.duroline_pipeline_snapshots_id_seq to service_role;
comment on table public.duroline_pipeline_snapshots is
  'Duro Line only, complete reconciled HighLevel and MMC current-state snapshots. Service-only access; dashboard requires Durodyne client authorization.';
