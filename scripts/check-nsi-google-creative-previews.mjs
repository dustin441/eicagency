import assert from 'node:assert/strict';
import { hasGoogleSearchPreviewCopy } from '../src/services/nsi-creative-filters.ts';

assert.equal(
  hasGoogleSearchPreviewCopy({ headlines: [], descriptions: [], headline: '', description: '' }),
  false,
  'DSA/no-copy rows must not render a Google ad preview'
);
assert.equal(
  hasGoogleSearchPreviewCopy({ headlines: ['   '], descriptions: [''], headline: ' ', description: '' }),
  false,
  'Whitespace-only copy must not render a preview'
);
assert.equal(
  hasGoogleSearchPreviewCopy({ headlines: ['A useful headline'], descriptions: [] }),
  true,
  'Ads with headline copy must remain eligible for preview'
);
assert.equal(
  hasGoogleSearchPreviewCopy({ headlines: [], descriptions: ['A useful description'] }),
  true,
  'Ads with description copy must remain eligible for preview'
);

console.log('NSI Google creative preview filter: PASS');
