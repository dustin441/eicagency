export const SOURCE_FIELDS = {
  leadSource: 'Marketo lead source',
  originalutmsource: 'Original UTM source',
  originalSourceType: 'Original source type',
  utmsource: 'Latest UTM source',
} as const;
export type SourceField = keyof typeof SOURCE_FIELDS;
export type DatabaseFilters = { start: string | null; end: string | null; source: string | null; segment: string | null; sourceField: SourceField };
export function percentage(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator * 100 : null;
}
export function parseFilters(params: Record<string, string | undefined>): DatabaseFilters {
  const date = (value?: string) => {
    if (!value) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error('Choose valid acquisition cohort dates.');
    return value;
  };
  const start = date(params.start), end = date(params.end);
  if (start && end && start > end) throw new Error('Cohort start must not follow end.');
  const sourceField = params.sourceField || 'leadSource';
  if (!Object.prototype.hasOwnProperty.call(SOURCE_FIELDS, sourceField)) throw new Error('Choose a supported source field.');
  return { start, end, source: params.source || null, segment: params.segment || null, sourceField: sourceField as SourceField };
}
export function recommendations(e: { people: number; unknownSource: number; missingLeadDate: number; invalidTransitions: number; mql?: number; mqlSql?: number; sql?: number; sqlWon?: number }): string[] {
  if (!e.people) return ['No people in this cohort. Widen the acquisition date, source, or segment filters before interpreting conversion.'];
  const messages: string[] = [];
  if (e.unknownSource) messages.push(`${e.unknownSource} of ${e.people} people lack the selected source field. Audit source capture before allocating budget from this mix.`);
  if (e.missingLeadDate) messages.push(`${e.missingLeadDate} of ${e.people} people lack a valid lead-created timestamp. Repair timestamp coverage before using lead-to-stage velocity.`);
  if (e.invalidTransitions) messages.push(`${e.invalidTransitions} people have reversed or future lifecycle timestamps. Review lifecycle write rules; invalid intervals are excluded from velocity.`);
  if (e.mql !== undefined && e.mqlSql !== undefined && e.mql > e.mqlSql) messages.push(`${e.mql - e.mqlSql} of ${e.mql} MQLs have no recorded SQL milestone. Review qualification, handoff ownership, follow-up and lifecycle logging before assuming more lead volume is the answer. These are not necessarily lost leads.`);
  if (e.sql !== undefined && e.sqlWon !== undefined && e.sql > e.sqlWon) messages.push(`${e.sql - e.sqlWon} of ${e.sql} SQLs have no recorded Won milestone. Prioritize a sales-stage and aged-open review, separating active, lost and unlogged outcomes. Compare similarly mature cohorts before judging close rates.`);
  if (!messages.length) messages.push('No missing-source or timestamp diagnostic was triggered in this cohort. Compare mature acquisition cohorts before interpreting conversion; these observations do not establish channel causality.');
  return messages;
}
