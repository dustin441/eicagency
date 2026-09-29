import { z } from 'zod';
import { IdeaSchema } from './ideas.ts';

export const EVIDENCE_LANES = ['verified-first-party', 'advertiser-reported', 'publicly-observed'] as const;
export type EvidenceLane = typeof EVIDENCE_LANES[number];
// Eligibility is not a winner designation. No first-party evidence is ingested in this slice.
export function winnerEligible(evidence: { lane: EvidenceLane; ownedAccount: boolean; verifiedResults: boolean }) {
  return evidence.lane === 'verified-first-party' && evidence.ownedAccount === true && evidence.verifiedResults === true;
}
export const STYLE_IDS = ['conceptual-photography', 'people-founder-led', 'product-process-demo', 'expressive-typography', 'illustration-visual-metaphor', 'collage-mixed-media', 'editorial-annotated', 'proof-comparison', 'native-lo-fi'] as const;
export const DirectionSchema = z.object({
  idea: IdeaSchema.optional(),
  styleId: z.enum(STYLE_IDS),
  copyDensity: z.enum(['minimal', 'balanced', 'copy-heavy']).default('minimal'),
  subject: z.enum(['Dustin', 'Mike', 'both', 'neither']).default('neither'),
  notes: z.string().trim().max(2000).default(''),
}).strict();
export type Direction = z.infer<typeof DirectionSchema>;
export type Style = { id: typeof STYLE_IDS[number]; name: string; job: string; requirements: string; support: 'planning-only'; references: { title: string; url: string; lane: EvidenceLane; limitation: string }[] };
const ref = (title: string, url: string, limitation = 'Public craft reference; results unknown. No reuse license or EIC performance evidence.', lane: EvidenceLane = 'publicly-observed') => ({title, url, limitation, lane});
const motion = 'https://motionapp.com/blog/static-ads-creative-strategy';
export const STYLES: readonly Style[] = [
  {id:'conceptual-photography',name:'Conceptual photography',job:'Make an intangible promise tangible through one surprising visual idea.',requirements:'Original directed shoot, approved props and bespoke composition.',support:'planning-only',references:[ref('COLLINS / Mailchimp — unexpected natural world','https://wearecollins.com/case-studies/mailchimp/')]},
  {id:'people-founder-led',name:'People / founder-led',job:'Show the accountable humans behind the work.',requirements:'Consenting subject, approved original photography, lighting and pose direction. Selecting a name does not supply an asset.',support:'planning-only',references:[ref('JKR / Burger King — directed uniform portraits','https://www.jkrglobal.com/work/burger-king')]},
  {id:'product-process-demo',name:'Product / process demo',job:'Demonstrate the actual deliverable rather than describe it.',requirements:'Real approved interface or process artifact, sensitive data removed, bespoke layout.',support:'planning-only',references:[ref('Motion product demonstration teardown',motion,'Critique, not a winner: the source criticizes the over-curated laptop treatment. Results unknown.')]},
  {id:'expressive-typography',name:'Expressive typography',job:'Let letterform, scale and rhythm communicate the idea.',requirements:'Original type composition, licensed fonts and feed-size legibility review.',support:'planning-only',references:[ref('JKR / Burger King — escalating M billboard','https://www.jkrglobal.com/work/burger-king')]},
  {id:'illustration-visual-metaphor',name:'Illustration / visual metaphor',job:'Explain a relationship through an original visual symbol.',requirements:'Commissioned original illustration, clear metaphor and verified renderer.',support:'planning-only',references:[ref('COLLINS / Dropbox — co-creation illustration','https://wearecollins.com/case-studies/dropbox/')]},
  {id:'collage-mixed-media',name:'Collage / mixed media',job:'Combine artifacts into one coherent argument, not decoration.',requirements:'Rights-cleared original materials, strong silhouette and bespoke art direction.',support:'planning-only',references:[ref('COLLINS / Dropbox — mixed-media creature','https://wearecollins.com/case-studies/dropbox/')]},
  {id:'editorial-annotated',name:'Editorial / annotated',job:'Guide the eye through a specific teardown or insight.',requirements:'Approved artifact, truthful annotations and a clear reading order.',support:'planning-only',references:[ref('Pentagram / Hamlet — controlled disorder','https://www.pentagram.com/work/shakespeare-in-the-park-2023/story','Adjacent craft reference for annotation and hierarchy, not a verified EIC editorial ad. Results unknown.')]},
  {id:'proof-comparison',name:'Proof / comparison',job:'Show a verifiable relationship between work and result.',requirements:'Approved authentic proof, comparable definitions and substantiated claims; no fabricated metrics.',support:'planning-only',references:[ref('Harry Dry / Shot on iPhone — visual demonstration','https://marketingexamples.com/copywriting/adjectives','Practitioner reproduction of a visual demonstration; no independent campaign results or reuse license.')]},
  {id:'native-lo-fi',name:'Native / lo-fi',job:'Communicate directly with deliberately unpolished, context-native execution.',requirements:'Original platform-native capture and a specific creative brief; bespoke renderer remains unavailable.',support:'planning-only',references:[ref('Motion / Obvi — polished and lo-fi diversity',motion,'Practitioner guidance, not a inspected native execution or performance proof.'),ref('Jess Bachman / FireTeam — dense-ad counterexample','https://motionapp.com/blog/ad-creative-inspiration-for-2024','Practitioner-reported outcome, unaudited; counterexample to universal minimalism, not an EIC winner.','advertiser-reported')]},
];
export type SavedDirection = { id: string; revision: number; createdAt: string; createdBy: string; brief: Direction; styleSnapshot: Style };
export const DEFAULT_DIRECTION: Direction = {styleId:'conceptual-photography',copyDensity:'minimal',subject:'neither',notes:''};
