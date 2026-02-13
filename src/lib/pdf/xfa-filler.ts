/**
 * XFA PDF filler engine for USCIS immigration forms.
 *
 * Wraps the Python-based XFA fill script (`scripts/fill-xfa-pdf.py`)
 * which uses pikepdf to inject field values into the XFA datasets XML.
 * This is required because pdf-lib cannot manipulate XFA streams —
 * the actual format used by official USCIS fillable PDFs.
 *
 * Reuses the same field-mapping types and formatter functions from
 * the AcroForm filler to keep the interface consistent.
 */

import { execFile } from 'child_process';
import { access, readFile, writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { createLogger } from '@/lib/logger';
import type { AcroFormFieldMap, FillResult } from './acroform-filler';
import { getNestedValue, formatFieldValue } from './acroform-filler';

const log = createLogger('xfa-filler');

const FILL_SCRIPT = process.env.XFA_FILL_SCRIPT ||
  path.resolve(process.cwd(), 'scripts/fill-xfa-pdf.py');

/** Timeout for the Python fill process (30 seconds). */
const PYTHON_TIMEOUT_MS = 30_000;

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

/** Promisified wrapper around child_process.execFile. */
function execPython(
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      'python3',
      [FILL_SCRIPT, ...args],
      { timeout: PYTHON_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      }
    );
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fill a USCIS PDF template using the XFA fill engine (Python + pikepdf).
 *
 * @param templatePath - Absolute path to the USCIS PDF template
 * @param fieldMaps    - Field mapping configuration (same interface as AcroForm)
 * @param formData     - Application data to fill into the PDF
 * @returns FillResult with the filled PDF bytes and fill statistics
 */
export async function fillXFAPdf(
  templatePath: string,
  fieldMaps: AcroFormFieldMap[],
  formData: Record<string, unknown>
): Promise<FillResult> {
  const errors: string[] = [];
  const sessionId = randomUUID();
  const dataJsonPath = path.join(tmpdir(), `xfa-data-${sessionId}.json`);
  const outputPdfPath = path.join(tmpdir(), `xfa-output-${sessionId}.pdf`);

  try {
    // 1. Build the flat field-name-to-value map
    const { fieldData, skippedFields } = buildFieldData(fieldMaps, formData);
    const totalFieldCount = fieldMaps.length;

    // 2. Write the field data to a temp JSON file
    await writeFile(dataJsonPath, JSON.stringify(fieldData), { encoding: 'utf-8', mode: 0o600 });

    // 3. Call the Python fill script
    let stdout: string;
    try {
      const result = await execPython([templatePath, dataJsonPath, outputPdfPath]);
      stdout = result.stdout;
    } catch (pythonError) {
      const msg =
        pythonError instanceof Error ? pythonError.message : String(pythonError);
      log.logError('Python XFA fill script failed', pythonError);
      return {
        success: false,
        filledFieldCount: 0,
        totalFieldCount,
        skippedFields,
        errors: [`Python fill failed: ${msg}`],
      };
    }

    // 4. Parse the fill stats from Python's JSON stdout
    let pythonResult: { filled: number; total: number; errors: string[] };
    try {
      pythonResult = JSON.parse(stdout.trim());
    } catch {
      log.warn('Could not parse Python fill output, using fallback stats');
      pythonResult = {
        filled: Object.keys(fieldData).length,
        total: Object.keys(fieldData).length,
        errors: [],
      };
    }

    if (pythonResult.errors.length > 0) {
      errors.push(...pythonResult.errors);
    }

    // 5. Verify and read the output PDF bytes
    try {
      await access(outputPdfPath);
    } catch {
      return {
        success: false,
        filledFieldCount: 0,
        totalFieldCount,
        skippedFields,
        errors: ['Python script succeeded but output PDF was not written'],
      };
    }
    const pdfBytes = await readFile(outputPdfPath);

    return {
      success: true,
      pdfBytes: new Uint8Array(pdfBytes),
      filledFieldCount: pythonResult.filled,
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
  } finally {
    // 6. Clean up temp files
    await Promise.allSettled([
      unlink(dataJsonPath),
      unlink(outputPdfPath),
    ]);
  }
}
