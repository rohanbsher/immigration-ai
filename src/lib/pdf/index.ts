/**
 * PDF generation service for USCIS immigration forms.
 *
 * Two modes of operation:
 * 1. XFA template filling — loads an official USCIS PDF template and fills
 *    its XFA form fields via Python/pikepdf. Produces filing-ready output.
 * 2. Summary PDF — generates a custom layout with all field data.
 *    Used as a fallback when no USCIS template is available on disk.
 */

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import { access } from 'fs/promises';
import type { FormType } from '@/types';
import { getFieldMappings, FormFieldMapping } from './templates';
import { getTemplatePath, getNestedValue, formatDate } from './acroform-filler';
import { fillXFAPdf } from './xfa-filler';
import { getUSCISFieldMap, hasUSCISFieldMap } from './uscis-fields';
import { createLogger } from '@/lib/logger';

const log = createLogger('pdf');

/**
 * Deep-merge two plain objects. `overrides` values take precedence.
 * Only recurses into plain objects — arrays, dates, etc. are replaced wholesale.
 */
function deepMerge(
  base: Record<string, unknown>,
  overrides: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(overrides)) {
    const baseVal = base[key];
    const overVal = overrides[key];
    if (
      baseVal && overVal &&
      typeof baseVal === 'object' && typeof overVal === 'object' &&
      !Array.isArray(baseVal) && !Array.isArray(overVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overVal as Record<string, unknown>
      );
    } else {
      result[key] = overVal;
    }
  }
  return result;
}

export interface PDFGenerationResult {
  success: boolean;
  pdfBytes?: Uint8Array;
  fileName?: string;
  error?: string;
  /** When true the output was produced from an official USCIS template */
  isAcroFormFilled?: boolean;
  /** Number of fields that were filled (XFA path only) */
  filledFieldCount?: number;
  /** Total number of fields in the mapping (XFA path only) */
  totalFieldCount?: number;
}

