/**
 * Zod schemas for every structured AI response.
 *
 * These schemas are converted to JSON Schema via zod v4's native
 * toJSONSchema() method and passed as tool input_schema to the
 * Anthropic API for guaranteed schema-conforming responses.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Form Autofill
// ---------------------------------------------------------------------------

export const FormFieldSchema = z.object({
  field_id: z.string(),
  field_name: z.string(),
  field_type: z.enum(['text', 'date', 'select', 'checkbox', 'radio', 'textarea']).default('text'),
  current_value: z.string().optional(),
  suggested_value: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  source_document: z.string().optional(),
  requires_review: z.boolean().optional(),
});

export const FormAutofillResultSchema = z.object({
  form_type: z.string(),
  fields: z.array(FormFieldSchema),
  overall_confidence: z.number().min(0).max(1),
  processing_time_ms: z.number().optional(),
  missing_documents: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Form Validation
// ---------------------------------------------------------------------------

export const FormValidationResultSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  suggestions: z.array(z.string()),
});

// ---------------------------------------------------------------------------
// Data Consistency
// ---------------------------------------------------------------------------

export const DataConsistencyResultSchema = z.object({
  consistencyScore: z.number().min(0).max(1),
  discrepancies: z.array(
    z.object({
      field: z.string(),
      values: z.array(
        z.object({
          document: z.string(),
          value: z.string(),
        })
      ),
      recommendation: z.string(),
    })
  ),
});

// ---------------------------------------------------------------------------
// Next Steps
// ---------------------------------------------------------------------------

export const NextStepsResultSchema = z.object({
  nextSteps: z.array(
    z.object({
      priority: z.enum(['high', 'medium', 'low']),
      action: z.string(),
      reason: z.string(),
    })
  ),
});

// ---------------------------------------------------------------------------
// Natural Language Search
// ---------------------------------------------------------------------------

export const SearchFiltersSchema = z.object({
  visaType: z.array(z.string()).optional(),
  status: z.array(z.string()).optional(),
  dateRange: z
    .object({
      start: z.string().optional(),
      end: z.string().optional(),
      field: z.enum(['created_at', 'deadline', 'updated_at']).optional(),
    })
    .optional(),
  documentMissing: z.array(z.string()).optional(),
  documentPresent: z.array(z.string()).optional(),
  clientName: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  hasDeadline: z.boolean().optional(),
  textSearch: z.string().optional(),
});

export const SearchInterpretationSchema = z.object({
  understood: z.string(),
  filters: SearchFiltersSchema,
  sortBy: z.enum(['relevance', 'date', 'deadline']).optional(),
  confidence: z.number().min(0).max(1),
});

// ---------------------------------------------------------------------------
// Document Analysis (for Phase 3 -- Claude Vision)
// ---------------------------------------------------------------------------

export const ExtractedFieldSchema = z.object({
  field_name: z.string(),
  value: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  source_location: z.string().optional(),
  requires_verification: z.boolean(),
});

export const DocumentAnalysisResultSchema = z.object({
  document_type: z.string(),
  extracted_fields: z.array(ExtractedFieldSchema),
  overall_confidence: z.number().min(0).max(1),
  processing_time_ms: z.number().optional(),
  raw_text: z.string().optional(),
  warnings: z.array(z.string()).optional(),
  errors: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Document Type Detection (for Phase 3 -- Claude Vision)
// ---------------------------------------------------------------------------

export const DocumentTypeDetectionSchema = z.object({
  type: z.string(),
  confidence: z.number().min(0).max(1),
});

// ---------------------------------------------------------------------------
// Document Validation (for Phase 3 -- Claude Vision)
// ---------------------------------------------------------------------------

export const DocumentValidationSchema = z.object({
  isValid: z.boolean(),
  reason: z.string().optional(),
  suggestedType: z.string().optional(),
});
