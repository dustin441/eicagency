'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Pencil, Trash2, UserPlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HOME_PATH, type AccessLevel, type ProfileRole } from '@/lib/tenant';
import { addTeamMember, removeTeamMember, updateTeamMember } from '@/app/dashboard/team/actions';

export type TeamMember = {
  id: string;
  email: string;
  fullName: string;
  role: ProfileRole;
  access: Record<string, AccessLevel>;
  lastSignIn: string | null;
  isSelf: boolean;
};

type ClientOption = { id: string; name: string };
type LevelChoice = AccessLevel | 'none';

type Draft = {
  userId: string | null;
  email: string;
  fullName: string;
  role: 'partner_admin' | 'client';
  access: Record<string, LevelChoice>;
};

export const LEVEL_LABELS: Record<AccessLevel, string> = { viewer: 'Viewer', admin: 'Client Admin' };

function isEditable(member: TeamMember): boolean {
  return !member.isSelf && (member.role === 'partner_admin' || member.role === 'client');
}

function roleLabel(member: TeamMember): string {
  if (member.role === 'partner_admin') return 'Master Admin';
  if (member.role === 'client') return 'Dashboard access';
  return 'Master Admin (EIC)';
}

export function formatLastSignIn(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never';
}

export default function TeamManagerClient({
  members,
  clients,
  agencyName,
}: {
  members: TeamMember[];
  clients: ClientOption[];
  agencyName: string;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState<{ kind: 'error' | 'notice'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const clientName = (id: string) => clients.find(c => c.id === id)?.name ?? id;

  function emptyDraft(): Draft {
    return { userId: null, email: '', fullName: '', role: 'client', access: Object.fromEntries(clients.map(c => [c.id, 'none'])) };
  }

  function save() {
    if (!draft) return;
    setMessage(null);
    startTransition(async () => {
      const payload = { fullName: draft.fullName, role: draft.role, access: draft.access };
      const result = draft.userId
        ? await updateTeamMember({ userId: draft.userId, ...payload })
        : await addTeamMember({ email: draft.email, ...payload });
      if (result.error) {
        setMessage({ kind: 'error', text: result.error });
        return;
      }
      setDraft(null);
      setMessage({ kind: 'notice', text: result.notice ?? 'Saved' });
    });
  }

  function remove(member: TeamMember) {
    if (!window.confirm(`Remove ${member.email}? They will lose access to every dashboard.`)) return;
    setMessage(null);
    startTransition(async () => {
      const result = await removeTeamMember(member.id);
      setMessage(result.error ? { kind: 'error', text: result.error } : { kind: 'notice', text: result.notice ?? 'Removed' });
    });
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href={HOME_PATH} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-brand-dark">
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
          <h1 className="text-3xl font-bold text-brand-dark tracking-tight mt-2">Settings</h1>
          <p className="text-gray-500 mt-1">
            Every user and their permissions on each {agencyName} dashboard. Master Admins see all dashboards and this page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setMessage(null); setDraft(emptyDraft()); }}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-forest px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
        >
          <UserPlus className="w-4 h-4" />
          Add user
        </button>
      </div>

      {message && <StatusMessage kind={message.kind} text={message.text} />}

      {draft && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-brand-dark">{draft.userId ? 'Edit access' : 'Add user'}</h2>
            <button type="button" onClick={() => setDraft(null)} aria-label="Close" className="text-gray-400 hover:text-brand-dark">
              <X className="w-5 h-5" />
            </button>
          </div>
          <UserFields
            email={draft.email}
            fullName={draft.fullName}
            emailLocked={Boolean(draft.userId)}
            onEmail={email => setDraft({ ...draft, email })}
            onName={fullName => setDraft({ ...draft, fullName })}
          />
          <fieldset className="space-y-2 text-sm">
            <legend className="font-medium text-gray-600 mb-1">Role</legend>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="role" checked={draft.role === 'client'} onChange={() => setDraft({ ...draft, role: 'client' })} />
                <span>Dashboard access (choose per dashboard)</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="role" checked={draft.role === 'partner_admin'} onChange={() => setDraft({ ...draft, role: 'partner_admin' })} />
                <span>Master Admin (all dashboards + Settings)</span>
              </label>
            </div>
          </fieldset>
          {draft.role === 'client' && (
            <fieldset className="space-y-2 text-sm">
              <legend className="font-medium text-gray-600 mb-1">Permission per dashboard</legend>
              <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
                {clients.map(c => (
                  <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="text-brand-dark">{c.name}</span>
                    <select
                      aria-label={`Permission on ${c.name}`}
                      value={draft.access[c.id] ?? 'none'}
                      onChange={e => setDraft({ ...draft, access: { ...draft.access, [c.id]: e.target.value as LevelChoice } })}
                      className="rounded-xl border border-gray-200 px-3 py-1.5 text-brand-dark"
                    >
                      <option value="none">No access</option>
                      <option value="viewer">{LEVEL_LABELS.viewer}</option>
                      <option value="admin">{LEVEL_LABELS.admin}</option>
                    </select>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400">Viewer: sees the dashboard. Client Admin: sees it and manages its users.</p>
            </fieldset>
          )}
          <FormButtons pending={pending} label={draft.userId ? 'Save' : 'Add user'} onCancel={() => setDraft(null)} onSave={save} />
        </div>
      )}

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-widest text-gray-400">
              <tr>
                <th className="px-5 py-3 font-medium">User</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Dashboards</th>
                <th className="px-5 py-3 font-medium">Last sign-in</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map(member => (
                <tr key={member.id}>
                  <UserCell fullName={member.fullName} email={member.email} />
                  <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{roleLabel(member)}{member.isSelf ? ' (you)' : ''}</td>
                  <td className="px-5 py-4 text-gray-600">
                    {member.role === 'client'
                      ? Object.entries(member.access).map(([id, level]) => `${clientName(id)} (${LEVEL_LABELS[level]})`).join(', ') || '—'
                      : 'All dashboards'}
                  </td>
                  <td className="px-5 py-4 text-gray-400 whitespace-nowrap">{formatLastSignIn(member.lastSignIn)}</td>
                  <td className="px-5 py-4">
                    {isEditable(member) && (
                      <RowButtons
                        email={member.email}
                        pending={pending}
                        onEdit={() => {
                          setMessage(null);
                          setDraft({
                            userId: member.id,
                            email: member.email,
                            fullName: member.fullName,
                            role: member.role === 'partner_admin' ? 'partner_admin' : 'client',
                            access: Object.fromEntries(clients.map(c => [c.id, member.access[c.id] ?? 'none'])),
                          });
                        }}
                        onRemove={() => remove(member)}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Shared pieces (also used by the per-dashboard Settings) ─────────────────

export function StatusMessage({ kind, text }: { kind: 'error' | 'notice'; text: string }) {
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-2xl border px-4 py-3 text-sm',
        kind === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800',
      )}
    >
      {text}
    </div>
  );
}

export function UserFields({
  email,
  fullName,
  emailLocked,
  onEmail,
  onName,
}: {
  email: string;
  fullName: string;
  emailLocked: boolean;
  onEmail: (value: string) => void;
  onName: (value: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-1 text-sm">
        <span className="font-medium text-gray-600">Email</span>
        <input
          type="email"
          value={email}
          disabled={emailLocked}
          onChange={e => onEmail(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-brand-dark disabled:bg-gray-50 disabled:text-gray-500"
          placeholder="name@company.com"
        />
      </label>
      <label className="space-y-1 text-sm">
        <span className="font-medium text-gray-600">Full name</span>
        <input
          type="text"
          value={fullName}
          onChange={e => onName(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-brand-dark"
        />
      </label>
    </div>
  );
}

export function FormButtons({ pending, label, onCancel, onSave }: { pending: boolean; label: string; onCancel: () => void; onSave: () => void }) {
  return (
    <div className="flex justify-end gap-3">
      <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm font-medium text-gray-500 hover:text-brand-dark">
        Cancel
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
      >
        {pending && <Loader2 className="w-4 h-4 animate-spin" />}
        {label}
      </button>
    </div>
  );
}

export function UserCell({ fullName, email }: { fullName: string; email: string }) {
  return (
    <td className="px-5 py-4">
      <div className="font-medium text-brand-dark">{fullName || email}</div>
      {fullName && <div className="text-gray-400">{email}</div>}
    </td>
  );
}

export function RowButtons({ email, pending, onEdit, onRemove }: { email: string; pending: boolean; onEdit: () => void; onRemove: () => void }) {
  return (
    <div className="flex justify-end gap-1">
      <button type="button" aria-label={`Edit ${email}`} onClick={onEdit} className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-brand-dark">
        <Pencil className="w-4 h-4" />
      </button>
      <button
        type="button"
        aria-label={`Remove ${email}`}
        onClick={onRemove}
        disabled={pending}
        className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
