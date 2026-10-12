import * as ExcelJSImport from 'exceljs';

const ExcelJS = ((ExcelJSImport as unknown as { default?: typeof ExcelJSImport }).default ?? ExcelJSImport);

export type GroundTruthImportCampaign = {
  campaignId: string;
  campaignName: string | null;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  reach: number | null;
  dataStart: string | null;
  dataEnd: string | null;
  source: 'campaign' | 'location';
};

export type GroundTruthImportLocation = {
  campaignId: string;
  campaignName: string | null;
  regionType: 'state' | 'dma' | 'county' | 'zip';
  region: string;
  state: string;
  city: string | null;
  impressions: number;
  clicks: number;
};

export type GroundTruthWorkbookImport = {
  fileName: string;
  formats: string[];
  campaigns: GroundTruthImportCampaign[];
  locations: GroundTruthImportLocation[];
  sourceRows: number;
  warnings: string[];
};

type RowRecord = Record<string, unknown>;
type ParsedRecord = { rowNumber: number; values: RowRecord };

const MAX_WORKBOOK_ROWS = 50_000;
const CAMPAIGN_ID = ['campaign id', 'campaignid'];
const CAMPAIGN_NAME = ['campaign name', 'campaign'];
const IMPRESSIONS = ['impressions', 'impr.'];
const CLICKS = ['clicks'];
const SPEND = ['total spent', 'spend', 'cost'];
const REACH = ['reach'];
const US_STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana',
  IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts',
  MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
};

function normalizedHeader(value: unknown): string {
  return cellText(value).replace(/^\ufeff/, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const cell = value as { text?: unknown; result?: unknown; richText?: Array<{ text?: unknown }> };
    if (cell.text !== undefined) return String(cell.text);
    if (cell.result !== undefined) return String(cell.result);
    if (Array.isArray(cell.richText)) return cell.richText.map(part => String(part.text ?? '')).join('');
  }
  return String(value);
}

function firstValue(row: RowRecord, aliases: string[]): unknown {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, alias)) return row[alias];
  }
  return undefined;
}

function hasAny(row: RowRecord, aliases: string[]): boolean {
  return aliases.some(alias => Object.prototype.hasOwnProperty.call(row, alias));
}

function textValue(value: unknown): string | null {
  const text = cellText(value).trim();
  return text && text !== '--' ? text : null;
}

function requiredText(value: unknown, label: string, context: string): string {
  const parsed = textValue(value);
  if (!parsed) throw new Error(`${context}: ${label} is required.`);
  return parsed;
}

function parsedNumber(value: unknown, integer: boolean): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 && (!integer || Number.isInteger(value)) ? value : null;
  }
  const text = cellText(value).trim();
  if (!text) return null;
  const integerPattern = /^(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)$/;
  const moneyPattern = /^\$?(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d+)?$/;
  if (!(integer ? integerPattern : moneyPattern).test(text)) return null;
  const parsed = Number(text.replace(/[$,]/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 && (!integer || Number.isInteger(parsed)) ? parsed : null;
}

function requiredNumber(value: unknown, label: string, context: string, integer = false): number {
  const parsed = parsedNumber(value, integer);
  if (parsed === null) {
    throw new Error(`${context}: ${label} must be a non-negative${integer ? ' whole' : ''} number.`);
  }
  return parsed;
}

function optionalNumber(value: unknown, label: string, context: string, integer = false): number | null {
  if (value === undefined || value === null || cellText(value).trim() === '') return null;
  return requiredNumber(value, label, context, integer);
}

function exactIsoDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return parsed.toISOString().slice(0, 10) === value;
}

function inferDates(fileName: string): { start: string | null; end: string | null } {
  const dates = fileName.match(/(?:19|20)\d{2}-\d{2}-\d{2}/g) ?? [];
  const [start, end] = dates;
  if (!start || !end || !exactIsoDate(start) || !exactIsoDate(end) || start > end) {
    return { start: null, end: null };
  }
  return { start, end };
}

function zipValue(value: unknown, context: string): string {
  const zip = requiredText(value, 'ZIP code', context);
  if (/^\d{1,5}$/.test(zip)) return zip.padStart(5, '0');
  if (/^\d{5}-\d{4}$/.test(zip)) return zip;
  throw new Error(`${context}: ZIP code must contain five digits or ZIP+4.`);
}

