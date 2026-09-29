'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpRight, Check, ChevronRight, FileText, Layers, Plus, ShieldCheck } from 'lucide-react';
import { CONCEPTS, sceneForConcept, conceptPackCompatible, BriefSchema, SceneSchema, DEFAULT_BRIEF, DEFAULT_SCENE, PLACEMENTS, PACK_IDS, PACKS, getPack, REQUIRED_SOURCE_IDS, STAGES, bucketFor, canApprove, type Brief, type Project, type Ratio, type Scene, type StudioState, type Version } from '../../lib/creative-studio/model';
import { sourcesForConcept, SOURCE_WARNINGS } from '../../lib/creative-studio/sources';
import { getVersionPack, placementFor, type Placement } from '../../lib/creative-studio/model';
import './studio.css';
import DirectionBrief from './DirectionBrief';
import IdeaBuilder from './IdeaBuilder';
import { DEFAULT_DIRECTION } from '../../lib/creative-studio/directions';
import { FORMATS, ideaScene, ideaBrief } from '../../lib/creative-studio/ideas';

const API = '/api/creative-studio';
const SELECTION_KEY = 'eic-creative-studio-selection';
const stageNotes = { Awareness: 'Problem recognition', Interest: 'Education', Desire: 'Social proof', Action: 'Offer + next step' };
function artifactUrl(projectId: string, versionId: string, ratio: Ratio, format: 'html' | 'png') {
  return `${API}?${new URLSearchParams({ projectId, versionId, ratio, format })}`;
}
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : `Request failed (${response.status}). Please retry.`);
  if (!data) throw new Error('The server returned an empty response. Please retry.');
  return data as T;
}
function Preview({ projectId, versionId, ratio, placement }: { projectId: string; versionId: string; ratio: Ratio; placement:Placement }) {
  const host = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(entry.contentRect.width / placement.width, 620 / placement.height, 1)));
    observer.observe(node);
    return () => observer.disconnect();
  }, [placement]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(artifactUrl(projectId, versionId, ratio, 'html'), { signal: controller.signal, cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error(`Preview unavailable (${response.status}).`); return response.text(); })
      .then(setHtml).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Preview unavailable.'); });
    return () => controller.abort();
  }, [projectId, versionId, ratio, retry]);
  return <div className="cs-preview-host" ref={host}>
    {error ? <div className="cs-empty" role="alert"><p>{error}</p><button onClick={() => { setError(''); setHtml(''); setRetry(n => n + 1); }}>Retry preview</button></div> : !html ? <div className="cs-empty" role="status">Loading saved artwork…</div> :
      <div className="cs-artwork" style={{ width: placement.width * scale, height: placement.height * scale }}>
        <iframe title={`${placement.name} saved version preview`} sandbox="" srcDoc={html} style={{ width: placement.width, height: placement.height, transform: `scale(${scale})` }} />
      </div>}
  </div>;
}

