import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMedibraneBudgetPacing,
  medibraneCurrentMonthWindow,
  MEDIBRANE_OCTOBER_2026_BUDGET_USD,
} from './medibrane-budget-pacing.ts';

test('uses Jerusalem month boundaries for dashboard reads and budget edits', () => {
  assert.deepEqual(medibraneCurrentMonthWindow(new Date('2026-10-31T22:30:00Z')), {
    today: '2026-11-01',
    periodStart: '2026-11-01',
    periodEnd: '2026-11-30',
  });
});

test('combines Meta, Google, and current-month GroundTruth spend in USD', () => {
  const pacing = buildMedibraneBudgetPacing({
    budget: 3000,
    metaSpendIls: 311,
    googleSpendUsd: 500,
    groundTruthCampaigns: [
      { spend: 250, dataStart: '2026-10-01', dataEnd: '2026-10-14' },
      { spend: 999, dataStart: '2026-09-17', dataEnd: '2026-09-30' },
    ],
    monthStart: '2026-10-01',
    monthEnd: '2026-10-20',
    usdIlsRate: 3.11,
  });

  assert.equal(pacing.metaSpendUsd, 100);
  assert.equal(pacing.googleSpendUsd, 500);
  assert.equal(pacing.groundTruthSpendUsd, 250);
  assert.equal(pacing.totalSpend, 850);
  assert.equal(pacing.budget, 3000);
});

test('uses the confirmed October USD 3,000 budget and marks missing GroundTruth data unavailable', () => {
  const pacing = buildMedibraneBudgetPacing({
    metaSpendIls: 0,
    googleSpendUsd: 0,
    groundTruthCampaigns: [{ spend: 400, dataStart: null, dataEnd: null }],
    monthStart: '2026-10-01',
    monthEnd: '2026-10-20',
  });

  assert.equal(pacing.budget, MEDIBRANE_OCTOBER_2026_BUDGET_USD);
  assert.equal(pacing.groundTruthSpendUsd, null);
  assert.equal(pacing.totalSpend, null);
});

test('preserves a real zero when every source has current-month coverage', () => {
  const pacing = buildMedibraneBudgetPacing({
    metaSpendIls: 0,
    googleSpendUsd: 0,
    groundTruthCampaigns: [{ spend: 0, dataStart: '2026-10-01', dataEnd: '2026-10-14' }],
    monthStart: '2026-10-01',
    monthEnd: '2026-10-20',
  });

  assert.equal(pacing.groundTruthSpendUsd, 0);
  assert.equal(pacing.totalSpend, 0);
});

test('does not calculate authoritative pacing when a synced source is unavailable', () => {
  const pacing = buildMedibraneBudgetPacing({
    metaSpendIls: null,
    googleSpendUsd: 50,
    groundTruthCampaigns: [{ spend: 25, dataStart: '2026-10-01', dataEnd: '2026-10-14' }],
    monthStart: '2026-10-01',
    monthEnd: '2026-10-20',
  });

  assert.equal(pacing.metaSpendUsd, null);
  assert.equal(pacing.totalSpend, null);
});

test('does not calculate authoritative pacing from mixed complete and cross-month GroundTruth ranges', () => {
  const pacing = buildMedibraneBudgetPacing({
    metaSpendIls: 311,
    googleSpendUsd: 50,
    groundTruthCampaigns: [
      { spend: 25, dataStart: '2026-10-01', dataEnd: '2026-10-14' },
      { spend: 80, dataStart: '2026-09-17', dataEnd: '2026-10-14' },
    ],
    monthStart: '2026-10-01',
    monthEnd: '2026-10-20',
  });

  assert.equal(pacing.groundTruthSpendUsd, null);
  assert.equal(pacing.totalSpend, null);
});

test('does not carry the October budget into another month', () => {
  const pacing = buildMedibraneBudgetPacing({
    metaSpendIls: 0,
    googleSpendUsd: 0,
    groundTruthCampaigns: [],
    monthStart: '2026-11-01',
    monthEnd: '2026-11-20',
  });

  assert.equal(pacing.budget, null);
  assert.equal(pacing.usdIlsRate, null);
});

test('requires an explicitly configured conversion rate after October', () => {
  const pacing = buildMedibraneBudgetPacing({
    budget: 3000,
    metaSpendIls: 311,
    googleSpendUsd: 50,
    groundTruthCampaigns: [{ spend: 25, dataStart: '2026-11-01', dataEnd: '2026-11-14' }],
    monthStart: '2026-11-01',
    monthEnd: '2026-11-20',
  });

  assert.equal(pacing.metaSpendUsd, null);
  assert.equal(pacing.totalSpend, null);
});

test('rejects an invalid USD/ILS conversion rate', () => {
  assert.throws(() => buildMedibraneBudgetPacing({
    metaSpendIls: 100,
    googleSpendUsd: 0,
    groundTruthCampaigns: [],
    monthStart: '2026-10-01',
    monthEnd: '2026-10-20',
    usdIlsRate: 0,
  }), /conversion rate/);
});
