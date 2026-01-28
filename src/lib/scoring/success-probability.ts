/**
 * Success Probability Scoring
 *
 * Calculates case approval likelihood (0-100%) based on document quality,
 * form confidence, and completeness. Uses a rule-based algorithm (no AI calls).
 */

import { createClient } from '@/lib/supabase/server';
import { analyzeDocumentCompleteness } from '@/lib/ai/document-completeness';
import { calculateWeightedScore } from '@/lib/ai/utils';

/**
 * Success score result.
 */
export interface SuccessScore {
  /** Overall success score (0-100) */
  overallScore: number;
  /** Confidence in the score (0-1) */
  confidence: number;
  /** Individual scoring factors */
  factors: ScoringFactor[];
  /** Risk factors that lower the score */
  riskFactors: string[];
  /** Improvements that could increase the score */
  improvements: string[];
  /** Timestamp of calculation */
  calculatedAt: string;
}

/**
 * Individual scoring factor.
 */
export interface ScoringFactor {
  name: string;
  description: string;
  score: number; // 0-100
  weight: number; // 0-1
  weightedScore: number; // score * weight
  rawValue?: string | number;
  status: 'good' | 'warning' | 'poor';
}

/**
 * Scoring configuration with weights.
 */
const SCORING_CONFIG = {
  documentCompleteness: {
    name: 'Document Completeness',
    description: 'Required documents uploaded vs total required',
    weight: 0.3,
  },
  documentQuality: {
    name: 'Document Quality',
    description: 'Average AI confidence score for analyzed documents',
    weight: 0.15,
  },
  formFieldConfidence: {
    name: 'Form Field Confidence',
    description: 'Average AI confidence for auto-filled form fields',
    weight: 0.2,
  },
  fieldValidation: {
    name: 'Field Validation',
    description: 'Percentage of form fields passing validation',
    weight: 0.15,
  },
  timeline: {
    name: 'Timeline',
    description: 'Days remaining vs typical processing time',
    weight: 0.1,
  },
  historical: {
    name: 'Case Readiness',
    description: 'Based on case status progression',
    weight: 0.1,
  },
} as const;

/**
 * Status thresholds for scoring factors.
 */
function getFactorStatus(score: number): ScoringFactor['status'] {
  if (score >= 80) return 'good';
  if (score >= 50) return 'warning';
  return 'poor';
}

/**
 * Calculate document quality score.
 */
async function calculateDocumentQualityScore(
  caseId: string
): Promise<{ score: number; rawValue: number; details: string[] }> {
  const supabase = await createClient();

  const { data: documents } = await supabase
    .from('documents')
    .select('ai_confidence_score, document_type, status')
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .not('ai_confidence_score', 'is', null);

  if (!documents || documents.length === 0) {
    return { score: 0, rawValue: 0, details: ['No analyzed documents'] };
  }

  const avgConfidence =
    documents.reduce((sum, doc) => sum + (doc.ai_confidence_score || 0), 0) /
    documents.length;

  const details: string[] = [];

  // Check for low-confidence documents
  const lowConfidenceDocs = documents.filter(
    (doc) => doc.ai_confidence_score && doc.ai_confidence_score < 0.7
  );
  if (lowConfidenceDocs.length > 0) {
    details.push(
      `${lowConfidenceDocs.length} document(s) with low confidence scores`
    );
  }

  // Convert to 0-100 scale
  const score = Math.round(avgConfidence * 100);

  return { score, rawValue: avgConfidence, details };
}

/**
 * Calculate form field confidence score.
 */
async function calculateFormConfidenceScore(
  caseId: string
): Promise<{ score: number; rawValue: number; details: string[] }> {
  const supabase = await createClient();

  const { data: forms } = await supabase
    .from('forms')
    .select('ai_confidence_scores, status')
    .eq('case_id', caseId)
    .not('ai_confidence_scores', 'is', null);

  if (!forms || forms.length === 0) {
    return { score: 0, rawValue: 0, details: ['No AI-filled forms'] };
  }

  const details: string[] = [];
  let totalFields = 0;
  let totalConfidence = 0;
  let lowConfidenceFields = 0;

  for (const form of forms) {
    const confidenceScores = form.ai_confidence_scores as Record<string, number>;
    if (!confidenceScores) continue;

    for (const [, confidence] of Object.entries(confidenceScores)) {
      totalFields++;
      totalConfidence += confidence;
      if (confidence < 0.7) {
        lowConfidenceFields++;
      }
    }
  }

  if (totalFields === 0) {
    return { score: 0, rawValue: 0, details: ['No form fields analyzed'] };
  }

  const avgConfidence = totalConfidence / totalFields;

  if (lowConfidenceFields > 0) {
    details.push(`${lowConfidenceFields} field(s) need review`);
  }

  const score = Math.round(avgConfidence * 100);

  return { score, rawValue: avgConfidence, details };
}

/**
 * Calculate field validation score (how many fields pass validation).
 */
