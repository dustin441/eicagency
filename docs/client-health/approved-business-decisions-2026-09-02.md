# Client Health Approved Business Decisions — 2026-09-02

**Authority:** Dustin Trout direction in the Slack thread linked to ClickUp task `86bbedxm0`
**Scope:** Business definitions for the agency-level all-client portfolio dashboard
**Operational activation:** Not authorized by this document alone. Production adapters, configuration activation, collection, and publication remain verification-gated.

## Portfolio boundary

- Client Health is one agency-only portfolio page at `/dashboard/client-health`.
- It is not a route or sidebar item inside individual client instances.
- Each active client appears as one portfolio row. A setup state may be shown without fabricating unavailable performance metrics.
- `LiveWorld` is excluded from Client Health.
- `EIC Agency` is excluded from external-client health.
- `Aurit` and `Medibrane` are active larger/custom clients. Their performance dashboards are expected the week of 2026-09-07; until verified, their performance dimensions remain setup-in-progress/unavailable.
- `NSI` and `Duro Dyne / HVAC` are separate clients and must never be aggregated together.

## Retainer economics and capacity

- Target top-line margin: **80%**.
- Custom/high-touch internal fulfillment cost: **$46/hour**.
- Platform internal fulfillment cost: **$26/hour**.
- `Aurit` and `Medibrane` use the custom/high-touch rate.
- Monthly allotted hours are derived, not manually copied from a month-end sheet:

  `monthly allotted hours = monthly retainer × (1 - 0.80) ÷ internal hourly cost`

- Actual hours come from current-month ClickUp time entries restricted to the approved client list IDs.
- Projected month-end hours use elapsed complete Phoenix days.
- Projected realized margin uses projected ClickUp hours:

  `projected margin = (monthly retainer - projected hours × internal hourly cost) ÷ monthly retainer`

- The historical finance workbook may bootstrap current retainers once, but it is not the ongoing Client Health source.
- Retainer, delivery type, hourly cost, target margin, and effective month must be editable in an agency-only versioned settings workflow. Prior effective months remain immutable/auditable.

## Approved North Stars

- **PrePass:** Cost per Won primary; SQL may be supporting evidence.
- **Spartaco:** show both Lead Gen CPL and e-commerce ROAS, preserving separate source/scope semantics.
- **NSI:** Cost per Submittal.
- **Duro Dyne / HVAC:** CPL.
- **Good Game / Nappy Boy:** online sales performance only; preserve existing e-commerce scope and exclude retail/foot-traffic spend and wholesale/draft orders.
- **Bridgeway:** Cost per verified 60-second Call.
- **State Forty Eight:** ROAS with a **3.0× target**.
- **InfiniteHeart Health:** Scheduled Appointments for now; definition may evolve as evidence matures.
- **Champagne Haus:** use the current dashboard's qualified-lead/CPL scope unless explicitly revised.
- Other existing clients retain the primary KPI and scope already presented by their current dashboard, subject to native-source reconciliation before first publication.

## Fail-closed rules

- Missing, stale, unverified, or not-yet-built source data is unavailable/incomplete, never zero or healthy.
- Aurit and Medibrane may appear as setup-in-progress before performance activation.
- ROAS and cost-per-result are different formulas and directions; neither may be represented by swapping labels on the other.
- Spartaco's two lanes must remain distinct and may not be averaged into one ratio.
- A client's overall state may not score healthy if a required performance lane is unavailable or configuration-required.
- Canary Data is not a source, target, fallback, or portfolio row.
