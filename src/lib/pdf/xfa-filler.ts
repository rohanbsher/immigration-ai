/**
 * XFA PDF filler engine for USCIS immigration forms.
 *
 * Calls the Railway-hosted PDF fill microservice over HTTP.
 * The service uses pikepdf to inject field values into XFA datasets XML —
 * the actual format used by official USCIS fillable PDFs.
 *
 * Reuses the same field-mapping types and formatter functions from
 * the AcroForm filler to keep the interface consistent.
 */

import path from 'path';
import { createLogger } from '@/lib/logger';
import type { AcroFormFieldMap, FillResult } from './acroform-filler';
import { getNestedValue, formatFieldValue } from './acroform-filler';

const log = createLogger('xfa-filler');

/** Timeout for the PDF service HTTP call (30 seconds). */
const SERVICE_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build a flat `Record<string, string>` of XFA field names to formatted
 * values from the field maps and form data.
 */
export function buildFieldData(
  fieldMaps: AcroFormFieldMap[],
  formData: Record<string, unknown>
): { fieldData: Record<string, string>; skippedFields: string[] } {
  const fieldData: Record<string, string> = {};
  const skippedFields: string[] = [];

  for (const mapping of fieldMaps) {
    const rawValue = getNestedValue(formData, mapping.dataPath);

    if (rawValue === undefined || rawValue === null || rawValue === '') {
      skippedFields.push(mapping.formFieldName);
      continue;
    }

    const formatted = mapping.format
      ? mapping.format(rawValue)
      : formatFieldValue(rawValue, mapping.type);

    if (formatted !== '') {
      fieldData[mapping.formFieldName] = formatted;
    } else {
      skippedFields.push(mapping.formFieldName);
    }
  }

  return { fieldData, skippedFields };
}

/** Known USCIS form types the PDF service supports. */
const KNOWN_FORM_TYPES = ['I-130', 'I-485', 'I-765', 'I-131', 'I-140', 'N-400', 'G-1145'] as const;

/**
 * Derive the USCIS form type identifier (e.g. "I-130") from a template
 * file path like `/path/to/public/uscis-templates/i-130.pdf`.
 *
 * Validates the derived type against the known form type list to catch
 * misnamed templates early rather than getting a 422 from the service.
 */
export function deriveFormType(templatePath: string): string {
  const basename = path.basename(templatePath, '.pdf'); // "i-130"
  const formType = basename.toUpperCase(); // "I-130"

  if (!KNOWN_FORM_TYPES.includes(formType as typeof KNOWN_FORM_TYPES[number])) {
    log.warn(`Unrecognized form type "${formType}" derived from template path: ${templatePath}`);
  }

  return formType;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fill a USCIS PDF template using the remote PDF fill service.
 *
 * @param templatePath - Absolute path to the USCIS PDF template (used to derive form type)
 * @param fieldMaps    - Field mapping configuration (same interface as AcroForm)
 * @param formData     - Application data to fill into the PDF
 * @returns FillResult with the filled PDF bytes and fill statistics
 */
export async function fillXFAPdf(
  templatePath: string,
  fieldMaps: AcroFormFieldMap[],
  formData: Record<string, unknown>
): Promise<FillResult> {
  const totalFieldCount = fieldMaps.length;

  // Check if the PDF service is configured
  const serviceUrl = process.env.PDF_SERVICE_URL;
  const serviceSecret = process.env.PDF_SERVICE_SECRET;

  if (!serviceUrl || !serviceSecret) {
    log.warn('PDF_SERVICE_URL or PDF_SERVICE_SECRET not configured, XFA fill unavailable');
    return {
      success: false,
      filledFieldCount: 0,
      totalFieldCount,
      skippedFields: [],
      errors: ['PDF fill service not configured'],
    };
  }

  try {
    // 1. Build the flat field-name-to-value map
    const { fieldData, skippedFields } = buildFieldData(fieldMaps, formData);

    // 2. Derive form type from template path
    const formType = deriveFormType(templatePath);

    // 3. Call the remote PDF fill service
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SERVICE_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${serviceUrl}/fill-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceSecret}`,
        },
        body: JSON.stringify({
          form_type: formType,
          field_data: fieldData,
        }),
        signal: controller.signal,
      });
    } catch (fetchError) {
      const msg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      log.logError('PDF service request failed', fetchError);
      return {
        success: false,
        filledFieldCount: 0,
        totalFieldCount,
        skippedFields,
        errors: [`PDF service unavailable: ${msg}`],
      };
    } finally {
      clearTimeout(timeout);
    }

    // 4. Handle HTTP errors
    if (!response.ok) {
      let errorDetail: string;
      try {
        const errorBody = await response.text();
        errorDetail = errorBody.slice(0, 500);
      } catch {
        errorDetail = `HTTP ${response.status}`;
      }
      log.error(`PDF service returned ${response.status}: ${errorDetail}`);
      return {
        success: false,
        filledFieldCount: 0,
        totalFieldCount,
        skippedFields,
        errors: [`PDF service error (${response.status}): ${errorDetail}`],
      };
    }

    // 5. Parse fill stats from response header
    let filledFieldCount = Object.keys(fieldData).length;
    const errors: string[] = [];

    const statsHeader = response.headers.get('X-Fill-Stats');
    if (statsHeader) {
      try {
        const stats = JSON.parse(statsHeader) as { filled: number; total: number; errors: string[] };
        filledFieldCount = stats.filled;
        if (stats.errors.length > 0) {
          errors.push(...stats.errors);
        }
      } catch {
        log.warn('Could not parse X-Fill-Stats header, using fallback stats');
      }
    }

    // 6. Read the PDF bytes from the response body
    const pdfBuffer = await response.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfBuffer);

    if (pdfBytes.length === 0) {
      return {
        success: false,
        filledFieldCount: 0,
        totalFieldCount,
        skippedFields,
        errors: ['PDF service returned empty response'],
      };
    }

    return {
      success: true,
      pdfBytes,
      filledFieldCount,
      totalFieldCount,
      skippedFields,
      errors,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.logError('XFA fill failed', error);
    return {
      success: false,
      filledFieldCount: 0,
      totalFieldCount: fieldMaps.length,
      skippedFields: [],
      errors: [msg],
    };
  }
}
