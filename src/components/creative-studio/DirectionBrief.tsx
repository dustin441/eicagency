'use client';
import { useEffect, useState } from 'react';
import { DEFAULT_DIRECTION, STYLES, type Direction } from '../../lib/creative-studio/directions';
import type { Project } from '../../lib/creative-studio/model';

export default function DirectionBrief({project, disabled, save, onDirty}: {project?: Project; disabled: boolean; save: (direction: Direction) => void; onDirty: (dirty: boolean) => void}) {
  const latest = project?.directions?.at(-1);
  const [draft, setDraft] = useState<Direction>(latest?.brief ?? DEFAULT_DIRECTION);
  const [opened, setOpened] = useState('');
  const dirty = JSON.stringify(draft) !== JSON.stringify(latest?.brief ?? DEFAULT_DIRECTION);
  useEffect(() => { onDirty(dirty); return () => onDirty(false); }, [dirty, onDirty]);
  const historical = project?.directions?.find(d => d.id === opened);
  const shown = historical?.brief ?? draft;
  const style = historical?.styleSnapshot ?? STYLES.find(s => s.id === shown.styleId)!;
  return <section className="cs-panel cs-controls" aria-label="Direction brief">
    <div className="cs-section-heading"><h2>Reference-backed direction brief</h2><span className="cs-pill">Planning only · Separate from artwork</span></div>
    <p>Choose a visual mechanism, not another template. Saving this brief never changes the existing design or its exports.</p>
    {dirty && <p role="status">Unsaved direction edits — save the direction brief separately.</p>}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12,margin:'20px 0'}}>
      {STYLES.map(s => <button key={s.id} data-style={s.id} aria-pressed={shown.styleId===s.id} disabled={disabled || !!historical} onClick={() => setDraft({...draft,styleId:s.id})} style={{textAlign:'left',padding:16,border:shown.styleId===s.id?'2px solid #0B4A31':'1px solid #d7dfda',borderRadius:10,background:shown.styleId===s.id?'#edf5ef':'white',color:'#152d22'}}><strong>{s.name}</strong><p>{s.job}</p><small>Reference / planning-only</small></button>)}
    </div>
    <h3>{style.name}: production requirements</h3><p>{style.requirements}</p>
    {style.references.map(r => <div key={r.title} className="cs-source"><a href={r.url} target="_blank" rel="noopener noreferrer">{r.title} ↗</a><small> · {r.lane}</small><p>{r.limitation}</p></div>)}
    <fieldset disabled={disabled || !!historical}>
      <div className="cs-adjust-grid"><label>Copy density<select aria-label="Copy density" value={shown.copyDensity} onChange={e=>setDraft({...draft,copyDensity:e.target.value as Direction['copyDensity']})}>{['minimal','balanced','copy-heavy'].map(v=><option key={v}>{v}</option>)}</select></label>
      <label>Subject<select aria-label="Subject" value={shown.subject} onChange={e=>setDraft({...draft,subject:e.target.value as Direction['subject']})}>{['Dustin','Mike','both','neither'].map(v=><option key={v}>{v}</option>)}</select></label></div>
      <label>Direction notes<textarea aria-label="Direction notes" rows={3} maxLength={2000} value={shown.notes} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label>
    </fieldset>
    <div className="cs-save-row"><button className="cs-button cs-primary" disabled={disabled || !!historical} onClick={()=>save(draft)}>Save direction brief</button><button className="cs-button cs-secondary" disabled>Generate selected style — unavailable</button></div>
    <p className="cs-help">{!project?'Save a direction-only project without creating artwork. ':''}No bespoke style renderer is verified. Existing designs below are a separate legacy workflow, not an implementation of this selection.</p>
    <label>Direction history<select aria-label="Direction history" value={opened} onChange={e=>setOpened(e.target.value)}><option value="">Latest editable brief {latest ? `(revision ${latest.revision})` : '(unsaved)'}</option>{project?.directions?.map(d=><option key={d.id} value={d.id}>Saved direction {d.revision} · read only</option>)}</select></label>
    <details><summary>Evidence lanes · No winners established</summary><p><strong>Verified first-party:</strong> No connected own-account results. No ROI or winning style can be established.</p><p><strong>Advertiser-reported:</strong> Unaudited practitioner claims; ineligible for winner selection.</p><p><strong>Publicly-observed:</strong> Craft references and visible executions; results unknown and ineligible for winner selection.</p><p>Only verified results from our own accounts may qualify for future winner evaluation. Eligibility is not proof of winning. References are not licensed assets; borrow principles, not artwork.</p></details>
  </section>;
}