export interface FormData {
  id: string;
  formType: FormType;
  data: Record<string, unknown>;
  aiFilledData?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Generate a filled PDF form from form data.
 *
 * Attempts AcroForm filling first (if a template exists on disk and we
 * have a field map for the form type). Falls back to the summary PDF
 * generator otherwise.
 */
export async function generateFormPDF(form: FormData): Promise<PDFGenerationResult> {
  try {
    // Deep-merge form_data and ai_filled_data, with form_data taking precedence
    const mergedData = form.aiFilledData
      ? deepMerge(form.aiFilledData, form.data)
      : { ...form.data };

    // Attempt XFA template filling when we have both a field map AND a template
    if (hasUSCISFieldMap(form.formType)) {
      const templatePath = getTemplatePath(form.formType);
      const templateExists = await access(templatePath).then(() => true).catch(() => false);

      if (templateExists) {
        const fieldMap = getUSCISFieldMap(form.formType)!;
        const result = await fillXFAPdf(templatePath, fieldMap, mergedData);

        if (result.success && result.pdfBytes && result.filledFieldCount > 0) {
          log.info(
            `Template filled ${form.formType}: ` +
              `${result.filledFieldCount}/${result.totalFieldCount} fields, ` +
              `${result.skippedFields.length} skipped`
          );

          return {
            success: true,
            pdfBytes: result.pdfBytes,
            fileName: `${form.formType}_${form.id.slice(0, 8)}_${Date.now()}.pdf`,
            isAcroFormFilled: true,
            filledFieldCount: result.filledFieldCount,
            totalFieldCount: result.totalFieldCount,
          };
        }

        if (result.success && result.filledFieldCount === 0 && result.totalFieldCount > 0) {
          log.warn(
            `Template fill for ${form.formType} filled 0/${result.totalFieldCount} fields. ` +
              `Field names may not match the PDF. Falling back to summary PDF.`
          );
        } else if (!result.success) {
          log.warn(
            `Template fill failed for ${form.formType}, falling back to summary PDF. ` +
              `Errors: ${result.errors.join('; ')}`
          );
        }
      }
    }

    // Fallback: generate a summary PDF (DRAFT watermark)
    const fieldMappings = getFieldMappings(form.formType);
    const pdfBytes = await generateSummaryPDF(form.formType, mergedData, fieldMappings);

    return {
      success: true,
      pdfBytes,
      fileName: `${form.formType}_${form.id.slice(0, 8)}_${Date.now()}.pdf`,
      isAcroFormFilled: false,
    };
  } catch (error) {
    log.logError('PDF generation error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate PDF',
    };
  }
}

/**
 * Generate a summary PDF with form data.
 * Fallback when no official USCIS PDF template is available.
 */
async function generateSummaryPDF(
  formType: FormType,
  data: Record<string, unknown>,
  fieldMappings: FormFieldMapping[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  // Create first page
  let page = doc.addPage([612, 792]); // Letter size
  let yPosition = 750;
  const leftMargin = 50;
  const pageWidth = 612 - leftMargin * 2;

  // Draw header
  yPosition = drawHeader(page, boldFont, formType, yPosition, leftMargin);
  yPosition -= 20;

  // Draw form fields
  for (const mapping of fieldMappings) {
    // Check if we need a new page
    if (yPosition < 100) {
      page = doc.addPage([612, 792]);
      yPosition = 750;
    }

    const value = getNestedValue(data, mapping.dataPath);
    yPosition = drawField(
      page,
      font,
      boldFont,
      mapping.label,
      formatValue(value),
      yPosition,
      leftMargin,
      pageWidth
    );
  }

  // Add any additional data not in mappings
  const mappedPaths = new Set(fieldMappings.map((m) => m.dataPath));
  const additionalData = getUnmappedData(data, mappedPaths);

  if (Object.keys(additionalData).length > 0) {
    // Check if we need a new page
    if (yPosition < 150) {
      page = doc.addPage([612, 792]);
      yPosition = 750;
    }

    yPosition -= 20;
    page.drawText('Additional Information', {
      x: leftMargin,
      y: yPosition,
      size: 14,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2),
    });
    yPosition -= 25;

    for (const [key, value] of Object.entries(additionalData)) {
      if (yPosition < 100) {
        page = doc.addPage([612, 792]);
        yPosition = 750;
      }
      yPosition = drawField(
        page,
        font,
        boldFont,
        formatLabel(key),
        formatValue(value),
        yPosition,
        leftMargin,
        pageWidth
      );
    }
  }

  // Add footer with timestamp
  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const currentPage = pages[i];
    currentPage.drawText(
      `Generated: ${new Date().toISOString()} | Page ${i + 1} of ${pages.length}`,
      {
        x: leftMargin,
        y: 30,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5),
      }
    );
    currentPage.drawText(
      'DRAFT - For Review Only - Not for Filing',
      {
        x: 612 / 2 - 100,
        y: 15,
        size: 8,
        font: boldFont,
        color: rgb(0.8, 0.2, 0.2),
      }
    );
  }

  return doc.save();
}

/**
 * Draw the form header.
 */
