'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronRight, ExternalLink, ImagePlus, LoaderCircle, MessageSquareText, Plus, RefreshCw, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { z } from 'zod';
import {
  PublicCreativeProjectSchema,
  STRATEGY_LIMITS,
  type PublicCreativeProject,
  type StrategyClaim,
} from '@/lib/creative-studio/strategy';
import ConceptPreview from './ConceptPreview';
import './studio.css';

const API = '/api/creative-builder';
const SOURCE_API = '/api/creative-builder/source-asset';
const ProjectListSchema = z.object({projects:z.array(PublicCreativeProjectSchema).max(100),nextCursor:z.object({createdAt:z.string().datetime({offset:true}),id:z.string().uuid()}).strict().nullable(),exhausted:z.boolean()}).strict();
const ImportedAssetSchema = z.object({ assetId: z.string().uuid() }).strict();
const assumptionKeys = ['advertisedSubject', 'offer', 'audience', 'awareness', 'funnelStage', 'objective', 'message', 'cta'] as const;
const assumptionLabels: Record<(typeof assumptionKeys)[number], string> = {
  advertisedSubject: 'Advertised subject', offer: 'Offer', audience: 'Audience', awareness: 'Awareness', funnelStage: 'Funnel stage',
  objective: 'Objective', message: 'Core message', cta: 'Call to action',
};
const channelLabels = { meta: 'Meta', 'google-display': 'Google Display', 'google-performance-max': 'Google Performance Max', linkedin: 'LinkedIn' } as const;

type Project = PublicCreativeProject;
type Command =
  | { operation: 'create-and-analyze'; url: string }
  | { operation: 'edit-plan'; projectId: string; expectedProjectRevision: number; expectedPlanRevisionId: string; patch: Record<string, unknown> }
  | { operation: 'confirm-plan'; projectId: string; expectedProjectRevision: number; expectedPlanRevisionId: string; acknowledged: true }
  | { operation: 'generate-concepts'; projectId: string; expectedProjectRevision: number; expectedPlanRevisionId: string }
  | { operation: 'select-concept'; projectId: string; expectedProjectRevision: number; expectedConceptSetId?: string; expectedConceptRevisionId?: string; conceptId: string; orderedAssetIds: string[] }
  | { operation: 'revise'; projectId: string; expectedProjectRevision: number; target: 'plan' | 'portfolio' | 'concept'; expectedPlanRevisionId?: string; expectedConceptSetId?: string; expectedConceptRevisionId?: string; conceptId?: string; message: string }
  | { operation: 'handoff'; projectId: string; expectedProjectRevision: number; selectionId: string }
  | { operation: 'delete-project'; projectId: string; expectedProjectRevision: number };

type EditablePlan = {
  assumptions: Record<(typeof assumptionKeys)[number], string>;
  claims: Array<{ id: string; kind: StrategyClaim['kind']; text: string }>;
  channels: Array<{ channel: keyof typeof channelLabels; recommended: boolean; placements: string[] }>;
};

type UiError = { message: string; refresh: boolean };

class BuilderRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

function friendlyError(error: unknown): UiError {
  if (error instanceof BuilderRequestError) {
    if (error.status === 409) return { message: 'This plan changed in another session. Refresh to continue from the latest saved version.', refresh: true };
    if (error.status === 429) return { message: 'The private beta usage limit has been reached. Your saved work is safe; try again later.', refresh: false };
    if (error.status === 401 || error.status === 403 || error.status === 404) return { message: 'Creative Builder access is unavailable. Reload the dashboard or contact an administrator.', refresh: true };
  }
  return { message: error instanceof Error ? error.message : 'The operation could not be completed. Your saved work is unchanged.', refresh: false };
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, { cache: 'no-store', ...init });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const serverMessage = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : '';
    throw new BuilderRequestError(serverMessage || `Request failed (${response.status}). Please retry.`, response.status);
  }
  if (data === null) throw new BuilderRequestError('The server returned an empty response. Please retry.', response.status);
  return data;
}

