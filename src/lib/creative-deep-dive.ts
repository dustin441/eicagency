export type CreativeObjective = 'sales' | 'leads' | 'traffic' | 'engagement' | 'volume';

export type CreativeDeepDiveLeader = {
  id: string;
  name: string;
  imageUrl?: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue?: number;
  engagements?: number;
};

function ctr(leader: CreativeDeepDiveLeader): number {
  return leader.impressions > 0 ? leader.clicks / leader.impressions : 0;
}

function costPerConversion(leader: CreativeDeepDiveLeader): number {
  return leader.conversions > 0 ? leader.spend / leader.conversions : Number.POSITIVE_INFINITY;
}

function roas(leader: CreativeDeepDiveLeader): number {
  return leader.spend > 0 ? (leader.revenue ?? 0) / leader.spend : 0;
}

function costPerEngagement(leader: CreativeDeepDiveLeader): number {
  return (leader.engagements ?? 0) > 0
    ? leader.spend / (leader.engagements ?? 1)
    : Number.POSITIVE_INFINITY;
}

export function selectCreativeLeaders(
  candidates: CreativeDeepDiveLeader[],
  objective: CreativeObjective,
  limit = 3,
): CreativeDeepDiveLeader[] {
  const totalSpend = candidates.reduce((sum, leader) => sum + leader.spend, 0);
  const totalConversions = candidates.reduce((sum, leader) => sum + leader.conversions, 0);
  const totalEngagements = candidates.reduce((sum, leader) => sum + (leader.engagements ?? 0), 0);
  const matureConversionSpend = totalConversions > 0 ? (totalSpend / totalConversions) * 2 : Number.POSITIVE_INFINITY;
  const matureEngagementSpend = totalEngagements > 0 ? (totalSpend / totalEngagements) * 2 : Number.POSITIVE_INFINITY;

  const eligible = candidates.filter((leader) => {
    if (objective === 'traffic') {
      return leader.clicks > 0 && (leader.impressions >= 1_000 || leader.clicks >= 20);
    }
    if (objective === 'engagement') {
      return (leader.engagements ?? 0) >= 10
        || ((leader.engagements ?? 0) > 0 && leader.spend >= matureEngagementSpend);
    }
    return leader.conversions >= 3
      || (leader.conversions > 0 && leader.spend >= matureConversionSpend);
  });

  return [...eligible]
    .sort((a, b) => {
      if (objective === 'sales') {
        return roas(b) - roas(a) || b.conversions - a.conversions || b.spend - a.spend;
      }
      if (objective === 'leads') {
        return costPerConversion(a) - costPerConversion(b) || b.conversions - a.conversions || b.spend - a.spend;
      }
      if (objective === 'volume') {
        return b.conversions - a.conversions || costPerConversion(a) - costPerConversion(b) || b.spend - a.spend;
      }
      if (objective === 'engagement') {
        return costPerEngagement(a) - costPerEngagement(b)
          || (b.engagements ?? 0) - (a.engagements ?? 0)
          || b.spend - a.spend;
      }
      return ctr(b) - ctr(a) || b.clicks - a.clicks || b.spend - a.spend;
    })
    .slice(0, limit);
}