function worksheetRecords(worksheet: ExcelJSImport.Worksheet): ParsedRecord[] {
  if (worksheet.rowCount > MAX_WORKBOOK_ROWS + 1) {
    throw new Error(`${worksheet.name} has more than ${MAX_WORKBOOK_ROWS.toLocaleString()} rows.`);
  }
  const headers = (worksheet.getRow(1).values as unknown[]).map(normalizedHeader);
  const records: ParsedRecord[] = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const values = worksheet.getRow(rowNumber).values as unknown[];
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index]]).filter(([header]) => Boolean(header)));
    if (Object.values(record).some(value => textValue(value))) records.push({ rowNumber, values: record });
  }
  return records;
}

function roundMoney(value: number | null): number | null {
  return value === null ? null : Math.round((value + Number.EPSILON) * 100) / 100;
}

function mergeCampaigns(campaigns: GroundTruthImportCampaign[]): GroundTruthImportCampaign[] {
  const merged = new Map<string, GroundTruthImportCampaign>();
  for (const campaign of campaigns) {
    const existing = merged.get(campaign.campaignId);
    if (!existing) {
      merged.set(campaign.campaignId, campaign);
      continue;
    }
    if (existing.source === campaign.source) {
      throw new Error(`Campaign ${campaign.campaignId} appears in more than one ${campaign.source} report. Upload one complete report per campaign.`);
    }
    const campaignReport = campaign.source === 'campaign' ? campaign : existing;
    const locationReport = campaign.source === 'location' ? campaign : existing;
    if (campaignReport.dataStart && locationReport.dataStart
      && (campaignReport.dataStart !== locationReport.dataStart || campaignReport.dataEnd !== locationReport.dataEnd)) {
      throw new Error(`Campaign ${campaign.campaignId} has campaign and location reports for different date ranges.`);
    }
    merged.set(campaign.campaignId, {
      campaignId: campaign.campaignId,
      campaignName: campaignReport.campaignName ?? locationReport.campaignName,
      spend: campaignReport.spend ?? locationReport.spend,
      impressions: campaignReport.impressions ?? locationReport.impressions,
      clicks: campaignReport.clicks ?? locationReport.clicks,
      reach: campaignReport.reach,
      dataStart: campaignReport.dataStart ?? locationReport.dataStart,
      dataEnd: campaignReport.dataEnd ?? locationReport.dataEnd,
      source: 'campaign',
    });
  }
  return Array.from(merged.values()).map(campaign => ({ ...campaign, spend: roundMoney(campaign.spend) }));
}

