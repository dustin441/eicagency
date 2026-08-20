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
};

export type AdapterFailureCode =
  | 'query_failed'
  | 'partial_query'
  | 'invalid_count'
  | 'count_changed'
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

export type SourceAdapterEvidence = {
  sourceKey: string;
  project: SupabaseProject;
  relation: string;
  retrievedAt: string;
  sourceContractVersion: string;
  requestFingerprint: string;
};

/**
 * `source` and `values` use the engine's exact input types. A successful result can
 * therefore be placed into ClientHealthEngineInput without a source-specific reshape.
 */
export type SourceAdapterResult = {
  source: EngineSourceInput;
  values: ClientHealthValueInputs;
  evidence: SourceAdapterEvidence;
  failure: AdapterFailure | null;
};

export type RatioSourceValues = {
  monthSpend: number | null;
  currentRows: RatioRow[] | null;
  previousRows: RatioRow[] | null;
};
