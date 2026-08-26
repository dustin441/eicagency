export type DashboardWorkbookData = object;

type WorkbookScalar = string | number | boolean | null;
type WorkbookRow = Record<string, WorkbookScalar>;

const FORMULA_PREFIX = /^[=+\-@]/;
const INVALID_SHEET_NAME = /[\\/?*:[\]]/g;
const CURRENCY_KEY = /(^|_)(cost|spend|revenue|cpc|cpl|cpa|cps|aov|price|budget|value|amount)(_|$)/i;
const PERCENT_KEY = /(^|_)(ctr|rate|percent|percentage|share)(_|$)/i;
const ROAS_KEY = /(^|_)roas(_|$)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function workbookValue(value: unknown): WorkbookScalar {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return JSON.stringify(value);
}

function flattenRecord(record: Record<string, unknown>): WorkbookRow {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, workbookValue(value)]));
}

function rowsForModule(value: unknown): WorkbookRow[] {
  if (Array.isArray(value)) {
    if (value.length === 0) return [{ status: 'No data for the selected filters' }];
    return value.map(item => (isRecord(item) ? flattenRecord(item) : { value: workbookValue(item) }));
  }

  if (isRecord(value)) {
    const groupedRows = Object.entries(value).flatMap(([group, groupValue]) => {
      if (!Array.isArray(groupValue)) return [];
      return groupValue.map(item => ({
        group,
        ...(isRecord(item) ? flattenRecord(item) : { value: workbookValue(item) }),
      }));
    });
    if (groupedRows.length > 0 && Object.values(value).every(Array.isArray)) return groupedRows;
    return [flattenRecord(value)];
  }

  return [{ value: workbookValue(value) }];
}

function humanize(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
    .trim();
}

function sheetName(module: string, used: Set<string>): string {
  const base = (humanize(module).replace(INVALID_SHEET_NAME, ' ').replace(/\s+/g, ' ').trim() || 'Data').slice(0, 31);
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate.toLowerCase())) {
    const ending = ` ${suffix++}`;
    candidate = `${base.slice(0, 31 - ending.length)}${ending}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function workbookFilters(data: DashboardWorkbookData): Record<string, WorkbookScalar> {
  const record = data as Record<string, unknown>;
  const candidate = record.filterParams ?? record.params ?? record.filters;
  if (!isRecord(candidate)) return {};
  return Object.fromEntries(Object.entries(candidate).map(([key, value]) => [key, workbookValue(value)]));
}

function columnNumberFormat(key: string): string | undefined {
  if (ROAS_KEY.test(key)) return '0.00"x"';
  if (PERCENT_KEY.test(key)) return '0.0%';
  if (CURRENCY_KEY.test(key)) return '$#,##0.00';
  return undefined;
}

export async function buildDashboardWorkbook(data: DashboardWorkbookData, title: string) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EIC Analytics';
  workbook.company = 'EIC Agency';
  workbook.title = title;
  workbook.subject = 'Filtered dashboard data by module';
  workbook.created = new Date();

  const usedNames = new Set<string>();
  const filters = workbookFilters(data);
  if (Object.keys(filters).length > 0) {
    const worksheet = workbook.addWorksheet(sheetName('Filters', usedNames), {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    worksheet.columns = [
      { key: 'filter', header: 'Filter', width: 24 },
      { key: 'value', header: 'Selected Value', width: 32 },
    ];
    for (const [key, value] of Object.entries(filters)) worksheet.addRow({ filter: humanize(key), value });
    styleWorksheet(worksheet, ['filter', 'value']);
  }

  const record = data as Record<string, unknown>;
  const filterModules = new Set(['filters', 'filterParams', 'params']);
  for (const [module, value] of Object.entries(record)) {
    if (filterModules.has(module)) continue;
    const rows = rowsForModule(value);
    const keys = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
    const worksheet = workbook.addWorksheet(sheetName(module, usedNames), {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    worksheet.columns = keys.map(key => ({ key, header: humanize(key), width: 14 }));
    worksheet.addRows(rows);
    styleWorksheet(worksheet, keys);
  }

  if (workbook.worksheets.length === 0) {
    const worksheet = workbook.addWorksheet('Data');
    worksheet.addRow(['No data for the selected filters']);
  }

  return workbook;
}

function styleWorksheet(
  worksheet: import('exceljs').Worksheet,
  keys: string[],
): void {
  const header = worksheet.getRow(1);
  header.height = 24;
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B4A31' } };
  header.alignment = { vertical: 'middle', horizontal: 'left' };

  if (keys.length > 0) {
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, worksheet.rowCount), column: keys.length },
    };
  }

  keys.forEach((key, index) => {
    const column = worksheet.getColumn(index + 1);
    let longest = humanize(key).length;
    column.eachCell({ includeEmpty: false }, cell => {
      const length = cell.value === null || cell.value === undefined ? 0 : String(cell.value).length;
      longest = Math.max(longest, length);
    });
    column.width = Math.min(45, Math.max(12, longest + 2));
    const numFmt = columnNumberFormat(key);
    if (numFmt) column.numFmt = numFmt;
  });

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    row.alignment = { vertical: 'top', wrapText: true };
    if (rowNumber % 2 === 0) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7F6' } };
    }
  }
}

export function dashboardXlsxFilename(title: string, filters?: Record<string, unknown>): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'dashboard-data';
  const start = typeof filters?.start === 'string' ? filters.start : null;
  const end = typeof filters?.end === 'string' ? filters.end : null;
  return `${slug}${start && end ? `_${start}_to_${end}` : ''}.xlsx`;
}
