import { z } from 'zod';
import data from './reference-catalog.json' with { type: 'json' };
export function safeReferenceUrl(value:string):boolean {try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}}
const strings=z.array(z.string().max(3000)).max(20);
const Source=z.object({url:z.string().refine(safeReferenceUrl),title:z.string(),publisher:z.string(),sourceKind:z.string(),limitations:z.string()}).strict();
const Entry=z.object({id:z.string(),title:z.string(),stages:z.array(z.enum(['Awareness','Interest','Desire','Action'])),communicationJob:z.string(),audiencePrerequisites:z.string(),format:z.string(),visualTreatment:z.string(),requiredInputs:strings,evidenceRequirements:strings,missingInputAlternatives:strings,rationale:z.string(),adaptationForEIC:z.string(),claimConstraints:strings,sources:z.array(Source).min(1).max(5),productionStatus:z.literal('reference-only'),evidenceClass:z.literal('external-inspiration'),winnerEligible:z.literal(false)}).strict();
export const REFERENCE_CATALOG=z.array(Entry).length(17).parse(data);
// Ranking is guidance only: all entries remain available at every stage.
export function referencesForStage(stage:string|null){return [...REFERENCE_CATALOG].sort((a,b)=>Number(b.stages.some(s=>s===stage))-Number(a.stages.some(s=>s===stage)));}
