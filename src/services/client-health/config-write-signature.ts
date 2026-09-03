import 'server-only';

import { createHmac } from 'node:crypto';
import { canonicalEvidenceJson } from './evidence.ts';
import type { NormalizedConfigRevision } from './config-revision.ts';

export type ConfigWriteRequest = {
  revisionId: string;
  revisionHash: string;
  revision: NormalizedConfigRevision['content'];
  activationId: string;
  reviewedCommitSha: string;
  reason: string;
  expectedCurrentActivationId: string | null;
  operatorIdentity: string;
  issuedAtUnixMs: number;
  nonce: string;
};

export function configWritePayload(request: ConfigWriteRequest): Record<string, unknown> {
  return {
    action: 'apply-client-health-config-v1',
    activationId: request.activationId,
    expectedCurrentActivationId: request.expectedCurrentActivationId,
    issuedAtUnixMs: request.issuedAtUnixMs,
    nonce: request.nonce,
    operatorIdentity: request.operatorIdentity,
    reason: request.reason,
    revision: request.revision,
    revisionHash: request.revisionHash,
    revisionId: request.revisionId,
    reviewedCommitSha: request.reviewedCommitSha,
  };
}

export function signConfigWriteRequest(request: ConfigWriteRequest, secretHex: string): string {
  if (!/^[0-9a-f]{64}$/.test(secretHex)) throw new Error('CLIENT_HEALTH_CONFIG_WRITE_SECRET must be exactly 32 lowercase hex bytes');
  if (!Number.isSafeInteger(request.issuedAtUnixMs) || request.issuedAtUnixMs < 1) throw new Error('issuedAtUnixMs must be a positive safe integer');
  return createHmac('sha256', Buffer.from(secretHex, 'hex'))
    .update(canonicalEvidenceJson(configWritePayload(request)))
    .digest('hex');
}
