import { describe, it, expect } from 'vitest';
import { I20_FORM } from './i-20';
import { FORM_DEFINITIONS } from './index';
import { FieldType } from './types';

const VALID_FIELD_TYPES: FieldType[] = [
  'text', 'textarea', 'number', 'date', 'select', 'radio',
  'checkbox', 'phone', 'email', 'ssn', 'alien_number', 'country', 'state', 'address',
];

describe('I-20 Form Definition', () => {
  describe('basic structure', () => {
    it('has correct form metadata', () => {
      expect(I20_FORM.formType).toBe('I-20');
      expect(I20_FORM.title).toBe('Certificate of Eligibility for Nonimmigrant Student Status');
      expect(I20_FORM.uscisFormNumber).toBe('I-20');
      expect(I20_FORM.filingFee).toBe(0);
    });

    it('has instructions text', () => {
      expect(I20_FORM.instructions).toBeDefined();
      expect(I20_FORM.instructions!.length).toBeGreaterThan(0);
    });
  });

  describe('sections', () => {
    it('has sections with expected ids', () => {
      const expectedSections = [
        'school_info',
        'student_info',
        'student_address',
        'admission_info',
        'program_info',
        'financial_info',
        'dso_certification',
      ];
      expect(I20_FORM.sections).toHaveLength(7);
      const sectionIds = I20_FORM.sections.map((s) => s.id);
      expect(sectionIds).toEqual(expectedSections);
    });

    it('every section has an id, title, and at least 1 field', () => {
      for (const section of I20_FORM.sections) {
        expect(section.id).toBeTruthy();
        expect(section.title).toBeTruthy();
        expect(section.fields.length).toBeGreaterThan(0);
      }
    });
  });

  describe('field uniqueness', () => {
    const allFields = I20_FORM.sections.flatMap((s) => s.fields);

    it('all field IDs are unique within the form', () => {
      const ids = allFields.map((f) => f.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('all aiFieldKey values are unique within the form', () => {
      const keys = allFields
        .filter((f) => f.aiFieldKey)
        .map((f) => f.aiFieldKey);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });
  });

  describe('field types', () => {
    const allFields = I20_FORM.sections.flatMap((s) => s.fields);

    it('all field types are valid FieldType values', () => {
      for (const field of allFields) {
        expect(VALID_FIELD_TYPES).toContain(field.type);
      }
    });
  });

  describe('required fields', () => {
    const allFields = I20_FORM.sections.flatMap((s) => s.fields);

    it('has fields with validation.required === true', () => {
      const requiredFields = allFields.filter(
        (f) => f.validation?.required === true
      );
      expect(requiredFields.length).toBeGreaterThan(0);
    });
  });

  describe('key fields', () => {
    const allFields = I20_FORM.sections.flatMap((s) => s.fields);
    const fieldById = (id: string) => allFields.find((f) => f.id === id);

    it('has school name and code fields', () => {
      const schoolName = fieldById('school_name');
      const schoolCode = fieldById('school_code');

      expect(schoolName).toBeDefined();
      expect(schoolName!.validation?.required).toBe(true);

      expect(schoolCode).toBeDefined();
      expect(schoolCode!.validation?.required).toBe(true);
    });

    it('has student name and DOB fields', () => {
      const lastName = fieldById('student_last_name');
      const firstName = fieldById('student_first_name');
      const dob = fieldById('student_dob');

      expect(lastName).toBeDefined();
      expect(lastName!.validation?.required).toBe(true);
      expect(lastName!.aiFieldKey).toBe('surname');

      expect(firstName).toBeDefined();
      expect(firstName!.validation?.required).toBe(true);
      expect(firstName!.aiFieldKey).toBe('given_name');

      expect(dob).toBeDefined();
      expect(dob!.type).toBe('date');
      expect(dob!.validation?.required).toBe(true);
      expect(dob!.aiFieldKey).toBe('date_of_birth');
    });

    it('has admission category select with F-1 and M-1 options', () => {
      const field = fieldById('admission_category');
      expect(field).toBeDefined();
      expect(field!.type).toBe('select');
      expect(field!.validation?.required).toBe(true);

      const values = field!.options!.map((o) => o.value);
      expect(values).toContain('f1');
      expect(values).toContain('m1');
    });

    it('has student level select with degree options', () => {
      const field = fieldById('student_level');
      expect(field).toBeDefined();
      expect(field!.type).toBe('select');
      expect(field!.validation?.required).toBe(true);

      const values = field!.options!.map((o) => o.value);
      expect(values).toContain('bachelor');
      expect(values).toContain('master');
      expect(values).toContain('doctorate');
    });

    it('has program info fields', () => {
      const programName = fieldById('program_name');
      const programStart = fieldById('program_start_date');
      const programEnd = fieldById('program_end_date');

      expect(programName).toBeDefined();
      expect(programName!.validation?.required).toBe(true);

      expect(programStart).toBeDefined();
      expect(programStart!.type).toBe('date');

      expect(programEnd).toBeDefined();
      expect(programEnd!.type).toBe('date');
    });

    it('has financial info fields', () => {
      const tuition = fieldById('estimated_tuition');
      const living = fieldById('estimated_living');

      expect(tuition).toBeDefined();
      expect(tuition!.validation?.required).toBe(true);

      expect(living).toBeDefined();
      expect(living!.validation?.required).toBe(true);
    });
  });

  describe('AI field key mappings', () => {
    const allFields = I20_FORM.sections.flatMap((s) => s.fields);
    const fieldById = (id: string) => allFields.find((f) => f.id === id);

    const expectedMappings: Record<string, string> = {
      student_last_name: 'surname',
      student_first_name: 'given_name',
      student_dob: 'date_of_birth',
      student_birth_country: 'country_of_birth',
      student_nationality: 'nationality',
      student_passport_number: 'passport_number',
    };

    it.each(Object.entries(expectedMappings))(
      'field %s maps to aiFieldKey "%s"',
      (fieldId, expectedKey) => {
        const field = fieldById(fieldId);
        expect(field).toBeDefined();
        expect(field!.aiFieldKey).toBe(expectedKey);
        expect(field!.aiMappable).toBe(true);
      }
    );
  });

  describe('form registry', () => {
    it('is registered in FORM_DEFINITIONS under "I-20"', () => {
      expect(FORM_DEFINITIONS['I-20']).toBe(I20_FORM);
    });
  });
});
