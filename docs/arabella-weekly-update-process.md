# Arabella Hotels Weekly Update Process

## Client

- Dashboard: `https://analytics.eic.agency/dashboard/arabella`
- ClickUp list: `Arabella Hotels`
- ClickUp list ID: `901414345904`
- Supabase table prefix: `arabella_`

## Supabase Tables

The weekly system writes to the Spartaco/NSI/Good Game/Turfli/Arabella Supabase project using:

- `arabella_clickup_tasks`
- `arabella_clickup_comments`
- `arabella_weekly_readout`

The table DDL is in `scratch/arabella/arabella_weekly_update_tables.sql`.

## n8n Workflows

The workflows are created from the same template pattern used for Spartaco, Good Game, and Turfli:

- `Arabella ClickUp Sync`: `https://eicagency.app.n8n.cloud/workflow/oNfYiyK1kzDKV3a9`
- `Arabella Weekly Readout Generator`: `https://eicagency.app.n8n.cloud/workflow/g56lPpXfY3CFqiKP`

`Arabella ClickUp Sync` pulls tasks and comments from ClickUp into Supabase. `Arabella Weekly Readout Generator` runs Monday morning, pulls the latest performance and ClickUp activity, asks the weekly readout agent for a client-ready summary, then saves it to `arabella_weekly_readout`.

Both workflows include an `Ensure Arabella Weekly Tables` Postgres node so the required tables are created before sync/generation.

## Agent Direction

The weekly readout should be written for Arabella Hotels and should call out:

- Overall spend, impressions, clicks, CTR, purchases/bookings, revenue, and ROAS.
- Meta movement, since Arabella is currently Meta-focused in the dashboard.
- Campaign or ad pockets driving booking volume and revenue efficiency.
- ClickUp accomplishments and optimization notes.
- Practical next-week priorities tied to budget pacing, creative, traffic quality, booking efficiency, and measurement cleanup.

The dashboard renders the latest `approved` or `published` readout as `Weekly Executive Summary`.

## Credential Check

After creating or updating via the n8n API, confirm the copied credentials are still attached before manual testing:

- ClickUp API credential on the ClickUp request nodes.
- Postgres credential for the `lozgnyxixzfxokllevtb` Supabase project, usually `Postgres account 3`.
- Weekly readout agent/model credentials on the generator workflow.
