-- Budget rows are monthly records. This index prevents concurrent first-edit
-- requests from creating duplicate client/month entries.
create unique index if not exists budgets_client_period_start_unique
  on public.budgets (client, period_start);
