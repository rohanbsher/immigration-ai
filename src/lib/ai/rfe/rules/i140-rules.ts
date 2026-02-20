import type { RFERule } from '../types';

export const i140Rules: RFERule[] = [
  {
    id: 'I140-PAY-001',
    visaTypes: ['EB1', 'EB2', 'EB3'],
    category: 'financial',
    severity: 'high',
    title: 'Employer net income may not support the proffered wage',
    description:
      "USCIS requires the petitioning employer to demonstrate ability to pay the proffered wage from the priority date onward. If the employer's net income is below the proffered wage, an RFE is likely.",
    recommendation:
      "Upload the employer's most recent 2-3 years of tax returns (IRS Form 1120 or 1120S). If net income is below the proffered wage, also provide audited financial statements and payroll records showing the beneficiary is already being paid.",
    evaluate: (ctx) => {
      const { netIncome } = ctx.employerInfo;
      if (netIncome === undefined) {
        return {
          triggered: false,
          confidence: 0.3,
          evidence: ['Employer financial data not available — upload corporate tax returns'],
        };
      }

      if (netIncome <= 0) {
        return {
          triggered: true,
          confidence: 0.7,
          evidence: [
            `Employer reported net income: $${netIncome.toLocaleString()}`,
            'Negative or zero net income makes ability-to-pay difficult to prove',
          ],
          details:
            'USCIS uses three tests for ability to pay: (1) net income >= proffered wage, (2) net current assets >= proffered wage, or (3) employee is already being paid the wage. Supplement with payroll records if net income is low.',
        };
      }

      return { triggered: false, confidence: 0.5, evidence: [] };
    },
  },
  {
    id: 'I140-EDU-001',
    visaTypes: ['EB2', 'EB3', 'H1B'],
    category: 'document_presence',
    severity: 'medium',
    title: 'Degree/diploma not uploaded',
    description:
      "Employment-based petitions require evidence of the beneficiary's educational qualifications. Missing diploma or transcript is a common RFE trigger.",
    recommendation:
      "Upload the beneficiary's diploma and official transcripts. For foreign degrees, also include a NACES-accredited credential evaluation.",
    evaluate: (ctx) => {
      const hasDiploma = ctx.uploadedDocumentTypes.has('diploma');
      const hasTranscript = ctx.uploadedDocumentTypes.has('transcript');

      if (!hasDiploma && !hasTranscript) {
        return {
          triggered: true,
          confidence: 0.85,
          evidence: [
            'Neither diploma nor transcript found in uploaded documents',
            'Educational credential evidence is required for employment-based petitions',
          ],
        };
      }

      if (!hasDiploma) {
        return {
          triggered: true,
          confidence: 0.7,
          evidence: ['Diploma not found — transcript alone may be insufficient'],
        };
      }

      return { triggered: false, confidence: 0.85, evidence: [] };
    },
  },
];
