import 'server-only';

import {
  createDeterministicClickUpAdapter,
  defineInjectedClickUpContract,
  type ClickUpFilteredTeamTasksRequest,
  type ClickUpFilteredTeamTasksResponse,
  type ClickUpHttpClient,
  type ClickUpTimeEntriesRequest,
  type ClickUpTimeEntriesResponse,
} from './clickup.ts';
import type { AdapterContext, ClickUpAdapterResult } from './types.ts';

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';
const CLICKUP_TEAM_ID = '1229523';
const CLICKUP_TOKEN_ENV = 'CLICKUP_CLIENT_HEALTH_TOKEN';

/** Private production authorization boundary. Values are fixed reviewed ClickUp list IDs. */
const APPROVED_PRODUCTION_CLICKUP_ADAPTERS = Object.freeze({
  prepass: '240062401',
  spartaco: '901407399216',
  nsi: '900900564386',
  durodyne: '901415478138',
  goodgame: '901414768821',
  bridgeway: '901413196484',
  arabella: '901414345904',
  kinsey: '901414385622',
  state48: '900500452322',
  cba: '901400944748',
  bloom: '901414401917',
  champagne: '901417128015',
  ihh: '901418534831',
  aurit: '901424611194',
  medibrane: '901424642458',
} satisfies Readonly<Record<string, string>>);

type ApprovedProductionClickUpKey = keyof typeof APPROVED_PRODUCTION_CLICKUP_ADAPTERS;

function approvedKey(value: string): value is ApprovedProductionClickUpKey {
  return Object.prototype.hasOwnProperty.call(APPROVED_PRODUCTION_CLICKUP_ADAPTERS, value);
}

async function getJson(url: URL, token: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: token },
      ...(signal ? { signal } : {}),
    });
  } catch {
    throw new Error('ClickUp client health request failed');
  }
  if (!response.ok) throw new Error('ClickUp client health request failed');

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('ClickUp client health returned invalid JSON');
  }
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('ClickUp client health returned a malformed response');
  }
  return payload as Record<string, unknown>;
}

function productionClient(token: string): ClickUpHttpClient {
  return {
    teamId: CLICKUP_TEAM_ID,
    async getTeamTimeEntries(request: ClickUpTimeEntriesRequest): Promise<ClickUpTimeEntriesResponse> {
      const query = new URLSearchParams([
        ['start_date', request.startDateMs],
        ['end_date', request.endDateMs],
        ['include_location_names', String(request.includeLocationNames)],
      ]);
      const url = new URL(`${CLICKUP_API_BASE}/team/${CLICKUP_TEAM_ID}/time_entries?${query}`);
      return getJson(url, token, request.signal) as Promise<ClickUpTimeEntriesResponse>;
    },
    async getFilteredTeamTasks(request: ClickUpFilteredTeamTasksRequest): Promise<ClickUpFilteredTeamTasksResponse> {
      const query = new URLSearchParams();
      for (const listId of request.listIds) query.append('list_ids[]', listId);
      query.append('due_date_lt', request.dueDateLtMs);
      query.append('include_closed', String(request.includeClosed));
      query.append('subtasks', String(request.subtasks));
      query.append('order_by', request.orderBy);
      query.append('reverse', String(request.reverse));
      query.append('page', String(request.page));
      const url = new URL(`${CLICKUP_API_BASE}/team/${CLICKUP_TEAM_ID}/task?${query}`);
      return getJson(url, token, request.signal) as Promise<ClickUpFilteredTeamTasksResponse>;
    },
  };
}

/**
 * Builds an inactive-by-default production adapter only for a reviewed key. The caller supplies the
 * active source contract version, which the deterministic adapter verifies against every context.
 */
export function createApprovedProductionClickUpAdapter(
  key: string,
  contractVersion: string,
): (context: AdapterContext) => Promise<ClickUpAdapterResult> {
  if (!approvedKey(key)) throw new Error('Unsupported production ClickUp adapter key');
  const token = process.env[CLICKUP_TOKEN_ENV]?.trim();
  if (!token) throw new Error('ClickUp client health credential is not configured');

  const contract = defineInjectedClickUpContract({
    sourceKey: 'clickup',
    clientKey: key,
    teamId: CLICKUP_TEAM_ID,
    approvedListIds: [APPROVED_PRODUCTION_CLICKUP_ADAPTERS[key]],
    timezone: 'America/Phoenix',
    contractVersion,
  });
  return createDeterministicClickUpAdapter(contract, { client: productionClient(token) });
}
