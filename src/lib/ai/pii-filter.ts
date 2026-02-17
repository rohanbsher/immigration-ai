// PII filtering for AI API payloads.
// Redacts sensitive field values before sending data to external AI providers
// while preserving field names and metadata needed for form mapping.

import { isSensitiveField } from '@/lib/crypto';
import type { ExtractedField } from './types';

const REDACTED_PREFIX = '[REDACTED:';
const REDACTED_SUFFIX = ']';

function redactedPlaceholder(fieldName: string): string {
  return `${REDACTED_PREFIX}${fieldName}${REDACTED_SUFFIX}`;
}

/**
 * Filter PII from an array of extracted document fields.
 *
 * Sensitive field values are replaced with `[REDACTED:field_name]`.
 * Field names, confidence scores, and other metadata are preserved
 * so the AI can still perform accurate form mapping.
 */
export function filterPiiFromExtractedData(
  fields: ExtractedField[]
): ExtractedField[] {
  return fields.map((field) => {
    if (field.value !== null && isSensitiveField(field.field_name)) {
      return {
        ...field,
        value: redactedPlaceholder(field.field_name),
      };
    }
    return field;
  });
}

/**
 * Filter PII from a key-value record (e.g. existing form data).
 *
 * Keys matching sensitive field patterns have their values replaced
 * with `[REDACTED:key]`. Non-sensitive entries pass through unchanged.
 */
export function filterPiiFromRecord(
  record: Record<string, string>
): Record<string, string> {
  const filtered: Record<string, string> = {};

  for (const [key, value] of Object.entries(record)) {
    filtered[key] = isSensitiveField(key)
      ? redactedPlaceholder(key)
      : value;
  }

  return filtered;
}
