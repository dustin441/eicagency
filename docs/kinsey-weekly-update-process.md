# Kinsey Design Weekly Update Process

Kinsey weekly executive summaries use the same pattern as Spartaco, Good Game, Turfli, and Arabella:

1. Pull ClickUp tasks and comments from the Kinsey Designs list.
2. Store the normalized task/comment history in Supabase.
3. Generate a Monday weekly readout from recent performance plus ClickUp activity.
4. Save the published readout to Supabase for `/dashboard/kinsey`.

## Supabase Tables

Created in the client analytics Supabase project:

- `kinsey_clickup_tasks`
- `kinsey_clickup_comments`
- `kinsey_weekly_readout`

DDL lives in `scratch/kinsey/kinsey_weekly_update_tables.sql`.

## n8n Workflows

These are created by `scratch/n8n/create_kinsey_weekly_update_workflows.mjs`.

- `Kinsey Design ClickUp Sync`
- `Kinsey Design Weekly Readout Generator`

ClickUp list:

- `901414385622`
- List name: `Kinsey Designs`

## Dashboard Placement

The dashboard reads the most recent `approved` or `published` row from `kinsey_weekly_readout` and renders it as `Weekly Executive Summary` directly below the date selector and above Budget Pacing.

## Agent Framing

The weekly agent treats `Kinsey Design` and `Kinsey Designs` as the same client context. It uses ecommerce funnel framing:

- Creative: ad assets, ad copy, messaging, video/image testing
- Traffic: clicks, CTR, CPC, visit quality
- Conversion: purchases/conversions, revenue, ROAS, cost per purchase/conversion
- Measurement: tracking, pixel, GA4, analytics cleanup

## Credential Note

After creating or updating via the n8n API, confirm copied credentials are still attached before manual testing:

- ClickUp HTTP Request credentials
- Postgres credential for the client analytics Supabase project
- AI/Claude credentials on the weekly readout generator
