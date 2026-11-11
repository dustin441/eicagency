export type DurolineLead = {
  id: string;
  contactId: string | null;
  name: string;
  stage: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  quality: boolean;
  mmcDealIds: number[];
  matchStatus: 'matched' | 'unmatched' | 'ambiguous';
};

export type DurolineDeal = {
  id: number;
  name: string;
  stage: string;
  stageId: number;
  stageType: string;
  hiddenStage: boolean;
  owner: string | null;
  amount: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  daysInStage: number | null;
  lastActivityAt: string | null;
  highlevelOpportunityId: string | null;
  highlevelContactId: string | null;
  matchStatus: 'matched' | 'unmatched' | 'ambiguous';
  salesState: 'awaiting_contact' | 'contacted' | 'negotiating' | 'won' | 'lost' | 'legacy_qualified' | 'other';
};

export type DurolinePipelineSnapshot = {
  schemaVersion: 1;
  capturedAt: string;
  ghlLocationId: string;
  ghlPipelineId: string;
  mmcOrganizationId: number;
  mmcFunnelId: number;
  leads: DurolineLead[];
  deals: DurolineDeal[];
  qualityStages: string[];
  stageDefinitions: { id: number; name: string; hidden: boolean; type: string; order: number }[];
  warnings: string[];
  entryStage: string | null;
};
