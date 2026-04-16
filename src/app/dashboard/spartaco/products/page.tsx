import React from 'react';
import ProductPerformanceClient from '@/components/ProductPerformanceClient';
import { fetchSpartacoProductData } from '@/services/spartaco-product-analytics';
import { spartacoParamsFromSearch } from '@/services/spartaco-analytics';

export default async function SpartacoProductPerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = spartacoParamsFromSearch(await searchParams);
  const data = await fetchSpartacoProductData(params);
  return <ProductPerformanceClient data={data} />;
}
