import { unstable_cache } from 'next/cache';
import { MetaAdPreviews, GoogleAdPreviews } from '@/components/AdPreviews';
import { fetchFocusData, type FilterParams } from '@/services/analytics';

const load = unstable_cache(
  async (segment: string, start: string, end: string, compStart: string, compEnd: string) => {
    const d = await fetchFocusData(segment, { start, end, compStart, compEnd } as FilterParams);
    return { meta: d.metaCreatives, google: d.googleCreatives };
  },
  ['prepass-v2-creatives'],
  { revalidate: 1800 },
);

// Ad previews with the same cards as V1. Leads, MQL and SQL shown on each ad come from the ad platform's own tracking.
export default async function PrepassSegmentCreatives({ segment, params }: { segment: 'SMB' | 'ABM' | 'FD360'; params: FilterParams }) {
  let data: Awaited<ReturnType<typeof load>> | null = null;
  try {
    data = await load(segment, params.start, params.end, params.compStart, params.compEnd);
  } catch {
    data = null;
  }
  if (!data) return null;
  return (
    <details className="group rounded-2xl border border-gray-100 bg-white shadow-sm">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-gray-950">
        Ad creatives <span className="ml-2 text-xs font-normal text-gray-500">Meta and Google ads, with ad-platform results. Click to open.</span>
      </summary>
      <div className="space-y-6 px-2 pb-4 sm:px-4">
        <MetaAdPreviews creatives={data.meta} advertiserName="PrePass" logoUrl="/prepass-social-logo.jpg" showFunnel />
        <GoogleAdPreviews creatives={data.google} advertiserName="PrePass" />
      </div>
    </details>
  );
}
