import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Immigration AI',
  description: 'Privacy policy for Immigration AI platform',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="container max-w-4xl py-12">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
      <p className="text-muted-foreground mb-8">Last updated: January 2024</p>

      <div className="prose prose-gray dark:prose-invert max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
          <p>
            Immigration AI ("we", "our", or "us") is committed to protecting your privacy.
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
          <p>Under GDPR, you have the following rights:</p>
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
          <h2 className="text-2xl font-semibold mb-4">6. Data Retention</h2>
          <p>
            We retain your personal data for as long as necessary to provide our services
            and comply with legal obligations. You can request deletion of your account
            and associated data at any time through your account settings.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. Third-Party Services</h2>
          <p>
            We may use third-party services to process your data, including:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Cloud storage providers (Supabase)</li>
            <li>AI processing services (OpenAI, Anthropic)</li>
            <li>Payment processors (Stripe)</li>
            <li>Email services (Resend)</li>
          </ul>
          <p className="mt-2">
            These providers are bound by strict data processing agreements and privacy
            standards.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">8. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us:
          </p>
          <ul className="list-none mt-2 space-y-1">
            <li>Email: privacy@immigrationai.app</li>
            <li>Address: [Company Address]</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
