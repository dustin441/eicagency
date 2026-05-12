# LifeRep Weekly Update Process

LifeRep weekly executive summaries use the same pattern as Spartaco, Good Game, Turfli, Arabella, and Kinsey:

1. Pull ClickUp tasks and comments from the LifeRep list.
2. Store normalized task/comment history in Supabase.
3. Generate a Monday weekly readout from recent Meta performance plus ClickUp activity.
4. Save the published readout to Supabase for `/dashboard/liferep`.

## Supabase Tables

Created in the client analytics Supabase project:

- `liferep_clickup_tasks`
- `liferep_clickup_comments`
- `liferep_weekly_readout`

DDL lives in `scratch/liferep/liferep_weekly_update_tables.sql`.

## n8n Workflows

These are created by `scratch/n8n/create_liferep_weekly_update_workflows.mjs`.

- `LifeRep ClickUp Sync`
- `LifeRep Weekly Readout Generator`

ClickUp list:

- `901415432028`
- List name: `LifeRep`

## Dashboard Placement

The dashboard reads the most recent `approved` or `published` row from `liferep_weekly_readout` and renders it as `Weekly Executive Summary` directly below the date selector and above Budget Pacing.

## Agent Framing

The weekly agent treats LifeRep as a Meta-focused ecommerce dashboard. It uses this funnel framing:

- Creative: ad assets, ad copy, messaging, video/image testing
- Traffic: clicks, CTR, CPC, visit quality
- Conversion: purchases, revenue, ROAS, cost per purchase
- Measurement: tracking, pixel, analytics cleanup

## Credential Note

After creating or updating via the n8n API, confirm copied credentials are still attached before manual testing:

- ClickUp HTTP Request credentials
- Postgres credential for the client analytics Supabase project
- AI/Claude credentials on the weekly readout generator
