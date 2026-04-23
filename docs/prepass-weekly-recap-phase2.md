# PrePass Weekly Recap Phase 2

## Current Dashboard State

The PrePass dashboard now renders a live `Weekly Executive Readout` at the top of `/dashboard` using:

- `master_marketing_performance` for last 14 complete days vs previous 14 complete days
- `clickup_tasks` and `clickup_comments` for last-week execution context
- `ad_change_history` for recent Google Ads changes

This is live-generated on page load and does not yet depend on `n8n`.

## Old Workflow Audit

Existing workflow:

- `n8n` workflow id: `kI8sFph45D0TKOm3`
- name: `PrePass Weekly Performance Report`

Observed issues:

- uses legacy RPC `get_prepass_period_comparison`
- pulls comments from two hard-coded ClickUp task ids instead of using the current Supabase mirror
- writes plain text into `pending_reports`
- outputs a Slack draft, but the dashboard does not consume that structure

## Recommended Phase 2 Shape

The Monday workflow should generate a structured weekly recap, not a plain-text report blob.

Recommended sections:

- `overall_story`
- `performance_insights`
- `accomplishments`
- `focus_next_week`
- `execution_context`

Recommended source split:

- `overall_story`: generated from dashboard metrics + execution context
- `performance_insights`: generated from focus-group metrics (`SMB`, `FD360`, `ABM`)
- `accomplishments`: generated from `clickup_tasks`, `clickup_comments`, `ad_change_history`
- `focus_next_week`: strategist-authored or strategist-approved

## Recommended Monday Workflow

1. Run every Monday morning.
2. Set windows:
   - current = last 14 complete days through yesterday
   - previous = 14 days immediately before current
   - context window = last 7 complete days through yesterday
3. Pull metric inputs for:
   - overall PrePass
   - `SMB`
   - `FD360`
   - `ABM`
4. Pull operational context from:
   - `clickup_tasks`
   - `clickup_comments`
   - `ad_change_history`
5. Generate structured recap text with an LLM.
6. Save the structured recap in a format the dashboard can read directly.
7. Optionally send Slack/email draft after save.

## Recommended Storage Contract

If we persist recaps, store fields separately instead of saving one plain-text report:

```json
{
  "client": "prepass",
  "week_of": "2026-04-27",
  "current_start": "2026-04-13",
  "current_end": "2026-04-26",
  "previous_start": "2026-03-30",
  "previous_end": "2026-04-12",
  "overall_story": "string",
  "wins": ["string"],
  "opportunities": ["string"],
  "accomplishments": ["string"],
  "focus_next_week": ["string"],
  "status": "draft|approved"
}
```

The dashboard can then prefer an approved recap when available and fall back to live-generated content otherwise.

## Suggested Next Step

Update the existing `n8n` workflow to generate structured output against the current data sources, then wire the dashboard to read the persisted recap when present.
