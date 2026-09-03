'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireAgencyIdentity } from '@/lib/auth-guard';
import { createEicSupabaseClient } from '@/lib/spartaco-supabase-server';
import { normalizeActiveConfigRevision } from '@/services/client-health/config-revision';
import {
  reviseClientPortfolioSettings,
  type ClientPortfolioLaneEdit,
} from '@/services/client-health/portfolio-settings';
import { signConfigWriteRequest, type ConfigWriteRequest } from '@/services/client-health/config-write-signature';

export type EconomicsSettingsActionState = { status: 'idle' | 'error' | 'success'; message: string };

function field(form: FormData, name: string): string {
  const value = form.get(name);
  if (typeof value !== 'string' || value !== value.trim() || value.length === 0) throw new Error(`${name} is required`);
  return value;
}

function optionalNumber(form: FormData, name: string): number | null {
  const value = form.get(name);
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || value !== value.trim()) throw new Error(`${name} is invalid`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} is invalid`);
  return parsed;
}

function boundedInteger(form: FormData, name: string, maximum: number): number {
  const parsed = Number(field(form, name));
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > maximum) throw new Error(`${name} is invalid`);
  return parsed;
}

function laneEdits(form: FormData): ClientPortfolioLaneEdit[] {
  const count = boundedInteger(form, 'northStarLaneCount', 4);
  return Array.from({ length: count }, (_, index) => {
    const prefix = `northStarLane${index}`;
    const formula = field(form, `${prefix}Formula`);
    const evaluation = field(form, `${prefix}Evaluation`);
    const direction = field(form, `${prefix}Direction`);
    if (formula !== 'cost_per_result' && formula !== 'roas') throw new Error('North Star formula is invalid');
    if (evaluation !== 'period_over_period_change' && evaluation !== 'absolute_target') throw new Error('North Star evaluation is invalid');
    if (direction !== 'lower_is_better' && direction !== 'higher_is_better') throw new Error('North Star direction is invalid');
    return {
      key: field(form, `${prefix}Key`),
      label: field(form, `${prefix}Label`),
      formula,
      evaluation,
      required: form.get(`${prefix}Required`) === 'true',
      weight: Number(field(form, `${prefix}Weight`)),
      direction,
      greenThreshold: Number(field(form, `${prefix}GreenThreshold`)),
      yellowThreshold: Number(field(form, `${prefix}YellowThreshold`)),
    };
  });
}

async function activeRevision() {
  const db = createEicSupabaseClient();
  const response = await db.rpc('client_health_get_active_config_revision');
  if (response.error) throw new Error('Active Client Health configuration is unavailable');
  return normalizeActiveConfigRevision(response.data);
}

export async function saveClientEconomicsSettings(
  _previous: EconomicsSettingsActionState,
  form: FormData,
): Promise<EconomicsSettingsActionState> {
  try {
    const identity = await requireAgencyIdentity();
    const active = await activeRevision();
    const deliveryModel = field(form, 'deliveryModel');
    if (deliveryModel !== 'custom' && deliveryModel !== 'platform') throw new Error('Delivery model is invalid');
    const monthlyRetainer = Number(field(form, 'monthlyRetainer'));
    const targetMarginPercent = Number(field(form, 'targetMarginPercent'));
    const reason = field(form, 'reason');
    if (reason.length > 1024) throw new Error('Reason must be at most 1,024 characters');

    const { revision, preview } = reviseClientPortfolioSettings(active, {
      clientId: field(form, 'clientId'),
      effectiveMonth: `${field(form, 'effectiveMonth')}-01`,
      monthlyRetainer,
      deliveryModel,
      targetMarginPercent,
      monthlyBudget: optionalNumber(form, 'monthlyBudget'),
      northStarLanes: laneEdits(form),
    });
    const reviewedCommitSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim() ?? '';
    if (!/^[0-9a-f]{40}$/.test(reviewedCommitSha)) throw new Error('Deployment commit identity is unavailable');
    const secret = process.env.CLIENT_HEALTH_CONFIG_WRITE_SECRET?.trim() ?? '';
    const request: ConfigWriteRequest = {
      revisionId: revision.id,
      revisionHash: revision.hash,
      revision: revision.content,
      activationId: randomUUID(),
      reviewedCommitSha,
      reason,
      expectedCurrentActivationId: active.activation.activationId,
      operatorIdentity: `prepass-auth:${identity.userId}`,
      issuedAtUnixMs: Date.now(),
      nonce: randomUUID(),
    };
    const signature = signConfigWriteRequest(request, secret);
    const db = createEicSupabaseClient();
    const response = await db.rpc('client_health_apply_config_revision', {
      p_revision_id: request.revisionId,
      p_revision_hash: request.revisionHash,
      p_revision: request.revision,
      p_activation_id: request.activationId,
      p_reviewed_commit_sha: request.reviewedCommitSha,
      p_reason: request.reason,
      p_expected_current_activation_id: request.expectedCurrentActivationId,
      p_operator_identity: request.operatorIdentity,
      p_issued_at_unix_ms: request.issuedAtUnixMs,
      p_nonce: request.nonce,
      p_signature: signature,
    });
    if (response.error) throw new Error('Client portfolio settings update was rejected');

    const committed = await activeRevision();
    if (committed.revision.id !== revision.id || committed.revision.hash !== revision.hash
      || committed.activation.activationId !== request.activationId
      || committed.activation.operatorIdentity !== request.operatorIdentity) {
      throw new Error('Client portfolio settings update could not be verified');
    }
    revalidatePath('/dashboard/eicagency/client-health/settings');
    revalidatePath('/dashboard/eicagency/client-health');
    return {
      status: 'success',
      message: `Activated revision ${revision.id.slice(0, 8)} with ${preview.monthlyAllottedHours.toFixed(2)} allotted hours and ${preview.northStarLanes.length} North Star lane${preview.northStarLanes.length === 1 ? '' : 's'}.`,
    };
  } catch (error) {
    const safe = error instanceof Error && /^(Client ID|Effective month|Monthly retainer|Monthly budget|Delivery model|Target margin|North Star|northStar|reason|Reason|Client is not|Client portfolio settings require|Configuration-required|Approved clients require|Deployment commit)/.test(error.message)
      ? error.message
      : 'Unable to save Client Health settings. Refresh and try again.';
    return { status: 'error', message: safe };
  }
}
