import assert from 'node:assert/strict';
import {
  concisePresentationCopy,
  creativeDisplayName,
  normalizePresentationCopy,
  safeExternalUrl,
} from '../src/lib/creative-presentation.ts';
import { resolveCreativeTestEvaluationEnd } from '../src/lib/goodgame-creative-evaluation.ts';

assert.equal(normalizePresentationCopy('  Make  this\nclear. '), 'Make this clear.');
assert.equal(
  concisePresentationCopy('Lead with the customer problem. Then explain every supporting detail that follows.', 45),
  'Lead with the customer problem.'
);
assert.equal(concisePresentationCopy('A very long recommendation without punctuation that keeps going', 24), 'A very long…');
assert.equal(creativeDisplayName('MLF_Johnny_Venus'), 'MLF Johnny Venus');
assert.equal(creativeDisplayName('MLF_Johnny_Venus', 'Furniture that survives real life'), 'Furniture that survives real life');
assert.equal(safeExternalUrl('https://example.com/ad/123'), 'https://example.com/ad/123');
assert.equal(safeExternalUrl('javascript:alert(1)'), null);
assert.equal(safeExternalUrl('/relative'), null);
assert.equal(resolveCreativeTestEvaluationEnd('evaluating', null, null, '2026-07-30'), '2026-07-30');
assert.equal(resolveCreativeTestEvaluationEnd('concluded', '2026-07-21T15:00:00Z', null, '2026-07-30'), '2026-07-21');
assert.equal(resolveCreativeTestEvaluationEnd('concluded', null, '2026-07-20', '2026-07-30'), '2026-07-20');
assert.equal(resolveCreativeTestEvaluationEnd('concluded', null, null, '2026-07-30'), null);

console.log('Verified concise creative copy, display labels, and safe external URLs.');