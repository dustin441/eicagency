const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateOnly(value: string, field = 'date'): Date {
  const match = DATE_ONLY.exec(value);
  if (!match) throw new Error(`${field} must be a YYYY-MM-DD date`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new Error(`${field} must be a valid YYYY-MM-DD date`);
  }
  return date;
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number): string {
  const date = parseDateOnly(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateOnly(date);
}

export type MonthWindow = {
  start: string;
  end: string;
  elapsedDays: number;
  daysInMonth: number;
  elapsedFraction: number;
};

/** Convert an instant to its calendar date in the fixed America/Phoenix reporting zone. */
export function phoenixDateFromInstant(instant: string | Date): string {
  const date = instant instanceof Date ? new Date(instant.getTime()) : new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new Error('instant must be a valid timestamp');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

/**
 * Month-to-date window derived only from the supplied last complete source date.
 * No current-clock fallback is permitted.
 */
export function phoenixMonthWindow(lastCompleteSourceDate: string): MonthWindow {
  const end = parseDateOnly(lastCompleteSourceDate, 'lastCompleteSourceDate');
  const year = end.getUTCFullYear();
  const month = end.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const elapsedDays = end.getUTCDate();
  return {
    start: dateOnly(new Date(Date.UTC(year, month, 1))),
    end: lastCompleteSourceDate,
    elapsedDays,
    daysInMonth,
    elapsedFraction: elapsedDays / daysInMonth,
  };
}

export function comparisonWindows(lastCompleteSourceDate: string, days: number): {
  current: { start: string; end: string };
  previous: { start: string; end: string };
} {
  parseDateOnly(lastCompleteSourceDate, 'lastCompleteSourceDate');
  if (!Number.isInteger(days) || days <= 0) throw new Error('comparison days must be a positive integer');
  const currentStart = addDays(lastCompleteSourceDate, -(days - 1));
  const previousEnd = addDays(currentStart, -1);
  return {
    current: { start: currentStart, end: lastCompleteSourceDate },
    previous: { start: addDays(previousEnd, -(days - 1)), end: previousEnd },
  };
}

export function assertDateOnly(value: string, field: string): void {
  parseDateOnly(value, field);
}
