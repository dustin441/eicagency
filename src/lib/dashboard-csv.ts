export type DashboardCsvData = object;

type CsvScalar = string | number | boolean | null;
type CsvRow = Record<string, CsvScalar>;

const FORMULA_PREFIX = /^[=+\-@]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function scalarValue(value: unknown): CsvScalar {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return JSON.stringify(value);
}

function flattenRecord(record: Record<string, unknown>): CsvRow {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, scalarValue(value)]));
}

function moduleRows(module: string, value: unknown): CsvRow[] {
  if (Array.isArray(value)) {
    return value.map((item) => ({
      module,
      ...(isRecord(item) ? flattenRecord(item) : { value: scalarValue(item) }),
    }));
  }

  if (isRecord(value)) {
    const groupedRows = Object.entries(value).flatMap(([group, groupValue]) => {
      if (!Array.isArray(groupValue)) return [];
      return groupValue.map((item) => ({
        module,
        group,
        ...(isRecord(item) ? flattenRecord(item) : { value: scalarValue(item) }),
      }));
    });
    if (groupedRows.length > 0 && Object.values(value).every(Array.isArray)) return groupedRows;
    return [{ module, ...flattenRecord(value) }];
  }

  return [{ module, value: scalarValue(value) }];
}

function escapeCsv(value: CsvScalar): string {
  if (value === null) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function filterMetadata(data: DashboardCsvData): CsvRow {
  const record = data as Record<string, unknown>;
  const candidate = record.filterParams ?? record.params ?? record.filters;
  if (!isRecord(candidate)) return {};
  return Object.fromEntries(
    Object.entries(candidate).map(([key, value]) => [`filter_${key}`, scalarValue(value)]),
  );
}

export function buildDashboardCsv(data: DashboardCsvData): string {
  const filters = filterMetadata(data);
  const rows = Object.entries(data).flatMap(([module, value]) =>
    moduleRows(module, value).map((row) => ({ ...filters, ...row })),
  );
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const preferred = ['module', 'group', ...Object.keys(filters)];
  columns.sort((a, b) => {
    const ai = preferred.indexOf(a);
    const bi = preferred.indexOf(b);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? Number.MAX_SAFE_INTEGER : ai) - (bi === -1 ? Number.MAX_SAFE_INTEGER : bi);
    return a.localeCompare(b);
  });

  const body = [
    columns.map(escapeCsv).join(','),
    ...rows.map((row) => columns.map((column) => escapeCsv(row[column] ?? null)).join(',')),
  ].join('\r\n');
  return `\uFEFF${body}`;
}

export function dashboardCsvFilename(title: string, filters?: Record<string, unknown>): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'dashboard-data';
  const start = typeof filters?.start === 'string' ? filters.start : null;
  const end = typeof filters?.end === 'string' ? filters.end : null;
  return `${slug}${start && end ? `_${start}_to_${end}` : ''}.csv`;
}
