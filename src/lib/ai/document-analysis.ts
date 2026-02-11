// Document analysis service combining OpenAI Vision for OCR

import {
  analyzeDocumentWithVision,
  detectDocumentType,
  validateDocumentImage,
  extractTextFromImage,
} from './openai';
import { DocumentAnalysisResult, ExtractedField, AnalysisOptions } from './types';
import { storage, SIGNED_URL_EXPIRATION } from '@/lib/storage';

export interface DocumentAnalysisInput {
  documentId: string;
  fileUrl?: string;
  filePath?: string;
  bucket?: string;
  documentType?: string;
  options?: AnalysisOptions;
}

export interface AnalysisProgress {
  stage: 'validating' | 'detecting_type' | 'extracting' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
}

/**
 * Main entry point for document analysis
 */
export async function analyzeDocument(
  input: DocumentAnalysisInput,
  onProgress?: (progress: AnalysisProgress) => void
): Promise<DocumentAnalysisResult> {
  const reportProgress = (
    stage: AnalysisProgress['stage'],
    progress: number,
    message: string
  ) => {
    if (onProgress) {
      onProgress({ stage, progress, message });
    }
  };

  try {
    // Step 1: Get the document URL
    reportProgress('validating', 10, 'Retrieving document...');

    let imageUrl = input.fileUrl;

    if (!imageUrl && input.filePath && input.bucket) {
      // Get a signed URL from Supabase storage with short expiration for security
      imageUrl = await storage.getSignedUrl(
        input.bucket,
        input.filePath,
        SIGNED_URL_EXPIRATION.AI_PROCESSING // 10 minutes - sufficient for AI processing
      );
    }

    if (!imageUrl) {
      throw new Error('No document URL available for analysis');
    }

    // Step 2: Validate the document image
    reportProgress('validating', 25, 'Validating document image...');

    const validation = await validateDocumentImage(imageUrl);

    if (!validation.isValid) {
      return {
        document_type: 'invalid',
        extracted_fields: [],
        overall_confidence: 0,
        processing_time_ms: 0,
        errors: [validation.reason || 'Invalid document image'],
      };
    }

    // Step 3: Detect document type if not provided
    reportProgress('detecting_type', 40, 'Detecting document type...');

    let documentType = input.documentType || input.options?.document_type;

    if (!documentType) {
      const detected = await detectDocumentType(imageUrl);
      documentType = detected.type;
    }

    // Step 4: Extract data using GPT-4 Vision
    reportProgress('extracting', 60, `Extracting data from ${documentType}...`);

    const analysisResult = await analyzeDocumentWithVision({
      imageUrl,
      documentType,
      options: input.options,
    });

    // Step 5: Post-process and validate results
    reportProgress('complete', 100, 'Analysis complete');

    return {
      ...analysisResult,
      document_type: documentType || analysisResult.document_type,
    };
  } catch (error) {
    reportProgress('error', 0, `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

/**
 * Batch analyze multiple documents
 */
export async function analyzeDocuments(
  documents: DocumentAnalysisInput[],
  onProgress?: (documentId: string, progress: AnalysisProgress) => void
): Promise<Map<string, DocumentAnalysisResult>> {
  const results = new Map<string, DocumentAnalysisResult>();

  // Process documents in parallel with concurrency limit
  const concurrencyLimit = 3;
  const chunks: DocumentAnalysisInput[][] = [];

  for (let i = 0; i < documents.length; i += concurrencyLimit) {
    chunks.push(documents.slice(i, i + concurrencyLimit));
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.allSettled(
      chunk.map(async (doc) => {
        const result = await analyzeDocument(doc, (progress) => {
          if (onProgress) {
            onProgress(doc.documentId, progress);
          }
        });
        return { documentId: doc.documentId, result };
      })
    );

    for (const settledResult of chunkResults) {
      if (settledResult.status === 'fulfilled') {
        results.set(
          settledResult.value.documentId,
          settledResult.value.result
        );
      } else {
        // Store error result
        const docId =
          chunk[chunkResults.indexOf(settledResult)]?.documentId || 'unknown';
        results.set(docId, {
          document_type: 'error',
          extracted_fields: [],
          overall_confidence: 0,
          processing_time_ms: 0,
          errors: [settledResult.reason?.message || 'Analysis failed'],
        });
      }
    }
  }

  return results;
}

/**
 * Extract specific fields from a document
 */
export async function extractSpecificFields(
  imageUrl: string,
  fieldNames: string[]
): Promise<ExtractedField[]> {
  const result = await analyzeDocumentWithVision({
    imageUrl,
    options: { high_accuracy_mode: true },
  });

  // Filter to only the requested fields
  return result.extracted_fields.filter((field) =>
    fieldNames.includes(field.field_name)
  );
}

/**
 * Get just the raw text from a document (useful for full-text search)
 */
export async function getDocumentText(imageUrl: string): Promise<string> {
  const result = await extractTextFromImage(imageUrl);
  return result.text;
}

/**
 * Compare two documents for similarity (useful for duplicate detection)
 */
export async function compareDocuments(
  doc1Url: string,
  doc2Url: string
): Promise<{
  isSameDocument: boolean;
  similarityScore: number;
  differences: string[];
}> {
  // Extract data from both documents
  const [result1, result2] = await Promise.all([
    analyzeDocumentWithVision({ imageUrl: doc1Url }),
    analyzeDocumentWithVision({ imageUrl: doc2Url }),
  ]);

  // Compare document types
  if (result1.document_type !== result2.document_type) {
    return {
      isSameDocument: false,
      similarityScore: 0,
      differences: [
        `Different document types: ${result1.document_type} vs ${result2.document_type}`,
      ],
    };
  }

  // Compare extracted fields
  const differences: string[] = [];
  let matchingFields = 0;
  const totalFields = Math.max(
    result1.extracted_fields.length,
    result2.extracted_fields.length
  );

  for (const field1 of result1.extracted_fields) {
    const field2 = result2.extracted_fields.find(
      (f) => f.field_name === field1.field_name
    );

    if (!field2) {
      differences.push(`Field "${field1.field_name}" missing in second document`);
    } else if (field1.value !== field2.value) {
      differences.push(
        `Field "${field1.field_name}" differs: "${field1.value}" vs "${field2.value}"`
      );
    } else {
      matchingFields++;
    }
  }

  const similarityScore = totalFields > 0 ? matchingFields / totalFields : 0;

  return {
    isSameDocument: similarityScore > 0.95 && differences.length === 0,
    similarityScore,
    differences,
  };
}

/**
 * Validate that a document meets requirements for a specific visa type
 */
export async function validateDocumentForVisa(
  analysisResult: DocumentAnalysisResult,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _visaType: string
): Promise<{
  isAcceptable: boolean;
  issues: string[];
  suggestions: string[];
}> {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Check overall confidence
  if (analysisResult.overall_confidence < 0.7) {
    issues.push(
      'Document quality is too low for reliable data extraction. Consider re-scanning.'
    );
  }

  // Check for required fields based on document type
  const requiredFieldsByType: Record<string, string[]> = {
    passport: [
      'full_name',
      'date_of_birth',
      'passport_number',
      'expiry_date',
      'nationality',
    ],
    birth_certificate: [
      'full_name',
      'date_of_birth',
      'place_of_birth',
    ],
    marriage_certificate: [
      'spouse_1_name',
      'spouse_2_name',
      'date_of_marriage',
    ],
    employment_letter: [
      'employee_name',
      'employer_name',
      'job_title',
    ],
  };

  const requiredFields =
    requiredFieldsByType[analysisResult.document_type] || [];

  for (const fieldName of requiredFields) {
    const field = analysisResult.extracted_fields.find(
      (f) => f.field_name === fieldName
    );

    if (!field || field.value === null) {
      issues.push(`Required field "${fieldName}" could not be extracted`);
    } else if (field.confidence < 0.8) {
      suggestions.push(
        `Field "${fieldName}" has low confidence (${Math.round(field.confidence * 100)}%). Please verify.`
      );
    }
  }

  // Check for passport expiry (must be valid for 6+ months for most visas)
  if (analysisResult.document_type === 'passport') {
    const expiryField = analysisResult.extracted_fields.find(
      (f) => f.field_name === 'expiry_date'
    );

    if (expiryField?.value) {
      const expiryDate = new Date(expiryField.value);
      const sixMonthsFromNow = new Date();
      sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

      if (expiryDate < sixMonthsFromNow) {
        issues.push(
          'Passport expires within 6 months. Most visa applications require at least 6 months validity.'
        );
      }
    }
  }

  // Add any warnings from the analysis
  if (analysisResult.warnings) {
    suggestions.push(...analysisResult.warnings);
  }

  return {
    isAcceptable: issues.length === 0,
    issues,
    suggestions,
  };
}
