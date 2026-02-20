/**
 * RFE Assessment Engine
 *
 * Gathers case data, runs applicable rules, and produces
 * a risk assessment. Phase 1: structural/deterministic rules only.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocumentType, VisaType } from '@/types';
import { createLogger } from '@/lib/logger';
import { getRulesForVisaType } from './rules';
import {
  SEVERITY_PENALTIES,
  type RFEAnalysisContext,
  type RFEAssessmentResult,
  type RFERiskLevel,
  type TriggeredRule,
} from './types';

const log = createLogger('rfe-assessment');

const ASSESSMENT_VERSION = '1.0';

// Bona fide evidence types for I-130 counting
const BONA_FIDE_TYPES: DocumentType[] = [
  'marriage_certificate',
  'bank_statement',
  'tax_return',
  'utility_bill',
  'photo',
];

/**
 * Resolve a Supabase client: use the provided one, or lazily import
 * the cookie-based server client (Next.js only).
 */
async function resolveClient(client?: SupabaseClient): Promise<SupabaseClient> {
  if (client) return client;
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

/**
 * Build the analysis context by gathering case data from the database.
 */
async function buildContext(
  caseId: string,
  supabase: SupabaseClient
): Promise<RFEAnalysisContext> {
  // Fetch case
  const { data: caseData, error: caseError } = await supabase
    .from('cases')
    .select('visa_type, status, deadline')
    .eq('id', caseId)
    .is('deleted_at', null)
    .single();

  if (caseError || !caseData) throw new Error('Case not found');

  // Fetch documents
  const { data: documents } = await supabase
    .from('documents')
    .select('document_type, ai_extracted_data, status')
    .eq('case_id', caseId)
    .is('deleted_at', null);

  // Fetch document checklist
  const { data: checklist } = await supabase
    .from('document_checklists')
    .select('document_type, required')
    .eq('visa_type', caseData.visa_type);

  // Fetch forms
  const { data: forms } = await supabase
    .from('forms')
    .select('form_type, form_data, ai_filled_data')
    .eq('case_id', caseId)
    .is('deleted_at', null);

  // Build uploaded document types set
  const uploadedDocumentTypes = new Set<DocumentType>(
    (documents || []).map((d) => d.document_type as DocumentType)
  );

  // Build required document types set
  const requiredDocumentTypes = new Set<DocumentType>(
    (checklist || [])
      .filter((c) => c.required)
      .map((c) => c.document_type as DocumentType)
  );

  // Build extracted data map
  const extractedData = new Map<DocumentType, Record<string, unknown>>();
  for (const doc of documents || []) {
    if (doc.ai_extracted_data) {
      extractedData.set(
        doc.document_type as DocumentType,
        doc.ai_extracted_data as Record<string, unknown>
      );
    }
  }

  // Build form data map
  const formData = new Map<string, Record<string, unknown>>();
  for (const form of forms || []) {
    const data = (form.form_data || form.ai_filled_data) as Record<string, unknown> | null;
    if (data) {
      formData.set(form.form_type, data);
    }
  }

  // Count bona fide marriage evidence categories
  const bonaFideEvidenceCount = BONA_FIDE_TYPES.filter((t) =>
    uploadedDocumentTypes.has(t)
  ).length;

  // Extract employer info from forms or documents
  const i129Data = formData.get('I-129') as Record<string, unknown> | undefined;

  return {
    caseId,
    visaType: caseData.visa_type as VisaType,
    caseStatus: caseData.status,
    deadline: caseData.deadline,
    uploadedDocumentTypes,
    requiredDocumentTypes,
    extractedData,
    formData,
    formTypes: (forms || []).map((f) => f.form_type),
    bonaFideEvidenceCount,
    employerInfo: {
      companyName: i129Data?.company_name as string | undefined,
      employeeCount: i129Data?.number_of_employees
        ? Number(i129Data.number_of_employees)
        : undefined,
      annualIncome: i129Data?.gross_annual_income
        ? Number(i129Data.gross_annual_income)
        : undefined,
      netIncome: i129Data?.net_annual_income
        ? Number(i129Data.net_annual_income)
        : undefined,
      isStaffingFirm: false, // Default; enriched in Phase 2
    },
    beneficiaryInfo: {
      degreeField: extractedData.get('diploma')?.field_of_study as string | undefined,
      degreeType: extractedData.get('diploma')?.degree_type as string | undefined,
    },
    financialInfo: {
      sponsorIncome: extractedData.get('tax_return')?.adjusted_gross_income
        ? Number(extractedData.get('tax_return')?.adjusted_gross_income)
        : undefined,
      householdSize: i129Data?.household_size
        ? Number(i129Data.household_size)
        : undefined,
    },
  };
}

/**
 * Calculate risk level from score.
 */
function scoreToRiskLevel(score: number): RFERiskLevel {
  if (score >= 85) return 'low';
  if (score >= 65) return 'medium';
  if (score >= 40) return 'high';
  return 'critical';
}

/**
 * Estimate RFE probability from risk score.
 */
function scoreToRFEProbability(score: number): number {
  return Math.round((1 - score / 100) * 1000) / 1000;
}

/**
 * Run RFE assessment for a case.
 */
export async function assessRFERisk(
  caseId: string,
  triggerEvent: string = 'manual',
  supabaseClient?: SupabaseClient
): Promise<RFEAssessmentResult> {
  const supabase = await resolveClient(supabaseClient);
  const context = await buildContext(caseId, supabase);

  // Get applicable rules
  const rules = getRulesForVisaType(context.visaType);

  // Evaluate each rule
  const triggeredRules: TriggeredRule[] = [];
  const safeRuleIds: string[] = [];

  for (const rule of rules) {
    try {
      const result = rule.evaluate(context);
      if (result.triggered) {
        triggeredRules.push({
          ruleId: rule.id,
          severity: rule.severity,
          category: rule.category,
          title: rule.title,
          description: rule.description,
          recommendation: rule.recommendation,
          evidence: result.evidence,
          confidence: result.confidence,
        });
      } else {
        safeRuleIds.push(rule.id);
      }
    } catch (error) {
      log.warn(`Rule ${rule.id} failed to evaluate`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Calculate risk score
  const totalPenalty = triggeredRules.reduce(
    (sum, r) => sum + SEVERITY_PENALTIES[r.severity] * r.confidence,
    0
  );
  const rfeRiskScore = Math.max(0, Math.round(100 - totalPenalty));

  // Calculate data confidence (what % of context fields were available)
  const contextFields = [
    context.uploadedDocumentTypes.size > 0,
    context.requiredDocumentTypes.size > 0,
    context.formData.size > 0,
    context.employerInfo.companyName !== undefined,
    context.beneficiaryInfo.degreeField !== undefined,
    context.financialInfo.sponsorIncome !== undefined,
  ];
  const dataConfidence =
    Math.round((contextFields.filter(Boolean).length / contextFields.length) * 1000) / 1000;

  // Sort triggered rules by severity (critical first)
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  triggeredRules.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Build priority actions from triggered rules
  const priorityActions = triggeredRules.slice(0, 5).map((r) => r.recommendation);

  const assessment: RFEAssessmentResult = {
    caseId,
    visaType: context.visaType,
    rfeRiskScore,
    riskLevel: scoreToRiskLevel(rfeRiskScore),
    estimatedRFEProbability: scoreToRFEProbability(rfeRiskScore),
    triggeredRules,
    safeRuleIds,
    priorityActions,
    dataConfidence,
    assessedAt: new Date().toISOString(),
    assessmentVersion: ASSESSMENT_VERSION,
  };

  // Cache on cases table
  await supabase
    .from('cases')
    .update({
      rfe_risk_score: rfeRiskScore,
      rfe_risk_level: assessment.riskLevel,
      rfe_assessment: assessment as unknown as Record<string, unknown>,
      rfe_assessed_at: assessment.assessedAt,
    })
    .eq('id', caseId);

  // Store in history table (fire-and-forget)
  supabase
    .from('rfe_assessments')
    .insert({
      case_id: caseId,
      visa_type: context.visaType,
      rfe_risk_score: rfeRiskScore,
      risk_level: assessment.riskLevel,
      estimated_rfe_probability: assessment.estimatedRFEProbability,
      triggered_rules: triggeredRules,
      safe_rules: safeRuleIds,
      priority_actions: priorityActions,
      data_confidence: dataConfidence,
      trigger_event: triggerEvent,
      assessment_version: ASSESSMENT_VERSION,
    })
    .then(({ error }) => {
      if (error) log.warn('Failed to store RFE assessment history', { error: error.message });
    });

  return assessment;
}
