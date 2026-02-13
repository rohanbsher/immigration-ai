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

      // I-129 has no USCIS field map (only summary PDF mappings)
      const form = makeForm('I-129', { applicant: { lastName: 'Test' } });
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
});
