import { describe, it, expect } from 'vitest';
import { G1145_FORM } from './g-1145';
import { FORM_DEFINITIONS } from './index';
import { FieldType } from './types';

const VALID_FIELD_TYPES: FieldType[] = [
  'text', 'textarea', 'number', 'date', 'select', 'radio',
  'checkbox', 'phone', 'email', 'ssn', 'alien_number', 'country', 'state', 'address',
];

describe('G-1145 Form Definition', () => {
  describe('basic structure', () => {
    it('has correct form metadata', () => {
      expect(G1145_FORM.formType).toBe('G-1145');
      expect(G1145_FORM.title).toBe('E-Notification of Application/Petition Acceptance');
      expect(G1145_FORM.uscisFormNumber).toBe('G-1145');
      expect(G1145_FORM.filingFee).toBe(0);
    });

    it('has instructions text', () => {
      expect(G1145_FORM.instructions).toBeDefined();
      expect(G1145_FORM.instructions!.length).toBeGreaterThan(0);
    });
  });

  describe('sections', () => {
    it('has sections with expected ids', () => {
      const expectedSections = [
        'applicant_info',
        'contact_info',
        'application_info',
      ];
      expect(G1145_FORM.sections).toHaveLength(3);
      const sectionIds = G1145_FORM.sections.map((s) => s.id);
      expect(sectionIds).toEqual(expectedSections);
    });

    it('every section has an id, title, and at least 1 field', () => {
      for (const section of G1145_FORM.sections) {
        expect(section.id).toBeTruthy();
        expect(section.title).toBeTruthy();
        expect(section.fields.length).toBeGreaterThan(0);
      }
    });
  });

  describe('field uniqueness', () => {
    const allFields = G1145_FORM.sections.flatMap((s) => s.fields);

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
    const allFields = G1145_FORM.sections.flatMap((s) => s.fields);

    it('all field types are valid FieldType values', () => {
      for (const field of allFields) {
        expect(VALID_FIELD_TYPES).toContain(field.type);
      }
    });
  });

  describe('required fields', () => {
    const allFields = G1145_FORM.sections.flatMap((s) => s.fields);

    it('has fields with validation.required === true', () => {
      const requiredFields = allFields.filter(
        (f) => f.validation?.required === true
      );
      expect(requiredFields.length).toBeGreaterThan(0);
    });
  });

  describe('key fields', () => {
    const allFields = G1145_FORM.sections.flatMap((s) => s.fields);
    const fieldById = (id: string) => allFields.find((f) => f.id === id);

    it('has applicant name fields', () => {
      const lastName = fieldById('applicant_last_name');
      const firstName = fieldById('applicant_first_name');

      expect(lastName).toBeDefined();
      expect(lastName!.validation?.required).toBe(true);
      expect(lastName!.aiFieldKey).toBe('last_name');

      expect(firstName).toBeDefined();
      expect(firstName!.validation?.required).toBe(true);
      expect(firstName!.aiFieldKey).toBe('first_name');
    });

    it('has email address field as required', () => {
      const email = fieldById('email_address');
      expect(email).toBeDefined();
      expect(email!.validation?.required).toBe(true);
      expect(email!.type).toBe('email');
    });

    it('has mobile phone as optional', () => {
      const phone = fieldById('mobile_phone');
      expect(phone).toBeDefined();
      expect(phone!.validation?.required).toBeUndefined();
      expect(phone!.type).toBe('phone');
    });

    it('has application info fields', () => {
      const formNumber = fieldById('form_number');
      const beneficiaryName = fieldById('beneficiary_name');

      expect(formNumber).toBeDefined();
      expect(beneficiaryName).toBeDefined();
    });
  });

  describe('AI field key mappings', () => {
    const allFields = G1145_FORM.sections.flatMap((s) => s.fields);
    const fieldById = (id: string) => allFields.find((f) => f.id === id);

    const expectedMappings: Record<string, string> = {
      applicant_last_name: 'last_name',
      applicant_first_name: 'first_name',
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
    it('is registered in FORM_DEFINITIONS under "G-1145"', () => {
      expect(FORM_DEFINITIONS['G-1145']).toBe(G1145_FORM);
    });
  });
});
