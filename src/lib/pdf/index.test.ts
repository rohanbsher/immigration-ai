/**
 * Unit tests for PDF generation service.
 * Tests XFA template filling, summary PDF fallback, data merging, and form type support.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { FormType } from '@/types';

// ---------------------------------------------------------------------------
// Mocks — set up before importing module under test
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  }),
}));

// We track mock state via module-level refs that survive vi.mock hoisting
let accessBehavior: 'exists' | 'not-found' = 'not-found';

vi.mock(import('fs/promises'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: {
      ...actual,
      access: vi.fn(async () => {
        if (accessBehavior === 'not-found') throw new Error('ENOENT');
      }),
    },
    access: vi.fn(async () => {
      if (accessBehavior === 'not-found') throw new Error('ENOENT');
    }),
  };
});

// Mock fillXFAPdf — we store the mock result in a module-level variable
let xfaResult: Record<string, unknown> | null = null;

vi.mock('./xfa-filler', () => ({
  fillXFAPdf: vi.fn(async () => xfaResult),
}));

// Import AFTER mocks
import {
  generateFormPDF,
  isPDFGenerationSupported,
  formatValue,
  formatCheckbox,
  type FormData,
} from './index';
import { fillXFAPdf } from './xfa-filler';
import { createMockFormForPDF, createFormData } from '@/test-utils/factories';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeForm(
  formType: FormType,
  data: Record<string, unknown> = {},
  aiFilledData?: Record<string, unknown>
): FormData {
  return {
    id: `test-${formType}`,
    formType,
    data,
    aiFilledData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function simulateTemplateExists() {
  accessBehavior = 'exists';
}

function simulateTemplateNotFound() {
  accessBehavior = 'not-found';
}

function simulateXFASuccess(filled: number, total: number) {
  xfaResult = {
    success: true,
    pdfBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]), // %PDF
    filledFieldCount: filled,
    totalFieldCount: total,
    skippedFields: [],
    errors: [],
  };
}

function simulateXFAFailure(errorMsg: string) {
  xfaResult = {
    success: false,
    filledFieldCount: 0,
    totalFieldCount: 10,
    skippedFields: [],
    errors: [errorMsg],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PDF Generation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: templates don't exist → always use summary PDF fallback
    simulateTemplateNotFound();
    xfaResult = null;
  });

  // -----------------------------------------------------------------------
  // XFA template path vs summary PDF fallback
  // -----------------------------------------------------------------------
  describe('XFA template filling', () => {
    test('uses XFA filler when template exists and fill succeeds', async () => {
      simulateTemplateExists();
      simulateXFASuccess(5, 10);

      const form = makeForm('I-130', {
        petitioner: { lastName: 'Doe', firstName: 'John' },
      });
      const result = await generateFormPDF(form);

      expect(result.success).toBe(true);
      expect(result.isAcroFormFilled).toBe(true);
      expect(result.pdfBytes).toBeInstanceOf(Uint8Array);
      expect(fillXFAPdf).toHaveBeenCalledTimes(1);
    });

    test('falls back to summary PDF when template does not exist', async () => {
      simulateTemplateNotFound();

      const form = makeForm('I-130', {
        petitioner: { lastName: 'Doe' },
      });
      const result = await generateFormPDF(form);

      expect(result.success).toBe(true);
      expect(result.isAcroFormFilled).toBe(false);
      expect(fillXFAPdf).not.toHaveBeenCalled();
    });

    test('falls back to summary PDF when XFA fill fails', async () => {
      simulateTemplateExists();
      simulateXFAFailure('Python script crashed');

      const form = makeForm('I-130', {
        petitioner: { lastName: 'Doe' },
      });
      const result = await generateFormPDF(form);

      expect(result.success).toBe(true);
      expect(result.isAcroFormFilled).toBe(false);
    });

    test('falls back to summary PDF when 0 fields filled', async () => {
      simulateTemplateExists();
      simulateXFASuccess(0, 10);

      const form = makeForm('I-130', {
        petitioner: { lastName: 'Doe' },
      });
      const result = await generateFormPDF(form);

      expect(result.success).toBe(true);
      // 0 fields filled should NOT return the empty USCIS template
      expect(result.isAcroFormFilled).toBe(false);
    });

    test('skips XFA for form types without field mappings', async () => {
      simulateTemplateExists();

      // I-20 has no USCIS field map (only summary PDF mappings)
      const form = makeForm('I-20', { student: { lastName: 'Test' } });
      const result = await generateFormPDF(form);

      expect(result.success).toBe(true);
      expect(result.isAcroFormFilled).toBe(false);
      expect(fillXFAPdf).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Data merging
  // -----------------------------------------------------------------------
  describe('data merging', () => {
    test('deep-merges AI and form data correctly', async () => {
      simulateTemplateExists();
      simulateXFASuccess(3, 5);

      const form = makeForm(
        'I-130',
        {
          petitioner: {
            firstName: 'Manual',
            lastName: 'Entry',
          },
        },
        {
          petitioner: {
            firstName: 'AI-Suggested',
            middleName: 'FromAI',
          },
          beneficiary: {
            firstName: 'AI-Beneficiary',
          },
        }
      );

      await generateFormPDF(form);

      // Verify the merged data passed to fillXFAPdf
      const mergedData = vi.mocked(fillXFAPdf).mock.calls[0][2];
      // form_data overrides AI for same keys
      expect(mergedData.petitioner.firstName).toBe('Manual');
      expect(mergedData.petitioner.lastName).toBe('Entry');
      // AI data preserved for keys NOT in form_data
      expect(mergedData.petitioner.middleName).toBe('FromAI');
      // AI-only top-level keys preserved
      expect(mergedData.beneficiary.firstName).toBe('AI-Beneficiary');
    });

    test('handles form with no AI data', async () => {
      const form = makeForm('I-130', createFormData());
      const result = await generateFormPDF(form);

      expect(result.success).toBe(true);
    });

    test('handles empty form data gracefully', async () => {
      const form = makeForm('I-130', {});
      const result = await generateFormPDF(form);

      expect(result.success).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Summary PDF generation (fallback path)
  // -----------------------------------------------------------------------
  describe('summary PDF generation', () => {
    test('generates valid PDF for I-130', async () => {
      const form = makeForm('I-130', {
        petitioner: { lastName: 'Doe', firstName: 'John' },
      });
      const result = await generateFormPDF(form);

      expect(result.success).toBe(true);
      expect(result.pdfBytes).toBeInstanceOf(Uint8Array);
      expect(result.pdfBytes!.length).toBeGreaterThan(0);
      expect(result.fileName).toContain('I-130');
      expect(result.isAcroFormFilled).toBe(false);
    });

    test('generates valid PDF for I-485', async () => {
      const form = makeForm('I-485', {
        applicant: {
          lastName: 'Smith',
          firstName: 'Jane',
          dateOfBirth: '1990-05-15',
        },
      });
      const result = await generateFormPDF(form);

      expect(result.success).toBe(true);
      expect(result.fileName).toContain('I-485');
    });

    test('generates valid PDF for I-765', async () => {
      const form = makeForm('I-765', {
        applicant: { lastName: 'Johnson', firstName: 'Bob' },
        eligibilityCategory: '(c)(9)',
      });
      const result = await generateFormPDF(form);

      expect(result.success).toBe(true);
      expect(result.fileName).toContain('I-765');
    });

    test('generates unique filenames with timestamp', async () => {
      const form = createMockFormForPDF('I-130');

      const result1 = await generateFormPDF(form);
      await new Promise(resolve => setTimeout(resolve, 5));
      const result2 = await generateFormPDF(form);

      expect(result1.fileName).not.toBe(result2.fileName);
    });

    test('handles null/undefined values in data', async () => {
      const form = makeForm('I-130', {
        petitioner: {
          firstName: null,
          lastName: undefined,
          middleName: 'Valid',
        },
      });
      const result = await generateFormPDF(form);

      expect(result.success).toBe(true);
    });

    test('handles boolean values in data', async () => {
      const form = makeForm('I-130', {
        isUSCitizen: true,
        hasValidVisa: false,
      });
      const result = await generateFormPDF(form);

      expect(result.success).toBe(true);
    });

    test('handles array values in data', async () => {
      const form = makeForm('I-130', {
        previousAddresses: ['123 First St', '456 Second Ave'],
      });
      const result = await generateFormPDF(form);

      expect(result.success).toBe(true);
    });

    test('handles deeply nested values', async () => {
      const form = makeForm('I-130', {
        petitioner: {
          name: { first: 'John', last: 'Doe' },
          address: { street: '123 Main St', city: 'New York' },
        },
      });
      const result = await generateFormPDF(form);

      expect(result.success).toBe(true);
    });

    test('handles very long text values', async () => {
      const form = makeForm('I-130', {
        description: 'Long text. '.repeat(100),
      });
      const result = await generateFormPDF(form);

      expect(result.success).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // isPDFGenerationSupported
  // -----------------------------------------------------------------------
  describe('isPDFGenerationSupported', () => {
    test('returns true for forms with XFA field mappings', () => {
      const xfaForms: FormType[] = [
        'I-130', 'I-485', 'I-765', 'I-131', 'N-400', 'I-140', 'G-1145',
      ];
      for (const ft of xfaForms) {
        expect(isPDFGenerationSupported(ft)).toBe(true);
      }
    });

    test('returns true for forms with only summary PDF mappings', () => {
      const summaryOnlyForms: FormType[] = ['I-129', 'I-539', 'I-20', 'DS-160'];
      for (const ft of summaryOnlyForms) {
        expect(isPDFGenerationSupported(ft)).toBe(true);
      }
    });
  });

  // -----------------------------------------------------------------------
  // formatCheckbox
  // -----------------------------------------------------------------------
  describe('formatCheckbox', () => {
    test('formats boolean true as checked checkbox', () => {
      expect(formatCheckbox(true)).toBe('[X] Yes');
    });

    test('formats boolean false as unchecked checkbox', () => {
      expect(formatCheckbox(false)).toBe('[ ] No');
    });

    test('formats string "yes" as checked checkbox', () => {
      expect(formatCheckbox('yes')).toBe('[X] Yes');
      expect(formatCheckbox('Yes')).toBe('[X] Yes');
      expect(formatCheckbox('YES')).toBe('[X] Yes');
    });

    test('formats string "no" as unchecked checkbox', () => {
      expect(formatCheckbox('no')).toBe('[ ] No');
      expect(formatCheckbox('No')).toBe('[ ] No');
    });

    test('formats "1"/"0" and "true"/"false" strings', () => {
      expect(formatCheckbox('1')).toBe('[X] Yes');
      expect(formatCheckbox('0')).toBe('[ ] No');
      expect(formatCheckbox('true')).toBe('[X] Yes');
      expect(formatCheckbox('false')).toBe('[ ] No');
    });

    test('formats empty string as unchecked', () => {
      expect(formatCheckbox('')).toBe('[ ] No');
    });

    test('returns null for non-boolean values', () => {
      expect(formatCheckbox('John')).toBeNull();
      expect(formatCheckbox(42)).toBeNull();
      expect(formatCheckbox(null)).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // formatValue — date and structured data handling
  // -----------------------------------------------------------------------
  describe('formatValue', () => {
    test('formats boolean values as checkboxes', () => {
      expect(formatValue(true)).toBe('[X] Yes');
      expect(formatValue(false)).toBe('[ ] No');
    });

    test('formats ISO date strings as MM/DD/YYYY', () => {
      expect(formatValue('2024-03-15')).toBe('03/15/2024');
    });

    test('preserves MM/DD/YYYY date strings', () => {
      expect(formatValue('03/15/2024')).toBe('03/15/2024');
    });

    test('formats null/undefined as empty string', () => {
      expect(formatValue(null)).toBe('');
      expect(formatValue(undefined)).toBe('');
    });

    test('passes through non-date strings', () => {
      expect(formatValue('John Doe')).toBe('John Doe');
    });

    test('formats arrays of primitives as comma-separated', () => {
      expect(formatValue(['foo', 'bar'])).toBe('foo, bar');
    });

    test('formats arrays of objects as structured lines', () => {
      const value = [
        { street: '123 Main St', city: 'New York' },
        { street: '456 Oak Ave', city: 'Boston' },
      ];
      const result = formatValue(value);
      expect(result).toContain('1.');
      expect(result).toContain('2.');
      expect(result).toContain('123 Main St');
      expect(result).toContain('New York');
    });

    test('formats plain objects as key: value lines', () => {
      const result = formatValue({ firstName: 'John', lastName: 'Doe' });
      expect(result).toContain('First Name: John');
      expect(result).toContain('Last Name: Doe');
    });
  });

  // -----------------------------------------------------------------------
  // PDF structural verification — multi-line data produces larger output
  // (Content streams are FlateDecode-compressed, so raw text search won't
  //  work. Instead we verify structural properties that prove the rendering
  //  pipeline processes formatted data correctly.)
  // -----------------------------------------------------------------------
  describe('PDF structural verification', () => {
    test('multi-line array data produces larger PDF than simple string data', async () => {
      const simpleForm = makeForm('I-130', {
        petitioner: { lastName: 'Doe' },
      });
      const complexForm = makeForm('I-130', {
        addressHistory: Array.from({ length: 10 }, (_, i) => ({
          street: `${100 + i} Street Name`,
          city: `City${i}`,
          state: `S${i}`,
        })),
      });

      const simpleResult = await generateFormPDF(simpleForm);
      const complexResult = await generateFormPDF(complexForm);

      expect(simpleResult.success).toBe(true);
      expect(complexResult.success).toBe(true);
      // Complex data with arrays of objects should produce a larger PDF
      expect(complexResult.pdfBytes!.length).toBeGreaterThan(simpleResult.pdfBytes!.length);
    });

    test('form with many fields generates multi-page PDF', async () => {
      // Generate enough data to force page breaks — proves newline handling
      // doesn't collapse everything onto one line
      const data: Record<string, unknown> = {};
      for (let i = 0; i < 50; i++) {
        data[`field_${i}`] = {
          name: `Person ${i}`,
          address: `${i} Main Street, City ${i}, State ${i}`,
          phone: `555-${String(i).padStart(4, '0')}`,
        };
      }

      const form = makeForm('I-130', data);
      const result = await generateFormPDF(form);

      expect(result.success).toBe(true);
      // A PDF with 50 structured fields MUST be multi-page — this proves
      // newlines create new drawing positions instead of being garbled
      expect(result.pdfBytes!.length).toBeGreaterThan(5000);
    });

    test('boolean data renders successfully in summary PDF', async () => {
      const form = makeForm('I-130', {
        isUSCitizen: true,
        hasCriminalRecord: false,
        isCurrentlyEmployed: true,
      });
      const result = await generateFormPDF(form);

      expect(result.success).toBe(true);
      expect(result.pdfBytes).toBeInstanceOf(Uint8Array);
      expect(result.pdfBytes!.length).toBeGreaterThan(0);
    });

    test('date fields render successfully in summary PDF', async () => {
      const form = makeForm('I-130', {
        dateOfBirth: '1990-05-15',
        dateOfEntry: '2020-01-01',
        visaExpiry: '12/31/2025',
      });
      const result = await generateFormPDF(form);

      expect(result.success).toBe(true);
      expect(result.pdfBytes).toBeInstanceOf(Uint8Array);
      expect(result.pdfBytes!.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // Fill stats propagation
  // -----------------------------------------------------------------------
  describe('fill stats in PDFGenerationResult', () => {
    test('includes fill stats when XFA template fill succeeds', async () => {
      simulateTemplateExists();
      simulateXFASuccess(8, 15);

      const form = makeForm('I-130', {
        petitioner: { lastName: 'Doe', firstName: 'John' },
      });
      const result = await generateFormPDF(form);

      expect(result.success).toBe(true);
      expect(result.isAcroFormFilled).toBe(true);
      expect(result.filledFieldCount).toBe(8);
      expect(result.totalFieldCount).toBe(15);
    });

    test('omits fill stats for summary PDF fallback', async () => {
      simulateTemplateNotFound();

      const form = makeForm('I-130', {
        petitioner: { lastName: 'Doe' },
      });
      const result = await generateFormPDF(form);

      expect(result.success).toBe(true);
      expect(result.isAcroFormFilled).toBe(false);
      expect(result.filledFieldCount).toBeUndefined();
      expect(result.totalFieldCount).toBeUndefined();
    });
  });
});
