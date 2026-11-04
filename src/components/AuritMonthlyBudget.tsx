import type { AuritMonthlyBudget as MonthlyBudget } from '@/lib/aurit-budgets';

export function AuritMonthlyBudget({ budget }: { budget: MonthlyBudget }) {
  const month = new Date(`${budget.monthStart}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });
  const amount = (value: number | null) => value === null ? 'Unavailable' : value.toLocaleString('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  });

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-700">Saved Monthly Budget: {month}</h2>
      <p className="mt-1 text-sm text-gray-500">
        Monthly plan, independent of the selected performance dates and channel filter. YouTube covers Google Video only, not all Google Ads.
      </p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        {([
          ['Meta', budget.meta],
          ['YouTube (Google Video only)', budget.youtube],
          ['Total', budget.total],
        ] as const).map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</dt>
            <dd className="mt-1 text-xl font-bold text-gray-900">{amount(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
