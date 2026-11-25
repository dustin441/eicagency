export type InvestmentPeriod = { start: string; end: string; paidMedia: number; technology: number };
export type InvestmentSnapshot = {
  basis: 'approved-workbook'; sourceLabel: string; sourceUrl: string;
  current: InvestmentPeriod; previous: InvestmentPeriod;
};

function record(value: unknown, keys: string[]): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
}
const validNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
function validPeriod(value: unknown, year: string): value is InvestmentPeriod {
  return record(value, ['start', 'end', 'paidMedia', 'technology'])
    && value.start === `${year}-01-01` && value.end === `${year}-10-31`
    && validNumber(value.paidMedia) && validNumber(value.technology);
}

export function parseInvestmentSnapshot(raw: string): InvestmentSnapshot {
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value, ['basis', 'sourceLabel', 'sourceUrl', 'current', 'previous'])
      || value.basis !== 'approved-workbook' || typeof value.sourceLabel !== 'string' || !value.sourceLabel.trim()
      || typeof value.sourceUrl !== 'string' || !validPeriod(value.current, '2026') || !validPeriod(value.previous, '2025')) throw new Error();
    const url = new URL(value.sourceUrl);
    if (url.protocol !== 'https:' || url.host !== 'docs.google.com' || !url.pathname.startsWith('/spreadsheets/') || url.username || url.password) throw new Error();
    return value as InvestmentSnapshot;
  } catch {
    throw new Error('NSI YTD investment configuration is invalid');
  }
}

export function buildInvestmentModel(revenueCurrent: number | null, revenuePrevious: number | null, snapshot: InvestmentSnapshot | null) {
  const period = (revenue: number | null, costs: InvestmentPeriod | undefined) => {
    const paidMedia = costs?.paidMedia ?? null;
    const technology = costs?.technology ?? null;
    const sum = paidMedia === null || technology === null ? null : paidMedia + technology;
    const total = sum !== null && Number.isFinite(sum) ? sum : null;
    const modeled = total !== null && total > 0 && validNumber(revenue) ? revenue * 0.01 / total : null;
    const roas = modeled !== null && Number.isFinite(modeled) ? modeled : null;
    return { paidMedia, technology, total, roas };
  };
  return { current: period(revenueCurrent, snapshot?.current), previous: period(revenuePrevious, snapshot?.previous) };
}
