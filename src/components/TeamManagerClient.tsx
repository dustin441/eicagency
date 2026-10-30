'use client';

import React, { useState, useTransition } from 'react';
import { Loader2, Pencil, Trash2, UserPlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProfileRole } from '@/lib/tenant';
import { addTeamMember, removeTeamMember, updateTeamMember } from '@/app/dashboard/team/actions';

export type TeamMember = {
  id: string;
  email: string;
  fullName: string;
  role: ProfileRole;
  clients: string[];
  lastSignIn: string | null;
  isSelf: boolean;
};

type ClientOption = { id: string; name: string };

type Draft = {
  userId: string | null;
  email: string;
  fullName: string;
  role: 'partner_admin' | 'client';
  clients: string[];
};

const EMPTY_DRAFT: Draft = { userId: null, email: '', fullName: '', role: 'client', clients: [] };

function roleLabel(role: ProfileRole, agencyName: string): string {
  if (role === 'partner_admin') return `${agencyName} admin`;
  if (role === 'client') return 'Client';
  return 'Agency (managed by EIC)';
}

function isManaged(member: TeamMember): boolean {
  return !member.isSelf && (member.role === 'partner_admin' || member.role === 'client');
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

  function save() {
    if (!draft) return;
    setMessage(null);
    startTransition(async () => {
      const result = draft.userId
        ? await updateTeamMember({ userId: draft.userId, fullName: draft.fullName, role: draft.role, clients: draft.clients })
        : await addTeamMember({ email: draft.email, fullName: draft.fullName, role: draft.role, clients: draft.clients });
      if (result.error) {
        setMessage({ kind: 'error', text: result.error });
        return;
      }
      setDraft(null);
      setMessage({ kind: 'notice', text: result.notice ?? 'Saved' });
    });
  }

  function remove(member: TeamMember) {
    if (!window.confirm(`Remove ${member.email}? They will lose access to this dashboard.`)) return;
    setMessage(null);
    startTransition(async () => {
      const result = await removeTeamMember(member.id);
      setMessage(result.error ? { kind: 'error', text: result.error } : { kind: 'notice', text: result.notice ?? 'Removed' });
    });
  }

  function toggleClient(id: string) {
    if (!draft) return;
    const next = draft.clients.includes(id) ? draft.clients.filter(c => c !== id) : [...draft.clients, id];
    setDraft({ ...draft, clients: next });
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-brand-dark tracking-tight">Settings</h1>
          <h2 className="text-lg font-bold text-brand-dark mt-6">Team</h2>
          <p className="text-gray-500 mt-1">Manage who can sign in and which clients they can see.</p>
        </div>
        <button
          type="button"
          onClick={() => { setMessage(null); setDraft({ ...EMPTY_DRAFT }); }}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-forest px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
        >
          <UserPlus className="w-4 h-4" />
          Add user
        </button>
      </div>

      {message && (
        <div
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={cn(
            'rounded-2xl border px-4 py-3 text-sm',
            message.kind === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800',
          )}
        >
          {message.text}
        </div>
      )}

      {draft && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-brand-dark">{draft.userId ? 'Edit access' : 'Add user'}</h2>
            <button type="button" onClick={() => setDraft(null)} aria-label="Close" className="text-gray-400 hover:text-brand-dark">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-gray-600">Email</span>
              <input
                type="email"
                value={draft.email}
                disabled={Boolean(draft.userId)}
                onChange={e => setDraft({ ...draft, email: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-brand-dark disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="name@company.com"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-gray-600">Full name</span>
              <input
                type="text"
                value={draft.fullName}
                onChange={e => setDraft({ ...draft, fullName: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-brand-dark"
              />
            </label>
          </div>
          <fieldset className="space-y-2 text-sm">
            <legend className="font-medium text-gray-600 mb-1">Role</legend>
            <div className="flex flex-wrap gap-3">
              {(['client', 'partner_admin'] as const).map(role => (
                <label key={role} className="inline-flex items-center gap-2">
                  <input type="radio" name="role" checked={draft.role === role} onChange={() => setDraft({ ...draft, role })} />
                  <span>{role === 'client' ? 'Client (selected clients only)' : `${agencyName} admin (all clients + Team)`}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {draft.role === 'client' && (
            <fieldset className="space-y-2 text-sm">
              <legend className="font-medium text-gray-600 mb-1">Clients</legend>
              <div className="flex flex-wrap gap-2">
                {clients.map(c => (
                  <label
                    key={c.id}
                    className={cn(
                      'inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5',
                      draft.clients.includes(c.id) ? 'border-brand-orange bg-brand-orange/10 text-brand-dark' : 'border-gray-200 text-gray-600',
                    )}
                  >
                    <input type="checkbox" className="sr-only" checked={draft.clients.includes(c.id)} onChange={() => toggleClient(c.id)} />
                    {c.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setDraft(null)} className="rounded-full px-4 py-2 text-sm font-medium text-gray-500 hover:text-brand-dark">
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {pending && <Loader2 className="w-4 h-4 animate-spin" />}
              {draft.userId ? 'Save' : 'Add user'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-widest text-gray-400">
              <tr>
                <th className="px-5 py-3 font-medium">User</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Clients</th>
                <th className="px-5 py-3 font-medium">Last sign-in</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map(member => (
                <tr key={member.id}>
                  <td className="px-5 py-4">
                    <div className="font-medium text-brand-dark">{member.fullName || member.email}</div>
                    {member.fullName && <div className="text-gray-400">{member.email}</div>}
                  </td>
                  <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{roleLabel(member.role, agencyName)}{member.isSelf ? ' (you)' : ''}</td>
                  <td className="px-5 py-4 text-gray-600">
                    {member.role === 'client' ? member.clients.map(clientName).join(', ') || '—' : 'All clients'}
                  </td>
                  <td className="px-5 py-4 text-gray-400 whitespace-nowrap">
                    {member.lastSignIn ? new Date(member.lastSignIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never'}
                  </td>
                  <td className="px-5 py-4">
                    {isManaged(member) && (
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          aria-label={`Edit ${member.email}`}
                          onClick={() => {
                            setMessage(null);
                            setDraft({
                              userId: member.id,
                              email: member.email,
                              fullName: member.fullName,
                              role: member.role === 'partner_admin' ? 'partner_admin' : 'client',
                              clients: member.clients,
                            });
                          }}
                          className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-brand-dark"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${member.email}`}
                          onClick={() => remove(member)}
                          disabled={pending}
                          className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
