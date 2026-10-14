import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { validateJobApplication, validateResume } from '@/lib/job-application';

export const runtime = 'nodejs';

const HIGHLEVEL_API_BASE = 'https://services.leadconnectorhq.com';
const IMPACT_FIELD_ID = 'kH564ikwZAtJzd4VILLF';
const RESUME_FIELD_ID = 'n39jwPYB4mN21ABfVVFT';
const ROLE_NAME = 'Performance Strategy & Analytics Manager';
const APPLICATION_TAGS = [
  'job applicant',
  'job applicant - performance strategy analytics manager',
];

function highLevelHeaders(token: string, version = '2021-07-28') {
  return {
    Authorization: `Bearer ${token}`,
    Version: version,
    Accept: 'application/json',
    'User-Agent': 'EIC-Careers-Form/1.0',
  };
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  return Boolean(origin && origin === new URL(request.url).origin);
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid submission origin.' }, { status: 403 });
  }

  const token = process.env.HIGHLEVEL_EIC_PRIVATE_INTEGRATION_TOKEN;
  const locationId = process.env.HIGHLEVEL_EIC_LOCATION_ID;
  const notificationUrl = process.env.EIC_JOB_APPLICATION_NOTIFICATION_WEBHOOK_URL;
  const notificationToken = process.env.EIC_JOB_APPLICATION_NOTIFICATION_TOKEN;
  if (!token || !locationId || !notificationUrl || !notificationToken) {
    console.error('Job application configuration is unavailable.');
    return NextResponse.json({ error: 'Applications are temporarily unavailable.' }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'We could not read this application.' }, { status: 400 });
  }

  const honeypot = String(formData.get('website') ?? '');
  const startedAt = Number(formData.get('startedAt') ?? 0);
  if (honeypot || !Number.isFinite(startedAt) || Date.now() - startedAt < 1500) {
    return NextResponse.json({ error: 'We could not accept this application.' }, { status: 400 });
  }

  const values = {
    name: String(formData.get('name') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    phone: String(formData.get('phone') ?? '').trim(),
    impact: String(formData.get('impact') ?? '').trim(),
  };
  const resumeValue = formData.get('resume');
  const resume = resumeValue instanceof File ? resumeValue : null;
  const fieldErrors: Record<string, string> = { ...validateJobApplication(values) };
  const resumeError = validateResume(resume);

  if (resumeError) fieldErrors.resume = resumeError;
  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ error: 'Review the highlighted fields.', fieldErrors }, { status: 400 });
  }

  const nameParts = values.name.split(/\s+/);
  const firstName = nameParts.shift() ?? values.name;
  const lastName = nameParts.join(' ');

  try {
    const upsertResponse = await fetch(`${HIGHLEVEL_API_BASE}/contacts/upsert`, {
      method: 'POST',
      headers: {
        ...highLevelHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firstName,
        lastName,
        name: values.name,
        email: values.email,
        phone: values.phone,
        locationId,
        source: `EIC Agency Careers - ${ROLE_NAME}`,
        customFields: [{ id: IMPACT_FIELD_ID, fieldValue: values.impact }],
      }),
      cache: 'no-store',
    });

    if (!upsertResponse.ok) {
      console.error('HighLevel job application upsert failed.', upsertResponse.status);
      return NextResponse.json({ error: 'We could not submit your application. Please try again.' }, { status: 502 });
    }

    const upsertResult = (await upsertResponse.json()) as { contact?: { id?: string } };
    const contactId = upsertResult.contact?.id;
    if (!contactId || !resume) {
      console.error('HighLevel job application response was incomplete.');
      return NextResponse.json({ error: 'We could not submit your application. Please try again.' }, { status: 502 });
    }

    const uploadBody = new FormData();
    uploadBody.append(`${RESUME_FIELD_ID}_${randomUUID()}`, resume, resume.name);
    const uploadResponse = await fetch(
      `${HIGHLEVEL_API_BASE}/forms/upload-custom-files?contactId=${encodeURIComponent(contactId)}&locationId=${encodeURIComponent(locationId)}`,
      {
        method: 'POST',
        headers: highLevelHeaders(token, 'v3'),
        body: uploadBody,
        cache: 'no-store',
      },
    );

    if (!uploadResponse.ok) {
      console.error('HighLevel resume upload failed.', uploadResponse.status);
      return NextResponse.json({ error: 'Your details were saved, but the resume upload failed. Please try again.' }, { status: 502 });
    }

    const tagResponse = await fetch(`${HIGHLEVEL_API_BASE}/contacts/${encodeURIComponent(contactId)}/tags`, {
      method: 'POST',
      headers: {
        ...highLevelHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tags: APPLICATION_TAGS }),
      cache: 'no-store',
    });

    if (!tagResponse.ok) {
      console.error('HighLevel applicant tagging failed.', tagResponse.status);
      return NextResponse.json({ error: 'Your application was saved, but final processing failed. Please try again.' }, { status: 502 });
    }

    const notificationResponse = await fetch(notificationUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${notificationToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: values.name,
        email: values.email,
        phone: values.phone,
        impact: values.impact,
        contactId,
        role: ROLE_NAME,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });

    if (!notificationResponse.ok) {
      console.error('Job application notification failed.', notificationResponse.status);
      return NextResponse.json({ error: 'Your application was saved, but the team notification failed. Please try again.' }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Job application request failed.', error instanceof Error ? error.name : 'Unknown error');
    return NextResponse.json({ error: 'We could not submit your application. Please try again.' }, { status: 502 });
  }
}
