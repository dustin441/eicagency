'use client';

import { BarChart3, CheckSquare2, FileText, MessageSquareText, Play, ReceiptText, Sparkles } from 'lucide-react';
import type { GeneratedConcept } from '@/lib/creative-studio/strategy';

const familyIcons = {
  receipt: ReceiptText,
  'text-thread': MessageSquareText,
  'founder-reel': Play,
  'founder-note': FileText,
  tracker: CheckSquare2,
  editorial: FileText,
  'job-post': FileText,
  'comment-thread': MessageSquareText,
  math: BarChart3,
  comparison: BarChart3,
  'communication-proof': MessageSquareText,
  'problem-solution': Sparkles,
  'proof-card': CheckSquare2,
  'product-demo': Play,
  scorecard: CheckSquare2,
  'benchmark-chart': BarChart3,
  calculator: BarChart3,
  'case-study': FileText,
  checklist: CheckSquare2,
} as const;

export default function ConceptPreview({ concept }: { concept: GeneratedConcept }) {
  const Icon = familyIcons[concept.visualFamily];
  return (
    <div className={`cb-concept-preview cb-family-${concept.visualFamily}`} aria-label={`${concept.title} creative preview`}>
      <div className="cb-preview-topline"><span>Creative direction</span><Icon size={18} aria-hidden="true" /></div>
      <div className="cb-preview-body">
        <span className="cb-preview-kicker">{concept.persuasionJob.replaceAll('-', ' ')}</span>
        <strong>{concept.headline}</strong>
        <p>{concept.primaryText}</p>
      </div>
      <div className="cb-preview-cta">{concept.cta}</div>
      {!concept.staticOutput && <div className="cb-preview-overlay"><Play size={20} fill="currentColor" aria-hidden="true" /> Planning treatment</div>}
    </div>
  );
}
