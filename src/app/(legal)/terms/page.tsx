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
          <h2 className="text-2xl font-semibold mb-4">5. AI-Generated Content and Professional Review</h2>
          <p>
            The Service uses artificial intelligence to analyze documents and assist with
            form preparation. You acknowledge and agree that:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>
              <strong>AI May Contain Errors:</strong> AI-generated content, including extracted
              data, form suggestions, and document analysis, may contain inaccuracies, omissions,
              or errors
            </li>
            <li>
              <strong>Professional Review Required:</strong> All AI-generated content MUST be
              independently reviewed and verified by a licensed immigration attorney before
              filing with USCIS or any government agency
            </li>
            <li>
              <strong>No Guarantee of Accuracy:</strong> We make no warranties regarding the
              accuracy, completeness, or legal sufficiency of AI-generated outputs
            </li>
            <li>
              <strong>User Responsibility:</strong> You remain solely responsible for verifying
              all data and for all submissions to government agencies
            </li>
            <li>
              <strong>Not Legal Advice:</strong> The Service does not constitute legal advice
              and does not create an attorney-client relationship
            </li>
          </ul>
          <p className="mt-4">
            For complete information about AI limitations and requirements, please review our{' '}
            <a href="/ai-disclaimer" className="text-primary hover:underline">
              AI Technology Disclaimer
            </a>.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">6. Unauthorized Practice of Law</h2>
          <p>
            This Service is designed exclusively for use by licensed attorneys and their
            supervised staff. By using the Service, you represent and warrant that:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>
              You are a licensed attorney in good standing, or you are operating under the
              direct supervision of a licensed attorney
            </li>
            <li>
              You will not use the Service in any manner that constitutes the unauthorized
              practice of law in any jurisdiction
            </li>
            <li>
              You will not allow non-attorneys to use the Service to prepare immigration
              forms for others without attorney supervision
            </li>
            <li>
              You understand that the Service assists with document preparation but does not
              provide legal advice or legal services
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. Payment Terms</h2>
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
          <h2 className="text-2xl font-semibold mb-4">8. Intellectual Property</h2>
          <p>
            The Service and its original content, features, and functionality are owned by
            Immigration AI and are protected by international copyright, trademark, and
            other intellectual property laws. You retain ownership of content you upload.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">9. Indemnification</h2>
          <p>
            You agree to indemnify, defend, and hold harmless Immigration AI, its officers,
            directors, employees, agents, and affiliates from and against any and all claims,
            damages, losses, costs, and expenses (including reasonable attorneys&rsquo; fees)
            arising from or relating to:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Your use of the Service</li>
            <li>Your violation of these Terms</li>
            <li>Your violation of any rights of any third party</li>
            <li>
              Any immigration filing or legal action taken based on information or forms
              prepared using the Service
            </li>
            <li>
              Any claim that your use of AI-generated content resulted in harm to you or
              any third party
            </li>
            <li>
              Your failure to properly review and verify AI-generated content before filing
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">10. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, IMMIGRATION AI SHALL NOT BE LIABLE FOR
            ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY
            LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, INCLUDING
            BUT NOT LIMITED TO:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Errors or inaccuracies in AI-generated content</li>
            <li>Denial of visa or immigration benefit applications</li>
            <li>Delays in immigration processing</li>
            <li>Removal or deportation proceedings</li>
            <li>Any other immigration-related consequences</li>
          </ul>
          <p className="mt-4">
            OUR TOTAL LIABILITY FOR ALL CLAIMS ARISING FROM YOUR USE OF THE SERVICE SHALL
            NOT EXCEED THE AMOUNT YOU PAID TO US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">11. Disclaimer of Warranties</h2>
          <p>
            THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT
            WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
            IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
            NON-INFRINGEMENT. WE DO NOT WARRANT THAT:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>The Service will be uninterrupted or error-free</li>
            <li>AI-generated content will be accurate, complete, or current</li>
            <li>
              The Service will meet your specific immigration case requirements
            </li>
            <li>
              Forms prepared using the Service will be accepted by USCIS or any government agency
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">12. Termination</h2>
          <p>
            We may terminate or suspend your account immediately, without prior notice,
            for any breach of these Terms. Upon termination, your right to use the Service
            will cease immediately. You may request export of your data before termination.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">13. Governing Law and Jurisdiction</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of
            the State of Delaware, United States, without regard to its conflict of law
            provisions. You agree to submit to the exclusive jurisdiction of the state
            and federal courts located in Delaware for the resolution of any disputes
            arising from these Terms or your use of the Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">14. Dispute Resolution</h2>
          <p>
            Any dispute arising from or relating to these Terms or the Service shall first
            be attempted to be resolved through good-faith negotiation. If the dispute
            cannot be resolved within thirty (30) days, either party may pursue formal
            legal remedies. You agree to waive any right to a jury trial and to participate
            in any class action lawsuit against Immigration AI.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">15. Changes to Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. We will notify you of
            any material changes by posting the new Terms on this page and updating the
            &ldquo;Last updated&rdquo; date. Your continued use of the Service after such
            changes constitutes acceptance of the new Terms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">16. Severability</h2>
          <p>
            If any provision of these Terms is held to be invalid or unenforceable, such
            provision shall be struck and the remaining provisions shall remain in full
            force and effect.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">17. Contact Us</h2>
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
