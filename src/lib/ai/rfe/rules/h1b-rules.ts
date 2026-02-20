import type { RFERule } from '../types';

export const h1bRules: RFERule[] = [
  {
    id: 'H1B-EER-001',
    visaTypes: ['H1B'],
    category: 'document_presence',
    severity: 'high',
    title: 'No end-client documentation for staffing/consulting employer',
    description:
      'USCIS requires evidence of employer-employee relationship when the worksite is a third-party client. Staffing, consulting, and IT services firms must provide end-client letters, SOWs, or project itineraries.',
    recommendation:
      "Upload an end-client letter or Statement of Work (SOW) that names the beneficiary, describes the role, and confirms the petitioner controls the employee's day-to-day work.",
    evaluate: (ctx) => {
      if (!ctx.employerInfo.isStaffingFirm) {
        return { triggered: false, confidence: 0.9, evidence: [] };
      }

      const hasEndClientLetter = ctx.uploadedDocumentTypes.has('employment_letter');
      const hasSow = Array.from(ctx.extractedData.values()).some(
        (data) =>
          typeof data.document_subtype === 'string' &&
          ['sow', 'statement_of_work', 'client_letter', 'end_client'].some((t) =>
            (data.document_subtype as string).toLowerCase().includes(t)
          )
      );

      if (!hasEndClientLetter && !hasSow) {
        return {
          triggered: true,
          confidence: 0.8,
          evidence: [
            'Employer appears to be a staffing/consulting firm',
            'No end-client letter or Statement of Work found in uploaded documents',
          ],
          details:
            'USCIS uses the Neufeld Memo criteria to evaluate employer-employee relationships for third-party placement. Without a client letter, the petition is very likely to receive an RFE.',
        };
      }

      return { triggered: false, confidence: 0.8, evidence: [] };
    },
  },
  {
    id: 'H1B-WAGE-001',
    visaTypes: ['H1B'],
    category: 'form_consistency',
    severity: 'medium',
    title: 'Wage Level I with experienced beneficiary',
    description:
      'A Level I (entry-level) wage paired with a beneficiary who has 5+ years of experience raises USCIS scrutiny about whether the position truly requires only entry-level skills.',
    recommendation:
      'If the beneficiary has significant experience, consider whether the wage level should be Level II or higher. If Level I is correct (e.g., new role in a different specialty), document the justification clearly in the support letter.',
    evaluate: (ctx) => {
      const yearsExp = ctx.beneficiaryInfo.yearsOfExperience;
      if (yearsExp === undefined || yearsExp < 5) {
        return { triggered: false, confidence: 0.7, evidence: [] };
      }

      const i129Data = ctx.formData.get('I-129');
      const lcaWageLevel = i129Data?.wage_level as string | undefined;

      if (
        lcaWageLevel &&
        lcaWageLevel.toLowerCase().includes('level i') &&
        !lcaWageLevel.toLowerCase().includes('level ii')
      ) {
        return {
          triggered: true,
          confidence: 0.75,
          evidence: [
            `Beneficiary has ${yearsExp} years of experience`,
            `Wage level is set to Level I (entry-level)`,
          ],
          details:
            'USCIS may question why an experienced professional is being offered an entry-level wage, suggesting the position may not be a true specialty occupation.',
        };
      }

      return { triggered: false, confidence: 0.6, evidence: [] };
    },
  },
  {
    id: 'H1B-LCA-001',
    visaTypes: ['H1B'],
    category: 'form_consistency',
    severity: 'medium',
    title: 'LCA job title may differ from petition job title',
    description:
      'The job title on the Labor Condition Application (LCA) must match the I-129 petition exactly. Mismatches trigger RFEs.',
    recommendation:
      'Verify that the job title in Part 2 of the I-129 exactly matches the LCA job title. Even minor differences (e.g., "Software Engineer" vs. "Software Developer") can trigger an RFE.',
    evaluate: (ctx) => {
      const i129Data = ctx.formData.get('I-129');
      if (!i129Data?.job_title) {
        return { triggered: false, confidence: 0.3, evidence: ['No I-129 form data available'] };
      }
      // Phase 1: flag as informational if we can't cross-check LCA
      return {
        triggered: false,
        confidence: 0.3,
        evidence: ['LCA cross-check requires LCA document upload (not yet supported)'],
      };
    },
  },
];