const pendingMutationKeys = new Map<string, string>();
async function postProject(command: Command): Promise<Project> {
  const fingerprint = JSON.stringify(command);
  const requestKey = pendingMutationKeys.get(fingerprint) ?? crypto.randomUUID();
  pendingMutationKeys.set(fingerprint, requestKey);
  const data = await fetchJson(API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestKey }, body: fingerprint });
  const parsed = PublicCreativeProjectSchema.safeParse(data);
  if (!parsed.success) throw new Error('The server returned an unexpected project response. Refresh before continuing.');
  pendingMutationKeys.delete(fingerprint);
  return parsed.data;
}

function editablePlan(project: Project): EditablePlan {
  return {
    assumptions: Object.fromEntries(assumptionKeys.map(key => [key, project.assumptions[key].recommendation])) as EditablePlan['assumptions'],
    claims: project.assumptions.claims.map(({ id, kind, text }) => ({ id, kind, text })),
    channels: project.channels.map(({ channel, recommended, placements }) => ({ channel, recommended, placements: [...placements] })),
  };
}

function phaseLabel(phase: Project['phase']) { return phase === 'generated' ? 'Concepts ready' : phase === 'confirmed' ? 'Plan confirmed' : 'Plan draft'; }
function previewUrl(project: Project, candidateId: string) {
  return `${SOURCE_API}?${new URLSearchParams({ kind: 'preview', projectId: project.projectId, scanId: project.scanId, candidateId })}`;
}

