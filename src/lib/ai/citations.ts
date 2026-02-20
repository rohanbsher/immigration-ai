/**
 * Citation parsing and mapping for the Anthropic Citations API.
 *
 * When citations are enabled, Claude returns annotation blocks alongside
 * text content. This module extracts those annotations and maps them to
 * specific form fields so attorneys can trace every AI-generated value
 * back to a source document passage.
 */

import type { Citation, FormFieldWithCitations } from './types';
import { createLogger } from '@/lib/logger';
import { getAnthropicClient, CLAUDE_MODEL } from './client';
import { anthropicBreaker } from './circuit-breaker';
import { withRetry, AI_RETRY_OPTIONS } from '@/lib/utils/retry';

const log = createLogger('ai:citations');

// ---------------------------------------------------------------------------
// Types for raw Anthropic citation annotations (real API format)
// ---------------------------------------------------------------------------

/**
 * Raw citation annotation from the Anthropic Citations API.
 *
 * The API returns three location types:
 * - `char_location`: character-level offsets (start_char_index / end_char_index)
 * - `page_location`: page-level ranges (start_page_number / end_page_number)
 * - `content_block_location`: block-level ranges (start_block_index / end_block_index)
 *
 * All types carry `cited_text`, `document_index`, and optional `document_title`.
 */
interface RawCitation {
  type: 'char_location' | 'page_location' | 'content_block_location';
  cited_text: string;
  document_index: number;
  document_title?: string;
  // char_location fields
  start_char_index?: number;
  end_char_index?: number;
  // page_location fields
  start_page_number?: number;
  end_page_number?: number;
  // content_block_location fields
  start_block_index?: number;
  end_block_index?: number;
}

interface RawContentBlock {
  type: string;
  text?: string;
  citations?: RawCitation[];
}

interface RawCitationResponse {
  content?: RawContentBlock[];
}

// ---------------------------------------------------------------------------
// Public input/output types for generateFieldCitations
// ---------------------------------------------------------------------------

export interface CitationDocument {
  documentId: string;
  documentType: string;
  rawText: string;
}

export interface CitationField {
  fieldId: string;
  fieldName: string;
  suggestedValue: string;
}

export interface CitationInput {
  documents: CitationDocument[];
  fields: CitationField[];
}

