/**
 * Document Completeness Analysis
 *
 * Analyzes what documents are missing for a specific visa type,
 * compares uploaded docs against requirements, and shows progress
 * toward "filing ready" status.
 */

import { createClient } from '@/lib/supabase/server';
import type { DocumentType, DocumentStatus } from '@/types';

/**
 * Result of document completeness analysis.
 */
export interface CompletenessResult {
  /** Overall completeness percentage (0-100) */
  overallCompleteness: number;
  /** Filing readiness status */
  filingReadiness: 'ready' | 'needs_review' | 'incomplete';
  /** Required documents that are missing */
  missingRequired: DocumentRequirement[];
  /** Optional documents that are missing */
  missingOptional: DocumentRequirement[];
  /** Documents that have been uploaded */
  uploadedDocs: UploadedDocumentInfo[];
  /** AI-generated recommendations for next steps */
  recommendations: string[];
  /** Total required documents count */
  totalRequired: number;
  /** Uploaded required documents count */
  uploadedRequired: number;
  /** Timestamp of analysis */
  analyzedAt: string;
}

/**
 * Document requirement from the checklist.
 */
export interface DocumentRequirement {
  documentType: DocumentType;
  displayName: string;
  required: boolean;
  description: string | null;
}

/**
 * Information about an uploaded document.
 */
export interface UploadedDocumentInfo {
  id: string;
  type: DocumentType;
  displayName: string;
  quality: number; // AI confidence score (0-1)
  status: 'verified' | 'needs_review' | 'processing' | 'rejected';
  expirationDate: string | null;
  isExpired: boolean;
  isExpiringSoon: boolean; // Within 30 days
}

/**
 * Format a document type enum value for display.
 */
