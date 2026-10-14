import test from 'node:test';
import assert from 'node:assert/strict';
import {
  JOB_APPLICATION_MAX_RESUME_BYTES,
  validateJobApplication,
  validateResume,
} from './job-application.ts';

test('accepts a complete application', () => {
  assert.deepEqual(
    validateJobApplication({
      name: 'Taylor Candidate',
      email: 'taylor@example.com',
      phone: '(480) 555-0199',
      impact: 'I can connect paid media strategy, measurement, and team execution to improve client outcomes.',
    }),
    {},
  );
});

test('rejects incomplete and malformed applicant fields', () => {
  const errors = validateJobApplication({ name: 'T', email: 'bad', phone: '123', impact: 'Too short.' });
  assert.deepEqual(Object.keys(errors).sort(), ['email', 'impact', 'name', 'phone']);
});

test('enforces resume type and byte limits', () => {
  const valid = new File(['resume'], 'resume.pdf', { type: 'application/pdf' });
  assert.equal(validateResume(valid), null);

  const wrongType = new File(['resume'], 'resume.exe', { type: 'application/octet-stream' });
  assert.match(validateResume(wrongType) ?? '', /PDF, DOC, or DOCX/);

  const oversized = new File([new Uint8Array(JOB_APPLICATION_MAX_RESUME_BYTES + 1)], 'resume.pdf', { type: 'application/pdf' });
  assert.match(validateResume(oversized) ?? '', /smaller than 4 MB/);
});
