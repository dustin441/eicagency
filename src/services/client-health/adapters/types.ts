import type {
  ClientHealthValueInputs,
  EngineSourceInput,
  RatioRow,
} from '../engine.ts';

export type SupabaseProject = 'prepass' | 'eic';

export type InclusiveDateWindow = {
  start: string;
  end: string;
};

/** All clock and window inputs are frozen by the collection run before adapters execute. */
export type AdapterContext = {
  clientKey: string;
  timezone: string;
  retrievedAt: string;
  lastCompleteDate: string;
  windows: {
    month: InclusiveDateWindow;
    current: InclusiveDateWindow;
    previous: InclusiveDateWindow;
  };
  sourceContractVersion: string;
  /** Optional request-scoped cancellation propagated by the refresh orchestrator. */
  signal?: AbortSignal;
};

export type AdapterFailureCode =
  | 'query_failed'
  | 'partial_query'
  | 'invalid_count'
  | 'count_changed'
  | 'source_changed'
  | 'incomplete_page'
  | 'duplicate_key'
  | 'page_order'
  | 'malformed_row'
  | 'max_pages';

export type AdapterFailure = {
  code: AdapterFailureCode;
  /** Sanitized adapter-owned reason. Database/API error messages are never copied here. */
  reason: string;
};

export type SupabaseAdapterEvidence = {
  sourceKey: string;
  provider: 'supabase';
  project: SupabaseProject;
  relation: string;
  retrievedAt: string;
  sourceContractVersion: string;
  requestFingerprint: string;
  selectedRowCount: number | null;
};

export type GoogleSheetsAdapterEvidence = {
  sourceKey: string;
  provider: 'google-sheets';
  spreadsheetId: string;
  range: string;
  valueRenderOption: 'UNFORMATTED_VALUE';
  dateTimeRenderOption: 'FORMATTED_STRING';
  sourceContractVersion: string;
  approvedClientAliasHash: string;
  requestFingerprint: string;
  matchedRowCount: number | null;
};

export type SourceAdapterEvidence = SupabaseAdapterEvidence | GoogleSheetsAdapterEvidence;

/**
 * `source` and `values` use the engine's exact input types. A successful result can
 * therefore be placed into ClientHealthEngineInput without a source-specific reshape.
 */
export type SourceAdapterResult<Evidence extends SourceAdapterEvidence = SourceAdapterEvidence> = {
  source: EngineSourceInput;
  values: ClientHealthValueInputs;
  evidence: Evidence;
  failure: AdapterFailure | null;
};

export type RatioSourceValues = {
  monthSpend: number | null;
  currentRows: RatioRow[] | null;
  previousRows: RatioRow[] | null;
};

/** Sanitized ClickUp task fields accepted by client_health_snapshot_tasks. */
export type ClickUpSnapshotTask = {
  id: string;
  listId: string;
  name: string;
  url: string;
  dueAt: string;
};

export type ClickUpAdapterEvidence = {
  sourceKey: string;
  provider: 'clickup';
  endpointFamily: 'team-time-entries-and-overdue-tasks';
  retrievedAt: string;
  sourceContractVersion: string;
  requestFingerprint: string;
  /** Exact verified entry count. Null whenever collection did not establish it. */
  timeEntryCount: number | null;
  /** Exact verified integer total. Null whenever collection did not succeed. */
  totalDurationMs: string | null;
  /** Exact verified count. Null whenever collection did not succeed. */
  overdueTaskCount: number | null;
};

export type ClickUpAdapterResult = {
  source: EngineSourceInput;
  values: ClientHealthValueInputs;
  tasks: ClickUpSnapshotTask[];
  evidence: ClickUpAdapterEvidence;
  failure: AdapterFailure | null;
};