export async function parseGroundTruthWorkbook(buffer: Buffer, fileName: string): Promise<GroundTruthWorkbookImport> {
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  await workbook.xlsx.load(arrayBuffer);
  const dates = inferDates(fileName);
  const campaigns: GroundTruthImportCampaign[] = [];
  const locations = new Map<string, GroundTruthImportLocation>();
  const formats = new Set<string>();
  const warnings: string[] = [];
  let sourceRows = 0;

  for (const worksheet of workbook.worksheets) {
    const records = worksheetRecords(worksheet);
    if (!records.length) continue;
    const sample = records[0].values;
    const hasCampaignColumns = hasAny(sample, CAMPAIGN_ID) && hasAny(sample, CAMPAIGN_NAME)
      && hasAny(sample, IMPRESSIONS) && hasAny(sample, CLICKS);
    if (!hasCampaignColumns) continue;

    const hasZip = Object.prototype.hasOwnProperty.call(sample, 'zipcode')
      || Object.prototype.hasOwnProperty.call(sample, 'zip code')
      || Object.prototype.hasOwnProperty.call(sample, 'zip');
    if (hasZip) {
      formats.add('location');
      sourceRows += records.length;
      const campaignTotals = new Map<string, GroundTruthImportCampaign>();
      const stateTotals = new Map<string, GroundTruthImportLocation>();
      const includesSpend = hasAny(sample, SPEND);
      for (const record of records) {
        const row = record.values;
        const context = `${fileName}, ${worksheet.name} row ${record.rowNumber}`;
        const campaignId = requiredText(firstValue(row, CAMPAIGN_ID), 'Campaign ID', context);
        const campaignName = requiredText(firstValue(row, CAMPAIGN_NAME), 'Campaign Name', context);
        const zip = zipValue(row.zipcode ?? row['zip code'] ?? row.zip, context);
        const state = (textValue(row.state) ?? '').toUpperCase();
        const city = textValue(row.city);
        const impressions = requiredNumber(firstValue(row, IMPRESSIONS), 'Impressions', context, true);
        const clicks = requiredNumber(firstValue(row, CLICKS), 'Clicks', context, true);
        const spend = includesSpend ? requiredNumber(firstValue(row, SPEND), 'Total Spent', context) : null;
        const zipKey = `${campaignId}|zip|${zip}|${state}`;
        const existingZip = locations.get(zipKey);
        locations.set(zipKey, {
          campaignId,
          campaignName,
          regionType: 'zip',
          region: zip,
          state,
          city: city ?? existingZip?.city ?? null,
          impressions: (existingZip?.impressions ?? 0) + impressions,
          clicks: (existingZip?.clicks ?? 0) + clicks,
        });
        if (state) {
          const stateKey = `${campaignId}|state|${state}|`;
          const existingState = stateTotals.get(stateKey);
          stateTotals.set(stateKey, {
            campaignId,
            campaignName,
            regionType: 'state',
            region: US_STATE_NAMES[state] ?? state,
            state: '',
            city: null,
            impressions: (existingState?.impressions ?? 0) + impressions,
            clicks: (existingState?.clicks ?? 0) + clicks,
          });
        }
        const existingCampaign = campaignTotals.get(campaignId);
        if (existingCampaign?.campaignName && existingCampaign.campaignName !== campaignName) {
          throw new Error(`${context}: campaign ${campaignId} has conflicting names.`);
        }
        campaignTotals.set(campaignId, {
          campaignId,
          campaignName,
          spend: spend === null ? existingCampaign?.spend ?? null : (existingCampaign?.spend ?? 0) + spend,
          impressions: (existingCampaign?.impressions ?? 0) + impressions,
          clicks: (existingCampaign?.clicks ?? 0) + clicks,
          reach: null,
          dataStart: dates.start,
          dataEnd: dates.end,
          source: 'location',
        });
      }
      stateTotals.forEach((row, key) => locations.set(key, row));
      campaigns.push(...Array.from(campaignTotals.values()).map(campaign => ({ ...campaign, spend: roundMoney(campaign.spend) })));
      continue;
    }

    if (hasAny(sample, SPEND) || hasAny(sample, REACH)) {
      formats.add('campaign');
      sourceRows += records.length;
      const seenCampaigns = new Set<string>();
      for (const record of records) {
        const row = record.values;
        const context = `${fileName}, ${worksheet.name} row ${record.rowNumber}`;
        const campaignId = requiredText(firstValue(row, CAMPAIGN_ID), 'Campaign ID', context);
        if (seenCampaigns.has(campaignId)) {
          throw new Error(`${context}: campaign ${campaignId} appears more than once. Export a campaign summary with one row per campaign.`);
        }
        seenCampaigns.add(campaignId);
        campaigns.push({
          campaignId,
          campaignName: requiredText(firstValue(row, CAMPAIGN_NAME), 'Campaign Name', context),
          spend: roundMoney(optionalNumber(firstValue(row, SPEND), 'Total Spent', context)),
          impressions: requiredNumber(firstValue(row, IMPRESSIONS), 'Impressions', context, true),
          clicks: requiredNumber(firstValue(row, CLICKS), 'Clicks', context, true),
          reach: optionalNumber(firstValue(row, REACH), 'Reach', context, true),
          dataStart: dates.start,
          dataEnd: dates.end,
          source: 'campaign',
        });
      }
    }
  }

  if (!formats.size) {
    throw new Error('No supported GroundTruth report was found. Export a campaign or location report as XLSX without changing its column headers.');
  }
  if (!dates.start || !dates.end) warnings.push('No valid date range was found in the file name. Enter the report dates before importing.');

  return {
    fileName,
    formats: Array.from(formats),
    campaigns: mergeCampaigns(campaigns),
    locations: Array.from(locations.values()),
    sourceRows,
    warnings,
  };
}

export function mergeGroundTruthWorkbookImports(imports: GroundTruthWorkbookImport[]) {
  const campaigns = mergeCampaigns(imports.flatMap(item => item.campaigns));
  const locations = new Map<string, GroundTruthImportLocation>();
  for (const row of imports.flatMap(item => item.locations)) {
    const key = `${row.campaignId}|${row.regionType}|${row.region}|${row.state}`;
    if (locations.has(key)) {
      throw new Error(`Location ${row.region} for campaign ${row.campaignId} appears in more than one workbook. Upload one complete export per campaign.`);
    }
    locations.set(key, row);
  }
  return {
    fileNames: imports.map(item => item.fileName),
    formats: Array.from(new Set(imports.flatMap(item => item.formats))),
    campaigns,
    locations: Array.from(locations.values()),
    sourceRows: imports.reduce((sum, item) => sum + item.sourceRows, 0),
    warnings: Array.from(new Set(imports.flatMap(item => item.warnings))),
  };
}
