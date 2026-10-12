'use client';

import React, { useActionState, useEffect, useRef } from 'react';
import { CheckCircle2, UploadCloud } from 'lucide-react';
import {
  importMedibraneGroundTruthReports,
  type MedibraneGroundTruthImportState,
} from './actions';

const initialState: MedibraneGroundTruthImportState = { ok: false, message: '' };

export default function MedibraneGroundTruthUpload() {
  const [state, formAction, pending] = useActionState(importMedibraneGroundTruthReports, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok, state.message]);

  return (
    <form ref={formRef} action={formAction} className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-white p-2.5 text-brand-forest shadow-sm">
          <UploadCloud className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">Refresh GroundTruth data</h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-600">
            Agency users can upload the original GroundTruth campaign or location XLSX export. The importer recognizes the native columns, refreshes only campaigns contained in the files, and keeps metrics unavailable in a location report, such as reach, from the latest campaign report.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="text-xs font-semibold text-gray-700">
          Collected on
          <input
            name="collected_at"
            type="date"
            defaultValue={today}
            required
            className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-forest focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <label className="text-xs font-semibold text-gray-700">
          Report start <span className="font-normal text-gray-400">(optional override)</span>
          <input
            name="report_start"
            type="date"
            className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-forest focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <label className="text-xs font-semibold text-gray-700">
          Report end <span className="font-normal text-gray-400">(optional override)</span>
          <input
            name="report_end"
            type="date"
            className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-forest focus:ring-2 focus:ring-emerald-100"
          />
        </label>
      </div>

      <label className="mt-3 block text-xs font-semibold text-gray-700">
        GroundTruth XLSX files
        <input
          name="files"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          multiple
          required
          className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-gray-900 file:px-4 file:py-2 file:text-xs file:font-bold file:text-white"
        />
      </label>
      <p className="mt-2 text-[11px] leading-4 text-gray-400">
        Up to five files, 3 MB combined. If the file name contains dates like <code>2026-09-17_2026-09-30</code>, those dates are used automatically unless you enter overrides above.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex items-center justify-center rounded-full bg-brand-forest px-5 py-2.5 text-xs font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Validating and importing…' : 'Upload and refresh'}
      </button>

      {state.message ? (
        <div className={`mt-4 flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold ${state.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
          {state.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : null}
          <span>{state.message}</span>
        </div>
      ) : null}
    </form>
  );
}
