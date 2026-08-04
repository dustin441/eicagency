export function dateOnly(value: string | null | undefined): string {
  return value?.slice(0, 10) ?? '';
}

export function resolveCreativeTestEvaluationEnd(
  status: string,
  concludedAt: string | null | undefined,
  sourcePeriodEnd: string | null | undefined,
  today: string
): string | null {
  if (status !== 'concluded') return today;
  return dateOnly(concludedAt) || dateOnly(sourcePeriodEnd) || null;
}