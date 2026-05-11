# Spartaco Weekly Update Process

## Goal

Duplicate the PrePass weekly update process for Spartaco so `/dashboard/spartaco/all` shows a published weekly readout every Monday.

## Source Systems

- ClickUp list: `901407399216`
- ClickUp list name: `Spartaco Group`
- ClickUp source workflow to duplicate: `d6IWJKqNbE0Jsa7a`
- Weekly agent source workflow to duplicate: `kI8sFph45D0TKOm3`
- Spartaco ClickUp sync workflow: `xMS3QEhTW4m4n759`
- Spartaco weekly readout workflow: `NkuQgaVFPNMj7f5c`
- Dashboard page: `/dashboard/spartaco/all`
- Supabase project: Spartaco/NSI project, accessed in code through `createSpartacoSupabaseClient()`

## Workflow URLs

- Spartaco ClickUp Sync: `https://eicagency.app.n8n.cloud/workflow/xMS3QEhTW4m4n759`
- Spartaco Weekly Readout Generator: `https://eicagency.app.n8n.cloud/workflow/NkuQgaVFPNMj7f5c`

## Tables

Run [spartaco_weekly_update_tables.sql](/Users/dustintrout/Documents/Antigravity/EIC%20Agency/scratch/spartaco/spartaco_weekly_update_tables.sql) in the Spartaco Supabase project.

Tables created:

- `spartaco_clickup_tasks`
- `spartaco_clickup_comments`
- `spartaco_weekly_readout`

ClickUp task/comment rows include `business_focus`, which must be one of:

- `general`
- `jameson`
- `huskie`
- `ronin`

Most current comments live in one budget pacing task, so the ClickUp workflow should default those rows to `general`. The weekly agent should treat `general` comments as general optimization context unless the comment text clearly names Jameson, Huskie, or Ronin.

## Weekly Readout Contract

`spartaco_weekly_readout.focus_insights` must always include all three business focuses:

```json
{
  "jameson": {
    "wins": [],
    "opportunities": [],
    "next_steps": []
  },
  "huskie": {
    "wins": [],
    "opportunities": [],
    "next_steps": []
  },
  "ronin": {
    "wins": [],
    "opportunities": [],
    "next_steps": []
  }
}
```

Do not omit a focus because activity was low. If there is not enough data, the agent should say that directly in `opportunities` or `next_steps`.

## Monday Workflow Windows

Recommended schedule: Monday morning.

Use complete days only:

- `period_end`: yesterday, which should be Sunday for the scheduled Monday run
- `period_start`: 13 days before `period_end`
- `previous_end`: day before `period_start`
- `previous_start`: 13 days before `previous_end`
- ClickUp context window: last 7 complete days through Sunday

This keeps the metric comparison aligned with the PrePass 14-day readout pattern while still grounding execution context in the most recent week.

## ClickUp Workflow Changes

Duplicate workflow `d6IWJKqNbE0Jsa7a` and change:

- ClickUp list ID to `901407399216`
- task upsert table to `spartaco_clickup_tasks`
- comment upsert table to `spartaco_clickup_comments`
- default `business_focus` to `general`
- infer `business_focus` from comment/task text when obvious:
  - Jameson: `jameson`
  - Huskie: `huskie`
  - Ronin: `ronin`

If a comment mentions multiple focuses, keep `business_focus = general` and let the weekly agent distribute it.

## Weekly Agent Workflow Changes

Duplicate workflow `kI8sFph45D0TKOm3` and replace PrePass inputs with:

- `master_spartaco` metrics for current and previous windows
- `master_spartaco` metrics grouped by brand/business focus for Jameson, Huskie, and Ronin
- `spartaco_clickup_tasks`
- `spartaco_clickup_comments`

The workflow should write one row into `spartaco_weekly_readout` with `status = 'published'` after generation.

## Agent Prompt Requirements

Use this hard rule in the agent prompt:

```text
Always include separate insight sections for Jameson, Huskie, and Ronin.
Do not omit a business focus because it had low spend, low conversion volume, or limited ClickUp activity.
If there is limited information for a focus, say that directly and recommend whether the next step is monitoring, budget shift, creative refresh, audience/search-term optimization, landing-page review, or measurement cleanup.

Most ClickUp comments currently come from one budget pacing task and should be treated as general optimization context unless the comment explicitly names Jameson, Huskie, or Ronin.
Use general optimization comments in the top-level opportunities/accomplishments/focus_next_week sections, then only assign them to a specific focus when the text supports that assignment.
```

Expected output:

```json
{
  "overall_story": "string",
  "focus_insights": {
    "jameson": {
      "wins": ["string"],
      "opportunities": ["string"],
      "next_steps": ["string"]
    },
    "huskie": {
      "wins": ["string"],
      "opportunities": ["string"],
      "next_steps": ["string"]
    },
    "ronin": {
      "wins": ["string"],
      "opportunities": ["string"],
      "next_steps": ["string"]
    }
  },
  "wins": ["string"],
  "opportunities": ["string"],
  "accomplishments": ["string"],
  "focus_next_week": ["string"],
  "execution_context": ["string"]
}
```

## Validation

After creating the workflows:

1. Run the ClickUp workflow manually.
2. Confirm rows exist in `spartaco_clickup_tasks` and `spartaco_clickup_comments`.
3. Confirm budget pacing task comments are stored as `business_focus = 'general'`.
4. Run the weekly agent workflow manually.
5. Confirm `spartaco_weekly_readout.focus_insights` has `jameson`, `huskie`, and `ronin`.
6. Load `/dashboard/spartaco/all` and confirm Weekly Notes appears above the KPI cards.
7. Publish both workflows.

## n8n Credential Warning

After every n8n SDK/API workflow update, credentials may disconnect. Reconnect the ClickUp/API credentials and the Postgres credential manually in n8n before testing or publishing.
