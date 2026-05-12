# Turfli Weekly Update Process

## Client

- Dashboard: `https://analytics.eic.agency/dashboard/turfli`
- ClickUp list: `Tuurfli`
- ClickUp list ID: `901414768474`
- ClickUp space: `Click and Mortar`
- Supabase table prefix: `turfli_`

## Supabase Tables

The weekly system writes to the Spartaco/NSI/Good Game/Turfli Supabase project using:

- `turfli_clickup_tasks`
- `turfli_clickup_comments`
- `turfli_weekly_readout`

The table DDL is in `scratch/turfli/turfli_weekly_update_tables.sql`.

## n8n Workflows

The workflows are created from the same template pattern used for Bloom, Spartaco, and Good Game:

- `Turfli ClickUp Sync`: `https://eicagency.app.n8n.cloud/workflow/RmurvcTivExnhcBk`
- `Turfli Weekly Readout Generator`: `https://eicagency.app.n8n.cloud/workflow/s9x9ctmz84XOn6Ks`

`Turfli ClickUp Sync` pulls tasks and comments from ClickUp into Supabase. `Turfli Weekly Readout Generator` runs Monday morning, pulls the latest performance and ClickUp activity, asks the weekly readout agent for a client-ready summary, then saves it to `turfli_weekly_readout`.

Both workflows include an `Ensure Turfli Weekly Tables` Postgres node so the required tables are created before sync/generation.

## Agent Direction

The weekly readout should be written for Turfli and should call out:

- Overall spend, impressions, clicks, CTR, conversions, and cost per conversion.
- Meta versus Google movement.
- Campaign or channel pockets that are driving conversion efficiency.
- ClickUp accomplishments and optimization notes.
- Practical next-week priorities tied to budget pacing, creative, traffic quality, landing page/site needs, and measurement cleanup.

The dashboard renders the latest readout as `Weekly Executive Summary`.

## Credential Check

After creating or updating via the n8n API, confirm the copied credentials are still attached before manual testing:

- ClickUp API credential on the ClickUp request nodes.
- Postgres credential for the `lozgnyxixzfxokllevtb` Supabase project, usually `Postgres account 3`.
- Weekly readout agent/model credentials on the generator workflow.
