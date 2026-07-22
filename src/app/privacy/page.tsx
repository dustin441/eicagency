import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPageLayout from '@/components/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Learn how EIC Agency collects, uses, protects, retains, and deletes information across its website, client dashboards, and connected advertising platforms.',
  alternates: {
    canonical: '/privacy',
  },
  openGraph: {
    title: 'Privacy Policy | EIC Agency',
    description:
      'How EIC Agency handles information across its website, client dashboards, and connected advertising platforms.',
    url: '/privacy',
  },
};

const sectionHeading = 'text-2xl font-semibold tracking-[-0.03em] text-brand-forest';
const subheading = 'mt-6 text-lg font-bold text-slate-900';
const listClass = 'mt-4 list-disc space-y-2 pl-6';

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      eyebrow="Legal"
      title="Privacy Policy"
      intro="This Privacy Policy explains how Every Impression Counts LLC, doing business as EIC Agency, handles information when you visit our website, use our client dashboards, communicate with us, or authorize us to connect to advertising and business platforms."
      lastUpdated="July 22, 2026"
    >
      <section>
        <h2 className={sectionHeading}>1. Scope</h2>
        <p className="mt-4">
          This policy applies to EIC Agency websites, dashboards, applications, reporting tools, marketing activities, and services that link to this policy. It also applies when an authorized business connects an advertising, analytics, customer relationship management, or other business account to an EIC Agency application.
        </p>
        <p className="mt-4">
          When we process personal information solely on behalf of a client or agency partner, that client or partner may be the business responsible for the information. Our agreement with that organization and its privacy notices may also apply.
        </p>
      </section>

      <section>
        <h2 className={sectionHeading}>2. Information we collect</h2>
        <h3 className={subheading}>Information you provide</h3>
        <ul className={listClass}>
          <li>Contact details such as your name, business name, email address, telephone number, and job information.</li>
          <li>Information submitted through forms, booking tools, email, support requests, surveys, or other communications.</li>
          <li>Account and profile information used to access EIC Agency dashboards and services.</li>
          <li>Materials you or an authorized organization provide for campaign management, reporting, creative production, or support.</li>
        </ul>

        <h3 className={subheading}>Information from connected platforms</h3>
        <p className="mt-4">
          If you authorize EIC Agency to connect to Meta or another platform, we may receive information allowed by the permissions you approve, including:
        </p>
        <ul className={listClass}>
          <li>Platform identifiers, app-scoped user identifiers, business portfolio information, Pages, and advertising account identifiers.</li>
          <li>Campaign, ad set, ad, creative, placement, audience, budget, delivery, and performance information.</li>
          <li>Aggregated conversion, lead, sales, and attribution information made available through the connected account.</li>
          <li>Access tokens, permission records, and other authorization information needed to maintain the connection.</li>
        </ul>
        <p className="mt-4">
          We access this information only after an authorized person grants permission and only to operate the requested services, such as campaign management, reporting, optimization, creative review, and client dashboards.
        </p>

        <h3 className={subheading}>Information collected automatically</h3>
        <ul className={listClass}>
          <li>Device, browser, operating system, IP address, approximate location, referring page, and request information.</li>
          <li>Pages viewed, links clicked, session activity, errors, and interactions with our website or services.</li>
          <li>Cookie and similar technology data collected through tools such as Google Tag Manager and the analytics or marketing tags configured through it.</li>
        </ul>
      </section>

      <section>
        <h2 className={sectionHeading}>3. How we use information</h2>
        <ul className={listClass}>
          <li>Provide, maintain, personalize, and secure our websites, dashboards, applications, and services.</li>
          <li>Authenticate users and maintain authorized platform connections.</li>
          <li>Create and manage advertising campaigns, reporting, analysis, recommendations, creative, and optimization workflows.</li>
          <li>Respond to inquiries, schedule meetings, provide support, and communicate about services.</li>
          <li>Monitor performance, diagnose errors, prevent fraud or misuse, and improve our services.</li>
          <li>Generate client-authorized summaries and insights, including through automated and artificial intelligence assisted tools.</li>
          <li>Comply with applicable law, enforce agreements, and protect the rights and safety of EIC Agency, our clients, users, and others.</li>
        </ul>
      </section>

      <section>
        <h2 className={sectionHeading}>4. Meta Platform Data</h2>
        <p className="mt-4">
          EIC Agency applications may use Meta permissions to access advertising and business information for accounts that an authorized user chooses to connect. We use Meta Platform Data only to provide requested services, operate and secure the application, provide support, and comply with law and Meta&apos;s applicable terms and policies.
        </p>
        <p className="mt-4">
          We do not sell Meta Platform Data, use it to build unrelated consumer profiles, or disclose it to data brokers. Access is limited to personnel and service providers who need it to provide or protect the requested service. Disconnecting an account does not automatically delete information previously imported into EIC systems; you may request deletion as described below.
        </p>
      </section>

      <section>
        <h2 className={sectionHeading}>5. How we disclose information</h2>
        <p className="mt-4">We may disclose information in the following circumstances:</p>
        <ul className={listClass}>
          <li><strong>Service providers:</strong> vendors that support hosting, databases, authentication, analytics, communications, booking, campaign operations, automation, artificial intelligence assisted features, and security.</li>
          <li><strong>Clients and agency partners:</strong> organizations that authorized the work or account connection, including through white-label reporting and campaign-management services.</li>
          <li><strong>Advertising and business platforms:</strong> when needed to carry out authorized campaign, measurement, or integration activity.</li>
          <li><strong>Legal and safety purposes:</strong> when reasonably necessary to comply with law, legal process, enforce agreements, or protect rights, property, and safety.</li>
          <li><strong>Business transactions:</strong> in connection with a merger, acquisition, financing, reorganization, or sale of all or part of the business, subject to appropriate safeguards.</li>
          <li><strong>With your direction or consent:</strong> when you ask us or authorize us to disclose information.</li>
        </ul>
        <p className="mt-4">
          We do not sell personal information for money. Some analytics or advertising technology disclosures may be treated as a sale, sharing, or targeted advertising under certain privacy laws. You may contact us to exercise any applicable opt-out right.
        </p>
      </section>

      <section>
        <h2 className={sectionHeading}>6. Cookies and analytics</h2>
        <p className="mt-4">
          We and our service providers use cookies, tags, pixels, local storage, and similar technologies to operate the site, remember settings, measure traffic and performance, understand engagement, and support advertising. You can control many cookies through your browser settings. Blocking some technologies may affect site functionality.
        </p>
      </section>

      <section>
        <h2 className={sectionHeading}>7. Data retention</h2>
        <p className="mt-4">
          We retain information only for as long as reasonably necessary for the purposes described in this policy, including providing contracted services, maintaining accurate business and security records, resolving disputes, enforcing agreements, and meeting legal obligations. Retention periods vary based on the type of information, the client relationship, platform requirements, and applicable law.
        </p>
        <p className="mt-4">
          When a connected account is removed or a verified deletion request is completed, we delete or de-identify covered information unless retention is required by law, needed for security or fraud prevention, or permitted under an applicable agreement. Residual copies may remain temporarily in protected backups until they are overwritten under normal retention schedules.
        </p>
      </section>

      <section>
        <h2 className={sectionHeading}>8. Security</h2>
        <p className="mt-4">
          We use administrative, technical, and organizational safeguards designed to protect information, including access controls, authentication, encryption where appropriate, logging, and service-provider review. No transmission or storage system is completely secure, so we cannot guarantee absolute security.
        </p>
      </section>

      <section>
        <h2 className={sectionHeading}>9. Your choices and privacy rights</h2>
        <p className="mt-4">
          Depending on where you live, you may have rights to request access, correction, deletion, or a copy of your personal information, and to object to or limit certain processing. You may also have the right to opt out of certain targeted advertising, sale, or sharing. We may need to verify your identity and authority before acting on a request.
        </p>
        <p className="mt-4">
          To request deletion of information associated with an EIC Agency application or connected Meta account, follow our{' '}
          <Link href="/data-deletion" className="font-bold text-brand-forest underline decoration-brand-orange/50 underline-offset-4">
            Data Deletion Instructions
          </Link>
          . You can also withdraw platform permissions through the relevant platform&apos;s account settings. Withdrawal may prevent some services from functioning.
        </p>
      </section>

      <section>
        <h2 className={sectionHeading}>10. Children&apos;s privacy</h2>
        <p className="mt-4">
          Our services are intended for businesses and are not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided information to us, contact us so we can review and delete it where appropriate.
        </p>
      </section>

      <section>
        <h2 className={sectionHeading}>11. International processing</h2>
        <p className="mt-4">
          EIC Agency and its service providers may process information in the United States and other countries. These locations may have privacy laws different from those where you live. Where required, we use appropriate safeguards for international transfers.
        </p>
      </section>

      <section>
        <h2 className={sectionHeading}>12. Third-party services</h2>
        <p className="mt-4">
          Our website and services may link to or integrate with third-party services. Their privacy practices are governed by their own policies. This policy does not control how Meta, Google, LinkedIn, YouTube, booking providers, or other third parties process information in their own capacity.
        </p>
      </section>

      <section>
        <h2 className={sectionHeading}>13. Changes to this policy</h2>
        <p className="mt-4">
          We may update this policy as our services, platform integrations, or legal obligations change. We will post the updated version here and revise the date above. Material changes may also be communicated through the service or by other appropriate means.
        </p>
      </section>

      <section>
        <h2 className={sectionHeading}>14. Contact us</h2>
        <p className="mt-4">
          For privacy questions or requests, contact:
        </p>
        <address className="mt-4 not-italic">
          <strong className="text-slate-900">Every Impression Counts LLC, doing business as EIC Agency</strong><br />
          Tempe, Arizona, United States<br />
          Email: <a href="mailto:eic@eic.agency" className="font-bold text-brand-forest underline decoration-brand-orange/50 underline-offset-4">eic@eic.agency</a>
        </address>
      </section>
    </LegalPageLayout>
  );
}
