import { describe, it, expect } from 'vitest';
import { I129_FORM } from './i-129';
import { FORM_DEFINITIONS } from './index';
import { FieldType } from './types';

const VALID_FIELD_TYPES: FieldType[] = [
  'text', 'textarea', 'number', 'date', 'select', 'radio',
  'checkbox', 'phone', 'email', 'ssn', 'alien_number', 'country', 'state', 'address',
];

describe('I-129 Form Definition', () => {
  describe('basic structure', () => {
    it('has correct form metadata', () => {
      expect(I129_FORM.formType).toBe('I-129');
      expect(I129_FORM.title).toBe('Petition for a Nonimmigrant Worker');
      expect(I129_FORM.uscisFormNumber).toBe('I-129');
      expect(I129_FORM.filingFee).toBe(780);
    });

    it('has instructions text', () => {
      expect(I129_FORM.instructions).toBeDefined();
      expect(I129_FORM.instructions!.length).toBeGreaterThan(0);
    });
  });

  describe('sections', () => {
    it('has sections with expected ids', () => {
      const expectedSections = [
        'classification',
        'petitioner_info',
        'beneficiary_info',
        'beneficiary_address',
        'beneficiary_last_entry',
        'job_details',
        'wages',
        'lca',
        'requested_dates',
        'signature',
      ];
      expect(I129_FORM.sections).toHaveLength(10);
      const sectionIds = I129_FORM.sections.map((s) => s.id);
      expect(sectionIds).toEqual(expectedSections);
    });

    it('every section has an id, title, and at least 1 field', () => {
      for (const section of I129_FORM.sections) {
        expect(section.id).toBeTruthy();
        expect(section.title).toBeTruthy();
        expect(section.fields.length).toBeGreaterThan(0);
      }
    });
  });

  describe('field uniqueness', () => {
    const allFields = I129_FORM.sections.flatMap((s) => s.fields);

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
    const allFields = I129_FORM.sections.flatMap((s) => s.fields);

    it('all field types are valid FieldType values', () => {
      for (const field of allFields) {
        expect(VALID_FIELD_TYPES).toContain(field.type);
      }
    });
  });

  describe('required fields', () => {
    const allFields = I129_FORM.sections.flatMap((s) => s.fields);

    it('has fields with validation.required === true', () => {
      const requiredFields = allFields.filter(
        (f) => f.validation?.required === true
      );
      expect(requiredFields.length).toBeGreaterThan(0);
    });
  });

  describe('key fields', () => {
    const allFields = I129_FORM.sections.flatMap((s) => s.fields);
    const fieldById = (id: string) => allFields.find((f) => f.id === id);

    it('has classification_requested as a select field with H-1B and L-1 options', () => {
      const field = fieldById('classification_requested');
      expect(field).toBeDefined();
      expect(field!.type).toBe('select');
      expect(field!.validation?.required).toBe(true);

      const values = field!.options!.map((o) => o.value);
      expect(values).toContain('h1b');
      expect(values).toContain('l1a');
      expect(values).toContain('o1a');
    });

    it('has petitioner company name field with aiFieldKey', () => {
      const field = fieldById('petitioner_company_name');
      expect(field).toBeDefined();
      expect(field!.validation?.required).toBe(true);
      expect(field!.aiFieldKey).toBe('employer_name');
    });

    it('has beneficiary name and DOB fields', () => {
      const lastName = fieldById('beneficiary_last_name');
      const firstName = fieldById('beneficiary_first_name');
      const dob = fieldById('beneficiary_dob');

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

    it('has job title and offered wage fields', () => {
      const jobTitle = fieldById('job_title');
      const offeredWage = fieldById('offered_wage');

      expect(jobTitle).toBeDefined();
      expect(jobTitle!.validation?.required).toBe(true);
      expect(jobTitle!.aiFieldKey).toBe('job_title');

      expect(offeredWage).toBeDefined();
      expect(offeredWage!.validation?.required).toBe(true);
      expect(offeredWage!.aiFieldKey).toBe('salary');
    });

    it('has passport number and expiry fields', () => {
      const passportNum = fieldById('beneficiary_passport_number');
      const passportExpiry = fieldById('beneficiary_passport_expiry');

      expect(passportNum).toBeDefined();
      expect(passportNum!.validation?.required).toBe(true);
      expect(passportNum!.aiFieldKey).toBe('passport_number');

      expect(passportExpiry).toBeDefined();
      expect(passportExpiry!.type).toBe('date');
      expect(passportExpiry!.aiFieldKey).toBe('expiry_date');
    });
  });

  describe('AI field key mappings', () => {
    const allFields = I129_FORM.sections.flatMap((s) => s.fields);
    const fieldById = (id: string) => allFields.find((f) => f.id === id);

    const expectedMappings: Record<string, string> = {
      petitioner_company_name: 'employer_name',
      beneficiary_last_name: 'surname',
      beneficiary_first_name: 'given_name',
      beneficiary_dob: 'date_of_birth',
      beneficiary_birth_country: 'country_of_birth',
      beneficiary_nationality: 'nationality',
      beneficiary_alien_number: 'alien_number',
      beneficiary_passport_number: 'passport_number',
      beneficiary_passport_expiry: 'expiry_date',
      job_title: 'job_title',
      offered_wage: 'salary',
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
    it('is registered in FORM_DEFINITIONS under "I-129"', () => {
      expect(FORM_DEFINITIONS['I-129']).toBe(I129_FORM);
    });
  });
});
