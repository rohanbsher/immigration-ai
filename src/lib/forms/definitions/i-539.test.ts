import { describe, it, expect } from 'vitest';
import { I539_FORM } from './i-539';
import { FORM_DEFINITIONS } from './index';
import { FieldType } from './types';

const VALID_FIELD_TYPES: FieldType[] = [
  'text', 'textarea', 'number', 'date', 'select', 'radio',
  'checkbox', 'phone', 'email', 'ssn', 'alien_number', 'country', 'state', 'address',
];

describe('I-539 Form Definition', () => {
  describe('basic structure', () => {
    it('has correct form metadata', () => {
      expect(I539_FORM.formType).toBe('I-539');
      expect(I539_FORM.title).toBe('Application to Extend/Change Nonimmigrant Status');
      expect(I539_FORM.uscisFormNumber).toBe('I-539');
      expect(I539_FORM.filingFee).toBe(370);
    });

    it('has instructions text', () => {
      expect(I539_FORM.instructions).toBeDefined();
      expect(I539_FORM.instructions!.length).toBeGreaterThan(0);
    });
  });

  describe('sections', () => {
    it('has sections with expected ids', () => {
      const expectedSections = [
        'request_type',
        'applicant_info',
        'applicant_address',
        'contact_info',
        'passport_info',
        'current_status_info',
        'requested_stay',
        'employment_info',
        'co_applicants',
        'signature',
      ];
      expect(I539_FORM.sections).toHaveLength(10);
      const sectionIds = I539_FORM.sections.map((s) => s.id);
      expect(sectionIds).toEqual(expectedSections);
    });

    it('every section has an id, title, and at least 1 field', () => {
      for (const section of I539_FORM.sections) {
        expect(section.id).toBeTruthy();
        expect(section.title).toBeTruthy();
        expect(section.fields.length).toBeGreaterThan(0);
      }
    });
  });

  describe('field uniqueness', () => {
    const allFields = I539_FORM.sections.flatMap((s) => s.fields);

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
    const allFields = I539_FORM.sections.flatMap((s) => s.fields);

    it('all field types are valid FieldType values', () => {
      for (const field of allFields) {
        expect(VALID_FIELD_TYPES).toContain(field.type);
      }
    });
  });

  describe('required fields', () => {
    const allFields = I539_FORM.sections.flatMap((s) => s.fields);

    it('has fields with validation.required === true', () => {
      const requiredFields = allFields.filter(
        (f) => f.validation?.required === true
      );
      expect(requiredFields.length).toBeGreaterThan(0);
    });
  });

  describe('key fields', () => {
    const allFields = I539_FORM.sections.flatMap((s) => s.fields);
    const fieldById = (id: string) => allFields.find((f) => f.id === id);

    it('has request_type as a select field with extension and change options', () => {
      const field = fieldById('request_type');
      expect(field).toBeDefined();
      expect(field!.type).toBe('select');
      expect(field!.validation?.required).toBe(true);

      const values = field!.options!.map((o) => o.value);
      expect(values).toContain('extension');
      expect(values).toContain('change');
    });

    it('has applicant name and DOB fields', () => {
      const lastName = fieldById('applicant_last_name');
      const firstName = fieldById('applicant_first_name');
      const dob = fieldById('applicant_dob');

      expect(lastName).toBeDefined();
      expect(lastName!.validation?.required).toBe(true);
      expect(lastName!.aiFieldKey).toBe('last_name');

      expect(firstName).toBeDefined();
      expect(firstName!.validation?.required).toBe(true);
      expect(firstName!.aiFieldKey).toBe('first_name');

      expect(dob).toBeDefined();
      expect(dob!.type).toBe('date');
      expect(dob!.validation?.required).toBe(true);
      expect(dob!.aiFieldKey).toBe('date_of_birth');
    });

    it('has passport number and expiry fields', () => {
      const passportNum = fieldById('passport_number');
      const passportExpiry = fieldById('passport_expiry');

      expect(passportNum).toBeDefined();
      expect(passportNum!.validation?.required).toBe(true);
      expect(passportNum!.aiFieldKey).toBe('passport_number');

      expect(passportExpiry).toBeDefined();
      expect(passportExpiry!.type).toBe('date');
      expect(passportExpiry!.aiFieldKey).toBe('expiry_date');
    });

    it('has current status and requested status fields', () => {
      const currentStatus = fieldById('current_status');
      const requestedStatus = fieldById('requested_status');

      expect(currentStatus).toBeDefined();
      expect(currentStatus!.validation?.required).toBe(true);

      expect(requestedStatus).toBeDefined();
      expect(requestedStatus!.validation?.required).toBe(true);
    });

    it('has co-applicants section marked as repeatable', () => {
      const coApplicantsSection = I539_FORM.sections.find((s) => s.id === 'co_applicants');
      expect(coApplicantsSection).toBeDefined();
      expect(coApplicantsSection!.repeatable).toBe(true);
      expect(coApplicantsSection!.maxRepeat).toBe(5);
    });
  });

  describe('AI field key mappings', () => {
    const allFields = I539_FORM.sections.flatMap((s) => s.fields);
    const fieldById = (id: string) => allFields.find((f) => f.id === id);

    const expectedMappings: Record<string, string> = {
      applicant_last_name: 'last_name',
      applicant_first_name: 'first_name',
      applicant_dob: 'date_of_birth',
      applicant_birth_country: 'country_of_birth',
      applicant_nationality: 'nationality',
      applicant_alien_number: 'alien_number',
      passport_number: 'passport_number',
      passport_expiry: 'expiry_date',
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
    it('is registered in FORM_DEFINITIONS under "I-539"', () => {
      expect(FORM_DEFINITIONS['I-539']).toBe(I539_FORM);
    });
  });
});