export default function UrlCreativeBuilder() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [plan, setPlan] = useState<EditablePlan | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState<UiError | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [planAcknowledged, setPlanAcknowledged] = useState(false);
  const [selectedConceptId, setSelectedConceptId] = useState('');
  const [importedAssets, setImportedAssets] = useState<Array<{ candidateId: string; assetId: string }>>([]);
  const [revisionTarget, setRevisionTarget] = useState<'plan' | 'portfolio' | 'concept'>('portfolio');
  const [revisionMessage, setRevisionMessage] = useState('');
  const [focusCurrentStep, setFocusCurrentStep] = useState(false);
  const mutationLock = useRef(false);

  const project = projects.find(item => item.projectId === projectId);
  const selectedConcept = project?.phase === 'generated' ? project.concepts.find(item => item.concept.id === selectedConceptId) : undefined;
  const needsClaimConfirmation = project?.assumptions.claims.filter(claim => claim.status === 'needs-confirmation' || claim.kind !== 'general') ?? [];


  const replaceProject = useCallback((next: Project) => {
    setProjects(current => [next, ...current.filter(item => item.projectId !== next.projectId)]);
    setProjectId(next.projectId);
    setPlan(editablePlan(next));
    setPlanAcknowledged(false);
    if (next.phase === 'generated') {
      const currentConcept = next.currentSelection?.conceptId;
      setSelectedConceptId(currentConcept && next.concepts.some(item => item.concept.id === currentConcept) ? currentConcept : '');
    } else setSelectedConceptId('');
  }, []);

  const load = useCallback(async (preferredId?: string) => {
    setBusy('Loading your Creative Builder projects…'); setError(null); setLoadFailed(false);
    try {
      const query = preferredId ? `?${new URLSearchParams({ projectId: preferredId })}` : '';
      const data = await fetchJson(`${API}${query}`);
      const single = PublicCreativeProjectSchema.safeParse(data);
      let loaded: Project[];
      if (single.success) loaded = [single.data];
      else {
        const list = ProjectListSchema.safeParse(data);
        if (!list.success) throw new Error('The server returned an unexpected project response.');
        loaded = list.data.projects;
      }
      setProjects(current => preferredId ? [...loaded, ...current.filter(item => item.projectId !== preferredId)] : loaded);
      setPlanAcknowledged(false); setImportedAssets([]);
      const next = loaded.find(item => item.projectId === preferredId) ?? loaded[0];
      if (next) {
        setProjectId(next.projectId); setPlan(editablePlan(next));
        setSelectedConceptId(next.phase === 'generated' ? next.currentSelection?.conceptId ?? '' : '');
      } else if (!preferredId) { setProjectId(''); setPlan(null); setSelectedConceptId(''); }
    } catch (caught) { setError(friendlyError(caught)); setLoadFailed(true); }
    finally { setBusy(''); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!focusCurrentStep || !project) return;
    const targetId = project.phase === 'draft' ? 'builder-plan' : project.phase === 'confirmed' ? 'builder-generate' : project.currentSelection ? 'builder-artwork' : 'builder-concepts';
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      const heading = target?.querySelector<HTMLElement>('h2[tabindex="-1"]');
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      heading?.focus({ preventScroll: true });
      target?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      setFocusCurrentStep(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusCurrentStep, project]);

  const run = useCallback(async (label: string, action: () => Promise<void>) => {
    if (mutationLock.current) return;
    mutationLock.current = true; setBusy(label); setNotice(''); setError(null);
    try { await action(); }
    catch (caught) { setError(friendlyError(caught)); }
    finally { mutationLock.current = false; setBusy(''); }
  }, []);

  function chooseProject(next: Project) {
    if (busy) return;
    setProjectId(next.projectId); setPlan(editablePlan(next)); setPlanAcknowledged(false); setImportedAssets([]); setError(null); setNotice('');
    setSelectedConceptId(next.phase === 'generated' ? next.currentSelection?.conceptId ?? '' : '');
    setFocusCurrentStep(true);
  }

  function create(event: FormEvent) {
    event.preventDefault();
    const submittedUrl = url.trim();
    if (!submittedUrl) return;
    void run('Analyzing the landing page and building a source-backed plan…', async () => {
      const next = await postProject({ operation: 'create-and-analyze', url: submittedUrl });
      replaceProject(next); setUrl(''); setImportedAssets([]);
      setNotice('Analysis complete. Review and edit every recommendation before confirming.');
    });
  }

  function savePlan() {
    if (!project || !plan || project.phase !== 'draft') return;
    void run('Saving a new plan revision…', async () => {
      const next = await postProject({
        operation: 'edit-plan', projectId: project.projectId, expectedProjectRevision: project.projectRevision, expectedPlanRevisionId: project.planRevisionId,
        patch: {
          ...Object.fromEntries(assumptionKeys.map(key => [key, { recommendation: plan.assumptions[key] }])),
          claims: plan.claims,
          channels: plan.channels,
        },
      });
      replaceProject(next); setNotice('Plan revision saved. Review the retained claims before confirming.');
    });
  }

  function removeClaim(claimId:string) {
    setPlan(current=>current&&({...current,claims:current.claims.filter(claim=>claim.id!==claimId)}));
  }

  function confirmPlan() {
    if (!project || project.phase !== 'draft') return;
    if (!planAcknowledged) {
      setError({ message: 'Acknowledge the exact saved strategy and retained claims before confirming this plan.', refresh: false });
      return;
    }
    void run('Recording your exact plan and claim confirmation…', async () => {
      const next = await postProject({ operation: 'confirm-plan', projectId: project.projectId, expectedProjectRevision: project.projectRevision, expectedPlanRevisionId: project.planRevisionId, acknowledged: true });
      replaceProject(next); setNotice('Plan confirmed. You can now generate six distinct concepts.');
    });
  }

  function generate() {
    if (!project || project.phase !== 'confirmed') return;
    void run('Generating six distinct creative concepts…', async () => {
      const next = await postProject({ operation: 'generate-concepts', projectId: project.projectId, expectedProjectRevision: project.projectRevision, expectedPlanRevisionId: project.planRevisionId });
      replaceProject(next); setNotice('Six concepts are ready. Compare the strategy, evidence needs, and source-image options.');
    });
  }

  function importCandidate(candidateId: string) {
    if (!project || importedAssets.some(item => item.candidateId === candidateId)) return;
    void run('Importing the selected source image securely…', async () => {
      const command = { projectId: project.projectId, expectedProjectRevision: project.projectRevision, scanId: project.scanId, candidateId };
      const fingerprint = `import:${JSON.stringify(command)}`;
      const requestKey = pendingMutationKeys.get(fingerprint) ?? crypto.randomUUID();
      pendingMutationKeys.set(fingerprint, requestKey);
      const data = await fetchJson(SOURCE_API, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestKey }, body: JSON.stringify(command),
      });
      const result = ImportedAssetSchema.safeParse(data);
      if (!result.success) throw new Error('The source image import response was not recognized. Refresh before retrying.');
      pendingMutationKeys.delete(fingerprint);
      setImportedAssets(items => [...items, { candidateId, assetId: result.data.assetId }]);
      setNotice('Source image imported. Its position in the selected artwork is shown below.');
    });
  }

  function moveAsset(index: number, direction: -1 | 1) {
    setImportedAssets(items => {
      const target = index + direction;
      if (target < 0 || target >= items.length) return items;
      const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; return next;
    });
  }

  function selectConcept() {
    if (!project || project.phase !== 'generated' || !selectedConcept || !selectedConcept.concept.staticOutput) return;
    void run('Saving your concept and source-image order…', async () => {
      const command: Command = {
        operation: 'select-concept', projectId: project.projectId, expectedProjectRevision: project.projectRevision,
        ...(selectedConcept.source === 'revision' ? { expectedConceptRevisionId: selectedConcept.revisionId } : { expectedConceptSetId: project.conceptSetId }),
        conceptId: selectedConcept.concept.id, orderedAssetIds: importedAssets.map(item => item.assetId),
      };
      const next = await postProject(command); replaceProject(next); setNotice('Selection saved as an immutable receipt. It is ready for the upcoming visual bakeoff and final artwork stage.');
    });
  }

  function revise(event: FormEvent) {
    event.preventDefault();
    if (!project || !revisionMessage.trim()) return;
    if (revisionTarget !== 'plan' && project.phase !== 'generated') return;
    if (revisionTarget === 'concept' && !selectedConcept) return;
    const command: Command = {
      operation: 'revise', projectId: project.projectId, expectedProjectRevision: project.projectRevision, target: revisionTarget, message: revisionMessage.trim(),
      ...(revisionTarget === 'plan' ? { expectedPlanRevisionId: project.planRevisionId } : {}),
      ...(revisionTarget === 'portfolio' && project.phase === 'generated' ? { expectedConceptSetId: project.conceptSetId } : {}),
      ...(revisionTarget === 'concept' && selectedConcept ? { expectedConceptRevisionId: selectedConcept.revisionId, conceptId: selectedConcept.concept.id } : {}),
    };
    void run('Applying your revision to canonical project history…', async () => {
      const next = await postProject(command); replaceProject(next); setRevisionMessage('');
      setNotice(revisionTarget === 'plan' ? 'Plan revised. Review and reconfirm it before generating concepts.' : 'Revision saved and added to project history.');
    });
  }

  function deleteProject() {
    if (!project || !window.confirm('Delete this Builder project and its private source images? Linked Creative Studio artwork will remain available.')) return;
    void run('Deleting the Builder project and scheduling private-image cleanup…', async () => {
      await fetchJson(API, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'delete-project',projectId:project.projectId,expectedProjectRevision:project.projectRevision} satisfies Command)});
      const remaining=projects.filter(item=>item.projectId!==project.projectId);
      setProjects(remaining);setProjectId(remaining[0]?.projectId??'');setPlan(remaining[0]?editablePlan(remaining[0]):null);setImportedAssets([]);setSelectedConceptId('');
      setNotice('Builder project deleted. Private images are queued for bounded cleanup; linked Studio artwork is preserved.');
    });
  }

  const planDirty = useMemo(() => project && plan ? JSON.stringify(editablePlan(project)) !== JSON.stringify(plan) : false, [project, plan]);

  const hasCurrentSelection = project?.phase === 'generated' && Boolean(project.currentSelection);
  useEffect(() => { if (planDirty) setPlanAcknowledged(false); }, [planDirty]);

  return <section className="creative-studio creative-builder-url" aria-label="Creative Builder">
    <header className="cs-header cb-header"><div><div className="cs-eyebrow">EIC AGENCY <span>/</span> CREATIVE WORKSPACE</div><h1>Creative Builder <span className="cs-beta">PRIVATE BETA</span></h1><p>Turn one landing page into a source-grounded plan, six creative routes, and reviewable artwork.</p></div><a className="cs-button cs-secondary" href="/dashboard/eicagency/creative-studio">Legacy Studio <ExternalLink size={15} aria-hidden="true" /></a></header>
    <div className="cs-mode"><span className="cs-status-dot" /><strong>Protected planning workspace</strong><span>Owner-scoped · Source-grounded · No ad publishing</span><ShieldCheck size={16} aria-hidden="true" /></div>

    {error && <div className="cs-alert cb-alert" role="alert"><div><strong>Something needs attention.</strong> {error.message}</div><div className="cb-alert-actions">{(error.refresh || loadFailed) && <button type="button" onClick={() => void load(projectId || undefined)}><RefreshCw size={14} aria-hidden="true" /> Refresh saved work</button>}</div></div>}
    {(busy || notice) && <div className="cs-notice cb-notice" role="status" aria-live="polite">{busy && <LoaderCircle className="cb-spinner" size={16} aria-hidden="true" />}{busy || notice}</div>}

    <section className="cb-intake cs-panel" aria-labelledby="cb-start-title">
      <div><div className="cs-eyebrow">START WITH THE SOURCE</div><h2 id="cb-start-title">What should we advertise?</h2><p>Enter the public landing page. Builder will privately analyze its messaging and available images, then return recommendations for your review.</p></div>
      <form onSubmit={create} className="cb-url-form"><label htmlFor="builder-url">Landing-page URL</label><div><input id="builder-url" type="url" inputMode="url" autoComplete="url" required maxLength={2048} placeholder="https://example.com/offer" value={url} onChange={event => setUrl(event.target.value)} disabled={!!busy} /><button className="cs-button cs-primary" disabled={!!busy || !url.trim()}>{busy && !project ? <LoaderCircle className="cb-spinner" size={16} /> : <Sparkles size={16} />} Analyze page</button></div><small>Only the page you submit and its same-site homepage fallback may be scanned. Page text and source addresses are never shown in this workspace.</small></form>
    </section>

    {!!projects.length && <nav className="cb-projects" aria-label="Creative Builder projects"><span>Saved plans</span>{projects.map((item, index) => <button type="button" key={item.projectId} aria-current={item.projectId === projectId ? 'page' : undefined} onClick={() => chooseProject(item)} disabled={!!busy}><strong>Plan {projects.length - index}</strong><small>{phaseLabel(item.phase)}</small></button>)}<button type="button" className="cb-new" onClick={() => { setProjectId(''); setPlan(null); setSelectedConceptId(''); setImportedAssets([]); document.getElementById('builder-url')?.focus(); }} disabled={!!busy}><Plus size={14} /> New</button></nav>}

    {project && plan && <div className="cb-flow">
      <aside className="cb-steps cs-panel" aria-label="Builder progress"><div className="cs-eyebrow">WORKFLOW</div>{[['1','Plan','draft'],['2','Confirm','confirmed'],['3','Concepts','generated'],['4','Artwork','selected']].map(([number,label,state]) => { const active = label === 'Plan' ? project.phase === 'draft' : label === 'Confirm' ? project.phase === 'confirmed' : label === 'Concepts' ? project.phase === 'generated' && !hasCurrentSelection : hasCurrentSelection; const complete = label === 'Plan' ? project.phase !== 'draft' : label === 'Confirm' ? project.phase === 'generated' : label === 'Concepts' ? hasCurrentSelection : false; return <div key={state} className={active ? 'is-active' : complete ? 'is-complete' : ''}><span>{complete ? <Check size={13} /> : number}</span><strong>{label}</strong></div>; })}<p>Every edit creates a new server-owned revision. Nothing here publishes ads.</p></aside>

      <main className="cb-main">
        <section id="builder-plan" className="cs-panel cb-plan" aria-labelledby="cb-plan-title">
          <div className="cb-section-head"><div><div className="cs-eyebrow">01 / SOURCE-BACKED PLAN</div><h2 id="cb-plan-title" tabIndex={-1}>Review the strategy, not just the copy</h2><p>“Page observed” means the recommendation has source support. It does not mean every claim is independently verified.</p></div><span className={`cb-phase cb-${project.phase}`}>{phaseLabel(project.phase)}</span></div>
          <fieldset disabled={!!busy || project.phase !== 'draft'}>
            <div className="cb-assumptions">{assumptionKeys.map(key => <label key={key}><span>{assumptionLabels[key]}</span><small className={project.assumptions[key].observedPageExcerptIds.length ? 'is-observed' : ''}>{project.assumptions[key].observedPageExcerptIds.length ? 'Page observed' : 'Strategic recommendation'}</small><textarea rows={key === 'message' ? 3 : 2} required maxLength={500} value={plan.assumptions[key]} onChange={event => setPlan(current => current && ({ ...current, assumptions: { ...current.assumptions, [key]: event.target.value } }))} /></label>)}</div>
            <div className="cb-subsection"><div><h3>Claims</h3><p>Edit the wording or remove anything you do not want used. Only retained claims require confirmation.</p></div><div className="cb-claims">{plan.claims.map((claim, index) => {const canonicalClaim=project.assumptions.claims.find(item=>item.id===claim.id);return <div className="cb-claim-row" key={claim.id}><label><span>{claim.kind.replaceAll('-', ' ')}</span><textarea rows={2} required maxLength={500} value={claim.text} onChange={event => setPlan(current => current && ({ ...current, claims: current.claims.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item) }))} /><small>{canonicalClaim?.status === 'page-observed' ? 'Page observed' : canonicalClaim?.status === 'user-confirmed' ? 'Previously confirmed' : 'Your confirmation required'}</small></label><button type="button" className="cb-remove-claim" onClick={()=>removeClaim(claim.id)}><Trash2 size={13} aria-hidden="true" /> Remove from plan</button></div>;})}</div></div>
            <div className="cb-subsection"><div><h3>Channels</h3><p>Select recommendations and review the proposed placements.</p></div><div className="cb-channels">{plan.channels.map((channel, index) => <label key={channel.channel}><input type="checkbox" checked={channel.recommended} onChange={event => setPlan(current => current && ({ ...current, channels: current.channels.map((item, itemIndex) => itemIndex === index ? { ...item, recommended: event.target.checked } : item) }))} /><span><strong>{channelLabels[channel.channel]}</strong><small>{channel.placements.length ? channel.placements.join(' · ') : 'Placements to be planned'}</small></span></label>)}</div></div>
          </fieldset>
          {project.phase === 'draft' && <div className="cb-plan-actions"><button type="button" className="cs-button cs-secondary" disabled={!!busy || !planDirty} onClick={savePlan}>Save plan revision</button><span>{planDirty ? 'Save edits before confirming.' : 'Saved revision ready for exact confirmation.'}</span></div>}
        </section>

        {project.phase === 'draft' && <section className="cs-panel cb-confirm" aria-labelledby="cb-confirm-title"><div className="cs-eyebrow">02 / HUMAN CONFIRMATION</div><h2 id="cb-confirm-title">Approve the saved plan</h2><p>Remove anything you do not want used above and save the revision first. Claims that require your approval are listed here as part of this exact plan.</p>{needsClaimConfirmation.length ? <div className="cb-confirm-claims">{needsClaimConfirmation.map(claim => <div key={claim.id}><span><strong>Claim requiring approval:</strong> “{claim.text}”</span></div>)}</div> : <p className="cb-safe-note"><Check size={15} /> No retained claims need additional confirmation.</p>}<label className="cb-plan-confirm"><input type="checkbox" checked={planAcknowledged} onChange={event => setPlanAcknowledged(event.target.checked)} disabled={!!busy || planDirty} /><span>I approve the audience, offer, message, CTA, channels, and every retained claim in this exact saved revision.</span></label><p className="cb-safe-note">Approval records this exact plan and unlocks generation of six creative concepts. Nothing is published.</p><button type="button" className="cs-button cs-primary" disabled={!!busy || planDirty || !planAcknowledged} onClick={confirmPlan}><ShieldCheck size={16} /> Approve plan and continue</button></section>}

        {project.phase === 'confirmed' && <section id="builder-generate" className="cs-panel cb-generate"><div><div className="cs-eyebrow">03 / CREATIVE ROUTES</div><h2 tabIndex={-1}>Turn the confirmed plan into six concepts</h2><p>Each route uses a different persuasion job and visual family. Generation does not select a winner or publish anything.</p></div><button type="button" className="cs-button cs-primary" disabled={!!busy} onClick={generate}><Sparkles size={16} /> Generate six concepts</button></section>}

        {project.phase === 'generated' && <section id="builder-concepts" className="cb-concepts" aria-labelledby="cb-concepts-title"><div className="cb-section-head"><div><div className="cs-eyebrow">03 / SIX CONCEPT BRIEFS</div><h2 id="cb-concepts-title" tabIndex={-1}>Review the strategy, copy, and planned visual treatment</h2><p>These are illustrative layout mockups, not final ads. Each route shows a different creative format so you can compare the complete direction before artwork production. Founder Reel remains planning-only and cannot be selected as static artwork.</p></div><span>{project.concepts.length}/{STRATEGY_LIMITS.concepts}</span></div><div className="cb-concept-grid">{project.concepts.map(({ concept }) => { const selected = selectedConceptId === concept.id; return <article key={concept.id} className={`cs-panel cb-concept-card${selected ? ' is-selected' : ''}${!concept.staticOutput ? ' is-planning' : ''}`}><ConceptPreview concept={concept} /><div className="cb-concept-content"><div className="cb-concept-meta"><span>{concept.persuasionJob.replaceAll('-', ' ')}</span><span>{concept.mediaType === 'video' ? 'Planning-only video' : 'Static artwork'}</span></div><h3>{concept.title}</h3><p className="cb-hypothesis">{concept.hypothesis}</p><dl><div><dt>Primary text</dt><dd>{concept.primaryText}</dd></div><div><dt>Headline</dt><dd>{concept.headline}</dd></div><div><dt>Description</dt><dd>{concept.description}</dd></div><div><dt>CTA</dt><dd>{concept.cta}</dd></div><div><dt>Why this route</dt><dd>{concept.rationale}</dd></div><div><dt>Visual direction</dt><dd>{concept.visualDirection}</dd></div></dl>{concept.claims.length > 0 && <div className="cb-evidence"><strong>Evidence check</strong>{concept.claims.map(claim => <span key={claim.id}>{claim.status === 'user-confirmed' ? 'Confirmed' : claim.status === 'page-observed' ? 'Page observed' : 'Confirmation required'} · {claim.text}</span>)}</div>}<button type="button" className={selected ? 'cs-button cs-primary' : 'cs-button cs-secondary'} disabled={!!busy || !concept.staticOutput} onClick={() => setSelectedConceptId(concept.id)}>{concept.staticOutput ? selected ? <><Check size={15} /> Selected</> : <>Select concept <ChevronRight size={15} /></> : 'Founder Reel · planning only'}</button></div></article>; })}</div></section>}

        {project.phase === 'generated' && <section className="cs-panel cb-assets" aria-labelledby="cb-assets-title"><div className="cb-section-head"><div><div className="cs-eyebrow">04 / SOURCE IMAGES</div><h2 id="cb-assets-title">Import only what supports the concept</h2><p>Protected thumbnails are shown without revealing source addresses. Importing copies and normalizes the image into private storage.</p></div><span>{importedAssets.length} selected</span></div>{project.candidates.length ? <div className="cb-asset-grid">{project.candidates.map(candidate => { const importedIndex = importedAssets.findIndex(item => item.candidateId === candidate.id); return <article key={candidate.id}><Image src={previewUrl(project, candidate.id)} alt={`${candidate.kind} source candidate`} width={400} height={260} unoptimized /><div><strong>{candidate.kind} image</strong>{candidate.width && candidate.height && <small>{candidate.width} × {candidate.height}</small>}</div>{importedIndex < 0 ? <button type="button" onClick={() => importCandidate(candidate.id)} disabled={!!busy}><ImagePlus size={14} /> Import</button> : <div className="cb-order"><span>Position {importedIndex + 1}</span><button type="button" aria-label={`Move ${candidate.kind} image earlier`} disabled={!!busy || importedIndex === 0} onClick={() => moveAsset(importedIndex, -1)}><ArrowUp size={14} /></button><button type="button" aria-label={`Move ${candidate.kind} image later`} disabled={!!busy || importedIndex === importedAssets.length - 1} onClick={() => moveAsset(importedIndex, 1)}><ArrowDown size={14} /></button></div>}</article>; })}</div> : <p className="cb-empty-inline">No usable page images were found. You can continue with a typography-led concept.</p>}<div className="cb-selection"><div><strong>{selectedConcept ? selectedConcept.concept.title : 'Select one static concept above'}</strong><span>{importedAssets.length ? `${importedAssets.length} imported source image${importedAssets.length === 1 ? '' : 's'} in order` : 'No source images selected'}</span></div><button type="button" className="cs-button cs-primary" disabled={!!busy || !selectedConcept?.concept.staticOutput} onClick={selectConcept}>{project.currentSelection?.conceptId === selectedConceptId ? 'Save a new selection receipt' : 'Save concept selection'} <ChevronRight size={15} /></button></div></section>}

        {project.phase === 'generated' && <section className="cs-panel cb-revise" aria-labelledby="cb-revise-title"><div className="cb-section-head"><div><div className="cs-eyebrow">REFINE WITH CONTEXT</div><h2 id="cb-revise-title">Request one focused revision</h2><p>Only this message and the selected target are sent. The server returns canonical project history.</p></div><MessageSquareText size={22} /></div><form onSubmit={revise}><label>Revision target<select value={revisionTarget} onChange={event => setRevisionTarget(event.target.value as typeof revisionTarget)} disabled={!!busy}><option value="plan">Plan</option><option value="portfolio" disabled={project.phase !== 'generated'}>All six concepts</option><option value="concept" disabled={project.phase !== 'generated' || !selectedConcept}>Selected concept</option></select></label><label>What should change?<textarea rows={3} required minLength={1} maxLength={2000} placeholder="For example: shorten the headline and make the benefit more direct." value={revisionMessage} onChange={event => setRevisionMessage(event.target.value)} disabled={!!busy} /></label><button className="cs-button cs-secondary" disabled={!!busy || !revisionMessage.trim() || (revisionTarget === 'concept' && !selectedConcept)}>Request revision</button></form>{project.conversation.length > 0 && <div className="cb-conversation"><h3>Saved revision history</h3>{project.conversation.map(turn => <div key={turn.id} className={`is-${turn.role}`}><strong>{turn.role === 'user' ? 'You' : 'Creative Builder'}</strong><p>{turn.message}</p><small>{new Date(turn.createdAt).toLocaleString()}</small></div>)}</div>}</section>}

        {project.phase === 'generated' && <section id="builder-artwork" className="cs-panel cb-handoff"><div><div className="cs-eyebrow">05 / FINAL ARTWORK</div><h2 tabIndex={-1}>Final artwork stays in this Builder</h2><p>{project.currentSelection ? 'Your saved concept is ready for the upcoming visual bakeoff and final composition stage.' : 'Save a static concept selection before the visual bakeoff and final composition stage.'}</p><small>The new artwork stage is still being built. This button stays disabled so you are not sent back to the legacy Studio.</small></div><button type="button" className="cs-button cs-primary" disabled>Final artwork coming next <ChevronRight size={16} /></button></section>}
        <section className="cs-panel cb-delete"><div><div className="cs-eyebrow">DATA LIFECYCLE</div><h2>Delete this Builder project</h2><p>Immediately revoke Builder access and queue private images for deletion. Linked Creative Studio artwork is preserved under its separate lifecycle.</p></div><button type="button" className="cs-button cs-secondary" disabled={!!busy} onClick={deleteProject}>Delete Builder project</button></section>
      </main>
    </div>}
  </section>;
}
