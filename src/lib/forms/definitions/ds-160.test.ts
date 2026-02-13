import { describe, it, expect } from 'vitest';
import { DS160_FORM } from './ds-160';
import { FORM_DEFINITIONS } from './index';
import { FieldType } from './types';

const VALID_FIELD_TYPES: FieldType[] = [
  'text', 'textarea', 'number', 'date', 'select', 'radio',
  'checkbox', 'phone', 'email', 'ssn', 'alien_number', 'country', 'state', 'address',
];

describe('DS-160 Form Definition', () => {
  describe('basic structure', () => {
    it('has correct form metadata', () => {
      expect(DS160_FORM.formType).toBe('DS-160');
      expect(DS160_FORM.title).toBe('Online Nonimmigrant Visa Application');
      expect(DS160_FORM.uscisFormNumber).toBe('DS-160');
      expect(DS160_FORM.filingFee).toBe(185);
    });

    it('has instructions text', () => {
      expect(DS160_FORM.instructions).toBeDefined();
      expect(DS160_FORM.instructions!.length).toBeGreaterThan(0);
    });
  });

  describe('sections', () => {
    it('has sections with expected ids', () => {
      const expectedSections = [
        'personal_info',
        'nationality_info',
        'passport_info',
        'travel_info',
        'travel_companions',
        'previous_us_travel',
        'us_contact',
        'family_info',
        'work_education',
        'address_phone',
        'security_questions',
      ];
      expect(DS160_FORM.sections).toHaveLength(11);
      const sectionIds = DS160_FORM.sections.map((s) => s.id);
      expect(sectionIds).toEqual(expectedSections);
    });

    it('every section has an id, title, and at least 1 field', () => {
      for (const section of DS160_FORM.sections) {
        expect(section.id).toBeTruthy();
        expect(section.title).toBeTruthy();
        expect(section.fields.length).toBeGreaterThan(0);
      }
    });
  });

  describe('field uniqueness', () => {
    const allFields = DS160_FORM.sections.flatMap((s) => s.fields);

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
    const allFields = DS160_FORM.sections.flatMap((s) => s.fields);

    it('all field types are valid FieldType values', () => {
      for (const field of allFields) {
        expect(VALID_FIELD_TYPES).toContain(field.type);
      }
    });
  });

  describe('required fields', () => {
    const allFields = DS160_FORM.sections.flatMap((s) => s.fields);

    it('has fields with validation.required === true', () => {
      const requiredFields = allFields.filter(
        (f) => f.validation?.required === true
      );
      expect(requiredFields.length).toBeGreaterThan(0);
    });
  });

  describe('key fields', () => {
    const allFields = DS160_FORM.sections.flatMap((s) => s.fields);
    const fieldById = (id: string) => allFields.find((f) => f.id === id);

    it('has personal info name and DOB fields', () => {
      const lastName = fieldById('last_name');
      const firstName = fieldById('first_name');
      const dob = fieldById('dob');

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

    it('has sex and marital status select fields', () => {
      const sex = fieldById('sex');
      const maritalStatus = fieldById('marital_status');

      expect(sex).toBeDefined();
      expect(sex!.type).toBe('select');
      expect(sex!.validation?.required).toBe(true);

      expect(maritalStatus).toBeDefined();
      expect(maritalStatus!.type).toBe('select');
      expect(maritalStatus!.validation?.required).toBe(true);

      const maritalValues = maritalStatus!.options!.map((o) => o.value);
      expect(maritalValues).toContain('single');
      expect(maritalValues).toContain('married');
      expect(maritalValues).toContain('divorced');
    });

    it('has passport info fields', () => {
      const passportNumber = fieldById('passport_number');
      const passportIssueDate = fieldById('passport_issue_date');
      const passportExpiryDate = fieldById('passport_expiry_date');

      expect(passportNumber).toBeDefined();
      expect(passportNumber!.validation?.required).toBe(true);
      expect(passportNumber!.aiFieldKey).toBe('passport_number');

      expect(passportIssueDate).toBeDefined();
      expect(passportIssueDate!.type).toBe('date');

      expect(passportExpiryDate).toBeDefined();
      expect(passportExpiryDate!.type).toBe('date');
      expect(passportExpiryDate!.aiFieldKey).toBe('expiry_date');
    });

    it('has visa type select with multiple options', () => {
      const field = fieldById('visa_type');
      expect(field).toBeDefined();
      expect(field!.type).toBe('select');
      expect(field!.validation?.required).toBe(true);

      const values = field!.options!.map((o) => o.value);
      expect(values).toContain('b1');
      expect(values).toContain('f1');
      expect(values).toContain('h1b');
    });

    it('has security questions as yes/no radio fields', () => {
      const securityFields = [
        'communicable_disease',
        'criminal_arrest',
        'visa_violation',
        'deported',
      ];

      for (const fieldId of securityFields) {
        const field = fieldById(fieldId);
        expect(field).toBeDefined();
        expect(field!.type).toBe('radio');
        expect(field!.options).toEqual([
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ]);
      }
    });

    it('has family info fields for father and mother', () => {
      const fatherLast = fieldById('father_last_name');
      const motherLast = fieldById('mother_last_name');

      expect(fatherLast).toBeDefined();
      expect(fatherLast!.validation?.required).toBe(true);

      expect(motherLast).toBeDefined();
      expect(motherLast!.validation?.required).toBe(true);
    });
  });

  describe('AI field key mappings', () => {
    const allFields = DS160_FORM.sections.flatMap((s) => s.fields);
    const fieldById = (id: string) => allFields.find((f) => f.id === id);

    const expectedMappings: Record<string, string> = {
      last_name: 'surname',
      first_name: 'given_name',
      dob: 'date_of_birth',
      birth_country: 'country_of_birth',
      nationality: 'nationality',
      passport_number: 'passport_number',
      passport_expiry_date: 'expiry_date',
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
    it('is registered in FORM_DEFINITIONS under "DS-160"', () => {
      expect(FORM_DEFINITIONS['DS-160']).toBe(DS160_FORM);
    });
  });
});
