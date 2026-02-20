/**
 * PDF field mapping types, formatters, and utilities for USCIS forms.
 *
 * Provides the shared AcroFormFieldMap / FillResult interfaces,
 * field-value formatters (date, SSN, phone, etc.), and template
 * path helpers used by both the XFA filler and summary PDF engines.
 */

import { PDFDocument } from 'pdf-lib';
import { readFile } from 'fs/promises';
import path from 'path';
import type { FormType } from '@/types';
import { createLogger } from '@/lib/logger';

const log = createLogger('acroform-filler');

/** Directory where USCIS PDF templates are stored. Override via env. */
export const USCIS_TEMPLATES_DIR =
  process.env.USCIS_TEMPLATES_DIR ||
  path.resolve(process.cwd(), 'public/uscis-templates');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AcroFieldType =
  | 'text'
  | 'checkbox'
  | 'radio'
  | 'dropdown'
  | 'date'
  | 'ssn'
  | 'phone'
  | 'alien_number'
  | 'zip_code'
  | 'currency'
  | 'yes_no';

export interface AcroFormFieldMap {
  /** Actual AcroForm field name inside the USCIS PDF */
  formFieldName: string;
  /** Dot-notation path into our form data object */
  dataPath: string;
  /** Field type — determines formatting and fill strategy */
  type: AcroFieldType;
  /** Optional custom formatter (overrides built-in formatting) */
  format?: (value: unknown) => string;
  /** For checkboxes: the data value that means "checked" */
  checkValue?: string;
}

export interface FillResult {
  success: boolean;
  pdfBytes?: Uint8Array;
  filledFieldCount: number;
  totalFieldCount: number;
  skippedFields: string[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

/** MM/DD/YYYY — standard USCIS date format */
export function formatDate(value: unknown): string {
  if (!value) return '';
  const str = String(value);

  // Already in MM/DD/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;

  // ISO-style YYYY-MM-DD
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`;

  // Attempt Date parse as last resort
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${mm}/${dd}/${d.getFullYear()}`;
  }

  return str;
}

/** UPPERCASE — USCIS convention for names */
export function formatName(value: unknown): string {
  if (!value) return '';
  return String(value).toUpperCase();
}

/** (XXX) XXX-XXXX */
export function formatPhone(value: unknown): string {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return String(value);
}

/** XXX-XX-XXXX */
export function formatSSN(value: unknown): string {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 9) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }
  return String(value);
}

