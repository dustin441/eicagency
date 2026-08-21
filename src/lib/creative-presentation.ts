export function normalizePresentationCopy(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function concisePresentationCopy(value: string, maxChars = 180): string {
  const normalized = normalizePresentationCopy(value);
  if (!normalized || normalized.length <= maxChars) return normalized;

  const firstSentence = normalized.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim();
  if (firstSentence && firstSentence.length <= maxChars) return firstSentence;

  const clipped = normalized.slice(0, Math.max(1, maxChars - 1));
  const wordBoundary = clipped.lastIndexOf(' ');
  const ending = wordBoundary >= Math.floor(maxChars * 0.4)
    ? clipped.slice(0, wordBoundary)
    : clipped;
  return `${ending.trimEnd()}…`;
}

export function safeExternalUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function creativeAnchorId(name: string): string {
  return `ad-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
}

export function creativeDisplayName(name: string, headline?: string): string {
  const normalizedHeadline = normalizePresentationCopy(headline ?? '');
  if (normalizedHeadline) return concisePresentationCopy(normalizedHeadline, 90);

  const normalizedName = normalizePresentationCopy(name)
    .replace(/[_|]+/g, ' ')
    .replace(/\s+-\s+/g, ' · ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalizedName || 'Creative reference';
}