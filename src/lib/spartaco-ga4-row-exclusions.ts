import { z } from 'zod';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
});

/** Native snapshot keys only: never infer missing attribution or normalize paths. */
export const ga4ExcludedRowSchema = z.object({
  date,
  pagePath: z.string().startsWith('/').min(1),
  source: z.string().min(1),
  medium: z.string().min(1),
  channelGroup: z.string().min(1),
}).strict();
export type Ga4ExcludedRow = z.infer<typeof ga4ExcludedRowSchema>;

type Scope = {
  beforeStart: string; beforeEnd: string;
  campaignStart: string; campaignEnd: string;
  afterStart: string; afterEnd: string;
  sourceMediumPagePaths: string[];
  sourceMediumScopedPageRules?: {
    pagePath: string; start?: string; end?: string;
    sources?: string[]; mediums?: string[]; channelGroups?: string[];
  }[];
  ga4ExcludedRows?: Ga4ExcludedRow[];
};
type Row = {
  date?: string | null; page_path?: string | null;
  ga4_source: string | null; ga4_medium: string | null;
  ga4_default_channel_group: string | null;
};
const key = (values: unknown[]) => JSON.stringify(values);
const excludedKey = (row: Ga4ExcludedRow) => key([
  row.date, row.pagePath, row.source, row.medium, row.channelGroup,
]);

/** Validate against the whole report, not the current before/during/after fetch. */
export function validateGa4ExcludedRows(config: Scope): void {
  if (config.ga4ExcludedRows === undefined) return;
  const rows = z.array(ga4ExcludedRowSchema).parse(config.ga4ExcludedRows);
  const seen = new Set<string>();
  for (const row of rows) {
    const inPeriod = [
      [config.beforeStart, config.beforeEnd],
      [config.campaignStart, config.campaignEnd],
      [config.afterStart, config.afterEnd],
    ].some(([start, end]) => row.date >= start && row.date <= end);
    const inPathScope = config.sourceMediumPagePaths.includes(row.pagePath) ||
      (config.sourceMediumScopedPageRules ?? []).some(rule =>
        rule.pagePath === row.pagePath &&
        (!rule.start || row.date >= rule.start) && (!rule.end || row.date <= rule.end) &&
        (!rule.sources?.length || rule.sources.includes(row.source)) &&
        (!rule.mediums?.length || rule.mediums.includes(row.medium)) &&
        (!rule.channelGroups?.length || rule.channelGroups.includes(row.channelGroup)));
    const rowKey = excludedKey(row);
    if (!inPeriod || !inPathScope || seen.has(rowKey)) {
      throw new Error('Invalid private GA4 row exclusions');
    }
    seen.add(rowKey);
  }
}

export function filterGa4ExcludedRows<T extends Row>(config: Scope, rows: T[]): T[] {
  validateGa4ExcludedRows(config);
  if (!config.ga4ExcludedRows?.length) return rows;
  const excluded = new Set(config.ga4ExcludedRows.map(excludedKey));
  return rows.filter(row => {
    // A changed/dynamic projection must not silently defeat reconciliation.
    if (typeof row.date !== 'string' || typeof row.page_path !== 'string' ||
        !Object.hasOwn(row, 'ga4_source') || !Object.hasOwn(row, 'ga4_medium') ||
        !Object.hasOwn(row, 'ga4_default_channel_group')) {
      throw new Error('Missing GA4 reconciliation dimensions');
    }
    return !excluded.has(key([
      row.date, row.page_path, row.ga4_source, row.ga4_medium, row.ga4_default_channel_group,
    ]));
  });
}
