/**
 * RFE Prevention Engine — Type definitions.
 *
 * Rules are deterministic checks that evaluate specific RFE risk factors
 * per visa type. Each rule is self-contained and independently testable.
 */

import type { VisaType, DocumentType } from '@/types';

// ---------------------------------------------------------------------------
// Risk Categories
// ---------------------------------------------------------------------------

export type RFERiskCategory =
  | 'document_presence'
  | 'document_content'
  | 'cross_document'
  | 'form_consistency'
  | 'financial'
  | 'timeline'
  | 'procedural';

export type RFESeverity = 'critical' | 'high' | 'medium' | 'low';

export type RFERiskLevel = 'low' | 'medium' | 'high' | 'critical';

// ---------------------------------------------------------------------------
// Rule Interface
// ---------------------------------------------------------------------------

export interface RFERuleResult {
  triggered: boolean;
  confidence: number;
  evidence: string[];
  details?: string;
}

export interface RFERule {
  id: string;
  visaTypes: VisaType[];
  category: RFERiskCategory;
  severity: RFESeverity;
  title: string;
  description: string;
  recommendation: string;
  evaluate: (context: RFEAnalysisContext) => RFERuleResult;
}

// ---------------------------------------------------------------------------
// Analysis Context (data gathered for rule evaluation)
// ---------------------------------------------------------------------------

export interface RFEAnalysisContext {
  caseId: string;
  visaType: VisaType;
  caseStatus: string;
  deadline: string | null;

  uploadedDocumentTypes: Set<DocumentType>;
  requiredDocumentTypes: Set<DocumentType>;
  extractedData: Map<DocumentType, Record<string, unknown>>;
  formData: Map<string, Record<string, unknown>>;
  formTypes: string[];
  bonaFideEvidenceCount: number;

  employerInfo: {
    companyName?: string;
    industry?: string;
    employeeCount?: number;
    annualIncome?: number;
    netIncome?: number;
    companyAge?: number;
    isStaffingFirm?: boolean;
  };

  beneficiaryInfo: {
    yearsOfExperience?: number;
    degreeField?: string;
    degreeType?: string;
    countryOfBirth?: string;
  };

  financialInfo: {
    sponsorIncome?: number;
    householdSize?: number;
    federalPovertyGuideline?: number;
  };
}

// ---------------------------------------------------------------------------
// Assessment Result
// ---------------------------------------------------------------------------

export interface TriggeredRule {
  ruleId: string;
  severity: RFESeverity;
  category: RFERiskCategory;
  title: string;
  description: string;
  recommendation: string;
  evidence: string[];
  confidence: number;
}

export interface RFEAssessmentResult {
  caseId: string;
  visaType: VisaType;
  rfeRiskScore: number;
  riskLevel: RFERiskLevel;
  estimatedRFEProbability: number;
  triggeredRules: TriggeredRule[];
  safeRuleIds: string[];
  priorityActions: string[];
  dataConfidence: number;
  assessedAt: string;
  assessmentVersion: string;
}

// ---------------------------------------------------------------------------
// Severity Penalty Constants
// ---------------------------------------------------------------------------

export const SEVERITY_PENALTIES: Record<RFESeverity, number> = {
  critical: 30,
  high: 15,
  medium: 8,
  low: 3,
};
