'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireAgencyIdentity } from '@/lib/auth-guard';
import { createEicSupabaseClient } from '@/lib/spartaco-supabase-server';
import { normalizeActiveConfigRevision } from '@/services/client-health/config-revision';
import { reviseClientEconomics } from '@/services/client-health/economics-settings';
import { signConfigWriteRequest, type ConfigWriteRequest } from '@/services/client-health/config-write-signature';

export type EconomicsSettingsActionState = { status: 'idle' | 'error' | 'success'; message: string };

function field(form: FormData, name: string): string {
  const value = form.get(name);
  if (typeof value !== 'string' || value !== value.trim() || value.length === 0) throw new Error(`${name} is required`);
  return value;
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

    const { revision, preview } = reviseClientEconomics(active, {
      clientId: field(form, 'clientId'),
      effectiveMonth: `${field(form, 'effectiveMonth')}-01`,
      monthlyRetainer,
      deliveryModel,
      targetMarginPercent,
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
    if (response.error) throw new Error('Client economics update was rejected');

    const committed = await activeRevision();
    if (committed.revision.id !== revision.id || committed.revision.hash !== revision.hash
      || committed.activation.activationId !== request.activationId
      || committed.activation.operatorIdentity !== request.operatorIdentity) {
      throw new Error('Client economics update could not be verified');
    }
    revalidatePath('/dashboard/eicagency/client-health/settings');
    revalidatePath('/dashboard/eicagency/client-health');
    return {
      status: 'success',
      message: `Activated revision ${revision.id.slice(0, 8)} with ${preview.monthlyAllottedHours.toFixed(2)} allotted hours.`,
    };
  } catch (error) {
    const safe = error instanceof Error && /^(Client ID|Effective month|Monthly retainer|Delivery model|Target margin|reason|Reason|Client is not|Client economics settings require|Deployment commit)/.test(error.message)
      ? error.message
      : 'Unable to save Client Health economics. Refresh and try again.';
    return { status: 'error', message: safe };
  }
}
