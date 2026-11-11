import 'server-only';
import { z } from 'zod';
import type { SpartacoWrapupConfig } from './spartaco-product-wrapups';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
});
const text = z.string().min(1);
const schema = z.array(z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  brand: z.enum(['Huskie', 'Jameson', 'Ronin']),
  product: text,
  parentProduct: text,
  campaignGroupName: text,
  campaignNames: z.array(text).min(1),
  sourceMediumPagePaths: z.array(z.string().startsWith('/')).min(1),
  gscPageUrls: z.array(z.string().url()).optional(),
  campaignStart: date, campaignEnd: date,
  beforeStart: date, beforeEnd: date,
  afterStart: date, afterEnd: date,
  status: z.enum(['Ready for Review', 'Draft']),
  executiveSummary: text,
  canClaim: z.array(text), cannotClaim: z.array(text),
  recommendations: z.array(text), caveats: z.array(text),
  emailSearchTerms: z.array(text).optional(),
}).strict().refine(report =>
  report.beforeStart <= report.beforeEnd && report.beforeEnd < report.campaignStart &&
  report.campaignStart <= report.campaignEnd && report.campaignEnd < report.afterStart &&
  report.afterStart <= report.afterEnd,
)).max(100);

let cachedRaw: string | undefined;
let cachedReports: SpartacoWrapupConfig[] | undefined;

/** Private server configuration, read only after the route's client authorization. */
export function getPrivateSpartacoWrapups(): SpartacoWrapupConfig[] {
  const raw = process.env.SPARTACO_PRIVATE_WRAPUPS_JSON;
  if (!raw) return [];
  if (raw === cachedRaw && cachedReports) return cachedReports;
  try {
    const reports = schema.parse(JSON.parse(raw));
    if (new Set(reports.map(report => report.slug)).size !== reports.length) throw new Error();
    cachedRaw = raw;
    cachedReports = reports;
    return reports;
  } catch {
    // Neither the underlying parser exception nor client data may enter logs.
    throw new Error('Invalid private saved report configuration');
  }
}
