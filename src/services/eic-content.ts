export type EicContentEpisode = {
  id: string;
  title: string;
  status: string;
};

export type EicContentAsset = {
  id: string;
  title: string | null;
  file_name: string | null;
};

export type EicContentPost = {
  id: string;
  episode_id: string;
  asset_id: string | null;
  platform: string;
  status: string;
  post_type: string;
  story_phase: string | null;
  title: string;
  notes: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  copy_doc_url: string | null;
  asset_url: string | null;
  destination_url: string | null;
};

export type EicContentDashboardData = {
  setupRequired?: boolean;
  setupMessage?: string;
  episodes: EicContentEpisode[];
  assets: EicContentAsset[];
  posts: EicContentPost[];
};