function formatDocumentType(docType: string): string {
  return docType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Map document status to simplified status.
 */
function mapDocumentStatus(
  status: DocumentStatus,
  confidence: number | null
): UploadedDocumentInfo['status'] {
  if (status === 'verified') return 'verified';
  if (status === 'rejected') return 'rejected';
  if (status === 'processing' || status === 'uploaded') return 'processing';

  // For 'analyzed' status, check confidence
  if (status === 'analyzed') {
    if (confidence !== null && confidence >= 0.7) return 'verified';
    return 'needs_review';
  }

  return 'needs_review';
}

/**
 * Check if a date is expired.
 */
function isDateExpired(date: string | null): boolean {
  if (!date) return false;
  return new Date(date) < new Date();
}

/**
 * Check if a date is expiring soon (within 30 days).
 */
function isDateExpiringSoon(date: string | null): boolean {
  if (!date) return false;
  const expirationDate = new Date(date);
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return expirationDate > now && expirationDate <= thirtyDaysFromNow;
}

/**
 * Generate recommendations based on completeness analysis.
 */
function generateRecommendations(
  missingRequired: DocumentRequirement[],
  missingOptional: DocumentRequirement[],
  uploadedDocs: UploadedDocumentInfo[]
): string[] {
  const recommendations: string[] = [];

  // Priority 1: Missing required documents
  if (missingRequired.length > 0) {
    const topMissing = missingRequired.slice(0, 3);
    recommendations.push(
      `Upload ${topMissing.map((d) => d.displayName).join(', ')} to proceed with filing.`
    );
  }

  // Priority 2: Documents needing review
  const needsReview = uploadedDocs.filter((d) => d.status === 'needs_review');
  if (needsReview.length > 0) {
    recommendations.push(
      `Review and verify ${needsReview.length} document(s) with low confidence scores.`
    );
  }

  // Priority 3: Expiring documents
  const expiringSoon = uploadedDocs.filter((d) => d.isExpiringSoon && !d.isExpired);
  if (expiringSoon.length > 0) {
    recommendations.push(
      `${expiringSoon.length} document(s) expiring soon. Consider renewing before filing.`
    );
  }

  // Priority 4: Expired documents
  const expired = uploadedDocs.filter((d) => d.isExpired);
  if (expired.length > 0) {
    recommendations.push(
      `Replace ${expired.length} expired document(s): ${expired.map((d) => d.displayName).join(', ')}.`
    );
  }

  // Priority 5: Optional documents that could strengthen the case
  if (missingOptional.length > 0 && missingRequired.length === 0) {
    const suggestionCount = Math.min(2, missingOptional.length);
    recommendations.push(
      `Consider adding optional documents like ${missingOptional
        .slice(0, suggestionCount)
        .map((d) => d.displayName)
        .join(' or ')} to strengthen the case.`
    );
  }

  return recommendations;
}

/**
 * Calculate filing readiness based on document completeness.
 */
function calculateFilingReadiness(
  completeness: number,
  hasExpired: boolean,
  needsReviewCount: number
): CompletenessResult['filingReadiness'] {
  // Cannot file with expired documents
  if (hasExpired) return 'incomplete';

  // All required docs present and verified
  if (completeness === 100 && needsReviewCount === 0) return 'ready';

  // All required docs present but some need review
  if (completeness === 100) return 'needs_review';

  // Missing required documents
  return 'incomplete';
}

/**
 * Analyze document completeness for a case.
 *
 * @param caseId - The case ID to analyze
 * @returns Completeness analysis result
 */
export async function analyzeDocumentCompleteness(
  caseId: string
): Promise<CompletenessResult> {
  const supabase = await createClient();

  // Fetch case details to get visa type
  const { data: caseData, error: caseError } = await supabase
    .from('cases')
    .select('visa_type')
    .eq('id', caseId)
    .is('deleted_at', null)
    .single();

  if (caseError || !caseData) {
    throw new Error('Case not found');
  }

  const visaType = caseData.visa_type;

  // Fetch document checklist for this visa type
  const { data: checklist, error: checklistError } = await supabase
    .from('document_checklists')
    .select('document_type, required, description')
    .eq('visa_type', visaType);

  if (checklistError) {
    console.error('Error fetching checklist:', checklistError);
    throw new Error('Failed to fetch document requirements');
  }

  // Fetch uploaded documents for this case
  const { data: documents, error: docsError } = await supabase
    .from('documents')
    .select('id, document_type, status, ai_confidence_score, expiration_date')
    .eq('case_id', caseId)
    .is('deleted_at', null);

  if (docsError) {
    console.error('Error fetching documents:', docsError);
    throw new Error('Failed to fetch case documents');
  }

  // Create a map of uploaded document types
  const uploadedTypes = new Set(
    (documents || []).map((doc) => doc.document_type as DocumentType)
  );

  // Process uploaded documents
  const uploadedDocs: UploadedDocumentInfo[] = (documents || []).map((doc) => ({
    id: doc.id,
    type: doc.document_type as DocumentType,
    displayName: formatDocumentType(doc.document_type),
    quality: doc.ai_confidence_score ?? 0,
    status: mapDocumentStatus(
      doc.status as DocumentStatus,
      doc.ai_confidence_score
    ),
    expirationDate: doc.expiration_date,
    isExpired: isDateExpired(doc.expiration_date),
    isExpiringSoon: isDateExpiringSoon(doc.expiration_date),
  }));

  // Separate missing required and optional documents
  const missingRequired: DocumentRequirement[] = [];
  const missingOptional: DocumentRequirement[] = [];
  let totalRequired = 0;
  let uploadedRequired = 0;

  for (const item of checklist || []) {
    const docType = item.document_type as DocumentType;
    const requirement: DocumentRequirement = {
      documentType: docType,
      displayName: formatDocumentType(docType),
      required: item.required,
      description: item.description,
    };

    if (item.required) {
      totalRequired++;
      if (uploadedTypes.has(docType)) {
        uploadedRequired++;
      } else {
        missingRequired.push(requirement);
      }
    } else {
      if (!uploadedTypes.has(docType)) {
        missingOptional.push(requirement);
      }
    }
  }

  // Calculate completeness percentage
  const overallCompleteness =
    totalRequired > 0 ? Math.round((uploadedRequired / totalRequired) * 100) : 100;

  // Check for expired documents
  const hasExpired = uploadedDocs.some((d) => d.isExpired);
  const needsReviewCount = uploadedDocs.filter(
    (d) => d.status === 'needs_review'
  ).length;

  // Calculate filing readiness
  const filingReadiness = calculateFilingReadiness(
    overallCompleteness,
    hasExpired,
    needsReviewCount
  );

  // Generate recommendations
  const recommendations = generateRecommendations(
    missingRequired,
    missingOptional,
    uploadedDocs
  );

  return {
    overallCompleteness,
    filingReadiness,
    missingRequired,
    missingOptional,
    uploadedDocs,
    recommendations,
    totalRequired,
    uploadedRequired,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Get a summary of completeness for multiple cases.
 * Useful for dashboard widgets.
 *
 * @param caseIds - Array of case IDs to analyze
 * @returns Map of case ID to completeness percentage
 */
export async function getCompletenessForCases(
  caseIds: string[]
): Promise<Map<string, number>> {
  const results = new Map<string, number>();

  // Process in parallel with concurrency limit
  const BATCH_SIZE = 5;
  for (let i = 0; i < caseIds.length; i += BATCH_SIZE) {
    const batch = caseIds.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (caseId) => {
        try {
          const result = await analyzeDocumentCompleteness(caseId);
          return { caseId, completeness: result.overallCompleteness };
        } catch {
          return { caseId, completeness: 0 };
        }
      })
    );

    for (const { caseId, completeness } of batchResults) {
      results.set(caseId, completeness);
    }
  }

  return results;
}
