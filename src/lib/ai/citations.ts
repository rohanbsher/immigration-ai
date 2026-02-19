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

const log = createLogger('ai:citations');

// ---------------------------------------------------------------------------
// Types for raw Anthropic citation annotations
// ---------------------------------------------------------------------------

interface RawCitationAnnotation {
  type: string;
  /** Cited text passage. */
  cited_text?: string;
  /** Start index in the source. */
  start_index?: number;
  /** End index in the source. */
  end_index?: number;
  /** Document index in the sources array. */
  document_index?: number;
  /** Page number (1-indexed). */
  page_number?: number;
  /** Document title / filename. */
  document_title?: string;
}

interface RawContentBlock {
  type: string;
  text?: string;
  annotations?: RawCitationAnnotation[];
}

interface RawCitationResponse {
  content?: RawContentBlock[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse citation annotations from a raw Anthropic response.
 *
 * The Citations API adds `annotations` arrays to text content blocks.
 * This function normalizes them into our `Citation` type.
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
    if (block.type !== 'text' || !block.annotations) continue;

    for (const annotation of block.annotations) {
      if (!annotation.cited_text) continue;

      const docInfo = annotation.document_index !== undefined
        ? documentMap?.get(annotation.document_index)
        : undefined;

      citations.push({
        type: 'document',
        citedText: annotation.cited_text,
        startIndex: annotation.start_index,
        endIndex: annotation.end_index,
        pageNumber: annotation.page_number,
        documentId: docInfo?.documentId,
        documentType: docInfo?.documentType || annotation.document_title,
      });
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
