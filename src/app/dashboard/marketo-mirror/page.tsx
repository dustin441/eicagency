import React from 'react';
import MarketoMirrorComparison from '@/components/MarketoMirrorComparison';
import { fetchPrepassMarketoMirrorComparison, paramsFromSearch } from '@/services/analytics';
import { requireClientAccess } from '@/lib/auth-guard';

export default async function MarketoMirrorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('prepass');
  const params = paramsFromSearch(await searchParams);
  const data = await fetchPrepassMarketoMirrorComparison(params);
  return <MarketoMirrorComparison data={data} />;
}
