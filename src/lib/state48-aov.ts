export function calculateGoogleAdsAov(revenue: number, purchases: number): number | null {
  return purchases > 0 ? revenue / purchases : null;
}
