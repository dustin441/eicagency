export type MarginSheetValue = {
  marginPercent: number | null;
  sheetHours: number | null;
};

const CLIENT_ALIASES: Record<string, string> = {
  prepass: 'prepass',
  spartaco: 'spartaco',
  'spartaco group': 'spartaco',
  nsi: 'nsi',
  'nsi electrical': 'nsi',
  'nsi direct electrical': 'nsi',
  'nsi data electrical': 'nsi',
  'nsi hvac': 'nsi',
  turfli: 'turfli',
  'fanntastic turfli': 'turfli',
  durodyne: 'durodyne',
  'duro dyne': 'durodyne',
  hvac: 'durodyne',
  goodgame: 'goodgame',
  'good game nappy boy dranks': 'goodgame',
  'nappy boy': 'goodgame',
  bridgeway: 'bridgeway',
  'bridgeway insurance': 'bridgeway',
  arabella: 'arabella',
  'arabella hotels': 'arabella',
  'scott arabella': 'arabella',
  kinsey: 'kinsey',
  'kinsey design': 'kinsey',
  'kinsey designs': 'kinsey',
  'scott kinsey': 'kinsey',
  state48: 'state48',
  'state forty eight': 'state48',
  cba: 'cba',
  'cba glass': 'cba',
  'cba autoglass': 'cba',
  liferep: 'liferep',
  'fanntastic liferep': 'liferep',
  bloom: 'bloom',
  'bloom aesthetics': 'bloom',
  'scott bloom': 'bloom',
  eic: 'eicagency',
  eicagency: 'eicagency',
  'eic agency': 'eicagency',
  champagne: 'champagne',
  'champagne haus': 'champagne',
  'champagne house': 'champagne',
  'scott champagne haus': 'champagne',
  ihh: 'ihh',
  'infinite health': 'ihh',
  'infiniteheart health': 'ihh',
};

function aliasKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function normalizeClientName(value: string): string | null {
  const key = aliasKey(value);
  return CLIENT_ALIASES[key] ?? null;
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && csv[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const normalized = value.replace(/[$,%\s]/g, '').replace(/,/g, '');
  if (!normalized || normalized.startsWith('#')) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseCurrentMarginCsv(csv: string): Map<string, MarginSheetValue> {
  const aggregates = new Map<string, {
    hours: number;
    revenue: number;
    fulfillmentCost: number;
    hasFinancials: boolean;
    fallbackMargin: number | null;
  }>();

  for (const row of parseCsv(csv).slice(1)) {
    const clientId = normalizeClientName(row[0] ?? '');
    if (!clientId) continue;
    const sheetHours = parseNumber(row[3]);
    const revenue = parseNumber(row[1]);
    const fulfillmentCost = parseNumber(row[5]);
    const rawMargin = parseNumber(row[6]);
    const aggregate = aggregates.get(clientId) ?? {
      hours: 0,
      revenue: 0,
      fulfillmentCost: 0,
      hasFinancials: false,
      fallbackMargin: null,
    };

    if (sheetHours && sheetHours > 0) {
      aggregate.hours += sheetHours;
      if (revenue !== null && fulfillmentCost !== null) {
        aggregate.revenue += revenue;
        aggregate.fulfillmentCost += fulfillmentCost;
        aggregate.hasFinancials = true;
      } else if (rawMargin !== null) {
        aggregate.fallbackMargin = rawMargin;
      }
    }
    aggregates.set(clientId, aggregate);
  }

  return new Map(Array.from(aggregates.entries()).map(([clientId, aggregate]) => {
    const marginPercent = aggregate.hasFinancials && aggregate.revenue > 0
      ? ((aggregate.revenue - aggregate.fulfillmentCost) / aggregate.revenue) * 100
      : aggregate.fallbackMargin;
    return [clientId, {
      sheetHours: aggregate.hours > 0 ? aggregate.hours : null,
      marginPercent,
    }];
  }));
}

export async function fetchCurrentMarginSheet(now = new Date()): Promise<Map<string, MarginSheetValue>> {
  const month = now.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const year = String(now.getUTCFullYear()).slice(-2);
  const sheetName = `${month} '${year}`;
  const spreadsheetId = '1w1XOdxRViV5VOx7Ek0e2LGOaK12Gu652gq2WmYAMx9s';
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const response = await fetch(url, { next: { revalidate: 900 } });
  if (!response.ok) throw new Error(`Margin sheet returned ${response.status}`);
  return parseCurrentMarginCsv(await response.text());
}

export type ClickUpClientValue = {
  hoursUsed: number;
  overdueCount: number;
  overdueTasks: { name: string; url: string; dueAt: string | null }[];
};

const CLICKUP_LIST_CLIENTS: Record<string, string> = {
  '240062401': 'prepass',
  '901407399216': 'spartaco',
  '900900564386': 'nsi',
  '901415478138': 'durodyne',
  '901414768821': 'goodgame',
  '901413196484': 'bridgeway',
  '901414345904': 'arabella',
  '901414385622': 'kinsey',
  '900500452322': 'state48',
  '901400944748': 'cba',
  '901414401917': 'bloom',
  '900901846441': 'eicagency',
  '901417128015': 'champagne',
  '901418534831': 'ihh',
};

async function clickUpGet(path: string, token: string): Promise<Record<string, unknown>> {
  const response = await fetch(`https://api.clickup.com/api/v2${path}`, {
    headers: { Authorization: token },
    next: { revalidate: 300 },
  });
  if (!response.ok) throw new Error(`ClickUp returned ${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}

export async function fetchClickUpClientHealth(
  token: string | undefined,
  teamId = '1229523',
  now = new Date(),
): Promise<Map<string, ClickUpClientValue>> {
  if (!token) return new Map();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const baseValue = (): ClickUpClientValue => ({ hoursUsed: 0, overdueCount: 0, overdueTasks: [] });
  const result = new Map<string, ClickUpClientValue>();
  const getValue = (clientId: string) => {
    const value = result.get(clientId) ?? baseValue();
    result.set(clientId, value);
    return value;
  };

  const taskPages: Record<string, unknown>[] = [];
  for (let page = 0; page < 20; page += 1) {
    const query = new URLSearchParams({
      due_date_lt: String(now.getTime()),
      include_closed: 'false',
      subtasks: 'true',
      order_by: 'due_date',
      reverse: 'false',
      page: String(page),
    });
    const payload = await clickUpGet(`/team/${teamId}/task?${query}`, token);
    const tasks = (payload.tasks as Record<string, unknown>[] | undefined) ?? [];
    taskPages.push(...tasks);
    if (payload.last_page === true || tasks.length === 0) break;
  }

  for (const task of taskPages) {
    const listId = String((task.list as { id?: string } | undefined)?.id ?? '');
    const clientId = CLICKUP_LIST_CLIENTS[listId];
    if (!clientId) continue;
    const value = getValue(clientId);
    value.overdueCount += 1;
    if (value.overdueTasks.length < 5) {
      const dueDate = task.due_date ? new Date(Number(task.due_date)).toISOString() : null;
      value.overdueTasks.push({
        name: String(task.name ?? 'Untitled task'),
        url: String(task.url ?? ''),
        dueAt: dueDate,
      });
    }
  }

  const timeQuery = new URLSearchParams({
    start_date: String(monthStart.getTime()),
    end_date: String(now.getTime()),
  });
  const timePayload = await clickUpGet(`/team/${teamId}/time_entries?${timeQuery}`, token);
  const entries = (timePayload.data as Record<string, unknown>[] | undefined) ?? [];
  for (const entry of entries) {
    const listId = String((entry.task_location as { list_id?: string } | undefined)?.list_id ?? '');
    const clientId = CLICKUP_LIST_CLIENTS[listId];
    if (!clientId) continue;
    const duration = Number(entry.duration ?? 0);
    if (Number.isFinite(duration) && duration > 0) getValue(clientId).hoursUsed += duration / 3_600_000;
  }

  return result;
}