async function calculateFieldValidationScore(
  caseId: string
): Promise<{ score: number; details: string[] }> {
  const supabase = await createClient();

  const { data: forms } = await supabase
    .from('forms')
    .select('form_data, ai_filled_data, status')
    .eq('case_id', caseId);

  if (!forms || forms.length === 0) {
    return { score: 50, details: ['No forms to validate'] };
  }

  // Count forms by status
  const statusCounts = forms.reduce(
    (acc, form) => {
      acc[form.status] = (acc[form.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const details: string[] = [];

  // Calculate score based on form status progression
  // approved/filed = 100, in_review = 80, ai_filled = 60, draft = 40
  const statusScores: Record<string, number> = {
    filed: 100,
    approved: 90,
    in_review: 80,
    ai_filled: 60,
    draft: 40,
    rejected: 20,
  };

  const totalScore = forms.reduce((sum, form) => {
    return sum + (statusScores[form.status] || 40);
  }, 0);

  const avgScore = Math.round(totalScore / forms.length);

  if (statusCounts['draft'] > 0) {
    details.push(`${statusCounts['draft']} form(s) still in draft`);
  }

  if (statusCounts['rejected'] > 0) {
    details.push(`${statusCounts['rejected']} form(s) rejected`);
  }

  return { score: avgScore, details };
}

/**
 * Calculate timeline score based on deadline proximity.
 */
async function calculateTimelineScore(
  caseId: string
): Promise<{ score: number; rawValue: string; details: string[] }> {
  const supabase = await createClient();

  const { data: caseData } = await supabase
    .from('cases')
    .select('deadline, created_at, status')
    .eq('id', caseId)
    .single();

  if (!caseData) {
    return { score: 50, rawValue: 'unknown', details: ['Case not found'] };
  }

  const details: string[] = [];

  if (!caseData.deadline) {
    return { score: 70, rawValue: 'no deadline', details: ['No deadline set'] };
  }

  const now = new Date();
  const deadline = new Date(caseData.deadline);
  const daysRemaining = Math.ceil(
    (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysRemaining < 0) {
    details.push('Deadline has passed');
    return { score: 0, rawValue: `${Math.abs(daysRemaining)} days overdue`, details };
  }

  if (daysRemaining <= 7) {
    details.push('Deadline within 7 days');
    return { score: 30, rawValue: `${daysRemaining} days`, details };
  }

  if (daysRemaining <= 30) {
    details.push('Deadline within 30 days');
    return { score: 60, rawValue: `${daysRemaining} days`, details };
  }

  if (daysRemaining <= 90) {
    return { score: 80, rawValue: `${daysRemaining} days`, details };
  }

  return { score: 100, rawValue: `${daysRemaining} days`, details: ['Ample time remaining'] };
}

/**
 * Calculate case readiness score based on status.
 */
async function calculateCaseReadinessScore(
  caseId: string
): Promise<{ score: number; rawValue: string; details: string[] }> {
  const supabase = await createClient();

  const { data: caseData } = await supabase
    .from('cases')
    .select('status')
    .eq('id', caseId)
    .single();

  if (!caseData) {
    return { score: 50, rawValue: 'unknown', details: ['Case not found'] };
  }

  // Score based on case status progression
  const statusScores: Record<string, number> = {
    intake: 30,
    document_collection: 40,
    in_review: 60,
    forms_preparation: 70,
    ready_for_filing: 90,
    filed: 95,
    pending_response: 85,
    approved: 100,
    denied: 20,
    closed: 50,
  };

  const score = statusScores[caseData.status] || 50;

  return {
    score,
    rawValue: caseData.status,
    details: [`Case is in ${caseData.status.replace('_', ' ')} stage`],
  };
}

/**
 * Generate risk factors based on all scoring data.
 */
function generateRiskFactors(factors: ScoringFactor[]): string[] {
  const risks: string[] = [];

  for (const factor of factors) {
    if (factor.status === 'poor') {
      switch (factor.name) {
        case 'Document Completeness':
          risks.push('Missing required documents may delay or prevent filing');
          break;
        case 'Document Quality':
          risks.push('Low document quality may require re-submission');
          break;
        case 'Form Field Confidence':
          risks.push('Form fields need attorney review before filing');
          break;
        case 'Timeline':
          risks.push('Approaching deadline increases rejection risk');
          break;
        default:
          risks.push(`${factor.name} needs attention`);
      }
    }
  }

  return risks;
}

/**
 * Generate improvement suggestions based on scoring data.
 */
function generateImprovements(factors: ScoringFactor[]): string[] {
  const improvements: string[] = [];

  for (const factor of factors) {
    if (factor.status !== 'good') {
      const potentialGain = Math.round((100 - factor.score) * factor.weight);

      switch (factor.name) {
        case 'Document Completeness':
          improvements.push(
            `Upload missing documents to increase score by up to ${potentialGain}%`
          );
          break;
        case 'Document Quality':
          improvements.push(
            `Re-upload clearer versions of low-quality documents (+${potentialGain}%)`
          );
          break;
        case 'Form Field Confidence':
          improvements.push(
            `Review and verify flagged form fields (+${potentialGain}%)`
          );
          break;
        case 'Field Validation':
          improvements.push(
            `Complete form review and approval process (+${potentialGain}%)`
          );
          break;
      }
    }
  }

  return improvements;
}

/**
 * Calculate success probability score for a case.
 *
 * @param caseId - The case ID to analyze
 * @returns Success score result
 */
export async function calculateSuccessScore(caseId: string): Promise<SuccessScore> {
  const factors: ScoringFactor[] = [];

  // 1. Document Completeness (30%)
  try {
    const completeness = await analyzeDocumentCompleteness(caseId);
    factors.push({
      name: SCORING_CONFIG.documentCompleteness.name,
      description: SCORING_CONFIG.documentCompleteness.description,
      score: completeness.overallCompleteness,
      weight: SCORING_CONFIG.documentCompleteness.weight,
      weightedScore:
        completeness.overallCompleteness * SCORING_CONFIG.documentCompleteness.weight,
      rawValue: `${completeness.uploadedRequired}/${completeness.totalRequired}`,
      status: getFactorStatus(completeness.overallCompleteness),
    });
  } catch (error) {
    console.error('Error calculating completeness:', error);
    factors.push({
      name: SCORING_CONFIG.documentCompleteness.name,
      description: SCORING_CONFIG.documentCompleteness.description,
      score: 0,
      weight: SCORING_CONFIG.documentCompleteness.weight,
      weightedScore: 0,
      status: 'poor',
    });
  }

  // 2. Document Quality (15%)
  const docQuality = await calculateDocumentQualityScore(caseId);
  factors.push({
    name: SCORING_CONFIG.documentQuality.name,
    description: SCORING_CONFIG.documentQuality.description,
    score: docQuality.score,
    weight: SCORING_CONFIG.documentQuality.weight,
    weightedScore: docQuality.score * SCORING_CONFIG.documentQuality.weight,
    rawValue: Math.round(docQuality.rawValue * 100) + '%',
    status: getFactorStatus(docQuality.score),
  });

  // 3. Form Field Confidence (20%)
  const formConfidence = await calculateFormConfidenceScore(caseId);
  factors.push({
    name: SCORING_CONFIG.formFieldConfidence.name,
    description: SCORING_CONFIG.formFieldConfidence.description,
    score: formConfidence.score,
    weight: SCORING_CONFIG.formFieldConfidence.weight,
    weightedScore: formConfidence.score * SCORING_CONFIG.formFieldConfidence.weight,
    rawValue: Math.round(formConfidence.rawValue * 100) + '%',
    status: getFactorStatus(formConfidence.score),
  });

  // 4. Field Validation (15%)
  const fieldValidation = await calculateFieldValidationScore(caseId);
  factors.push({
    name: SCORING_CONFIG.fieldValidation.name,
    description: SCORING_CONFIG.fieldValidation.description,
    score: fieldValidation.score,
    weight: SCORING_CONFIG.fieldValidation.weight,
    weightedScore: fieldValidation.score * SCORING_CONFIG.fieldValidation.weight,
    status: getFactorStatus(fieldValidation.score),
  });

  // 5. Timeline (10%)
  const timeline = await calculateTimelineScore(caseId);
  factors.push({
    name: SCORING_CONFIG.timeline.name,
    description: SCORING_CONFIG.timeline.description,
    score: timeline.score,
    weight: SCORING_CONFIG.timeline.weight,
    weightedScore: timeline.score * SCORING_CONFIG.timeline.weight,
    rawValue: timeline.rawValue,
    status: getFactorStatus(timeline.score),
  });

  // 6. Case Readiness (10%)
  const caseReadiness = await calculateCaseReadinessScore(caseId);
  factors.push({
    name: SCORING_CONFIG.historical.name,
    description: SCORING_CONFIG.historical.description,
    score: caseReadiness.score,
    weight: SCORING_CONFIG.historical.weight,
    weightedScore: caseReadiness.score * SCORING_CONFIG.historical.weight,
    rawValue: caseReadiness.rawValue,
    status: getFactorStatus(caseReadiness.score),
  });

  // Calculate overall score
  const overallScore = calculateWeightedScore(
    factors.map((f) => ({ value: f.score, weight: f.weight }))
  );

  // Calculate confidence (based on how much data we have)
  const dataPoints = factors.filter((f) => f.score > 0).length;
  const confidence = dataPoints / factors.length;

  // Generate risk factors and improvements
  const riskFactors = generateRiskFactors(factors);
  const improvements = generateImprovements(factors);

  return {
    overallScore,
    confidence,
    factors,
    riskFactors,
    improvements,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Get success score color based on score value.
 */
export function getSuccessScoreColor(score: number): {
  bg: string;
  text: string;
  border: string;
} {
  if (score >= 80) {
    return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-500' };
  }
  if (score >= 60) {
    return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-500' };
  }
  if (score >= 40) {
    return { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-500' };
  }
  return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-500' };
}

/**
 * Get success score label based on score value.
 */
export function getSuccessScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Needs Work';
}
