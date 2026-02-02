/**
 * PDF generation service for USCIS immigration forms.
 * Generates filled PDF forms from form data.
 */

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import type { FormType } from '@/types';
import { getFieldMappings, FormFieldMapping } from './templates';
import { createLogger } from '@/lib/logger';

const log = createLogger('pdf');

export interface PDFGenerationResult {
  success: boolean;
  pdfBytes?: Uint8Array;
  fileName?: string;
  error?: string;
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
 */
export async function generateFormPDF(form: FormData): Promise<PDFGenerationResult> {
  try {
    const fieldMappings = getFieldMappings(form.formType);

    // Merge form_data and ai_filled_data, with form_data taking precedence
    const mergedData = {
      ...(form.aiFilledData || {}),
      ...form.data,
    };

    // For now, generate a summary PDF since we don't have actual USCIS templates
    // In production, you would load the official USCIS PDF template and fill it
    const pdfBytes = await generateSummaryPDF(form.formType, mergedData, fieldMappings);

    return {
      success: true,
      pdfBytes,
      fileName: `${form.formType}_${form.id.slice(0, 8)}_${Date.now()}.pdf`,
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
 * This is a placeholder until official USCIS PDF templates are integrated.
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

  // Handle multi-line values
  const lines = wrapText(value || 'N/A', font, 10, maxWidth);
  for (const line of lines) {
    page.drawText(line, {
      x: x + 10,
      y,
      size: 10,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    y -= 14;
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

/**
 * Get a nested value from an object using a dot-separated path.
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Format a value for display.
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (value instanceof Date) {
    return value.toLocaleDateString('en-US');
  }

  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map(formatValue).join(', ');
    }
    return JSON.stringify(value, null, 2);
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
 */
export function isPDFGenerationSupported(formType: FormType): boolean {
  const supportedForms: FormType[] = ['I-130', 'I-485', 'I-765', 'I-131', 'N-400'];
  return supportedForms.includes(formType);
}
