import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Immigration AI',
  description: 'Privacy policy for Immigration AI platform',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="container max-w-4xl py-12">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
      <p className="text-muted-foreground mb-8">Last updated: February 2026</p>

      <div className="prose prose-gray dark:prose-invert max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
          <p>
            Immigration AI (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) is committed to protecting your privacy.
            This Privacy Policy explains how we collect, use, disclose, and safeguard your
            information when you use our immigration case management platform.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
          <h3 className="text-xl font-medium mb-2">Personal Information</h3>
          <p>We may collect the following types of personal information:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Name, email address, and contact information</li>
            <li>Immigration-related documents and data</li>
            <li>Case information and legal documents</li>
            <li>Payment and billing information</li>
            <li>Usage data and analytics</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
          <p>We use the collected information for:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Providing and maintaining our services</li>
            <li>Processing immigration documents with AI assistance</li>
            <li>Communicating with you about your cases</li>
            <li>Improving our platform and services</li>
            <li>Complying with legal obligations</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. Data Security</h2>
          <p>
            We implement appropriate technical and organizational measures to protect your
            personal data against unauthorized access, alteration, disclosure, or destruction.
            This includes encryption, secure storage, and access controls.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. Your Rights (GDPR)</h2>
          <p>Under GDPR, European Economic Area residents have the following rights:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li><strong>Right to Access:</strong> Request a copy of your personal data</li>
            <li><strong>Right to Rectification:</strong> Request correction of inaccurate data</li>
            <li><strong>Right to Erasure:</strong> Request deletion of your data</li>
            <li><strong>Right to Data Portability:</strong> Receive your data in a portable format</li>
            <li><strong>Right to Object:</strong> Object to processing of your data</li>
            <li><strong>Right to Withdraw Consent:</strong> Withdraw consent at any time</li>
          </ul>
          <p className="mt-4">
            To exercise these rights, visit your account settings or contact us at
            privacy@immigrationai.app
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">6. California Privacy Rights (CCPA/CPRA)</h2>
          <p>
            California residents have additional rights under the California Consumer Privacy
            Act (CCPA) and California Privacy Rights Act (CPRA):
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>
              <strong>Right to Know:</strong> Request information about the categories and
              specific pieces of personal information we have collected about you
            </li>
            <li>
              <strong>Right to Delete:</strong> Request deletion of your personal information,
              subject to certain exceptions
            </li>
            <li>
              <strong>Right to Correct:</strong> Request correction of inaccurate personal
              information
            </li>
            <li>
              <strong>Right to Opt-Out:</strong> Opt out of the sale or sharing of your
              personal information (note: we do not sell personal information)
            </li>
            <li>
              <strong>Right to Limit Use:</strong> Limit the use of sensitive personal
              information to purposes authorized by the CPRA
            </li>
            <li>
              <strong>Right to Non-Discrimination:</strong> We will not discriminate against
              you for exercising any of your CCPA/CPRA rights
            </li>
          </ul>
          <p className="mt-4">
            To exercise these rights, visit your account settings, email us at
            privacy@immigrationai.app, or contact us at support@immigrationai.app.
          </p>
          <p className="mt-2">
            <strong>Categories of Personal Information Collected:</strong> We collect
            identifiers, professional information, commercial information, internet activity,
            and sensitive personal information as described in Section 2 above.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. Data Retention</h2>
          <p>
            We retain your personal data for as long as necessary to provide our services
            and comply with legal obligations:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>
              <strong>Account Data:</strong> Retained while your account is active and for
              30 days after deletion request
            </li>
            <li>
              <strong>Case Data:</strong> Retained for 7 years after case closure to comply
              with legal record-keeping requirements
            </li>
            <li>
              <strong>Billing Records:</strong> Retained for 7 years for tax and accounting
              purposes
            </li>
            <li>
              <strong>Audit Logs:</strong> Retained for 3 years for security and compliance
            </li>
          </ul>
          <p className="mt-4">
            You can request deletion of your account and associated data at any time
            through your account settings.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">8. Third-Party Services (Sub-Processors)</h2>
          <p>
            We use third-party services to provide our platform. All sub-processors are
            bound by data processing agreements and maintain appropriate security measures:
          </p>
          <div className="overflow-x-auto mt-4">
            <table className="min-w-full border border-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Provider</th>
                  <th className="px-4 py-2 text-left font-semibold">Purpose</th>
                  <th className="px-4 py-2 text-left font-semibold">Location</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="px-4 py-2">Supabase</td>
                  <td className="px-4 py-2">Database and storage</td>
                  <td className="px-4 py-2">United States</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-4 py-2">Anthropic</td>
                  <td className="px-4 py-2">AI document analysis</td>
                  <td className="px-4 py-2">United States</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-4 py-2">OpenAI</td>
                  <td className="px-4 py-2">AI document analysis</td>
                  <td className="px-4 py-2">United States</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-4 py-2">Stripe</td>
                  <td className="px-4 py-2">Payment processing</td>
                  <td className="px-4 py-2">United States</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-4 py-2">Resend</td>
                  <td className="px-4 py-2">Email delivery</td>
                  <td className="px-4 py-2">United States</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-4 py-2">Vercel</td>
                  <td className="px-4 py-2">Application hosting</td>
                  <td className="px-4 py-2">United States</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-4 py-2">Sentry</td>
                  <td className="px-4 py-2">Error monitoring</td>
                  <td className="px-4 py-2">United States</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            We will notify users of any material changes to our sub-processor list.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">9. International Data Transfers</h2>
          <p>
            Your personal data may be transferred to and processed in countries outside
            your country of residence. For transfers outside the EEA, we rely on:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Standard Contractual Clauses approved by the European Commission</li>
            <li>EU-US Data Privacy Framework certification (where applicable)</li>
            <li>Binding Corporate Rules of our service providers</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">10. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us:
          </p>
          <ul className="list-none mt-2 space-y-1">
            <li>Email: privacy@immigrationai.app</li>
            <li>Address: Immigration AI, Inc.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
