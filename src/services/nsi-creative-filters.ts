export type GoogleSearchPreviewCopy = {
  headline?: string;
  description?: string;
  headlines?: string[];
  descriptions?: string[];
};

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Dynamic Search Ads arrive without fixed RSA copy in the creative feed.
 * Only ads with at least one usable headline or description should render a preview.
 */
export function hasGoogleSearchPreviewCopy(creative: GoogleSearchPreviewCopy): boolean {
  return (
    hasText(creative.headline) ||
    hasText(creative.description) ||
    (creative.headlines ?? []).some(hasText) ||
    (creative.descriptions ?? []).some(hasText)
  );
}
