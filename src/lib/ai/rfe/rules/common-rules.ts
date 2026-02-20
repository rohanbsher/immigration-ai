import type { RFERule } from '../types';

export const commonRules: RFERule[] = [
  {
    id: 'COMMON-PASSPORT-001',
    visaTypes: [
      'H1B',
      'H4',
      'L1',
      'O1',
      'F1',
      'B1B2',
      'EB1',
      'EB2',
      'EB3',
      'EB5',
      'I-130',
      'I-485',
      'I-765',
      'I-131',
      'N-400',
    ],
    category: 'document_presence',
    severity: 'high',
    title: 'Passport not uploaded',
    description:
      'A valid passport is required for virtually all immigration petitions. Missing passport is one of the simplest RFE triggers to prevent.',
    recommendation:
      "Upload a copy of the beneficiary's valid passport (biographical page). Ensure the passport has at least 6 months validity beyond the intended stay.",
    evaluate: (ctx) => {
      if (ctx.requiredDocumentTypes.has('passport') && !ctx.uploadedDocumentTypes.has('passport')) {
        return {
          triggered: true,
          confidence: 0.95,
          evidence: ['Passport is required but not found in uploaded documents'],
        };
      }
      return { triggered: false, confidence: 0.95, evidence: [] };
    },
  },
  {
    id: 'COMMON-PHOTO-001',
    visaTypes: ['H1B', 'L1', 'O1', 'I-485', 'I-765', 'I-131', 'N-400'],
    category: 'document_presence',
    severity: 'low',
    title: 'Passport-style photos not uploaded',
    description:
      'Most USCIS forms require passport-style photographs meeting specific technical requirements.',
    recommendation:
      'Upload 2 passport-style photographs (2x2 inches, white background, taken within 6 months).',
    evaluate: (ctx) => {
      if (ctx.requiredDocumentTypes.has('photo') && !ctx.uploadedDocumentTypes.has('photo')) {
        return {
          triggered: true,
          confidence: 0.7,
          evidence: ['Passport photos required but not uploaded'],
        };
      }
      return { triggered: false, confidence: 0.7, evidence: [] };
    },
  },
  {
    id: 'COMMON-DEADLINE-001',
    visaTypes: [
      'H1B',
      'H4',
      'L1',
      'O1',
      'F1',
      'B1B2',
      'EB1',
      'EB2',
      'EB3',
      'EB5',
      'I-130',
      'I-485',
      'I-765',
      'I-131',
      'N-400',
    ],
    category: 'timeline',
    severity: 'medium',
    title: 'Filing deadline is approaching with incomplete documents',
    description:
      'Cases filed under time pressure with incomplete documentation are more likely to contain errors that trigger RFEs.',
    recommendation:
      'Prioritize completing all required documents before the deadline. If documents cannot be obtained in time, consider filing with a cover letter explaining what will be supplemented.',
    evaluate: (ctx) => {
      if (!ctx.deadline) {
        return { triggered: false, confidence: 0.3, evidence: [] };
      }

      const daysUntilDeadline = Math.ceil(
        (new Date(ctx.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      const missingRequired = [...ctx.requiredDocumentTypes].filter(
        (t) => !ctx.uploadedDocumentTypes.has(t)
      );

      if (daysUntilDeadline <= 14 && missingRequired.length > 0) {
        return {
          triggered: true,
          confidence: 0.7,
          evidence: [
            `Filing deadline in ${daysUntilDeadline} days`,
            `${missingRequired.length} required document(s) still missing`,
          ],
        };
      }

      return { triggered: false, confidence: 0.7, evidence: [] };
    },
  },
];
