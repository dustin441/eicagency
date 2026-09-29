'use client';
import { useState } from 'react';
import type { Idea } from '../../lib/creative-studio/ideas';
import { safeReferenceUrl } from '../../lib/creative-studio/reference-catalog';
import { confirmDevelopment, developmentBrief, developmentReference, directionKind, updateDevelopment, type Development } from '../../lib/creative-studio/development-brief';
export default function DevelopDirection({idea,onChange}:{idea:Idea;onChange:(idea:Idea)=>void}) {
 const [error,setError]=useState('');
 const id=idea.activeDevelopment!;const r=developmentReference(id);const d=idea.developments![id];const brief=developmentBrief(idea);
 const [sourceDraft,setSourceDraft]=useState(d.sourceUrl);
 const update=(patch:Partial<Development>)=>{try{onChange(updateDevelopment(idea,patch));setError('');}catch{setError('Use a credential-free HTTP(S) source URL and stay within field limits.');}};
 const download=()=>{const url=URL.createObjectURL(new Blob([brief],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`${id}-planning-brief.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return <section aria-label="Develop this direction"><h3>Develop: {r.title}</h3><p>{directionKind(id)} · Planning brief only · no renderer or production approval</p><p>Goal: {idea.goal} · Audience: {idea.audience||'Not supplied'} · Stage: {idea.stageOverride||'See shared recommendation'}</p><p><strong>Proposed, not accepted as EIC fact:</strong> {r.adaptationForEIC}</p>
 <label>Missing inputs: how would you like to proceed?<select aria-label="Missing input option" value={d.route} onChange={e=>update({route:e.target.value as Development['route']})}><option value="enter">Enter information myself</option><option value="saved">Use saved answers — this direction only</option><option value="research">Help me find it — generate research checklist, no live research</option><option value="unsure">Not sure — keep unresolved</option></select></label>
 {d.route==='saved'&&<p>Showing saved answers below. No external source claims are imported or accepted. Empty answers remain unresolved.</p>}{d.route==='research'&&<p>Research checklist included in the preview/download. Web research is not connected; no sources have been fetched.</p>}
 {r.requiredInputs.map((label,n)=><label key={label}>{label}<textarea aria-label={`Direction input ${n+1}`} maxLength={2000} value={d.inputs[n]??''} onChange={e=>update({inputs:d.inputs.map((v,i)=>i===n?e.target.value:v)})}/></label>)}
 <label>Exact EIC claim / next step (user supplied)<textarea aria-label="Direction claim" maxLength={2000} value={d.statement} onChange={e=>update({statement:e.target.value})}/></label>
 <label>Evidence source URL (not fetched)<input aria-label="Direction source URL" maxLength={2000} value={sourceDraft} onChange={e=>{const value=e.target.value;setSourceDraft(value);update({sourceUrl:safeReferenceUrl(value)?value:''});if(value&&!safeReferenceUrl(value))setError('Invalid source URL. Previous confirmation cleared; this URL will not be saved.');}}/></label>
 <label>Review note: exact support, scope, reuse permission<textarea aria-label="Direction review note" maxLength={2000} value={d.reviewNote} onChange={e=>update({reviewNote:e.target.value})}/></label>
 <button className="cs-button cs-secondary" disabled={!d.statement.trim()||!d.sourceUrl||!d.reviewNote.trim()} onClick={()=>{try{onChange(confirmDevelopment(idea));setError('');}catch{setError('Provide a claim, safe source URL and review note first.');}}}>Confirm this claim and source review</button><p>{d.confirmedFingerprint?'User-confirmed only; not independently verified. Editing inputs clears confirmation.':'User-supplied and unconfirmed. Production remains gated.'}</p>{error&&<p role="alert">{error}</p>}
 <details open><summary>Production brief preview · unresolved evidence included</summary><pre style={{whiteSpace:'pre-wrap',fontSize:13}}>{brief}</pre></details><button className="cs-button cs-secondary" onClick={download}>Download planning brief (.txt)</button><button className="cs-text-button" onClick={()=>onChange({...idea,activeDevelopment:undefined})}>Return to editable formats (keep answers)</button>
 </section>;
}
