/**
 * Unit tests for the AcroForm PDF filler engine.
 *
 * Uses pdf-lib to create synthetic AcroForm PDFs with known fields,
 * then verifies that fillUSCISForm fills them correctly.
 */

import { describe, test, expect, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  fillUSCISForm,
  getTemplatePath,
  getNestedValue,
  formatDate,
  formatName,
  formatPhone,
  formatSSN,
  formatAlienNumber,
  USCIS_TEMPLATES_DIR,
  type AcroFormFieldMap,
} from './acroform-filler';
import { hasUSCISFieldMap, getUSCISFieldMap } from './uscis-fields';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers — build synthetic AcroForm PDFs for testing
// ---------------------------------------------------------------------------

async function createTestPdfWithTextFields(
  fieldNames: string[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  const form = doc.getForm();
  for (const name of fieldNames) {
    form.createTextField(name);
  }
  return doc.save();
}

async function createTestPdfWithCheckbox(
  fieldName: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const form = doc.getForm();
  const cb = form.createCheckBox(fieldName);
  cb.addToPage(page, { x: 50, y: 700, width: 15, height: 15 });
  return doc.save();
}

async function createTestPdfWithDropdown(
  fieldName: string,
  options: string[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  const form = doc.getForm();
  const dd = form.createDropdown(fieldName);
  dd.addOptions(options);
  return doc.save();
}

async function createTestPdfWithRadioGroup(
  groupName: string,
  options: string[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const form = doc.getForm();
  const rg = form.createRadioGroup(groupName);
  for (const opt of options) {
    rg.addOptionToPage(opt, page);
  }
  return doc.save();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AcroForm Filler Engine', () => {
  // -----------------------------------------------------------------------
  // Formatters
  // -----------------------------------------------------------------------
  describe('formatDate', () => {
    test('converts ISO date to MM/DD/YYYY', () => {
      expect(formatDate('2024-03-15')).toBe('03/15/2024');
    });

    test('passes through already formatted dates', () => {
      expect(formatDate('03/15/2024')).toBe('03/15/2024');
    });

    test('returns empty string for falsy values', () => {
      expect(formatDate(null)).toBe('');
      expect(formatDate(undefined)).toBe('');
      expect(formatDate('')).toBe('');
    });

    test('handles ISO datetime strings', () => {
      expect(formatDate('2024-03-15T10:30:00Z')).toBe('03/15/2024');
    });
  });

  describe('formatName', () => {
    test('converts to uppercase', () => {
      expect(formatName('John Doe')).toBe('JOHN DOE');
    });

    test('returns empty for falsy', () => {
      expect(formatName(null)).toBe('');
    });
  });

  describe('formatPhone', () => {
    test('formats 10-digit number', () => {
      expect(formatPhone('5551234567')).toBe('(555) 123-4567');
    });

    test('formats 11-digit with leading 1', () => {
      expect(formatPhone('15551234567')).toBe('(555) 123-4567');
    });

    test('strips non-digit characters before formatting', () => {
      expect(formatPhone('555-123-4567')).toBe('(555) 123-4567');
    });

    test('returns original for non-standard lengths', () => {
      expect(formatPhone('12345')).toBe('12345');
    });
  });

  describe('formatSSN', () => {
    test('formats 9-digit string', () => {
      expect(formatSSN('123456789')).toBe('123-45-6789');
    });

    test('strips non-digits first', () => {
      expect(formatSSN('123-45-6789')).toBe('123-45-6789');
    });

    test('returns original for non-standard lengths', () => {
      expect(formatSSN('1234')).toBe('1234');
    });
  });

  describe('formatAlienNumber', () => {
    test('formats with A- prefix and zero padding', () => {
      expect(formatAlienNumber('123456789')).toBe('A-123456789');
    });

    test('pads short numbers', () => {
      expect(formatAlienNumber('12345')).toBe('A-000012345');
    });

    test('strips leading A- before formatting', () => {
      expect(formatAlienNumber('A123456789')).toBe('A-123456789');
    });
  });

  // -----------------------------------------------------------------------
  // getNestedValue
  // -----------------------------------------------------------------------
  describe('getNestedValue', () => {
    test('resolves shallow path', () => {
      expect(getNestedValue({ name: 'Alice' }, 'name')).toBe('Alice');
    });

    test('resolves deep path', () => {
      const data = { a: { b: { c: 42 } } };
      expect(getNestedValue(data, 'a.b.c')).toBe(42);
    });

    test('returns undefined for missing path', () => {
      expect(getNestedValue({}, 'a.b.c')).toBeUndefined();
    });

    test('returns undefined when intermediate is null', () => {
      expect(getNestedValue({ a: null } as Record<string, unknown>, 'a.b')).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // fillUSCISForm — text fields
  // -----------------------------------------------------------------------
  describe('fillUSCISForm — text fields', () => {
    test('fills text fields and returns correct statistics', async () => {
      const pdfBytes = await createTestPdfWithTextFields([
        'LastName',
        'FirstName',
        'MiddleName',
      ]);

      const fieldMaps: AcroFormFieldMap[] = [
        { formFieldName: 'LastName', dataPath: 'lastName', type: 'text' },
        { formFieldName: 'FirstName', dataPath: 'firstName', type: 'text' },
        { formFieldName: 'MiddleName', dataPath: 'middleName', type: 'text' },
      ];

      const data = {
        lastName: 'Doe',
        firstName: 'John',
        middleName: 'Michael',
      };

      const result = await fillUSCISForm(pdfBytes, fieldMaps, data);

      expect(result.success).toBe(true);
      expect(result.filledFieldCount).toBe(3);
      expect(result.totalFieldCount).toBe(3);
      expect(result.skippedFields).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.pdfBytes).toBeInstanceOf(Uint8Array);

      // Verify values were actually set
      const filled = await PDFDocument.load(result.pdfBytes!);
      const form = filled.getForm();
      expect(form.getTextField('LastName').getText()).toBe('DOE');
      expect(form.getTextField('FirstName').getText()).toBe('JOHN');
    });

    test('skips fields with missing data', async () => {
      const pdfBytes = await createTestPdfWithTextFields([
        'LastName',
        'FirstName',
      ]);

      const fieldMaps: AcroFormFieldMap[] = [
        { formFieldName: 'LastName', dataPath: 'lastName', type: 'text' },
        { formFieldName: 'FirstName', dataPath: 'firstName', type: 'text' },
      ];

      const result = await fillUSCISForm(pdfBytes, fieldMaps, {
        lastName: 'Doe',
        // firstName intentionally missing
      });

      expect(result.success).toBe(true);
      expect(result.filledFieldCount).toBe(1);
      expect(result.skippedFields).toContain('FirstName');
    });

    test('records error for non-existent PDF field', async () => {
      const pdfBytes = await createTestPdfWithTextFields(['LastName']);

      const fieldMaps: AcroFormFieldMap[] = [
        { formFieldName: 'LastName', dataPath: 'lastName', type: 'text' },
        {
          formFieldName: 'NonExistentField',
          dataPath: 'firstName',
          type: 'text',
        },
      ];

      const result = await fillUSCISForm(pdfBytes, fieldMaps, {
        lastName: 'Doe',
        firstName: 'John',
      });

      expect(result.success).toBe(true);
      expect(result.filledFieldCount).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('NonExistentField');
    });
  });

  // -----------------------------------------------------------------------
  // fillUSCISForm — date formatting
  // -----------------------------------------------------------------------
  describe('fillUSCISForm — date fields', () => {
    test('formats ISO dates to MM/DD/YYYY', async () => {
      const pdfBytes = await createTestPdfWithTextFields(['DOB']);

      const fieldMaps: AcroFormFieldMap[] = [
        { formFieldName: 'DOB', dataPath: 'dateOfBirth', type: 'date' },
      ];

      const result = await fillUSCISForm(pdfBytes, fieldMaps, {
        dateOfBirth: '1990-06-15',
      });

      expect(result.success).toBe(true);
      const filled = await PDFDocument.load(result.pdfBytes!);
      expect(filled.getForm().getTextField('DOB').getText()).toBe('06/15/1990');
    });
  });

  // -----------------------------------------------------------------------
  // fillUSCISForm — SSN and phone
  // -----------------------------------------------------------------------
  describe('fillUSCISForm — SSN and phone fields', () => {
    test('formats SSN correctly', async () => {
      const pdfBytes = await createTestPdfWithTextFields(['SSN']);

      const fieldMaps: AcroFormFieldMap[] = [
        { formFieldName: 'SSN', dataPath: 'ssn', type: 'ssn' },
      ];

      const result = await fillUSCISForm(pdfBytes, fieldMaps, {
        ssn: '123456789',
      });

      expect(result.success).toBe(true);
      const filled = await PDFDocument.load(result.pdfBytes!);
      expect(filled.getForm().getTextField('SSN').getText()).toBe(
        '123-45-6789'
      );
    });

    test('formats phone correctly', async () => {
      const pdfBytes = await createTestPdfWithTextFields(['Phone']);

      const fieldMaps: AcroFormFieldMap[] = [
        { formFieldName: 'Phone', dataPath: 'phone', type: 'phone' },
      ];

      const result = await fillUSCISForm(pdfBytes, fieldMaps, {
        phone: '5551234567',
      });

      expect(result.success).toBe(true);
      const filled = await PDFDocument.load(result.pdfBytes!);
      expect(filled.getForm().getTextField('Phone').getText()).toBe(
        '(555) 123-4567'
      );
    });
  });

  // -----------------------------------------------------------------------
  // fillUSCISForm — checkboxes
  // -----------------------------------------------------------------------
  describe('fillUSCISForm — checkboxes', () => {
    test('checks a checkbox when value is true', async () => {
      const pdfBytes = await createTestPdfWithCheckbox('USCitizen');

      const fieldMaps: AcroFormFieldMap[] = [
        {
          formFieldName: 'USCitizen',
          dataPath: 'isUSCitizen',
          type: 'checkbox',
        },
      ];

      const result = await fillUSCISForm(pdfBytes, fieldMaps, {
        isUSCitizen: true,
      });

      expect(result.success).toBe(true);
      expect(result.filledFieldCount).toBe(1);

      const filled = await PDFDocument.load(result.pdfBytes!);
      expect(filled.getForm().getCheckBox('USCitizen').isChecked()).toBe(true);
    });

    test('unchecks a checkbox when value is false', async () => {
      const pdfBytes = await createTestPdfWithCheckbox('USCitizen');

      const fieldMaps: AcroFormFieldMap[] = [
        {
          formFieldName: 'USCitizen',
          dataPath: 'isUSCitizen',
          type: 'checkbox',
        },
      ];

      const result = await fillUSCISForm(pdfBytes, fieldMaps, {
        isUSCitizen: false,
      });

      expect(result.success).toBe(true);
      const filled = await PDFDocument.load(result.pdfBytes!);
      expect(filled.getForm().getCheckBox('USCitizen').isChecked()).toBe(false);
    });

    test('supports checkValue matching', async () => {
      const pdfBytes = await createTestPdfWithCheckbox('GenderMale');

      const fieldMaps: AcroFormFieldMap[] = [
        {
          formFieldName: 'GenderMale',
          dataPath: 'gender',
          type: 'checkbox',
          checkValue: 'male',
        },
      ];

      const resultChecked = await fillUSCISForm(pdfBytes, fieldMaps, {
        gender: 'male',
      });
      const filledChecked = await PDFDocument.load(resultChecked.pdfBytes!);
      expect(
        filledChecked.getForm().getCheckBox('GenderMale').isChecked()
      ).toBe(true);

      const resultUnchecked = await fillUSCISForm(pdfBytes, fieldMaps, {
        gender: 'female',
      });
      const filledUnchecked = await PDFDocument.load(
        resultUnchecked.pdfBytes!
      );
      expect(
        filledUnchecked.getForm().getCheckBox('GenderMale').isChecked()
      ).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // fillUSCISForm — dropdowns
  // -----------------------------------------------------------------------
  describe('fillUSCISForm — dropdowns', () => {
    test('selects a dropdown value', async () => {
      const pdfBytes = await createTestPdfWithDropdown('Country', [
        'USA',
        'CANADA',
        'MEXICO',
      ]);

      const fieldMaps: AcroFormFieldMap[] = [
        {
          formFieldName: 'Country',
          dataPath: 'country',
          type: 'dropdown',
        },
      ];

      const result = await fillUSCISForm(pdfBytes, fieldMaps, {
        country: 'CANADA',
      });

      expect(result.success).toBe(true);
      expect(result.filledFieldCount).toBe(1);
      const filled = await PDFDocument.load(result.pdfBytes!);
      const selected = filled.getForm().getDropdown('Country').getSelected();
      expect(selected).toContain('CANADA');
    });
  });

  // -----------------------------------------------------------------------
  // fillUSCISForm — radio groups
  // -----------------------------------------------------------------------
  describe('fillUSCISForm — radio groups', () => {
    test('selects a radio option', async () => {
      const pdfBytes = await createTestPdfWithRadioGroup('MaritalStatus', [
        'SINGLE',
        'MARRIED',
        'DIVORCED',
      ]);

      const fieldMaps: AcroFormFieldMap[] = [
        {
          formFieldName: 'MaritalStatus',
          dataPath: 'maritalStatus',
          type: 'radio',
        },
      ];

      const result = await fillUSCISForm(pdfBytes, fieldMaps, {
        maritalStatus: 'MARRIED',
      });

      expect(result.success).toBe(true);
      expect(result.filledFieldCount).toBe(1);
      const filled = await PDFDocument.load(result.pdfBytes!);
      const selected = filled
        .getForm()
        .getRadioGroup('MaritalStatus')
        .getSelected();
      expect(selected).toBe('MARRIED');
    });
  });

  // -----------------------------------------------------------------------
  // fillUSCISForm — custom formatter
  // -----------------------------------------------------------------------
  describe('fillUSCISForm — custom formatter', () => {
    test('uses custom format function when provided', async () => {
      const pdfBytes = await createTestPdfWithTextFields(['Amount']);

      const fieldMaps: AcroFormFieldMap[] = [
        {
          formFieldName: 'Amount',
          dataPath: 'salary',
          type: 'text',
          format: (v) => `$${Number(v).toLocaleString()}`,
        },
      ];

      const result = await fillUSCISForm(pdfBytes, fieldMaps, {
        salary: 85000,
      });

      expect(result.success).toBe(true);
      const filled = await PDFDocument.load(result.pdfBytes!);
      expect(filled.getForm().getTextField('Amount').getText()).toBe('$85,000');
    });
  });

  // -----------------------------------------------------------------------
  // fillUSCISForm — empty / edge-case data
  // -----------------------------------------------------------------------
  describe('fillUSCISForm — edge cases', () => {
    test('handles completely empty data gracefully', async () => {
      const pdfBytes = await createTestPdfWithTextFields([
        'LastName',
        'FirstName',
      ]);

      const fieldMaps: AcroFormFieldMap[] = [
        { formFieldName: 'LastName', dataPath: 'lastName', type: 'text' },
        { formFieldName: 'FirstName', dataPath: 'firstName', type: 'text' },
      ];

      const result = await fillUSCISForm(pdfBytes, fieldMaps, {});

      expect(result.success).toBe(true);
      expect(result.filledFieldCount).toBe(0);
      expect(result.skippedFields).toHaveLength(2);
    });

    test('handles deeply nested data paths', async () => {
      const pdfBytes = await createTestPdfWithTextFields(['Street']);

      const fieldMaps: AcroFormFieldMap[] = [
        {
          formFieldName: 'Street',
          dataPath: 'applicant.address.street',
          type: 'text',
        },
      ];

      const result = await fillUSCISForm(pdfBytes, fieldMaps, {
        applicant: { address: { street: '123 Main St' } },
      });

      expect(result.success).toBe(true);
      expect(result.filledFieldCount).toBe(1);
      const filled = await PDFDocument.load(result.pdfBytes!);
      expect(filled.getForm().getTextField('Street').getText()).toBe(
        '123 MAIN ST'
      );
    });

    test('returns failure on invalid PDF bytes', async () => {
      const result = await fillUSCISForm(
        new Uint8Array([0, 1, 2, 3]),
        [],
        {}
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // fillUSCISForm — flatten option
  // -----------------------------------------------------------------------
  describe('fillUSCISForm — flatten', () => {
    test('flattens form when option is set', async () => {
      const pdfBytes = await createTestPdfWithTextFields(['Name']);

      const fieldMaps: AcroFormFieldMap[] = [
        { formFieldName: 'Name', dataPath: 'name', type: 'text' },
      ];

      const result = await fillUSCISForm(
        pdfBytes,
        fieldMaps,
        { name: 'Test' },
        { flatten: true }
      );

      expect(result.success).toBe(true);
      // After flatten, attempting to access form fields will throw
      const filled = await PDFDocument.load(result.pdfBytes!);
      const form = filled.getForm();
      expect(form.getFields()).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // getTemplatePath
  // -----------------------------------------------------------------------
  describe('getTemplatePath', () => {
    test('returns expected path for form type', () => {
      expect(getTemplatePath('I-130')).toBe(
        `${USCIS_TEMPLATES_DIR}/i-130.pdf`
      );
    });
  });

  // -----------------------------------------------------------------------
  // USCIS field maps registry
  // -----------------------------------------------------------------------
  describe('USCIS field map registry', () => {
    test('has field maps for all primary forms', () => {
      expect(hasUSCISFieldMap('I-130')).toBe(true);
      expect(hasUSCISFieldMap('I-485')).toBe(true);
      expect(hasUSCISFieldMap('I-765')).toBe(true);
      expect(hasUSCISFieldMap('I-131')).toBe(true);
      expect(hasUSCISFieldMap('N-400')).toBe(true);
      expect(hasUSCISFieldMap('I-140')).toBe(true);
      expect(hasUSCISFieldMap('G-1145')).toBe(true);
    });

    test('each field map has valid structure', () => {
      const formTypes = [
        'I-130',
        'I-485',
        'I-765',
        'I-131',
        'N-400',
        'I-140',
        'G-1145',
      ] as const;

      for (const ft of formTypes) {
        const fields = getUSCISFieldMap(ft);
        expect(fields).toBeDefined();
        expect(fields!.length).toBeGreaterThan(0);

        for (const field of fields!) {
          expect(field.formFieldName).toBeTruthy();
          expect(field.dataPath).toBeTruthy();
          expect(field.type).toBeTruthy();
        }
      }
    });
  });

  // -----------------------------------------------------------------------
  // FillResult statistics
  // -----------------------------------------------------------------------
  describe('FillResult statistics', () => {
    test('accurately counts filled, skipped, and total fields', async () => {
      const pdfBytes = await createTestPdfWithTextFields([
        'Field1',
        'Field2',
        'Field3',
      ]);

      const fieldMaps: AcroFormFieldMap[] = [
        { formFieldName: 'Field1', dataPath: 'f1', type: 'text' },
        { formFieldName: 'Field2', dataPath: 'f2', type: 'text' },
        { formFieldName: 'Field3', dataPath: 'f3', type: 'text' },
      ];

      const result = await fillUSCISForm(pdfBytes, fieldMaps, {
        f1: 'val1',
        // f2 missing
        f3: 'val3',
      });

      expect(result.filledFieldCount).toBe(2);
      expect(result.totalFieldCount).toBe(3);
      expect(result.skippedFields).toEqual(['Field2']);
      expect(result.errors).toHaveLength(0);
    });
  });
});
