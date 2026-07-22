import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPageLayout from '@/components/LegalPageLayout';

export const metadata: Metadata = {
  title: 'User Data Deletion Instructions',
  description:
    'Instructions for requesting deletion of information associated with EIC Agency applications and connected Meta accounts.',
  alternates: {
    canonical: '/data-deletion',
  },
  openGraph: {
    title: 'User Data Deletion Instructions | EIC Agency',
    description:
      'How to request deletion of information associated with EIC Agency applications and connected Meta accounts.',
    url: '/data-deletion',
  },
};

const sectionHeading = 'text-2xl font-semibold tracking-[-0.03em] text-brand-forest';
const listClass = 'mt-4 list-disc space-y-2 pl-6';

export default function DataDeletionPage() {
  return (
    <LegalPageLayout
      eyebrow="Privacy"
      title="User Data Deletion Instructions"
      intro="Use these instructions to request deletion of information associated with an EIC Agency application, dashboard account, or connected Meta business or advertising account."
      lastUpdated="July 22, 2026"
    >
      <section>
        <h2 className={sectionHeading}>Request deletion by email</h2>
        <p className="mt-4">
          Email{' '}
          <a href="mailto:eic@eic.agency?subject=Meta%20App%20Data%20Deletion%20Request" className="font-bold text-brand-forest underline decoration-brand-orange/50 underline-offset-4">
            eic@eic.agency
          </a>{' '}
          with the subject line <strong>Meta App Data Deletion Request</strong> or <strong>Data Deletion Request</strong>.
        </p>
        <p className="mt-4">Include enough information for us to locate and verify the applicable records:</p>
        <ul className={listClass}>
          <li>Your full name and business email address.</li>
          <li>The organization or agency associated with the EIC Agency service.</li>
          <li>The relevant Meta Business Portfolio, Page, or ad account name or identifier, if known.</li>
          <li>Your app-scoped user identifier or confirmation code, if Meta provided one.</li>
          <li>A short description of the account or information you want deleted.</li>
        </ul>
        <p className="mt-4 font-semibold text-slate-900">
          Do not send passwords, access tokens, payment-card information, or other sensitive credentials by email.
        </p>
      </section>

      <section>
        <h2 className={sectionHeading}>Request deletion through Meta</h2>
        <p className="mt-4">
          You may remove the EIC Agency application and send a deletion request through your Facebook settings:
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-6">
          <li>Open Facebook and go to <strong>Settings &amp; Privacy</strong>, then <strong>Settings</strong>.</li>
          <li>Open <strong>Apps and Websites</strong>.</li>
          <li>Select the EIC Agency application and remove it.</li>
          <li>If shown, select <strong>Send Request</strong> or the available option to request deletion.</li>
        </ol>
        <p className="mt-4">
          Removing the application revokes future platform access. It may not automatically delete information previously imported into EIC Agency systems, so you may also email us if you want confirmation that covered records were deleted.
        </p>
      </section>

      <section>
        <h2 className={sectionHeading}>What happens after a request</h2>
        <ul className={listClass}>
          <li>We may ask for additional information to verify your identity, authority, and the accounts covered by the request.</li>
          <li>We will acknowledge a verifiable request and provide a status update or confirmation number where appropriate.</li>
          <li>We aim to complete verified deletion requests within 30 days unless applicable law requires a different period.</li>
          <li>We will delete or de-identify covered identifiers, authorization records, tokens, account mappings, and imported platform data within EIC Agency&apos;s control.</li>
          <li>Protected backup copies may remain until overwritten under normal retention schedules, and limited records may be retained when required by law, security, fraud-prevention, dispute, or contractual obligations.</li>
        </ul>
      </section>

      <section>
        <h2 className={sectionHeading}>What this request does not delete</h2>
        <p className="mt-4">
          An EIC Agency deletion request does not delete source information held independently by Meta, another advertising platform, your employer, an agency partner, or another client system. To delete information from those systems, submit a separate request to the organization that controls them.
        </p>
      </section>

      <section>
        <h2 className={sectionHeading}>Questions</h2>
        <p className="mt-4">
          For questions about deletion or our privacy practices, email{' '}
          <a href="mailto:eic@eic.agency" className="font-bold text-brand-forest underline decoration-brand-orange/50 underline-offset-4">
            eic@eic.agency
          </a>{' '}
          or review our{' '}
          <Link href="/privacy" className="font-bold text-brand-forest underline decoration-brand-orange/50 underline-offset-4">
            Privacy Policy
          </Link>
          .
        </p>
      </section>
    </LegalPageLayout>
  );
}
