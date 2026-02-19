/**
 * Claude Vision provider for document analysis.
 *
 * Mirrors the public API of `openai.ts` so the routing layer in
 * `document-analysis.ts` can swap providers transparently.
 *
 * Uses `callClaudeStructured` (tool-use forced output) for guaranteed
 * schema-conforming responses, and Anthropic native content blocks for
 * images (base64) and PDFs (document blocks).
 */

import type Anthropic from '@anthropic-ai/sdk';
import type { DocumentAnalysisResult, AnalysisOptions } from './types';
import {
  DOCUMENT_ANALYSIS_SYSTEM_PROMPT,
  getExtractionPrompt,
} from './prompts';
import {
  DocumentAnalysisResultSchema,
  DocumentTypeDetectionSchema,
  DocumentValidationSchema,
} from './schemas';
import { callClaudeStructured } from './structured-output';
import { anthropicBreaker } from './circuit-breaker';
import { createLogger } from '@/lib/logger';

const log = createLogger('ai:claude-vision');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VisionAnalysisInput {
  imageUrl?: string;
  imageBase64?: string;
  documentType?: string;
  options?: AnalysisOptions;
}

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Fetch an image from a signed URL and return its base64-encoded content.
 * Claude requires base64 image data rather than URL references.
 */
export async function fetchImageAsBase64(
  signedUrl: string
): Promise<{ data: string; mediaType: ImageMediaType | 'application/pdf' }> {
  const response = await fetch(signedUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch image from signed URL: ${response.status} ${response.statusText}`
    );
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const buffer = await response.arrayBuffer();
  const data = Buffer.from(buffer).toString('base64');

  const mediaType = resolveMediaType(contentType);

  return { data, mediaType };
}

function resolveMediaType(
  contentType: string
): ImageMediaType | 'application/pdf' {
  if (contentType.includes('pdf')) return 'application/pdf';
  if (contentType.includes('png')) return 'image/png';
  if (contentType.includes('gif')) return 'image/gif';
  if (contentType.includes('webp')) return 'image/webp';
  return 'image/jpeg';
}

/**
 * Build an Anthropic content block for the given image/PDF data.
 */
function buildContentBlock(
  base64Data: string,
  mediaType: ImageMediaType | 'application/pdf'
): Anthropic.Messages.ContentBlockParam {
  if (mediaType === 'application/pdf') {
    return {
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: base64Data,
      },
    };
  }

  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: mediaType,
      data: base64Data,
    },
  };
}

/**
 * Resolve the base64 data for a vision input.
 * If `imageBase64` is provided it is used directly; otherwise the
 * signed URL is fetched and converted.
 */
async function resolveBase64(
  input: VisionAnalysisInput
): Promise<{ data: string; mediaType: ImageMediaType | 'application/pdf' }> {
  if (input.imageBase64) {
    return { data: input.imageBase64, mediaType: 'image/jpeg' };
  }

  if (!input.imageUrl) {
    throw new Error('Either imageUrl or imageBase64 must be provided');
  }

  return fetchImageAsBase64(input.imageUrl);
}

// ---------------------------------------------------------------------------
// Public API -- mirrors openai.ts function signatures
// ---------------------------------------------------------------------------

/**
 * Analyze a document image using Claude Vision.
 */
export async function analyzeDocumentWithClaude(
  input: VisionAnalysisInput
): Promise<DocumentAnalysisResult> {
  const startTime = Date.now();

  if (!input.imageUrl && !input.imageBase64) {
    throw new Error('Either imageUrl or imageBase64 must be provided');
  }

  const { data, mediaType } = await resolveBase64(input);
  const contentBlock = buildContentBlock(data, mediaType);

  const documentType =
    input.documentType || input.options?.document_type || 'generic';
  const extractionPrompt = getExtractionPrompt(documentType);

  try {
    const result = await anthropicBreaker.execute(() =>
      callClaudeStructured({
        toolName: 'document_analysis',
        toolDescription:
          'Extract structured data from an immigration document image.',
        schema: DocumentAnalysisResultSchema,
        system: DOCUMENT_ANALYSIS_SYSTEM_PROMPT,
        userMessage: [
          { type: 'text' as const, text: extractionPrompt },
          contentBlock,
        ],
        maxTokens: 4096,
      })
    );

    return {
      ...result,
      processing_time_ms: Date.now() - startTime,
    };
  } catch (error) {
    log.error('Claude vision analysis failed', {
      error: error instanceof Error ? error.message : String(error),
      documentType,
    });
    throw error;
  }
}

/**
 * Extract text from a document image (OCR) using Claude Vision.
 */
export async function extractTextWithClaude(
  imageUrl: string
): Promise<{ text: string; confidence: number }> {
  const { data, mediaType } = await fetchImageAsBase64(imageUrl);
  const contentBlock = buildContentBlock(data, mediaType);

  try {
    const result = await anthropicBreaker.execute(() =>
      callClaudeStructured({
        toolName: 'text_extraction',
        toolDescription: 'Extract all text from a document image via OCR.',
        schema: DocumentAnalysisResultSchema,
        system:
          'You are a precise OCR engine. Extract every piece of text visible in the document, preserving formatting and line breaks.',
        userMessage: [
          {
            type: 'text' as const,
            text: 'Extract all text from this document image. Return it in the raw_text field. Also identify any fields you can detect and list them in extracted_fields.',
          },
          contentBlock,
        ],
        maxTokens: 4096,
      })
    );

    const text = result.raw_text || '';
    return {
      text,
      confidence: text.length > 0 ? 0.9 : 0,
    };
  } catch (error) {
    log.error('Claude text extraction failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Detect the type of a document from an image using Claude Vision.
 */
export async function detectDocumentTypeWithClaude(
  imageUrl: string
): Promise<{ type: string; confidence: number }> {
  const { data, mediaType } = await fetchImageAsBase64(imageUrl);
  const contentBlock = buildContentBlock(data, mediaType);

  try {
    const result = await anthropicBreaker.execute(() =>
      callClaudeStructured({
        toolName: 'document_type_detection',
        toolDescription:
          'Identify the type of an immigration-related document from its image.',
        schema: DocumentTypeDetectionSchema,
        system:
          'You are an expert at identifying immigration document types from images.',
        userMessage: [
          {
            type: 'text' as const,
            text: `Identify the type of document in this image. Common types include:
- passport
- birth_certificate
- marriage_certificate
- divorce_certificate
- employment_letter
- bank_statement
- tax_return
- utility_bill
- drivers_license
- national_id
- visa
- i94
- green_card
- naturalization_certificate
- other`,
          },
          contentBlock,
        ],
        maxTokens: 256,
      })
    );

    return {
      type: result.type || 'other',
      confidence: result.confidence || 0,
    };
  } catch (error) {
    log.error('Claude document type detection failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { type: 'other', confidence: 0 };
  }
}

/**
 * Validate if an image is a valid document using Claude Vision.
 */
export async function validateDocumentImageWithClaude(
  imageUrl: string
): Promise<{
  isValid: boolean;
  reason?: string;
  suggestedType?: string;
}> {
  const { data, mediaType } = await fetchImageAsBase64(imageUrl);
  const contentBlock = buildContentBlock(data, mediaType);

  try {
    const result = await anthropicBreaker.execute(() =>
      callClaudeStructured({
        toolName: 'document_validation',
        toolDescription:
          'Validate whether an image is a legitimate document suitable for immigration case processing.',
        schema: DocumentValidationSchema,
        system:
          'You are an expert at evaluating document image quality for immigration case processing.',
        userMessage: [
          {
            type: 'text' as const,
            text: `Analyze this image and determine if it's a valid document image suitable for immigration case processing.

Invalid images include:
- Blank or mostly blank images
- Photos of people without document context
- Screenshots of websites
- Illegible or very low quality images
- Irrelevant content`,
          },
          contentBlock,
        ],
        maxTokens: 256,
      })
    );

    return {
      isValid: result.isValid,
      reason: result.reason,
      suggestedType: result.suggestedType,
    };
  } catch (error) {
    log.error('Claude document validation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { isValid: false, reason: 'Unable to analyze image with Claude' };
  }
}
