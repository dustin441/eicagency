import { z } from 'zod';
const text=(max:number)=>z.string().trim().min(1).max(max);
// Receipts describe provenance, not independent verification of a user's words.
export const ClaimSchema=z.object({text:text(72),sourceIds:z.array(text(80)).max(8),status:z.enum(['user-claimed','source-reported','review-confirmed']),reviewNote:z.string().max(280).optional()}).strict().refine(c=>c.status!=='review-confirmed'||(c.sourceIds.length>0&&!!c.reviewNote?.trim()),'Confirmation requires a receipt and review note');
export const ContentSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('note'),body:text(600)}).strict(),
 z.object({kind:z.literal('comparison'),leftHeading:text(32),rightHeading:text(32),rows:z.array(z.object({label:text(36),left:ClaimSchema,right:ClaimSchema}).strict()).min(3).max(5)}).strict(),
]);
// Planning saves allow incomplete text; SceneSchema still requires ContentSchema.
const DraftClaimSchema=z.object({text:z.string().max(72),sourceIds:z.array(text(80)).max(8),status:z.literal('user-claimed'),reviewNote:z.string().max(280).optional()}).strict();
export const DraftContentSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('note'),body:z.string().max(600)}).strict(),
 z.object({kind:z.literal('comparison'),leftHeading:z.string().max(32),rightHeading:z.string().max(32),rows:z.array(z.object({label:z.string().max(36),left:DraftClaimSchema,right:DraftClaimSchema}).strict()).min(3).max(5)}).strict(),
]);
export type CreativeContent=z.infer<typeof ContentSchema>;
export const emptyComparison=():Extract<CreativeContent,{kind:'comparison'}>=>({kind:'comparison',leftHeading:'Current approach',rightHeading:'Proposed approach',rows:Array.from({length:3},()=>({label:'',left:{text:'',sourceIds:[],status:'user-claimed'},right:{text:'',sourceIds:[],status:'user-claimed'}}))});
