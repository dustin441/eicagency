export type IhhFunnelContactRow = {
  contact_key: string;
  lead_at: string;
  quiz_taker: boolean;
  appointment_scheduled: boolean;
  appointment_at?: string | null;
};

export type IhhFunnelDailyPoint = {
  label: string;
  quizTakers: number;
  scheduledAppointments: number;
};

export type IhhFunnelAggregation = {
  quizTakers: number;
  scheduledAppointments: number;
  conversionRate: number | null;
  costPerQuizTaker: number | null;
  costPerScheduledAppointment: number | null;
  daily: IhhFunnelDailyPoint[];
};

export function ihhArizonaDateLabel(value: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function ihhArizonaRangeBounds(start: string, end: string) {
  const nextDay = new Date(`${end}T00:00:00.000Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return {
    start: `${start}T07:00:00.000Z`,
    endExclusive: `${nextDay.toISOString().slice(0, 10)}T07:00:00.000Z`,
  };
}

/** Aggregate the lead-date cohort used by the IHH dashboard. */
export function aggregateIhhFunnelRows(
  rows: IhhFunnelContactRow[],
  mediaSpend: number
): IhhFunnelAggregation {
  const daily = new Map<string, IhhFunnelDailyPoint>();
  let quizTakers = 0;
  let scheduledAppointments = 0;

  for (const row of rows) {
    if (!row.quiz_taker) continue;

    const label = ihhArizonaDateLabel(row.lead_at);
    const point = daily.get(label) ?? { label, quizTakers: 0, scheduledAppointments: 0 };
    quizTakers += 1;
    point.quizTakers += 1;

    if (row.appointment_scheduled) {
      scheduledAppointments += 1;
      point.scheduledAppointments += 1;
    }
    daily.set(label, point);
  }

  return {
    quizTakers,
    scheduledAppointments,
    conversionRate: quizTakers > 0 ? (scheduledAppointments / quizTakers) * 100 : null,
    costPerQuizTaker: quizTakers > 0 ? mediaSpend / quizTakers : null,
    costPerScheduledAppointment: scheduledAppointments > 0 ? mediaSpend / scheduledAppointments : null,
    daily: Array.from(daily.values()).sort((a, b) => a.label.localeCompare(b.label)),
  };
}
