/**
 * Unit tests for the USCIS field map registry and all 9 field maps.
 *
 * Validates structural correctness, field counts, naming conventions,
 * and critical field presence for each USCIS form type.
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { getUSCISFieldMap, hasUSCISFieldMap } from './index';
import type { FormType } from '@/types';
import type { AcroFormFieldMap } from '../acroform-filler';

// =========================================================================
// Registry Tests
// =========================================================================

describe('USCIS Field Map Registry', () => {
  const FORMS_WITH_MAPS: FormType[] = [
    'I-130', 'I-485', 'I-765', 'I-131', 'N-400', 'I-140', 'G-1145', 'I-129', 'I-539',
  ];

  const FORMS_WITHOUT_MAPS: FormType[] = ['I-20', 'DS-160'];

  test('hasUSCISFieldMap returns true for all mapped forms', () => {
    for (const ft of FORMS_WITH_MAPS) {
      expect(hasUSCISFieldMap(ft), `expected ${ft} to have a field map`).toBe(true);
    }
  });

  test('hasUSCISFieldMap returns false for unmapped forms', () => {
    for (const ft of FORMS_WITHOUT_MAPS) {
      expect(hasUSCISFieldMap(ft), `expected ${ft} to NOT have a field map`).toBe(false);
    }
  });

  test('getUSCISFieldMap returns arrays for mapped forms', () => {
    for (const ft of FORMS_WITH_MAPS) {
      const map = getUSCISFieldMap(ft);
      expect(map, `expected ${ft} map to be defined`).toBeDefined();
      expect(Array.isArray(map), `expected ${ft} map to be an array`).toBe(true);
      expect(map!.length, `expected ${ft} map to be non-empty`).toBeGreaterThan(0);
    }
  });

  test('getUSCISFieldMap returns undefined for unmapped forms', () => {
    for (const ft of FORMS_WITHOUT_MAPS) {
      expect(getUSCISFieldMap(ft), `expected ${ft} to return undefined`).toBeUndefined();
    }
  });

  test('registry covers all 9 supported forms', () => {
    expect(FORMS_WITH_MAPS).toHaveLength(9);
    for (const ft of FORMS_WITH_MAPS) {
      expect(getUSCISFieldMap(ft)).toBeDefined();
    }
  });
});

// =========================================================================
// Structural Validation for All Field Maps
// =========================================================================

describe('Field Map Structural Validation', () => {
  const ALL_MAPS: FormType[] = [
    'I-130', 'I-485', 'I-765', 'I-131', 'N-400', 'I-140', 'G-1145', 'I-129', 'I-539',
  ];

  const VALID_TYPES = ['text', 'checkbox', 'radio', 'dropdown', 'date', 'ssn', 'phone', 'alien_number'];

  for (const formType of ALL_MAPS) {
    describe(`${formType} field map`, () => {
      let fields: AcroFormFieldMap[];

      beforeAll(() => {
        fields = getUSCISFieldMap(formType)!;
      });

      test('has no duplicate formFieldName entries', () => {
        const names = fields.map(f => f.formFieldName);
        const uniqueNames = new Set(names);
        const duplicates = names.filter((name, i) => names.indexOf(name) !== i);
        expect(
          uniqueNames.size,
          `Found duplicate formFieldName entries: ${duplicates.join(', ')}`
        ).toBe(names.length);
      });

      test('all fields have required properties', () => {
        for (const field of fields) {
          expect(field.formFieldName, 'formFieldName must be truthy').toBeTruthy();
          expect(field.dataPath, `dataPath must be truthy for ${field.formFieldName}`).toBeTruthy();
          expect(field.type, `type must be truthy for ${field.formFieldName}`).toBeTruthy();
          expect(
            VALID_TYPES,
            `invalid type "${field.type}" for ${field.formFieldName}`
          ).toContain(field.type);
        }
      });

      test('formFieldName starts with form1', () => {
        for (const field of fields) {
          expect(
            field.formFieldName.startsWith('form1'),
            `Expected "${field.formFieldName}" to start with "form1"`
          ).toBe(true);
        }
      });

      test('dataPath contains no leading or trailing dots', () => {
        for (const field of fields) {
          expect(field.dataPath.startsWith('.'), `dataPath "${field.dataPath}" starts with dot`).toBe(false);
          expect(field.dataPath.endsWith('.'), `dataPath "${field.dataPath}" ends with dot`).toBe(false);
        }
      });

      test('checkbox fields that use checkWhen pattern have format function', () => {
        // Some checkbox fields use a `format` function (checkWhen helper),
        // while others rely on the fillUSCISForm engine's checkValue matching.
        // This test validates that fields with both checkValue AND format are consistent.
        const checkboxFieldsWithFormat = fields.filter(
          f => f.type === 'checkbox' && f.checkValue && typeof f.format === 'function'
        );
        for (const field of checkboxFieldsWithFormat) {
          // The format function should return '1' for matching checkValue
          expect(
            field.format!(field.checkValue!),
            `format("${field.checkValue}") on "${field.formFieldName}" should return "1"`
          ).toBe('1');
          // And empty string for non-matching
          expect(
            field.format!('__nonmatch__'),
            `format("__nonmatch__") on "${field.formFieldName}" should return ""`
          ).toBe('');
        }
      });

      test('format functions return strings when provided', () => {
        const fieldsWithFormat = fields.filter(f => typeof f.format === 'function');
        for (const field of fieldsWithFormat) {
          const result = field.format!('test-value');
          expect(
            typeof result,
            `format function on "${field.formFieldName}" should return a string`
          ).toBe('string');
        }
      });
    });
  }
});

// =========================================================================
// Field Map Coverage (Minimum Field Counts)
// =========================================================================

describe('Field Map Coverage', () => {
  const EXPECTED_COUNTS: [FormType, number][] = [
    ['G-1145', 5],
    ['I-131', 15],
    ['I-140', 20],
    ['N-400', 30],
    ['I-539', 35],
    ['I-765', 45],
    ['I-129', 50],
    ['I-485', 100],
    ['I-130', 100],
  ];

  for (const [formType, minFields] of EXPECTED_COUNTS) {
    test(`${formType} has at least ${minFields} field mappings`, () => {
      const map = getUSCISFieldMap(formType)!;
      expect(
        map.length,
        `${formType} has ${map.length} fields, expected >= ${minFields}`
      ).toBeGreaterThanOrEqual(minFields);
    });
  }
});

// =========================================================================
// Critical Fields Present
// =========================================================================

describe('Critical Fields Present', () => {

  test('I-129 has employer and beneficiary fields', () => {
    const map = getUSCISFieldMap('I-129')!;
    const dataPaths = map.map(f => f.dataPath);

    expect(dataPaths).toContain('petitioner.companyName');
    expect(dataPaths).toContain('beneficiary.lastName');
    expect(dataPaths).toContain('beneficiary.firstName');
    expect(dataPaths).toContain('job.title');
    expect(dataPaths).toContain('requestedStartDate');
    expect(dataPaths).toContain('classification');
    expect(dataPaths).toContain('petitioner.ein');
    expect(dataPaths).toContain('beneficiary.dateOfBirth');
    expect(dataPaths).toContain('petitioner.phone');
  });

  test('I-129 has classification checkbox fields for visa types', () => {
    const map = getUSCISFieldMap('I-129')!;
    const checkboxFields = map.filter(f => f.type === 'checkbox');
    const checkValues = checkboxFields.map(f => f.checkValue);

    expect(checkValues).toContain('H-1B');
    expect(checkValues).toContain('L-1A');
    expect(checkValues).toContain('O-1A');
    expect(checkValues).toContain('TN');
    expect(checkValues).toContain('E-1');
  });

  test('I-129 checkbox format functions correctly select matching classification', () => {
    const map = getUSCISFieldMap('I-129')!;
    const h1bField = map.find(f => f.checkValue === 'H-1B');
    expect(h1bField).toBeDefined();
    expect(h1bField!.format!('H-1B')).toBe('1');
    expect(h1bField!.format!('L-1A')).toBe('');
    expect(h1bField!.format!('h-1b')).toBe('1'); // case-insensitive
  });

  test('I-539 has applicant and status fields', () => {
    const map = getUSCISFieldMap('I-539')!;
    const dataPaths = map.map(f => f.dataPath);

    expect(dataPaths).toContain('applicant.lastName');
    expect(dataPaths).toContain('applicant.firstName');
    expect(dataPaths).toContain('currentStatus');
    expect(dataPaths).toContain('requestedStatus');
    expect(dataPaths).toContain('applicant.alienNumber');
    expect(dataPaths).toContain('applicant.dateOfBirth');
    expect(dataPaths).toContain('applicant.passportNumber');
    expect(dataPaths).toContain('signatureDate');
  });

  test('I-539 has application type checkboxes (extend/change)', () => {
    const map = getUSCISFieldMap('I-539')!;
    const checkboxFields = map.filter(f => f.type === 'checkbox');
    const checkValues = checkboxFields.map(f => f.checkValue);

    expect(checkValues).toContain('extend');
    expect(checkValues).toContain('change');
  });

  test('I-539 checkbox format functions correctly select extend/change', () => {
    const map = getUSCISFieldMap('I-539')!;
    const extendField = map.find(f => f.checkValue === 'extend');
    expect(extendField).toBeDefined();
    expect(extendField!.format!('extend')).toBe('1');
    expect(extendField!.format!('change')).toBe('');
    expect(extendField!.format!('Extend')).toBe('1'); // case-insensitive
  });

  test('I-130 has petitioner and beneficiary fields', () => {
    const map = getUSCISFieldMap('I-130')!;
    const dataPaths = map.map(f => f.dataPath);

    expect(dataPaths).toContain('petitioner.lastName');
    expect(dataPaths).toContain('beneficiary.lastName');
    expect(dataPaths).toContain('petitioner.ssn');
    expect(dataPaths).toContain('beneficiary.ssn');
    expect(dataPaths).toContain('relationship');
    expect(dataPaths).toContain('signatureDate');
  });

  test('I-130 has relationship classification checkboxes', () => {
    const map = getUSCISFieldMap('I-130')!;
    const checkboxFields = map.filter(f => f.type === 'checkbox');
    const checkValues = checkboxFields.map(f => f.checkValue);

    expect(checkValues).toContain('spouse');
    expect(checkValues).toContain('parent');
    expect(checkValues).toContain('sibling');
    expect(checkValues).toContain('child');
  });

  test('I-485 has applicant identity and address fields', () => {
    const map = getUSCISFieldMap('I-485')!;
    const dataPaths = map.map(f => f.dataPath);

    expect(dataPaths).toContain('applicant.lastName');
    expect(dataPaths).toContain('applicant.firstName');
    expect(dataPaths).toContain('applicant.alienNumber');
    expect(dataPaths).toContain('applicant.ssn');
    expect(dataPaths).toContain('applicant.dateOfBirth');
    expect(dataPaths).toContain('applicant.address.street');
    expect(dataPaths).toContain('applicant.phone');
  });

  test('I-765 has applicant and eligibility fields', () => {
    const map = getUSCISFieldMap('I-765')!;
    const dataPaths = map.map(f => f.dataPath);

    expect(dataPaths).toContain('applicant.lastName');
    expect(dataPaths).toContain('applicant.firstName');
    expect(dataPaths).toContain('applicant.alienNumber');
    expect(dataPaths).toContain('applicant.ssn');
    expect(dataPaths).toContain('eligibilityCategory');
  });

  test('I-131 has applicant and travel document fields', () => {
    const map = getUSCISFieldMap('I-131')!;
    const dataPaths = map.map(f => f.dataPath);

    expect(dataPaths).toContain('applicant.lastName');
    expect(dataPaths).toContain('applicant.firstName');
    expect(dataPaths).toContain('applicant.alienNumber');
    expect(dataPaths).toContain('travelDocument.type');
    expect(dataPaths).toContain('travelDocument.departureDate');
  });

  test('I-140 has petitioner/employer and beneficiary fields', () => {
    const map = getUSCISFieldMap('I-140')!;
    const dataPaths = map.map(f => f.dataPath);

    expect(dataPaths).toContain('petitioner.companyName');
    expect(dataPaths).toContain('beneficiary.lastName');
    expect(dataPaths).toContain('beneficiary.firstName');
    expect(dataPaths).toContain('job.title');
    expect(dataPaths).toContain('classification');
  });

  test('N-400 has applicant identity and immigration fields', () => {
    const map = getUSCISFieldMap('N-400')!;
    const dataPaths = map.map(f => f.dataPath);

    expect(dataPaths).toContain('applicant.lastName');
    expect(dataPaths).toContain('applicant.firstName');
    expect(dataPaths).toContain('applicant.alienNumber');
    expect(dataPaths).toContain('applicant.ssn');
    expect(dataPaths).toContain('immigration.greenCardDate');
  });

  test('G-1145 has notification fields', () => {
    const map = getUSCISFieldMap('G-1145')!;
    const dataPaths = map.map(f => f.dataPath);

    expect(dataPaths).toContain('applicant.lastName');
    expect(dataPaths).toContain('applicant.firstName');
    expect(dataPaths).toContain('email');
    expect(dataPaths).toContain('mobilePhone');
  });
});

// =========================================================================
// Field Type Distribution
// =========================================================================

describe('Field Type Distribution', () => {
  test('I-129 has the expected mix of field types', () => {
    const map = getUSCISFieldMap('I-129')!;
    const typeCounts = new Map<string, number>();
    for (const field of map) {
      typeCounts.set(field.type, (typeCounts.get(field.type) ?? 0) + 1);
    }

    expect(typeCounts.get('text')).toBeGreaterThan(15);
    expect(typeCounts.get('checkbox')).toBeGreaterThan(5);
    expect(typeCounts.get('date')).toBeGreaterThan(3);
    expect(typeCounts.get('phone')).toBeGreaterThan(0);
    expect(typeCounts.get('ssn')).toBeGreaterThan(0);
    expect(typeCounts.get('alien_number')).toBeGreaterThan(0);
  });

  test('I-539 has the expected mix of field types', () => {
    const map = getUSCISFieldMap('I-539')!;
    const typeCounts = new Map<string, number>();
    for (const field of map) {
      typeCounts.set(field.type, (typeCounts.get(field.type) ?? 0) + 1);
    }

    expect(typeCounts.get('text')).toBeGreaterThan(15);
    expect(typeCounts.get('checkbox')).toBeGreaterThanOrEqual(2);
    expect(typeCounts.get('date')).toBeGreaterThan(3);
    expect(typeCounts.get('phone')).toBeGreaterThan(0);
    expect(typeCounts.get('ssn')).toBeGreaterThan(0);
    expect(typeCounts.get('alien_number')).toBeGreaterThan(0);
  });

  test('I-485 has many eligibility checkbox fields', () => {
    const map = getUSCISFieldMap('I-485')!;
    const checkboxFields = map.filter(f => f.type === 'checkbox');
    // I-485 has extensive Part 8 eligibility Yes/No checkboxes
    expect(checkboxFields.length).toBeGreaterThan(30);
  });

  test('every form has at least one text-type field', () => {
    const ALL_FORMS: FormType[] = [
      'I-130', 'I-485', 'I-765', 'I-131', 'N-400', 'I-140', 'G-1145', 'I-129', 'I-539',
    ];
    for (const ft of ALL_FORMS) {
      const map = getUSCISFieldMap(ft)!;
      const textFields = map.filter(f => f.type === 'text');
      expect(textFields.length, `${ft} should have text fields`).toBeGreaterThan(0);
    }
  });
});

// =========================================================================
// Format Function Behavior (checkWhen helper used across forms)
// =========================================================================

describe('checkWhen Format Functions', () => {
  test('I-130 relationship checkboxes return "1" for matching value', () => {
    const map = getUSCISFieldMap('I-130')!;
    const spouseField = map.find(f => f.formFieldName === 'form1.Pt1Line1_Spouse');
    expect(spouseField).toBeDefined();
    expect(spouseField!.format!('spouse')).toBe('1');
    expect(spouseField!.format!('parent')).toBe('');
  });

  test('I-130 marital status checkboxes are case-insensitive', () => {
    const map = getUSCISFieldMap('I-130')!;
    const marriedField = map.find(f => f.formFieldName === 'form1.Pt2Line17_Married');
    expect(marriedField).toBeDefined();
    expect(marriedField!.format!('married')).toBe('1');
    expect(marriedField!.format!('MARRIED')).toBe('1');
    expect(marriedField!.format!('Married')).toBe('1');
    expect(marriedField!.format!('single')).toBe('');
  });

  test('checkWhen handles null and undefined gracefully', () => {
    const map = getUSCISFieldMap('I-129')!;
    const h1bField = map.find(f => f.checkValue === 'H-1B');
    expect(h1bField).toBeDefined();
    expect(h1bField!.format!(null)).toBe('');
    expect(h1bField!.format!(undefined)).toBe('');
    expect(h1bField!.format!('')).toBe('');
  });
});
