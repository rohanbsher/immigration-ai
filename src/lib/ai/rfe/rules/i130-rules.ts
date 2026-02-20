import type { RFERule } from '../types';

export const i130Rules: RFERule[] = [
  {
    id: 'I130-BONA-001',
    visaTypes: ['I-130'],
    category: 'document_presence',
    severity: 'high',
    title: 'Insufficient bona fide marriage evidence',
    description:
      'USCIS requires substantial evidence of a genuine marriage. Petitions with fewer than 4 categories of evidence (joint finances, shared residence, photos, affidavits) are very likely to receive an RFE.',
    recommendation:
      'Upload at least 4 categories of evidence: (1) joint bank statements, (2) joint tax return, (3) shared lease or mortgage, (4) photos together across multiple time periods. Also consider affidavits from friends/family and joint insurance policies.',
    evaluate: (ctx) => {
      const evidenceCount = ctx.bonaFideEvidenceCount;

      if (evidenceCount < 4) {
        const missing: string[] = [];
        if (!ctx.uploadedDocumentTypes.has('bank_statement')) missing.push('Joint bank statements');
        if (!ctx.uploadedDocumentTypes.has('tax_return')) missing.push('Joint tax return');
        if (!ctx.uploadedDocumentTypes.has('utility_bill'))
          missing.push('Shared address proof (lease/utility)');

        return {
          triggered: true,
          confidence: 0.9,
          evidence: [
            `Only ${evidenceCount} category(ies) of bona fide marriage evidence found`,
            `USCIS expects at least 4 categories`,
            ...missing.map((m) => `Missing: ${m}`),
          ],
          details:
            'The marriage certificate alone is never sufficient. USCIS requires corroborating evidence from multiple independent sources to establish the marriage is genuine.',
        };
      }

      return { triggered: false, confidence: 0.9, evidence: [] };
    },
  },
  {
    id: 'I130-BONA-002',
    visaTypes: ['I-130'],
    category: 'document_presence',
    severity: 'medium',
    title: 'No joint financial account evidence',
    description:
      'Joint bank accounts are one of the strongest indicators of a bona fide marriage. Their absence is a common RFE trigger.',
    recommendation:
      "Upload recent joint bank statements (last 3-6 months) showing both spouses' names. If no joint account exists, provide a letter explaining why and substitute with other financial commingling evidence.",
    evaluate: (ctx) => {
      if (!ctx.uploadedDocumentTypes.has('bank_statement')) {
        return {
          triggered: true,
          confidence: 0.85,
          evidence: ['No bank statements found in uploaded documents'],
        };
      }
      return { triggered: false, confidence: 0.85, evidence: [] };
    },
  },
  {
    id: 'I130-PRIOR-001',
    visaTypes: ['I-130'],
    category: 'document_presence',
    severity: 'medium',
    title: 'Possible prior marriage without dissolution proof',
    description:
      'If either spouse was previously married, USCIS requires proof of legal termination (divorce decree, death certificate, annulment) of all prior marriages.',
    recommendation:
      'Upload divorce decrees or other legal dissolution documents for all prior marriages of both spouses.',
    evaluate: (ctx) => {
      if (
        ctx.requiredDocumentTypes.has('divorce_certificate') &&
        !ctx.uploadedDocumentTypes.has('divorce_certificate')
      ) {
        return {
          triggered: true,
          confidence: 0.8,
          evidence: [
            'Divorce certificate is listed as required but not uploaded',
            'Prior marriage dissolution must be documented',
          ],
        };
      }
      return { triggered: false, confidence: 0.6, evidence: [] };
    },
  },
];
