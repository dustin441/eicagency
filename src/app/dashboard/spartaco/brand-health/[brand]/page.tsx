import { notFound } from 'next/navigation';
import SpartacoBrandHealthClient from '@/components/SpartacoBrandHealthClient';
import { requireClientAccess } from '@/lib/auth-guard';
import {
  fetchCachedSpartacoBrandHealth,
  SPARTACO_HEALTH_BRANDS,
  type SpartacoHealthBrand,
} from '@/services/spartaco-brand-health';

function brandFromSlug(slug: string): SpartacoHealthBrand | null {
  return SPARTACO_HEALTH_BRANDS.find(brand => brand.toLowerCase() === slug.toLowerCase()) ?? null;
}

export default async function SpartacoBrandHealthBrandPage({
  params,
}: {
  params: Promise<{ brand: string }>;
}) {
  await requireClientAccess('spartaco');
  const { brand: slug } = await params;
  const brand = brandFromSlug(slug);
  if (!brand) notFound();

  const data = await fetchCachedSpartacoBrandHealth();
  return <SpartacoBrandHealthClient data={data} selectedBrand={brand} />;
}