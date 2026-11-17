-- PrePass Sales Overview: monthly readout, team notes, and the fact sheet the monthly AI workflow reads. ADDITIVE.
-- Does not touch prepass_monthly_readout / prepass_weekly_readout (those feed the SMB, ABM and FD360 pages).
--   prepass_sales_notes   : the team's log of what was tested or changed (written from the dashboard, agency users only)
--   prepass_sales_readout : one row per generated readout; the page shows the latest row
--   prepass_sales_focus_facts(start, end) : one JSON fact sheet (year over year, paths, calls, spend vs enrollment, notes)
-- Monthly AI workflow (n8n, to build): call prepass_sales_focus_facts for the trailing 12 months, ask the model for the six
-- lists below using only those facts, then insert one row into prepass_sales_readout.
-- RLS is on with no policies; only the service role (server code and n8n) can read or write.
-- Rollback: drop function public.prepass_sales_focus_facts(date, date); drop table public.prepass_sales_readout, public.prepass_sales_notes;

create table if not exists public.prepass_sales_notes (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  note_date date not null default current_date,
  kind text not null default 'note' check (kind in ('test','change','note')),
  body text not null check (length(body) between 1 and 2000),
  author text
);
alter table public.prepass_sales_notes enable row level security;
revoke all on public.prepass_sales_notes from anon, authenticated;
create index if not exists prepass_sales_notes_date_idx on public.prepass_sales_notes (note_date desc);

create table if not exists public.prepass_sales_readout (
  id bigserial primary key,
  generated_at timestamptz not null default now(),
  month_start date not null,
  month_end date not null,
  generated_by text not null default 'unknown',
  summary jsonb not null default '[]'::jsonb,
  working jsonb not null default '[]'::jsonb,
  not_working jsonb not null default '[]'::jsonb,
  tested jsonb not null default '[]'::jsonb,
  do_next jsonb not null default '[]'::jsonb,
  watch_out jsonb not null default '[]'::jsonb
);
alter table public.prepass_sales_readout enable row level security;
revoke all on public.prepass_sales_readout from anon, authenticated;
create index if not exists prepass_sales_readout_gen_idx on public.prepass_sales_readout (generated_at desc);

create or replace function public.prepass_sales_focus_facts(p_start date, p_end date)
returns jsonb language plpgsql stable security definer
set search_path to 'pg_catalog','public','mk'
set statement_timeout to '120s'
as $$
begin
  return jsonb_build_object(
    'generated_for', jsonb_build_object('start', p_start, 'end', p_end),
    'yoy', public.prepass_sales_yoy(p_start, p_end),
    'conversion_paths', public.prepass_conversion_paths(p_start, p_end),
    'call_campaigns', public.prepass_call_campaigns(p_start, p_end),
    'spend_vs_enrollment', public.prepass_spend_vs_enrollment(p_start, p_end),
    'team_notes', (select coalesce(jsonb_agg(jsonb_build_object('date', note_date, 'kind', kind, 'note', body) order by note_date desc, id desc), '[]'::jsonb)
                   from public.prepass_sales_notes where note_date >= p_end - 90)
  );
end $$;
revoke all on function public.prepass_sales_focus_facts(date, date) from public, anon, authenticated;
grant execute on function public.prepass_sales_focus_facts(date, date) to service_role;
