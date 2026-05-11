# Good Game Weekly Update Process

## Client

- Dashboard: `https://analytics.eic.agency/dashboard/goodgame`
- ClickUp list: `Good Game - Nappy Boy Dranks`
- ClickUp list ID: `901414768821`
- Supabase table prefix: `goodgame_`

## Supabase Tables

The weekly system writes to the Spartaco/NSI/Good Game Supabase project using:

- `goodgame_clickup_tasks`
- `goodgame_clickup_comments`
- `goodgame_weekly_readout`

The table DDL is in `scratch/goodgame/goodgame_weekly_update_tables.sql`.

## n8n Workflows

The workflows are created from the same template pattern used for Bloom and Spartaco:

- `Good Game ClickUp Sync`: `https://eicagency.app.n8n.cloud/workflow/k0bQSFlKt4KAIVOF`
- `Good Game Weekly Readout Generator`: `https://eicagency.app.n8n.cloud/workflow/xzH2hwaf3cilDLqC`

`Good Game ClickUp Sync` pulls tasks and comments from ClickUp into Supabase. `Good Game Weekly Readout Generator` runs Monday morning, pulls the latest performance and ClickUp activity, asks the weekly readout agent for a client-ready summary, then saves it to `goodgame_weekly_readout`.

Both workflows include an `Ensure Good Game Weekly Tables` Postgres node so the required tables are created before sync/generation.

## Credential Check

After creating or updating via the n8n API, confirm the copied credentials are still attached before manual testing:

- ClickUp API credential on the ClickUp request nodes.
- Postgres credential for the `lozgnyxixzfxokllevtb` Supabase project, usually `Postgres account 3`.
- Weekly readout agent/model credentials on the generator workflow.

## Agent Direction

The weekly readout should be written for Good Game / Nappy Boy Dranks and should call out:

- Overall spend, purchases/conversions, revenue, ROAS, CTR, and CPC.
- Meta versus Google movement.
- Full-funnel context where available: Engagement, Traffic, and Conversion.
- ClickUp accomplishments and optimization notes.
- Practical next-week priorities tied to budget pacing, creative testing, and conversion efficiency.

The dashboard renders the latest `approved` or `published` readout as `Weekly Executive Summary`.