export default function CreativeStudio({ mode = 'local-review' }: { mode?: 'local-review' | 'hosted-private-beta' }) {
  const hosted = mode === 'hosted-private-beta';
  const packEnabled = (id: Brief['pack']) => !hosted || PACKS[id].placements.every(r => PLACEMENTS[r].mimeType === 'image/png');
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [versionId, setVersionId] = useState('');
  const [ratio, setRatio] = useState<Ratio>('1:1');
  const [brief, setBrief] = useState<Brief>({ ...DEFAULT_BRIEF, sourceIds: [...DEFAULT_BRIEF.sourceIds] });
  const [scene, setScene] = useState<Scene>({ ...DEFAULT_SCENE });
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [newDraftTouched, setNewDraftTouched] = useState(false);
  const [directionDirty, setDirectionDirty] = useState(false);
  const [ideaDirty, setIdeaDirty] = useState(false);
  const [ideaPlanningOnly, setIdeaPlanningOnly] = useState(false);
  const mutationLock = useRef(false);
  const project = projects.find(p => p.id === projectId);
  const version = project?.versions.find(v => v.id === versionId);
  const normalizedSavedBrief = version ? { ...version.brief, pack: version.brief.pack || 'meta-images' } : undefined;
  const dirty = version ? (JSON.stringify(brief) !== JSON.stringify(normalizedSavedBrief) || JSON.stringify(scene) !== JSON.stringify(version.scene)) : newDraftTouched;
  const ready = packEnabled(brief.pack) && !ideaPlanningOnly && BriefSchema.safeParse(brief).success && SceneSchema.safeParse(scene).success && (brief.stage === 'Action' || ['founder-note','editable-note-v2','benefit-comparison-v2'].includes(scene.template)) && conceptPackCompatible(scene,brief);
  const historical = !!version && project?.versions.at(-1)?.id !== version.id;
  const frozen = loading || loadFailed || !!busy;
  const editFrozen = frozen || historical;
  const pack = version?getVersionPack(version):getPack(brief);
  const spec=(r:Ratio)=>version?placementFor(version,r):PLACEMENTS[r];
  const placements = pack.placements;
  const displayRatio = placements.includes(ratio) ? ratio : placements[0];
  const SOURCES = sourcesForConcept(scene.template);
  const savedSources = historical ? version?.sourceSnapshot?.sources || [] : SOURCES;
  const savedWarnings = historical ? version?.sourceSnapshot?.warnings || ['No recorded source snapshot exists for this legacy version. Current notes must not be treated as historical evidence.'] : SOURCE_WARNINGS;
  const sourceChanged = !!version && JSON.stringify(version.sourceSnapshot??null)!==JSON.stringify({sources:SOURCES,warnings:SOURCE_WARNINGS});
  const approvalReady = !!version && !historical && !dirty && canApprove(version.exports, version.reviews, placements) && acknowledged;
  const select = useCallback((p: Project, v?: Version, r?: Ratio) => {
    setNewDraftTouched(false);
    if (!v) { setProjectId(p.id); setVersionId(''); setBrief(p.planningBrief ?? DEFAULT_BRIEF); setScene(DEFAULT_SCENE); setAcknowledged(false); setRatio('1:1'); return; }
    setProjectId(p.id); setVersionId(v.id); setBrief({ ...v.brief, pack: v.brief.pack || 'meta-images' }); setScene(v.scene); setAcknowledged(false);
    const allowed = getVersionPack(v).placements;
    setRatio(r && allowed.includes(r) ? r : allowed[0]);
  }, []);
  const load = useCallback(async () => {
    setLoading(true); setError(''); setLoadFailed(false);
    try {
      const data = await request<StudioState>(API);
      if (data.mode !== mode || !Array.isArray(data.projects)) throw new Error('Unexpected Studio mode. Editing is disabled.');
      setProjects(data.projects);
      let stored: { projectId?: string; versionId?: string; ratio?: Ratio } = {};
      try { stored = JSON.parse(localStorage.getItem(SELECTION_KEY) || '{}') || {}; } catch { /* Optional selection storage. */ }
      const p = data.projects.find(p => p.id === stored.projectId) || data.projects[0];
      if (p) { const v = p.versions.find(v => v.id === stored.versionId) || p.versions.at(-1); select(p, v, stored.ratio); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load projects.'); setLoadFailed(true); }
    finally { setLoading(false); }
  }, [select, mode]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (loading || !projectId) return;
    try { localStorage.setItem(SELECTION_KEY, JSON.stringify({ projectId, versionId, ratio: displayRatio })); } catch { /* Optional storage. */ }
  }, [projectId, versionId, displayRatio, loading]);
  useLayoutEffect(() => {
    if (loading || (!dirty && !directionDirty && !ideaDirty)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, directionDirty, ideaDirty, loading]);
  function updateBrief<K extends keyof Brief>(key: K, value: Brief[K]) { setBrief(b => ({ ...b, [key]: value })); setAcknowledged(false); if(!version)setNewDraftTouched(true); }
  function updateScene<K extends keyof Scene>(key: K, value: Scene[K]) { setScene(s => ({ ...s, [key]: value })); setAcknowledged(false); if(!version)setNewDraftTouched(true); }
  function mayLeave() { return (!dirty && !directionDirty && !ideaDirty) || window.confirm('Discard unsaved edits? These edits have not been saved.'); }
  function newProject(copy = false) {
    if (!mayLeave()) return;
    setNewDraftTouched(copy);
    setProjectId(''); setVersionId(''); setAcknowledged(false); setError('');
    if (!copy) { setRatio('1:1'); setBrief({ ...DEFAULT_BRIEF, sourceIds: [...DEFAULT_BRIEF.sourceIds] }); setScene({ ...DEFAULT_SCENE }); }
    else { setBrief(b => ({ ...b, title: `${b.title.slice(0, 86)} (copy)` })); }
    setNotice(copy ? 'Copied into an unsaved new project. Current source notes apply; approvals do not carry over.' : 'New brief ready. Compose a draft to save it.');
    try { localStorage.removeItem(SELECTION_KEY); } catch { /* Optional selection storage. */ }
  }
  async function post(body: Record<string, unknown>) {
    const result = await request<Project>(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setProjects(ps => [result, ...ps.filter(p => p.id !== result.id)]);
    return result;
  }
  async function run(label: string, action: () => Promise<void>) {
    if (mutationLock.current) return;
    mutationLock.current = true; setBusy(label); setError(''); setNotice('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Operation failed. Please retry.'); }
    finally { mutationLock.current = false; setBusy(''); }
  }
  function save() {
    if (!ready || editFrozen) return;
    if(sourceChanged&&!window.confirm('Source notes changed or were not recorded for this older version. This revision adopts the CURRENT notes shown in Source library and Source decisions, not the saved historical notes. Review those notes before continuing. Continue with the current sources?'))return;
    void run(project ? 'Saving new version…' : 'Composing draft…', async () => {
      const p = await post(project ? { op: 'revise', projectId, expectedVersionId: versionId || null, brief, scene } : { op: 'create', brief, scene });
      const v = p.versions.at(-1);
      if (!v) throw new Error('No saved version returned. Reload projects before retrying.');
      select(p, v); setNotice('Draft saved. Preview and exports now use this exact version.');
    });
  }
  function render(all = false) {
    if (!version || dirty || editFrozen || !packEnabled(version.brief.pack)) return;
    void run('Exporting placements…', async () => {
      for (const r of all ? placements : [displayRatio]) {
        if (version.exports[r]?.status === 'complete') continue;
        setBusy(`Exporting ${r}…`);
        const p = await post({ op: 'render', projectId, versionId, ratio: r });
        const result = p.versions.find(v => v.id === versionId)?.exports[r];
        if (result?.status !== 'complete') throw new Error(result?.issues.join(' ') || `Export failed for ${r}. Retry this placement.`);
      }
      setNotice('Exports saved. Open each exported image and complete a human review.');
    });
  }
  return <section className="creative-studio" aria-label="Creative Builder">
    <header className="cs-header"><div><div className="cs-eyebrow">EIC AGENCY <span>/</span> CREATIVE WORKSPACE</div><h1>Creative Builder<span className="cs-beta">{hosted ? 'PRIVATE BETA' : 'LOCAL BETA'}</span></h1><p>From a clear brief to a considered creative.</p></div><button className="cs-button cs-secondary" disabled={frozen} onClick={() => newProject()}><Plus size={16} /> New project</button></header>
    <div className="cs-mode"><span className="cs-status-dot" /><strong>{hosted ? 'Hosted private beta' : 'Local persisted review'}</strong><span>{hosted ? 'Private owner-scoped storage · PNG only' : 'Saved on this server'} · No AI provider enabled · No publishing</span><ShieldCheck size={16} /></div>
    {error && <div className="cs-alert" role="alert"><strong>Something needs attention.</strong> {error}{loadFailed && <button onClick={() => void load()}>Retry loading projects</button>}</div>}
    {(loading || busy || notice) && <div className="cs-notice" role="status" aria-live="polite">{loading ? 'Loading projects…' : busy || notice}</div>}
    {historical && <div className="cs-historical"><strong>Historical version · Read only</strong><p>Preview and download saved files here. Return to the latest version to continue, or copy this brief and scene into a new project.</p><button className="cs-button cs-secondary" disabled={frozen} onClick={() => newProject(true)}>Copy into new project</button></div>}
    <details className="cs-panel cs-details cs-optional-ideas" aria-label="Optional idea planning"><summary>Optional: develop an idea or write a custom note / comparison</summary><IdeaBuilder key={`idea:${projectId}:${project?.directions?.at(-1)?.id ?? 'new'}`} saved={project?.directions?.at(-1)?.brief} disabled={editFrozen} onDirty={setIdeaDirty} onPlanningOnly={setIdeaPlanningOnly} onSave={(idea,apply)=>void run('Saving idea decisions…',async()=>{
      const direction={...(project?.directions?.at(-1)?.brief??DEFAULT_DIRECTION),styleId:FORMATS.find(f=>f.id===idea.format)!.artDirection,idea};
      const saved=await post(project?{op:'save-direction',projectId,expectedDirectionId:project.directions?.at(-1)?.id??null,direction}:{op:'create-direction',brief,direction});
      if(!project)setProjectId(saved.id);
      // Persist selection before announcing success, including an immediate reload.
      try { localStorage.setItem(SELECTION_KEY, JSON.stringify({ projectId: saved.id, versionId: project ? versionId : '', ratio: displayRatio })); } catch { /* Optional selection storage. */ }
      if(apply){const next=ideaScene(idea);if(next){setScene(next);setBrief(b=>ideaBrief(idea,b));setNewDraftTouched(true);setAcknowledged(false);setNotice('Idea saved and applied to editable artwork below. Compose draft to save its exact HTML, then export.');}}
      else setNotice('Idea decisions saved. Artwork remains unchanged.');
      // Clear the saved editor's dirty flag in the same commit as the success notice.
      // Waiting for the keyed child's passive effect leaves an immediate-reload race.
      setIdeaDirty(false); setDirectionDirty(false);
    })}/></details>
    <div className="cs-workspace"><aside className="cs-sidebar">
      <div className="cs-panel cs-brief"><div className="cs-section-heading"><span className="cs-step">01</span><h2>Your draft</h2><FileText size={17} /></div><p className="cs-help">Start with the saved EIC white-label offer. Compose now, then refine the copy and export. No questionnaire required.</p>
        <fieldset disabled={editFrozen}>
          <label>Project title<input value={brief.title} minLength={3} maxLength={100} onChange={e => updateBrief('title', e.target.value)} /></label>
          <label>Export pack<select aria-label="Export pack" value={brief.pack} onChange={e => updateBrief('pack', e.target.value as Brief['pack'])}>{PACK_IDS.map(id => <option key={id} value={id} disabled={!packEnabled(id)}>{PACKS[id].name}{!packEnabled(id) ? ' — JPEG not ready in hosted beta' : ''}</option>)}</select></label>
          {hosted && <p className="cs-help">Hosted private beta supports PNG packs only. JPEG packs are not ready; no automatic conversion is performed.</p>}
          <p className="cs-help">{PACKS[brief.pack].description} Changing packs creates a new saved version.</p>
          <details className="cs-brief-context"><summary>Optional brief & audience context</summary><label>Audience<textarea rows={2} value={brief.audience} minLength={5} maxLength={280} onChange={e => updateBrief('audience', e.target.value)} /></label>
          <label>Objective<textarea rows={2} value={brief.objective} minLength={5} maxLength={280} onChange={e => updateBrief('objective', e.target.value)} /></label>
          <label>Creative hypothesis<textarea rows={3} value={brief.hypothesis} minLength={5} maxLength={400} onChange={e => updateBrief('hypothesis', e.target.value)} /></label>
          <div className="cs-field-label">AIDA stage</div><div className="cs-stages">{STAGES.map(stage => <button key={stage} aria-pressed={brief.stage === stage} className={brief.stage === stage ? 'is-selected' : ''} onClick={() => updateBrief('stage', stage)}><strong>{stage}</strong><span>{bucketFor(stage)} · {stageNotes[stage]}</span></button>)}</div>
          <p className="cs-help">{scene.template==='founder-note'?'Founder Note supports this planning stage. Review the locked offer for audience fit; stage selection does not rewrite supporting copy.':brief.stage === 'Action' ? 'Action is the first rendering slice. One offer, one next step.' : `${brief.stage} is planning only for this concept. Founder Note supports other stages; this concept requires Action.`}</p>
          </details>
        </fieldset>
      </div>
      <details className="cs-panel cs-details"><summary>Source library <span>{brief.sourceIds.length}/{REQUIRED_SOURCE_IDS.length} selected</span></summary><div className="cs-details-body"><p className="cs-help">{historical ? 'Historical view: recorded source notes only. Missing legacy notes are not reconstructed.' : 'Revision sources: current source notes that will be saved with your next draft. Existing artwork retains its recorded provenance below. Selection is not automated verification.'}</p>{savedSources.map(source => <div className="cs-source" key={source.id}><label className="cs-check"><input type="checkbox" disabled={editFrozen || source.id==='white-label-parent'} checked={source.id==='white-label-parent' || brief.sourceIds.some(id => id === source.id)} onChange={e => updateBrief('sourceIds', ([...REQUIRED_SOURCE_IDS.filter(id=>id!=='launch-tracker'),scene.template==='one-client-math'?'one-client-math':'launch-tracker'] as Brief['sourceIds']).filter(id => id === source.id ? e.target.checked : brief.sourceIds.includes(id)))} /><span><strong>{source.title}</strong><small>{source.role}</small></span></label><p>{source.note}</p><a href={source.url} target="_blank" rel="noopener noreferrer">Open source <ArrowUpRight size={12} /></a></div>)}</div></details>
      {version && <details className="cs-panel cs-details"><summary>Saved version provenance <span>{sourceChanged?'Differs from current notes':'Recorded notes'}</span></summary><div className="cs-details-body">{version.sourceSnapshot ? <><p className="cs-help">These notes belong to the displayed saved artwork, not necessarily the next revision.</p>{version.sourceSnapshot.sources.map(s=><div className="cs-source" key={s.id}><strong>{s.title}</strong><p>{s.note}</p><a href={s.url} target="_blank" rel="noopener noreferrer">Open recorded source</a></div>)}<ul>{version.sourceSnapshot.warnings.map(w=><li key={w}>{w}</li>)}</ul></> : <p>No source snapshot was recorded for this legacy version.</p>}</div></details>}
      <details className="cs-panel cs-details"><summary>Source decisions <span>Review required</span></summary><div className="cs-details-body"><ul className="cs-warnings">{savedWarnings.map(warning => <li key={warning}>{warning}</li>)}</ul><p className="cs-help">Awareness → TOF; Interest → MOF; Desire → MOF; Action → BOF.</p></div></details>
    </aside><div className="cs-main">
      <details className="cs-panel cs-details"><summary>Explore all 9 art-direction families · planning references</summary><DirectionBrief key={`${projectId}:${project?.directions?.at(-1)?.id ?? 'new'}`} project={project} disabled={editFrozen} onDirty={setDirectionDirty} save={direction => void run('Saving direction brief…', async () => { const saved = await post(project ? {op:'save-direction',projectId,expectedDirectionId:project.directions?.at(-1)?.id ?? null,direction} : {op:'create-direction',brief,direction}); if (!project) { setProjectId(saved.id); setNewDraftTouched(false); } setNotice('Direction brief saved separately. Existing artwork and exports are unchanged.'); })} /></details>
      <h2>Create → edit → preview → export</h2>
      <div className="cs-panel cs-canvas-panel"><div className="cs-canvas-header"><div><div className="cs-eyebrow">02 / ART DIRECTION</div><h2>{pack.name}</h2></div><span className="cs-pill">{version ? `Version ${project!.versions.indexOf(version) + 1}` : 'Not saved'} · {version?.approval ? 'Design approved' : 'Draft'}</span></div>
        <div className="cs-ratio-bar" aria-label="Preview placement">{placements.map(r => <button key={r} className={displayRatio === r ? 'is-selected' : ''} aria-pressed={displayRatio === r} onClick={() => setRatio(r)}><span>{spec(r).width}×{spec(r).height}</span><small>{spec(r).name}</small></button>)}</div>
        <div className="cs-canvas">{version && project ? <Preview key={`${project.id}:${version.id}:${displayRatio}`} projectId={project.id} versionId={version.id} ratio={displayRatio} placement={spec(displayRatio)} /> : <div className="cs-empty"><Layers size={34} strokeWidth={1.25} /><div className="cs-eyebrow">EIC WHITE-LABEL STARTER</div><h3>{ideaPlanningOnly ? 'This idea is planning only.' : 'Make your first draft.'}</h3><p>{ideaPlanningOnly ? 'Save your planning decisions, or choose a supported Notes / Comparison format in the idea builder.' : 'Use the existing Launch Tracker offer and copy. Compose to see the artwork, then make it yours below.'}</p><button className="cs-button cs-primary" disabled={!ready || editFrozen} onClick={save}>Compose draft <ChevronRight size={16} /></button><p className="cs-help">Drafting is not approval. Review factual claims before launch.</p></div>}</div>
        <div className="cs-canvas-caption"><span>{spec(displayRatio).width} × {spec(displayRatio).height} px · {spec(displayRatio).extension.toUpperCase()}</span><span>{dirty ? 'Unsaved edits · preview shows saved version' : 'Saved HTML layout · scaled to fit'}</span></div>
      </div>
      <div className="cs-panel cs-controls"><div className="cs-section-heading"><h2>Make it yours</h2><span className="cs-help">Edits become a new, immutable version.</span></div>
        <label>Visual concept<select aria-label="Visual concept" disabled={editFrozen} value={scene.template || 'launch-tracker-v1'} onChange={e=>{setScene(sceneForConcept(e.target.value as Scene['template']));setBrief(b=>({...b,sourceIds:b.sourceIds.map(id=>['launch-tracker','one-client-math','agency-owner-text-thread','founder-note','same-client-two-replies','build-or-partner-note'].includes(id)?(['one-client-math','agency-owner-text-thread','founder-note','same-client-two-replies','build-or-partner-note'].includes(e.target.value)?e.target.value as 'one-client-math'|'agency-owner-text-thread'|'founder-note':'launch-tracker'):id)}));setAcknowledged(false);if(!version)setNewDraftTouched(true);}}>{Object.entries(CONCEPTS).map(([id,name])=><option key={id} value={id} disabled={id!=='launch-tracker-v1'&&brief.pack!=='meta-feed'}>{name}</option>)}</select></label>
        <p className="cs-help">Select the Meta feed concepts pack for named concepts, including One-Client Math. These are not renderers for the reference-backed styles above. Square and portrait only; no 9:16 or Google coverage. Supporting copy is locked for these concepts. Every saved revision requires fresh export and review.</p>
        {['same-client-two-replies','build-or-partner-note'].includes(scene.template)&&<p className="cs-help">Fixed comparison draft: all scene copy, size and logo controls are locked. Messages are illustrative, not testimonials. Checklist columns are alternative operating choices, not universal requirements.</p>}
        {!conceptPackCompatible(scene,brief)&&<p role="alert">This concept requires the Meta feed concepts pack. Select it or explicitly switch to Launch Tracker.</p>}
        <p className="cs-help">{brief.pack === 'google-assets' ? 'Image and logo assets only. The illustration contains no ad text or fake evidence; original logos export separately. Copy controls below are stored with the brief but do not alter these graphics. Headlines, descriptions, video and campaign setup are still required outside this pack.' : brief.pack === 'google-banners' ? 'Small banners use condensed, locked offer copy rather than shrinking the full tracker. Inspect each actual-size export. Not every scene control affects every banner.' : brief.pack === 'meta-feed' ? 'Two static feed drafts only. Stories, Reels and Google are not supported by these concepts.' : 'Static Feed and Stories image pack. Vertical artwork is not a video ad or a guarantee of every Reels placement. Review platform overlays and crops before launch.'}</p>
        {scene.template==='agency-owner-text-thread'&&<p className="cs-help">Fixed illustrative scenario: conversation and offer are locked. Headline, CTA, size and logo controls do not alter this template. No CTA is printed in the conversation.</p>}{scene.template==='founder-note'&&<p className="cs-help">Draft note, not an actual founder screenshot. Headline and closing line are editable; supporting offer copy is locked. This logo-free note ignores logo alignment.</p>}<fieldset disabled={editFrozen || brief.pack === 'google-assets' || ['agency-owner-text-thread','same-client-two-replies','build-or-partner-note'].includes(scene.template)}><div className="cs-copy-grid"><label>Headline<textarea rows={2} value={scene.headline} minLength={5} maxLength={90} onChange={e => updateScene('headline', e.target.value)} /><small>{scene.headline.length}/90</small></label><label>Supporting copy (Launch Tracker only)<textarea disabled={scene.template !== 'launch-tracker-v1'} rows={2} value={scene.subhead} minLength={5} maxLength={160} onChange={e => updateScene('subhead', e.target.value)} /><small>{scene.subhead.length}/160</small></label></div><div className="cs-adjust-grid"><label>Call to action<input value={scene.cta} minLength={3} maxLength={38} onChange={e => updateScene('cta', e.target.value)} /></label><label>Headline size · {scene.headlineScale.toFixed(2)}×<input type="range" min="0.9" max="1.1" step="0.01" value={scene.headlineScale} onChange={e => updateScene('headlineScale', Number(e.target.value))} /></label><label>Logo alignment<select value={scene.logoPosition} onChange={e => updateScene('logoPosition', e.target.value as Scene['logoPosition'])}><option value="left">Left</option><option value="right">Right</option></select></label></div></fieldset>
        <div className="cs-save-row"><p className="cs-help">{historical ? 'Historical artwork is read only.' : ideaPlanningOnly ? 'Selected idea is planning only; no artwork renderer is available.' : !ready ? 'Check copy, export pack and stage compatibility in the optional brief.' : dirty ? 'Save before exporting or approving.' : 'Original logo and offer safeguards are protected.'}</p><button className="cs-button cs-primary" onClick={save} disabled={editFrozen || !ready || (!!version && !dirty)}>{version ? 'Save new version' : 'Compose draft'} <ChevronRight size={16} /></button></div>
        {dirty && <button className="cs-text-button" disabled={frozen} onClick={() => { if (project && version) { if(mayLeave())select(project, version); } else newProject(); }}>Discard unsaved edits</button>}
      </div>
      <details className="cs-panel cs-details" open><summary>03 / Export & human review <span>Not a publishing workflow</span></summary><div className="cs-details-body"><p className="cs-help">System checks cover file and layout constraints, not platform acceptance, offer accuracy or claim substantiation. Inspect each exported image at its actual size. JPEG compression can differ slightly from the HTML preview.</p>
        <div className="cs-export-actions"><button className="cs-button cs-secondary" disabled={editFrozen || !version || dirty || version.exports[displayRatio]?.status === 'complete'} onClick={() => render()}><ArrowDownToLine size={15} /> Export selected</button><button className="cs-button cs-secondary" disabled={editFrozen || !version || dirty || placements.every(r => version.exports[r]?.status === 'complete')} onClick={() => render(true)}>Export all placements</button></div>
        <div className="cs-review-list">{placements.map(r => { const record = version?.exports[r]; return <div className="cs-review-row" key={r}><div><strong>{spec(r).name}</strong><small>{spec(r).width}×{spec(r).height} · {spec(r).extension.toUpperCase()}{record?.sizeBytes ? ` · ${Math.ceil(record.sizeBytes / 1024)} KB` : ''}</small><small>{record ? record.status === 'complete' ? record.qaPassed ? 'Export saved · system checks passed' : 'Export saved · system checks need attention' : 'Export failed' : 'Not exported'}</small>{record?.issues.map(issue => <small className="cs-error-text" key={issue}>{issue}</small>)}</div>{record?.status === 'complete' && project && version && <a href={artifactUrl(project.id, version.id, r, 'png')} target="_blank" rel="noopener noreferrer">Open {spec(r).extension.toUpperCase()} <ArrowUpRight size={12} /></a>}<label className="cs-check"><input type="checkbox" checked={version?.reviews[r] === true} disabled={editFrozen || dirty || !version || record?.status !== 'complete' || !record.qaPassed || !!version.approval} onChange={e => { const approved = e.target.checked; void run('Saving human review…', async () => { await post({ op: 'review', projectId, versionId, ratio: r, approved }); setAcknowledged(false); setNotice(`Human review saved for ${r}.`); }); }} /><span>I checked this image</span></label></div>; })}</div>
        <div className="cs-approval"><label className="cs-check"><input type="checkbox" checked={acknowledged} disabled={editFrozen || !version || dirty || !!version.approval} onChange={e => setAcknowledged(e.target.checked)} /><span>I reviewed this saved version, its offer and claims, and every exported placement. This is design approval only, not publishing or a performance result.</span></label><button className="cs-button cs-primary" disabled={editFrozen || !approvalReady || !!version?.approval} onClick={() => void run('Saving local approval…', async () => { await post({ op: 'approve', projectId, versionId }); setNotice('Local design approved. Nothing has been published.'); })}><Check size={16} />{version?.approval ? 'Local design approved' : 'Approve local design'}</button></div>
        {!!version?.jobs.length && <details className="cs-job-details"><summary>Render activity · {version.jobs.length} jobs</summary>{version.jobs.map(job => <p key={job.id}>{job.ratio} · {job.status} · Local Chromium · $0{job.error ? ` · ${job.error}` : ''}</p>)}</details>}
      </div></details>
      <div className="cs-history-grid"><div className="cs-panel cs-history"><h2>Saved projects <span>{projects.length}</span></h2>{!projects.length && <p className="cs-help">Your first composed draft will appear here.</p>}<div className="cs-history-scroll">{projects.map(p => { const latest = p.versions.at(-1); return <button key={p.id} disabled={frozen} className={p.id === projectId ? 'is-selected' : ''} onClick={() => { if (mayLeave()) { select(p, latest); setError(''); setNotice('Saved project opened.'); } }}><FileText size={16} /><span><strong>{latest?.brief.title ?? p.planningBrief?.title ?? 'Direction brief'}</strong><small>{p.versions.length} versions · {new Date(p.updatedAt).toLocaleDateString()}</small></span><ChevronRight size={14} /></button>; })}</div></div><div className="cs-panel cs-history"><h2>Version history <span>{project?.versions.length || 0}</span></h2>{!project && <p className="cs-help">Saved versions are immutable. Revisions never overwrite them.</p>}<div className="cs-history-scroll">{project?.versions.slice().reverse().map((v, i) => <button key={v.id} disabled={frozen} className={v.id === versionId ? 'is-selected' : ''} onClick={() => { if (mayLeave()) { select(project, v); setError(''); setNotice('Saved version opened.'); } }}><Layers size={16} /><span><strong>Version {project.versions.length - i} {v.approval ? '· Approved locally' : '· Draft'}</strong><small>{new Date(v.createdAt).toLocaleString()}</small></span><ChevronRight size={14} /></button>)}</div></div></div>
    </div></div><footer className="cs-footer">EIC CREATIVE STUDIO <span>Thoughtful inputs. Reviewable outputs. Human approval.</span></footer>
  </section>;
}