function drawHeader(
  page: PDFPage,
  font: PDFFont,
  formType: FormType,
  y: number,
  x: number
): number {
  const formNames: Record<FormType, string> = {
    'I-130': 'Petition for Alien Relative',
    'I-485': 'Application to Register Permanent Residence',
    'I-765': 'Application for Employment Authorization',
    'I-131': 'Application for Travel Document',
    'I-140': 'Immigrant Petition for Alien Workers',
    'I-129': 'Petition for Nonimmigrant Worker',
    'I-539': 'Application to Extend/Change Nonimmigrant Status',
    'I-20': 'Certificate of Eligibility',
    'DS-160': 'Online Nonimmigrant Visa Application',
    'N-400': 'Application for Naturalization',
    'G-1145': 'E-Notification of Application/Petition Acceptance',
  };

  // Draw form type
  page.drawText(`Form ${formType}`, {
    x,
    y,
    size: 24,
    font,
    color: rgb(0.1, 0.1, 0.4),
  });

  y -= 25;

  // Draw form name
  page.drawText(formNames[formType] || 'Immigration Form', {
    x,
    y,
    size: 14,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  y -= 15;

  // Draw divider line
  page.drawLine({
    start: { x, y },
    end: { x: x + 512, y },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });

  return y;
}

/**
 * Draw a single field with label and value.
 */
function drawField(
  page: PDFPage,
  font: PDFFont,
  boldFont: PDFFont,
  label: string,
  value: string,
  y: number,
  x: number,
  maxWidth: number
): number {
  // Draw label
  page.drawText(label + ':', {
    x,
    y,
    size: 10,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.2),
  });

  y -= 14;

  // Split on explicit newlines first, then wrap each line to fit width
  const paragraphs = (value || 'N/A').split('\n');
  for (const paragraph of paragraphs) {
    const wrapped = wrapText(paragraph, font, 10, maxWidth);
    for (const line of wrapped) {
      page.drawText(line, {
        x: x + 10,
        y,
        size: 10,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
      y -= 14;
    }
  }

  y -= 8; // Extra spacing between fields

  return y;
}

/**
 * Wrap text to fit within a given width.
 */
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);

    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

// getNestedValue is imported from ./acroform-filler

/**
 * Format a boolean-like value as a visual checkbox.
 */
export function formatCheckbox(value: unknown): string | null {
  if (typeof value === 'boolean') {
    return value ? '[X] Yes' : '[ ] No';
  }
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    if (lower === 'yes' || lower === '1' || lower === 'true') return '[X] Yes';
    if (lower === 'no' || lower === '0' || lower === 'false' || lower === '') return '[ ] No';
  }
  return null;
}

/**
 * Format an array of objects as structured multi-line text.
 * e.g., address_history entries become "Street: 123 Main | City: NY | State: NY"
 */
function formatArrayOfObjects(arr: unknown[]): string {
  return arr.map((item, i) => {
    if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
      const entries = Object.entries(item as Record<string, unknown>)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `${formatLabel(k)}: ${formatValue(v)}`)
        .join(' | ');
      return `${i + 1}. ${entries}`;
    }
    return `${i + 1}. ${formatValue(item)}`;
  }).join('\n');
}

/**
 * Detect if a string looks like a date value.
 */
function looksLikeDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{2}\/\d{2}\/\d{4}$/.test(value);
}

/**
 * Format a value for display.
 */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  // Render actual booleans as checkbox indicators
  if (typeof value === 'boolean') {
    return value ? '[X] Yes' : '[ ] No';
  }

  if (value instanceof Date) {
    return formatDate(value);
  }

  // String values — check for dates
  if (typeof value === 'string') {
    if (looksLikeDate(value)) {
      return formatDate(value);
    }
    return value;
  }

  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      // Check if array contains objects (structured data)
      if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
        return formatArrayOfObjects(value);
      }
      return value.map(formatValue).join(', ');
    }
    // Render plain objects as structured key: value lines
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `${formatLabel(k)}: ${formatValue(v)}`);
    return entries.join('\n');
  }

  return String(value);
}

/**
 * Format a camelCase or snake_case key as a label.
 */
function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Get data that isn't covered by field mappings.
 */
function getUnmappedData(
  data: Record<string, unknown>,
  mappedPaths: Set<string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  function traverse(obj: Record<string, unknown>, prefix: string = ''): void {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        traverse(value as Record<string, unknown>, path);
      } else if (!mappedPaths.has(path)) {
        result[path] = value;
      }
    }
  }

  traverse(data);
  return result;
}

/**
 * Check if PDF generation is available for a form type.
 * Returns true when we have either XFA field maps (for template filling)
 * or summary-PDF field mappings. Both produce usable output.
 */
export function isPDFGenerationSupported(formType: FormType): boolean {
  return hasUSCISFieldMap(formType) || getFieldMappings(formType).length > 0;
}
