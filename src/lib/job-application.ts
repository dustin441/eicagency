export const JOB_APPLICATION_MAX_RESUME_BYTES = 4_000_000;
export const JOB_APPLICATION_ALLOWED_RESUME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export const JOB_APPLICATION_ALLOWED_RESUME_EXTENSIONS = ['.pdf', '.doc', '.docx'] as const;

export type JobApplicationValues = {
  name: string;
  email: string;
  phone: string;
  impact: string;
};

export function validateJobApplication(values: JobApplicationValues) {
  const errors: Partial<Record<keyof JobApplicationValues, string>> = {};

  if (values.name.trim().length < 2 || values.name.trim().length > 120) {
    errors.name = 'Enter your full name.';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()) || values.email.trim().length > 254) {
    errors.email = 'Enter a valid email address.';
  }

  const phoneDigits = values.phone.replace(/\D/g, '');
  if (phoneDigits.length < 7 || phoneDigits.length > 15) {
    errors.phone = 'Enter a valid phone number.';
  }

  if (values.impact.trim().length < 50 || values.impact.trim().length > 2500) {
    errors.impact = 'Please share between 50 and 2,500 characters.';
  }

  return errors;
}

export function validateResume(file: File | null) {
  if (!file || file.size === 0) return 'Upload your resume.';
  if (file.size > JOB_APPLICATION_MAX_RESUME_BYTES) return 'Your resume must be smaller than 4 MB.';

  const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
  if (!JOB_APPLICATION_ALLOWED_RESUME_EXTENSIONS.includes(extension as (typeof JOB_APPLICATION_ALLOWED_RESUME_EXTENSIONS)[number])) {
    return 'Upload a PDF, DOC, or DOCX file.';
  }

  if (file.type && !JOB_APPLICATION_ALLOWED_RESUME_TYPES.has(file.type)) {
    return 'Upload a PDF, DOC, or DOCX file.';
  }

  return null;
}