export interface CitationResult {
  citations: Citation[];
  processingTimeMs: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse citation annotations from a raw Anthropic response.
 *
 * The Citations API returns `citations` arrays on text content blocks.
 * Each citation has a `type` that determines the location format:
 * - `char_location`: start_char_index / end_char_index
 * - `page_location`: start_page_number / end_page_number
 * - `content_block_location`: start_block_index / end_block_index
 *
 * This function normalizes all three formats into our `Citation` type.
 *
 * @param response — The raw message response from the Anthropic API.
 * @param documentMap — Optional mapping from document index → { documentId, documentType }.
 */
export function parseCitationsFromResponse(
  response: RawCitationResponse,
  documentMap?: Map<number, { documentId: string; documentType: string }>
): Citation[] {
  const citations: Citation[] = [];

  if (!response.content) return citations;

  for (const block of response.content) {
    if (block.type !== 'text' || !block.citations) continue;

    for (const raw of block.citations) {
      if (!raw.cited_text) continue;

      const docInfo = raw.document_index !== undefined
        ? documentMap?.get(raw.document_index)
        : undefined;

      const citation: Citation = {
        type: 'document',
        citedText: raw.cited_text,
        documentId: docInfo?.documentId,
        documentType: docInfo?.documentType || raw.document_title,
      };

      // Normalize location fields based on citation type
      if (raw.type === 'char_location') {
        citation.startIndex = raw.start_char_index;
        citation.endIndex = raw.end_char_index;
      } else if (raw.type === 'page_location') {
        citation.pageNumber = raw.start_page_number;
      }
      // content_block_location — no direct mapping to our Citation fields;
      // we store only the citedText and document info.

      citations.push(citation);
    }
  }

  return citations;
}

/**
 * Minimum character length for substring matching.
 * Values shorter than this are too ambiguous to match reliably
 * (e.g., "A", "NY" would match too many citations).
 */
const MIN_MATCH_LENGTH = 3;

/**
 * Minimum ratio of shorter-string length to longer-string length.
 * Prevents false positives where a short value matches inside a
 * much longer, unrelated citation (e.g., "John" matching
 * "Johnson & Johnson LLC" — ratio 4/23 = 0.17, rejected).
 */
const MIN_MATCH_RATIO = 0.4;

/**
 * Map parsed citations to specific form fields.
 *
 * Uses heuristic matching: the citation's `citedText` must contain the
 * field's `suggested_value` (or vice versa) via case-insensitive substring.
 *
 * Guards against false positives:
 * - Values shorter than 3 characters are skipped (too ambiguous)
 * - The shorter string must be at least 40% the length of the longer one
 *   to avoid "John" matching "Johnson & Johnson LLC"
 *
 * @param citations — Array of parsed citations.
 * @param fields — Array of form fields with suggested values.
 * @returns The same fields with `citations` arrays populated.
 */
export function mapCitationsToFields(
  citations: Citation[],
  fields: FormFieldWithCitations[]
): FormFieldWithCitations[] {
  if (citations.length === 0) return fields;

  return fields.map((field) => {
    if (!field.suggested_value) return field;

    const valueLower = field.suggested_value.toLowerCase().trim();
    if (valueLower.length < MIN_MATCH_LENGTH) return field;

    const matchingCitations = citations.filter((c) => {
      const citedLower = c.citedText.toLowerCase().trim();
      if (citedLower.length < MIN_MATCH_LENGTH) return false;

      const shorter = valueLower.length <= citedLower.length ? valueLower : citedLower;
      const longer = valueLower.length <= citedLower.length ? citedLower : valueLower;

      // The shorter string must be a substring of the longer
      if (!longer.includes(shorter)) return false;

      // Guard against partial-word matches
      if (shorter.length / longer.length < MIN_MATCH_RATIO) return false;

      return true;
    });

    if (matchingCitations.length === 0) return field;

    log.debug('Mapped citations to field', {
      fieldId: field.field_id,
      fieldName: field.field_name,
      citationCount: matchingCitations.length,
    });

    return {
      ...field,
      citations: matchingCitations,
    };
  });
}

/**
 * Check if any fields have citations attached.
 */
export function hasCitations(fields: FormFieldWithCitations[]): boolean {
  return fields.some((f) => f.citations && f.citations.length > 0);
}

/**
 * Get the total number of citations across all fields.
 */
export function countCitations(fields: FormFieldWithCitations[]): number {
  return fields.reduce((sum, f) => sum + (f.citations?.length || 0), 0);
}

// ---------------------------------------------------------------------------
// Pass 2: Generate citations for autofilled fields
// ---------------------------------------------------------------------------

const MAX_TOKENS_CITATIONS = 4096;

/**
 * Generate citations for autofilled form fields (Pass 2).
 *
 * Sends document text as `document` content blocks with `citations: { enabled: true }`
 * and asks Claude to quote passages that support each field's suggested value.
 *
 * This is best-effort: on any error, logs and returns empty citations so
 * the autofill result is never blocked.
 */
export async function generateFieldCitations(
  input: CitationInput
): Promise<CitationResult> {
  const startTime = Date.now();

  // Filter out documents with empty rawText
  const validDocs = input.documents.filter((d) => d.rawText.trim().length > 0);

  // Return early if nothing to cite
  if (validDocs.length === 0 || input.fields.length === 0) {
    return { citations: [], processingTimeMs: Date.now() - startTime };
  }

  // Build document-index-to-info mapping
  const documentMap = new Map<number, { documentId: string; documentType: string }>();
  validDocs.forEach((doc, idx) => {
    documentMap.set(idx, { documentId: doc.documentId, documentType: doc.documentType });
  });

  // Build document content blocks
  const documentBlocks = validDocs.map((doc) => ({
    type: 'document' as const,
    source: {
      type: 'text' as const,
      media_type: 'text/plain' as const,
      data: doc.rawText,
    },
    title: doc.documentType,
    context: `Source document: ${doc.documentType} (ID: ${doc.documentId})`,
    citations: { enabled: true as const },
    cache_control: { type: 'ephemeral' as const },
  }));

  // Build the field-listing prompt
  const fieldLines = input.fields.map(
    (f) => `- ${f.fieldName} (ID: ${f.fieldId}): "${f.suggestedValue}"`
  );

  const textBlock = {
    type: 'text' as const,
    text: [
      'For each of the following form field values, quote the exact passage from the source documents that supports the value.',
      'If a value cannot be found in any document, skip it.',
      '',
      ...fieldLines,
    ].join('\n'),
  };

  try {
    const response = await anthropicBreaker.execute(() =>
      withRetry(
        () =>
          getAnthropicClient().messages.create({
            model: CLAUDE_MODEL,
            max_tokens: MAX_TOKENS_CITATIONS,
            messages: [
              {
                role: 'user',
                content: [...documentBlocks, textBlock],
              },
            ],
          }),
        AI_RETRY_OPTIONS
      )
    );

    const citations = parseCitationsFromResponse(
      response as unknown as RawCitationResponse,
      documentMap
    );

    const processingTimeMs = Date.now() - startTime;
    log.info('Generated field citations', {
      documentCount: validDocs.length,
      fieldCount: input.fields.length,
      citationCount: citations.length,
      processingTimeMs,
    });

    return { citations, processingTimeMs };
  } catch (error) {
    log.logError('Failed to generate field citations (best-effort)', error);
    return { citations: [], processingTimeMs: Date.now() - startTime };
  }
}
