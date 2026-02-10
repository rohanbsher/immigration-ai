import { Metadata } from 'next';
import { AlertTriangle, Scale, FileCheck, UserCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'AI Technology Disclaimer | Immigration AI',
  description: 'Important information about AI-assisted document processing and form preparation',
};

export default function AIDisclaimerPage() {
  return (
    <div className="container max-w-4xl py-12">
      <h1 className="text-4xl font-bold mb-4">AI Technology Disclaimer</h1>
      <p className="text-muted-foreground mb-8">Last updated: February 2026</p>

      {/* Critical Warning Banner */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-6 mb-8">
        <div className="flex items-start gap-4">
          <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-1" />
          <div>
            <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-2">
              Important Notice
            </h2>
            <p className="text-amber-700 dark:text-amber-300">
              Immigration AI is a technology tool designed to assist licensed immigration
              attorneys. It is <strong>NOT</strong> a substitute for professional legal advice.
              All AI-generated content must be reviewed by a qualified immigration attorney
              before any filing with USCIS or other government agencies.
            </p>
          </div>
        </div>
      </div>

      <div className="prose prose-gray dark:prose-invert max-w-none">
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Scale className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold m-0">Not Legal Advice</h2>
          </div>
          <p>
            Immigration AI provides AI-assisted document analysis and form preparation tools.
            The use of this platform:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>
              <strong>Does not create an attorney-client relationship</strong> between you and
              Immigration AI or its operators
            </li>
            <li>
              <strong>Does not constitute legal advice</strong> under any jurisdiction
            </li>
            <li>
              <strong>Does not replace the professional judgment</strong> of a licensed
              immigration attorney
            </li>
            <li>
              <strong>Should not be relied upon</strong> as the sole basis for any immigration
              filing or legal decision
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <FileCheck className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold m-0">AI Accuracy Limitations</h2>
          </div>
          <p>
            Our artificial intelligence technology, while advanced, has inherent limitations:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>
              <strong>AI may produce errors:</strong> Extracted data, suggested form entries,
              and document analysis may contain inaccuracies, omissions, or misinterpretations
            </li>
            <li>
              <strong>Confidence scores are estimates:</strong> The confidence percentages
              displayed are probabilistic assessments, not guarantees of accuracy
            </li>
            <li>
              <strong>Context may be missed:</strong> AI cannot fully understand the unique
              circumstances of each immigration case or the nuanced legal implications
            </li>
            <li>
              <strong>Immigration law changes:</strong> AI training data may not reflect the
              most recent changes to immigration law, policy, or USCIS procedures
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <UserCheck className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold m-0">Attorney Review Required</h2>
          </div>
          <p>
            Immigration AI is designed as a workflow tool for licensed immigration attorneys.
            The platform enforces the following requirements:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>
              All AI-filled form fields with confidence below 80% are flagged for mandatory
              attorney review
            </li>
            <li>
              Sensitive fields (Social Security numbers, Alien numbers, passport numbers, etc.)
              always require attorney verification regardless of confidence level
            </li>
            <li>
              Forms cannot be marked as &ldquo;ready for filing&rdquo; until an attorney has
              reviewed all flagged fields
            </li>
            <li>
              Attorneys must certify that they have independently verified the accuracy of
              form data before submission
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Unauthorized Practice of Law</h2>
          <p>
            Immigration AI is designed exclusively for use by licensed attorneys and their
            supervised staff. This platform:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>
              Is not intended for use by non-attorneys to prepare immigration forms for others
            </li>
            <li>
              Does not provide legal advice, recommendations, or strategy guidance
            </li>
            <li>
              Should not be used by any person or entity in a manner that would constitute
              the unauthorized practice of law in any jurisdiction
            </li>
          </ul>
          <p className="mt-4">
            If you are not a licensed attorney, you should consult with a qualified immigration
            attorney before taking any action based on information from this platform.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Consequences of Immigration Errors</h2>
          <p>
            Users should understand that errors in immigration filings can have severe consequences:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>Denial of visa or immigration benefit applications</li>
            <li>Delays in processing that may affect employment, travel, or family reunification</li>
            <li>Findings of inadmissibility or deportability</li>
            <li>Bars to future immigration benefits</li>
            <li>Removal (deportation) proceedings</li>
            <li>Criminal consequences for fraud or material misrepresentation</li>
          </ul>
          <p className="mt-4 font-medium">
            These potential consequences underscore why attorney review of all AI-generated
            content is mandatory before filing.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Limitation of Liability</h2>
          <p>
            By using Immigration AI, you acknowledge and agree that:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>
              Immigration AI and its operators shall not be liable for any damages arising
              from reliance on AI-generated content without proper attorney review
            </li>
            <li>
              The responsibility for verifying the accuracy of all form data rests solely
              with the reviewing attorney
            </li>
            <li>
              Immigration AI makes no warranties regarding the accuracy, completeness, or
              legal sufficiency of AI-generated outputs
            </li>
            <li>
              Users assume all risk associated with the use of AI-assisted immigration
              document preparation
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Contact Information</h2>
          <p>
            If you have questions about this AI Technology Disclaimer or our platform:
          </p>
          <ul className="list-none mt-2 space-y-1">
            <li>Email: legal@immigrationai.app</li>
            <li>Address: Immigration AI, Inc.</li>
          </ul>
        </section>

        <section className="bg-muted/50 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-3">Acknowledgment</h2>
          <p className="text-sm">
            By using Immigration AI, you confirm that you have read, understood, and agree
            to this AI Technology Disclaimer. You acknowledge that AI-generated content is
            provided as a starting point only and that licensed attorney review is required
            before any immigration filing.
          </p>
        </section>
      </div>
    </div>
  );
}
