# Bridgeway Weekly Update Process

Bridgeway weekly executive summaries use the same pattern as the other EIC Agency client dashboards:

1. Pull ClickUp tasks and comments from the Bridgeway Insurance list.
2. Store normalized task/comment history in Supabase.
3. Generate a Monday weekly readout from recent paid media performance plus ClickUp activity.
4. Save the published readout to Supabase for `/dashboard/bridgeway`.

## Supabase Tables

Created in the client analytics Supabase project:

- `bridgeway_clickup_tasks`
- `bridgeway_clickup_comments`
- `bridgeway_weekly_readout`

DDL lives in `scratch/bridgeway/bridgeway_weekly_update_tables.sql`.

## n8n Workflows

Use these existing workflows as the Bridgeway workflow sources:

- ClickUp sync: `https://eicagency.app.n8n.cloud/workflow/RmurvcTivExnhcBk`
- Weekly generator: `https://eicagency.app.n8n.cloud/workflow/r4oF9ccBWgBClSgA`

ClickUp list:

- `901413196484`
- List name: `Bridgeway Insurance`
- Dashboard page: `https://analytics.eic.agency/dashboard/bridgeway`

## Dashboard Placement

The dashboard reads the most recent `approved` or `published` row from `bridgeway_weekly_readout` and renders it as `Weekly Executive Summary` directly below the date selector and above Budget Pacing.

## Agent Framing

The weekly agent treats Bridgeway Insurance as a lead-generation dashboard. It should prioritize 60+ second calls and cost per 60+ second call as conversion-quality signals.

- Creative: ad assets, ad copy, message-market fit, image/video testing
- Traffic: impressions, clicks, CTR, CPC, channel quality
- Conversion: 60+ second calls, cost per call, conversion rate, lead quality
- Measurement: call tracking, attribution, GA4, platform reporting cleanup

## Credential Note

After creating or updating via the n8n API, confirm copied credentials are still attached before manual testing:

- ClickUp HTTP Request credentials
- Postgres credential for the client analytics Supabase project
- AI/Claude credentials on the weekly readout generator
