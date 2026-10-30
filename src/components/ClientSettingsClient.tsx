'use client';

import React, { useState, useTransition } from 'react';
import { UserPlus, X } from 'lucide-react';
import type { AccessLevel } from '@/lib/tenant';
import { addClientUser, removeClientUser, setClientUserLevel } from '@/app/dashboard/team/actions';
import {
  FormButtons,
  LEVEL_LABELS,
  RowButtons,
  StatusMessage,
  UserCell,
  UserFields,
  formatLastSignIn,
} from '@/components/TeamManagerClient';

export type ClientUser = {
  id: string;
  email: string;
  fullName: string;
  level: AccessLevel;
  lastSignIn: string | null;
  isSelf: boolean;
};

type Draft = { userId: string | null; email: string; fullName: string; level: AccessLevel };

/** One dashboard's users. Only permissions for this client can be set here. */
export default function ClientSettingsClient({
  clientId,
  clientName,
  users,
}: {
  clientId: string;
  clientName: string;
  users: ClientUser[];
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState<{ kind: 'error' | 'notice'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    if (!draft) return;
    setMessage(null);
    startTransition(async () => {
      const result = draft.userId
        ? await setClientUserLevel({ clientId, userId: draft.userId, level: draft.level })
        : await addClientUser({ clientId, email: draft.email, fullName: draft.fullName, level: draft.level });
      if (result.error) {
        setMessage({ kind: 'error', text: result.error });
        return;
      }
      setDraft(null);
      setMessage({ kind: 'notice', text: result.notice ?? 'Saved' });
    });
  }

  function remove(user: ClientUser) {
    if (!window.confirm(`Remove ${user.email} from ${clientName}?`)) return;
    setMessage(null);
    startTransition(async () => {
      const result = await removeClientUser({ clientId, userId: user.id });
      setMessage(result.error ? { kind: 'error', text: result.error } : { kind: 'notice', text: result.notice ?? 'Removed' });
    });
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-brand-dark tracking-tight">Settings</h1>
          <p className="text-gray-500 mt-1">People with access to the {clientName} dashboard.</p>
        </div>
        <button
          type="button"
          onClick={() => { setMessage(null); setDraft({ userId: null, email: '', fullName: '', level: 'viewer' }); }}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-forest px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
        >
          <UserPlus className="w-4 h-4" />
          Invite user
        </button>
      </div>

      {message && <StatusMessage kind={message.kind} text={message.text} />}

      {draft && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-brand-dark">{draft.userId ? 'Change permission' : `Invite to ${clientName}`}</h2>
            <button type="button" onClick={() => setDraft(null)} aria-label="Close" className="text-gray-400 hover:text-brand-dark">
              <X className="w-5 h-5" />
            </button>
          </div>
          {!draft.userId && (
            <UserFields
              email={draft.email}
              fullName={draft.fullName}
              emailLocked={false}
              onEmail={email => setDraft({ ...draft, email })}
              onName={fullName => setDraft({ ...draft, fullName })}
            />
          )}
          <fieldset className="space-y-2 text-sm">
            <legend className="font-medium text-gray-600 mb-1">Permission on {clientName}</legend>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
              {(['viewer', 'admin'] as const).map(level => (
                <label key={level} className="inline-flex items-center gap-2">
                  <input type="radio" name="level" checked={draft.level === level} onChange={() => setDraft({ ...draft, level })} />
                  <span>{level === 'viewer' ? 'Viewer (sees the dashboard)' : 'Client Admin (sees it and manages its users)'}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <FormButtons pending={pending} label={draft.userId ? 'Save' : 'Send invite'} onCancel={() => setDraft(null)} onSave={save} />
        </div>
      )}

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-widest text-gray-400">
              <tr>
                <th className="px-5 py-3 font-medium">User</th>
                <th className="px-5 py-3 font-medium">Permission</th>
                <th className="px-5 py-3 font-medium">Last sign-in</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-6 text-center text-gray-400">No users yet.</td></tr>
              )}
              {users.map(user => (
                <tr key={user.id}>
                  <UserCell fullName={user.fullName} email={user.email} />
                  <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{LEVEL_LABELS[user.level]}{user.isSelf ? ' (you)' : ''}</td>
                  <td className="px-5 py-4 text-gray-400 whitespace-nowrap">{formatLastSignIn(user.lastSignIn)}</td>
                  <td className="px-5 py-4">
                    {!user.isSelf && (
                      <RowButtons
                        email={user.email}
                        pending={pending}
                        onEdit={() => { setMessage(null); setDraft({ userId: user.id, email: user.email, fullName: user.fullName, level: user.level }); }}
                        onRemove={() => remove(user)}
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
