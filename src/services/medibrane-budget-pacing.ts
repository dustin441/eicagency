export const MEDIBRANE_OCTOBER_2026_BUDGET_USD = 3000;
// Bank of Israel representative rate published 2026-10-19.
export const MEDIBRANE_OCTOBER_2026_USD_ILS_RATE = 3.11;

type GroundTruthCampaignSpend = {
  spend: number;
  dataStart: string | null;
  dataEnd: string | null;
};

export type MedibraneBudgetPacingInput = {
  budget?: number | null;
  metaSpendIls: number | null;
  googleSpendUsd: number | null;
  groundTruthCampaigns: GroundTruthCampaignSpend[];
  monthStart: string;
  monthEnd: string;
  usdIlsRate?: number | null;
};

export type MedibraneBudgetPacingSummary = {
  budget: number | null;
  totalSpend: number | null;
  metaSpendUsd: number | null;
  metaSpendIls: number | null;
  googleSpendUsd: number | null;
  groundTruthSpendUsd: number | null;
  usdIlsRate: number | null;
  monthStart: string;
  monthEnd: string;
};

export function medibraneCurrentMonthWindow(now = new Date()): {
  today: string;
  periodStart: string;
  periodEnd: string;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const year = Number(value.year);
  const month = Number(value.month);
  const today = `${value.year}-${value.month}-${value.day}`;
  return {
    today,
    periodStart: `${value.year}-${value.month}-01`,
    periodEnd: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10),
  };
}

export function buildMedibraneBudgetPacing({
  budget,
  metaSpendIls,
  googleSpendUsd,
  groundTruthCampaigns,
  monthStart,
  monthEnd,
  usdIlsRate,
}: MedibraneBudgetPacingInput): MedibraneBudgetPacingSummary {
  const effectiveUsdIlsRate = usdIlsRate === undefined
    ? monthStart === '2026-10-01' ? MEDIBRANE_OCTOBER_2026_USD_ILS_RATE : null
    : usdIlsRate;
  if (effectiveUsdIlsRate !== null && (!Number.isFinite(effectiveUsdIlsRate) || effectiveUsdIlsRate <= 0)) {
    throw new Error('MediBraine USD/ILS conversion rate must be greater than zero.');
  }

  const metaSpendUsd = metaSpendIls === null || effectiveUsdIlsRate === null
    ? null
    : metaSpendIls / effectiveUsdIlsRate;
  const groundTruthHasUnknownRange = groundTruthCampaigns.some(row => row.dataStart === null || row.dataEnd === null);
  const overlappingGroundTruth = groundTruthCampaigns
    .filter((row): row is GroundTruthCampaignSpend & { dataStart: string; dataEnd: string } => row.dataStart !== null && row.dataEnd !== null)
    .filter(row => row.dataEnd >= monthStart && row.dataStart <= monthEnd);
  const groundTruthHasCrossMonthRange = overlappingGroundTruth.some(row => row.dataStart < monthStart || row.dataEnd > monthEnd);
  const groundTruthSpendUsd = !groundTruthHasUnknownRange && !groundTruthHasCrossMonthRange && overlappingGroundTruth.length
    ? overlappingGroundTruth.reduce((sum, row) => sum + row.spend, 0)
    : null;
  const totalSpend = metaSpendUsd === null || googleSpendUsd === null || groundTruthSpendUsd === null
    ? null
    : metaSpendUsd + googleSpendUsd + groundTruthSpendUsd;

  return {
    budget: budget ?? (monthStart === '2026-10-01' ? MEDIBRANE_OCTOBER_2026_BUDGET_USD : null),
    totalSpend,
    metaSpendUsd,
    metaSpendIls,
    googleSpendUsd,
    groundTruthSpendUsd,
    usdIlsRate: effectiveUsdIlsRate,
    monthStart,
    monthEnd,
  };
}