/** A-XXXXXXXXX */
export function formatAlienNumber(value: unknown): string {
  if (!value) return '';
  const str = String(value).replace(/\D/g, '');
  if (str.length > 0) {
    return `A-${str.padStart(9, '0')}`;
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// Split-date helpers (for XFA forms with separate Month/Day/Year fields)
// ---------------------------------------------------------------------------

/** Extract month (MM) from a date value. */
export function formatMonth(value: unknown): string {
  const full = formatDate(value);
  if (!full) return '';
  const parts = full.split('/');
  return parts.length === 3 ? parts[0] : '';
}

/** Extract day (DD) from a date value. */
export function formatDay(value: unknown): string {
  const full = formatDate(value);
  if (!full) return '';
  const parts = full.split('/');
  return parts.length === 3 ? parts[1] : '';
}

/** Extract year (YYYY) from a date value. */
export function formatYear(value: unknown): string {
  const full = formatDate(value);
  if (!full) return '';
  const parts = full.split('/');
  return parts.length === 3 ? parts[2] : '';
}

// ---------------------------------------------------------------------------
// Additional USCIS-specific formatters
// ---------------------------------------------------------------------------

/** Format a yes/no value. Returns the matching string or empty. */
export function formatYesNo(
  value: unknown,
  yesText = 'Yes',
  noText = 'No'
): string {
  if (value === null || value === undefined) return '';
  const str = String(value).toLowerCase().trim();
  if (['yes', 'true', '1', 'y'].includes(str)) return yesText;
  if (['no', 'false', '0', 'n'].includes(str)) return noText;
  if (typeof value === 'boolean') return value ? yesText : noText;
  return '';
}

/** Format a currency value as $X,XXX.XX */
export function formatCurrency(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return String(value);
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Preserve leading zeros on zip codes (5 or 9 digits). */
export function formatZipCode(value: unknown): string {
  if (!value) return '';
  const str = String(value).replace(/[^0-9-]/g, '');
  const digits = str.replace(/-/g, '');
  if (digits.length === 5) return digits;
  if (digits.length === 9) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return str;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve a dot-notation path against a data object. */
export function getNestedValue(
  obj: Record<string, unknown>,
  path: string
): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Apply the appropriate formatter for a field type. */
export function formatFieldValue(value: unknown, type: AcroFieldType): string {
  switch (type) {
    case 'date':
      return formatDate(value);
    case 'ssn':
      return formatSSN(value);
    case 'phone':
      return formatPhone(value);
    case 'alien_number':
      return formatAlienNumber(value);
    case 'zip_code':
      return formatZipCode(value);
    case 'currency':
      return formatCurrency(value);
    case 'yes_no':
      return formatYesNo(value);
    case 'text':
      // USCIS convention: names are uppercase, but we apply it to all text
      // fields. Callers needing verbatim values (emails, etc.) should use a
      // custom `format` function on those specific field maps.
      return formatName(value);
    case 'dropdown':
    case 'radio':
    case 'checkbox':
      // Pass through raw value — must match PDF option values exactly
      return value == null ? '' : String(value);
    default:
      return value == null ? '' : String(value);
  }
}

// ---------------------------------------------------------------------------
// Core engine (AcroForm — kept for testing with synthetic PDFs)
// ---------------------------------------------------------------------------

/**
 * Load a USCIS PDF template from a file path or raw bytes, fill its
 * AcroForm fields according to the provided mappings, and return the
 * result.
 *
 * **Note:** Real USCIS PDFs use XFA, not AcroForm. For production use,
 * prefer `fillXFAPdf` from `./xfa-filler`. This function is retained
 * for unit testing against synthetic AcroForm PDFs built with pdf-lib.
 *
 * @param template  - Absolute file path to the template, or raw PDF bytes
 * @param fieldMaps - Per-form AcroForm field mapping configuration
 * @param formData  - The application data to fill into the PDF
 * @param options   - Optional flags (flatten, etc.)
 *
 * @deprecated Use `fillXFAPdf` from `./xfa-filler` for USCIS templates.
 */
export async function fillUSCISForm(
  template: string | Uint8Array,
  fieldMaps: AcroFormFieldMap[],
  formData: Record<string, unknown>,
  options: { flatten?: boolean } = {}
): Promise<FillResult> {
  const errors: string[] = [];
  const skippedFields: string[] = [];
  let filledFieldCount = 0;

  try {
    // 1. Load the template
    const pdfBytes =
      template instanceof Uint8Array
        ? template
        : await readFile(template);

    const pdfDoc = await PDFDocument.load(pdfBytes, {
      ignoreEncryption: true,
    });

    // 2. Get the AcroForm
    const form = pdfDoc.getForm();

    // 3. Fill each mapped field
    for (const mapping of fieldMaps) {
      try {
        const rawValue = getNestedValue(formData, mapping.dataPath);

        // Skip fields with no data
        if (rawValue === undefined || rawValue === null || rawValue === '') {
          skippedFields.push(mapping.formFieldName);
          continue;
        }

        // Use custom formatter if provided, otherwise use type-based
        const formatted = mapping.format
          ? mapping.format(rawValue)
          : formatFieldValue(rawValue, mapping.type);

        switch (mapping.type) {
          case 'checkbox': {
            const cb = form.getCheckBox(mapping.formFieldName);
            const shouldCheck = mapping.checkValue
              ? String(rawValue) === mapping.checkValue
              : Boolean(rawValue);
            if (shouldCheck) {
              cb.check();
            } else {
              cb.uncheck();
            }
            filledFieldCount++;
            break;
          }

          case 'radio': {
            const rg = form.getRadioGroup(mapping.formFieldName);
            rg.select(formatted);
            filledFieldCount++;
            break;
          }

          case 'dropdown': {
            const dd = form.getDropdown(mapping.formFieldName);
            dd.select(formatted);
            filledFieldCount++;
            break;
          }

          default: {
            // text, date, ssn, phone, alien_number — all end up as text
            const tf = form.getTextField(mapping.formFieldName);
            tf.setText(formatted);
            filledFieldCount++;
            break;
          }
        }
      } catch (fieldError) {
        const msg =
          fieldError instanceof Error ? fieldError.message : String(fieldError);
        errors.push(`Field "${mapping.formFieldName}": ${msg}`);
      }
    }

    // 4. Optionally flatten (makes fields non-editable)
    if (options.flatten) {
      form.flatten();
    }

    // 5. Save
    const resultBytes = await pdfDoc.save();

    return {
      success: true,
      pdfBytes: resultBytes,
      filledFieldCount,
      totalFieldCount: fieldMaps.length,
      skippedFields,
      errors,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.logError('Failed to fill USCIS form', error);
    return {
      success: false,
      filledFieldCount,
      totalFieldCount: fieldMaps.length,
      skippedFields,
      errors: [...errors, msg],
    };
  }
}

/**
 * Resolve the file system path for a USCIS template given a form type.
 * e.g. "I-130" -> "public/uscis-templates/i-130.pdf"
 */
export function getTemplatePath(formType: FormType): string {
  return `${USCIS_TEMPLATES_DIR}/${formType.toLowerCase()}.pdf`;
}
