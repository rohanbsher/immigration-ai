import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | Immigration AI',
  description: 'Terms of service for Immigration AI platform',
};

export default function TermsOfServicePage() {
  return (
    <div className="container max-w-4xl py-12">
      <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
      <p className="text-muted-foreground mb-8">Last updated: January 2024</p>

      <div className="prose prose-gray dark:prose-invert max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
          <p>
            By accessing or using Immigration AI (&ldquo;Service&rdquo;), you agree to be bound by these
            Terms of Service. If you do not agree to these terms, you may not use the Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
          <p>
            Immigration AI is a case management platform that uses artificial intelligence
            to assist immigration attorneys and their clients with document analysis, form
            preparation, and case tracking. The Service is designed to enhance, not replace,
            professional legal judgment.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>You must provide accurate and complete registration information</li>
            <li>You are responsible for maintaining the security of your account</li>
            <li>You must notify us immediately of any unauthorized access</li>
            <li>You may not share your account credentials with others</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Use the Service for any unlawful purpose</li>
            <li>Upload malicious code or interfere with the Service</li>
            <li>Attempt to gain unauthorized access to other accounts</li>
            <li>Use the Service to store or transmit harmful content</li>
            <li>Violate any applicable laws or regulations</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. AI-Generated Content</h2>
          <p>
            The Service uses artificial intelligence to analyze documents and assist with
            form preparation. You acknowledge that:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>AI-generated content should be reviewed by qualified professionals</li>
            <li>We do not guarantee the accuracy of AI-generated outputs</li>
            <li>You remain responsible for all submissions to government agencies</li>
            <li>The Service does not constitute legal advice</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">6. Payment Terms</h2>
          <p>
            For paid subscriptions:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Fees are billed in advance on a monthly or annual basis</li>
            <li>Subscriptions automatically renew unless cancelled</li>
            <li>Refunds are provided according to our refund policy</li>
            <li>We may change prices with 30 days notice</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. Intellectual Property</h2>
          <p>
            The Service and its original content, features, and functionality are owned by
            Immigration AI and are protected by international copyright, trademark, and
            other intellectual property laws. You retain ownership of content you upload.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">8. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, IMMIGRATION AI SHALL NOT BE LIABLE FOR
            ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY
            LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">9. Termination</h2>
          <p>
            We may terminate or suspend your account immediately, without prior notice,
            for any breach of these Terms. Upon termination, your right to use the Service
            will cease immediately. You may request export of your data before termination.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">10. Changes to Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. We will notify you of
            any material changes by posting the new Terms on this page and updating the
            &ldquo;Last updated&rdquo; date.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">11. Contact Us</h2>
          <p>
            If you have any questions about these Terms, please contact us:
          </p>
          <ul className="list-none mt-2 space-y-1">
            <li>Email: legal@immigrationai.app</li>
            <li>Address: [Company Address]</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
