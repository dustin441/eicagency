'use client';

import React, { useActionState, useEffect, useRef } from 'react';
import { UploadCloud } from 'lucide-react';
import { importGoodGameOrganicSocialCsvs } from './actions';

type ImportState = {
  ok: boolean;
  message: string;
};

const initialState: ImportState = { ok: false, message: '' };

export default function GoodGameOrganicSocialUpload() {
  const [state, formAction, pending] = useActionState(importGoodGameOrganicSocialCsvs, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok, state.message]);

  return (
    <form ref={formRef} action={formAction} className="rounded-[2rem] border border-dashed border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-orange-50 p-3 text-brand-orange">
          <UploadCloud className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-black text-gray-950">Upload organic social CSVs</h2>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            Upload the Facebook Content and Page Activity exports together. Leave the brand blank to use the Page name from the CSV.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <label className="text-sm font-bold text-gray-700">
          Brand override <span className="font-normal text-gray-400">(optional)</span>
          <input
            name="brand"
            placeholder="T-Pain, Good Game, etc."
            className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-brand-orange focus:ring-2 focus:ring-orange-100"
          />
        </label>
        <label className="text-sm font-bold text-gray-700">
          CSV files
          <input
            name="files"
            type="file"
            accept=".csv,text/csv"
            multiple
            required
            className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-gray-900 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-5 inline-flex items-center justify-center rounded-full bg-gray-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Importing…' : 'Import CSVs'}
      </button>

      {state.message ? (
        <p className={`mt-4 rounded-2xl px-4 py-3 text-sm font-bold ${state.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
