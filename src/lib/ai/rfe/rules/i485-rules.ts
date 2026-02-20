import type { RFERule } from '../types';

// 2025 Federal Poverty Guidelines (48 contiguous states)
// Source: HHS. Updated annually in January.
const FPG_2025: Record<number, number> = {
  1: 15_650,
  2: 21_150,
  3: 26_650,
  4: 32_150,
  5: 37_650,
  6: 43_150,
  7: 48_650,
  8: 54_150,
};
const FPG_PER_ADDITIONAL = 5_500;

function getFPG125(householdSize: number): number {
  const base =
    FPG_2025[Math.min(householdSize, 8)] ??
    FPG_2025[8]! + FPG_PER_ADDITIONAL * (householdSize - 8);
  return Math.ceil(base * 1.25);
}

export const i485Rules: RFERule[] = [
  {
    id: 'I485-MED-001',
    visaTypes: ['I-485'],
    category: 'procedural',
    severity: 'critical',
    title: 'Medical exam (I-693) not uploaded',
    description:
      'Since December 2, 2024, USCIS REJECTS (not just RFEs) I-485 applications filed without a sealed I-693 medical exam. This is a hard block.',
    recommendation:
      'The I-693 medical exam from a USCIS-designated civil surgeon MUST be included with the I-485 filing. Schedule the medical exam immediately and upload the sealed I-693.',
    evaluate: (ctx) => {
      if (!ctx.uploadedDocumentTypes.has('medical_exam')) {
        return {
          triggered: true,
          confidence: 0.95,
          evidence: [
            'I-693 medical exam not found in uploaded documents',
            'Since Dec 2024, USCIS rejects I-485 filings without I-693 (not just RFE)',
          ],
          details:
            'This is the single most critical document for I-485. USCIS changed their policy in December 2024 to reject applications outright rather than issuing RFEs for missing medical exams.',
        };
      }
      return { triggered: false, confidence: 0.95, evidence: [] };
    },
  },
  {
    id: 'I485-SUPPORT-001',
    visaTypes: ['I-485'],
    category: 'financial',
    severity: 'high',
    title: 'Sponsor income may be below 125% Federal Poverty Guidelines',
    description:
      "The I-864 affidavit of support requires the sponsor's income to be at least 125% of the Federal Poverty Guidelines for the declared household size.",
    recommendation:
      "Verify the sponsor's income exceeds the 125% FPG threshold. If below, add a joint sponsor with sufficient income or include evidence of assets worth 3x the income gap.",
    evaluate: (ctx) => {
      const { sponsorIncome, householdSize } = ctx.financialInfo;
      if (sponsorIncome === undefined || householdSize === undefined) {
        return {
          triggered: false,
          confidence: 0.3,
          evidence: ['Insufficient financial data to evaluate — upload tax returns and I-864'],
        };
      }

      const threshold = getFPG125(householdSize);
      if (sponsorIncome < threshold) {
        return {
          triggered: true,
          confidence: 0.85,
          evidence: [
            `Sponsor income: $${sponsorIncome.toLocaleString()}`,
            `Required (125% FPG for household of ${householdSize}): $${threshold.toLocaleString()}`,
            `Shortfall: $${(threshold - sponsorIncome).toLocaleString()}`,
          ],
          details:
            'The sponsor must demonstrate ability to maintain the intending immigrant at 125% of FPG. If income is insufficient, a joint sponsor or assets (3x the shortfall) are required.',
        };
      }

      return { triggered: false, confidence: 0.85, evidence: [] };
    },
  },
  {
    id: 'I485-SUPPORT-002',
    visaTypes: ['I-485'],
    category: 'document_presence',
    severity: 'medium',
    title: 'Tax return may be outdated',
    description:
      "USCIS requires the most recent tax return. Filing early in the year without the prior year's return is a common RFE trigger.",
    recommendation:
      'Ensure the most recent tax return is uploaded. If filing between January and April, include a letter explaining the prior year return is not yet available, along with W-2s and recent pay stubs.',
    evaluate: (ctx) => {
      if (!ctx.uploadedDocumentTypes.has('tax_return')) {
        return {
          triggered: true,
          confidence: 0.8,
          evidence: ['No tax return found in uploaded documents'],
        };
      }
      return { triggered: false, confidence: 0.7, evidence: [] };
    },
  },
  {
    id: 'I485-POLICE-001',
    visaTypes: ['I-485'],
    category: 'document_presence',
    severity: 'medium',
    title: 'Police clearance certificate may be missing',
    description:
      'Applicants who lived in certain countries for 6+ months after age 16 must provide police clearance certificates. Missing clearances trigger RFEs.',
    recommendation:
      "Review the applicant's residence history. For each country where they lived 6+ months after age 16, obtain a police clearance certificate.",
    evaluate: (ctx) => {
      if (
        ctx.requiredDocumentTypes.has('police_clearance') &&
        !ctx.uploadedDocumentTypes.has('police_clearance')
      ) {
        return {
          triggered: true,
          confidence: 0.8,
          evidence: ['Police clearance certificate is required but not uploaded'],
        };
      }
      return { triggered: false, confidence: 0.6, evidence: [] };
    },
  },
];
