'use client';

import { ChangeEvent, FormEvent, useRef, useState } from 'react';
import { CheckCircle2, FileText, Loader2, Upload } from 'lucide-react';
import {
  JOB_APPLICATION_MAX_RESUME_BYTES,
  validateJobApplication,
  validateResume,
} from '@/lib/job-application';

type FieldErrors = Record<string, string>;

export default function JobApplicationForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [fileName, setFileName] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setFileName(file?.name ?? '');
    const error = validateResume(file);
    setFieldErrors((current) => ({ ...current, resume: error ?? '' }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError('');

    const form = event.currentTarget;
    const data = new FormData(form);
    data.set('startedAt', String(startedAt));
    const values = {
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? ''),
      phone: String(data.get('phone') ?? ''),
      impact: String(data.get('impact') ?? ''),
    };
    const resumeValue = data.get('resume');
    const resume = resumeValue instanceof File ? resumeValue : null;
    const nextErrors: FieldErrors = { ...validateJobApplication(values) };
    const resumeError = validateResume(resume);
    if (resumeError) nextErrors.resume = resumeError;
    setFieldErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/job-applications', { method: 'POST', body: data });
      const result = (await response.json()) as { error?: string; fieldErrors?: FieldErrors };
      if (!response.ok) {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        setSubmitError(result.error ?? 'We could not submit your application. Please try again.');
        return;
      }

      formRef.current?.reset();
      setFileName('');
      setFieldErrors({});
      setStartedAt(Date.now());
      setSubmitted(true);
    } catch {
      setSubmitError('We could not submit your application. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-[2rem] border border-brand-forest/10 bg-white p-8 text-center shadow-xl shadow-brand-forest/10 sm:p-12">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-forest text-white">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h2 className="mt-6 text-3xl font-semibold tracking-[-0.045em] text-brand-forest">Application received.</h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-600">
          Thank you for taking the time to tell us where you can make an impact. The EIC team will review your application and contact you if there is a fit.
        </p>
      </div>
    );
  }

  const inputClass = 'mt-2 w-full rounded-2xl border border-brand-forest/15 bg-white px-4 py-3.5 text-base text-slate-950 outline-none transition focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10';

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="rounded-[2.5rem] border border-brand-forest/10 bg-white p-7 shadow-xl shadow-brand-forest/10 sm:p-10 lg:p-12">
      <div className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">Apply for this role</p>
        <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-brand-forest sm:text-5xl">Tell us where you can make an impact.</h2>
        <p className="mt-5 text-lg leading-8 text-slate-600">
          Share your contact information, resume, and the part of this role where your experience can contribute most.
        </p>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <label className="text-sm font-bold text-brand-forest">
          Full name
          <input name="name" autoComplete="name" required maxLength={120} className={inputClass} aria-describedby={fieldErrors.name ? 'application-name-error' : undefined} />
          {fieldErrors.name ? <span id="application-name-error" className="mt-2 block text-sm font-medium text-red-700">{fieldErrors.name}</span> : null}
        </label>

        <label className="text-sm font-bold text-brand-forest">
          Email
          <input name="email" type="email" autoComplete="email" required maxLength={254} className={inputClass} aria-describedby={fieldErrors.email ? 'application-email-error' : undefined} />
          {fieldErrors.email ? <span id="application-email-error" className="mt-2 block text-sm font-medium text-red-700">{fieldErrors.email}</span> : null}
        </label>

        <label className="text-sm font-bold text-brand-forest sm:col-span-2">
          Phone number
          <input name="phone" type="tel" autoComplete="tel" required maxLength={40} className={inputClass} aria-describedby={fieldErrors.phone ? 'application-phone-error' : undefined} />
          {fieldErrors.phone ? <span id="application-phone-error" className="mt-2 block text-sm font-medium text-red-700">{fieldErrors.phone}</span> : null}
        </label>

        <label className="text-sm font-bold text-brand-forest sm:col-span-2">
          Where do you feel you can make the most impact based on your skill set and what this role is asking for?
          <textarea name="impact" required minLength={50} maxLength={2500} rows={7} className={`${inputClass} resize-y`} aria-describedby={fieldErrors.impact ? 'application-impact-error' : 'application-impact-help'} />
          {fieldErrors.impact ? (
            <span id="application-impact-error" className="mt-2 block text-sm font-medium text-red-700">{fieldErrors.impact}</span>
          ) : (
            <span id="application-impact-help" className="mt-2 block text-sm font-medium text-slate-500">50–2,500 characters</span>
          )}
        </label>

        <label className="text-sm font-bold text-brand-forest sm:col-span-2">
          Resume
          <span className="mt-2 flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-brand-forest/25 bg-[#f7f4ef] px-5 py-5 transition hover:border-brand-orange hover:bg-brand-orange/[0.04]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand-orange shadow-sm">
              {fileName ? <FileText className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
            </span>
            <span>
              <span className="block font-bold text-brand-forest">{fileName || 'Choose your resume'}</span>
              <span className="mt-1 block text-sm font-medium text-slate-500">PDF, DOC, or DOCX, up to {JOB_APPLICATION_MAX_RESUME_BYTES / 1_000_000} MB</span>
            </span>
            <input name="resume" type="file" required accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={handleFileChange} />
          </span>
          {fieldErrors.resume ? <span className="mt-2 block text-sm font-medium text-red-700">{fieldErrors.resume}</span> : null}
        </label>
      </div>

      <label className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <input type="hidden" name="startedAt" value={startedAt} readOnly />

      {submitError ? <div role="alert" className="mt-6 rounded-2xl bg-red-50 px-5 py-4 text-sm font-semibold text-red-800">{submitError}</div> : null}

      <button type="submit" disabled={submitting} className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-orange px-6 py-4 text-base font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 sm:w-auto">
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
        {submitting ? 'Submitting application…' : 'Submit application'}
      </button>
      <p className="mt-4 text-sm leading-6 text-slate-500">By submitting, you agree that EIC Agency may contact you about this role.</p>
    </form>
  );
}
