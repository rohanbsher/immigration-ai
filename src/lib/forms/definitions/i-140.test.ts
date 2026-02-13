import { describe, it, expect } from 'vitest';
import { I140_FORM } from './i-140';
import { FORM_DEFINITIONS } from './index';

describe('I-140 Form Definition', () => {
  describe('basic structure', () => {
    it('has correct form metadata', () => {
      expect(I140_FORM.formType).toBe('I-140');
      expect(I140_FORM.title).toBe('Immigrant Petition for Alien Workers');
      expect(I140_FORM.version).toBe('2024-01');
      expect(I140_FORM.filingFee).toBe(700);
      expect(I140_FORM.uscisFormNumber).toBe('I-140');
      expect(I140_FORM.estimatedTime).toBe('1-2 hours');
    });

    it('has instructions text', () => {
      expect(I140_FORM.instructions).toBeDefined();
      expect(I140_FORM.instructions!.length).toBeGreaterThan(0);
    });
  });

  describe('sections', () => {
    const expectedSections = [
      'immigrant_category',
      'petitioner_info',
      'beneficiary_info',
      'job_info',
      'labor_cert',
      'education',
      'additional_info',
    ];

    it('has exactly 7 sections', () => {
      expect(I140_FORM.sections).toHaveLength(7);
    });

    it('has all expected section ids', () => {
      const sectionIds = I140_FORM.sections.map((s) => s.id);
      expect(sectionIds).toEqual(expectedSections);
    });

    it('every section has an id, title, and non-empty fields', () => {
      for (const section of I140_FORM.sections) {
        expect(section.id).toBeTruthy();
        expect(section.title).toBeTruthy();
        expect(section.fields.length).toBeGreaterThan(0);
      }
    });
  });

  describe('key fields', () => {
    const allFields = I140_FORM.sections.flatMap((s) => s.fields);
    const fieldById = (id: string) => allFields.find((f) => f.id === id);

    it('has immigrant_category as a select field with EB categories', () => {
      const field = fieldById('immigrant_category');
      expect(field).toBeDefined();
      expect(field!.type).toBe('select');
      expect(field!.validation?.required).toBe(true);

      const values = field!.options!.map((o) => o.value);
      expect(values).toContain('eb1a');
      expect(values).toContain('eb2');
      expect(values).toContain('eb2_niw');
      expect(values).toContain('eb3_skilled');
    });

    it('has employer name field', () => {
      const field = fieldById('pt1_employer_name');
      expect(field).toBeDefined();
      expect(field!.validation?.required).toBe(true);
      expect(field!.aiFieldKey).toBe('employer_name');
    });

    it('has beneficiary name and DOB fields', () => {
      const familyName = fieldById('pt4_family_name');
      const givenName = fieldById('pt4_given_name');
      const dob = fieldById('pt4_dob');

      expect(familyName).toBeDefined();
      expect(familyName!.validation?.required).toBe(true);

      expect(givenName).toBeDefined();
      expect(givenName!.validation?.required).toBe(true);

      expect(dob).toBeDefined();
      expect(dob!.type).toBe('date');
      expect(dob!.validation?.required).toBe(true);
    });

    it('has job title and offered wage fields', () => {
      const jobTitle = fieldById('pt5_job_title');
      const offeredWage = fieldById('pt5_offered_wage');

      expect(jobTitle).toBeDefined();
      expect(jobTitle!.validation?.required).toBe(true);
      expect(jobTitle!.aiFieldKey).toBe('job_title');

      expect(offeredWage).toBeDefined();
      expect(offeredWage!.validation?.required).toBe(true);
      expect(offeredWage!.aiFieldKey).toBe('salary');
    });

    it('has labor certification yes/no field', () => {
      const field = fieldById('pt6_has_labor_cert');
      expect(field).toBeDefined();
      expect(field!.type).toBe('radio');
      expect(field!.options).toEqual([
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ]);
    });

    it('has education level select field', () => {
      const field = fieldById('pt7_highest_education');
      expect(field).toBeDefined();
      expect(field!.type).toBe('select');
      const values = field!.options!.map((o) => o.value);
      expect(values).toContain('bachelors');
      expect(values).toContain('masters');
      expect(values).toContain('doctorate');
    });
  });

  describe('AI field key mappings', () => {
    const allFields = I140_FORM.sections.flatMap((s) => s.fields);
    const fieldById = (id: string) => allFields.find((f) => f.id === id);

    const expectedMappings: Record<string, string> = {
      pt4_family_name: 'surname',
      pt4_given_name: 'given_name',
      pt4_dob: 'date_of_birth',
      pt4_country_of_birth: 'place_of_birth',
      pt4_nationality: 'nationality',
      pt4_alien_number: 'alien_number',
      pt4_passport_number: 'passport_number',
      pt4_passport_expiry: 'expiry_date',
      pt1_employer_name: 'employer_name',
      pt5_job_title: 'job_title',
      pt5_offered_wage: 'salary',
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
    it('is registered in FORM_DEFINITIONS under "I-140"', () => {
      expect(FORM_DEFINITIONS['I-140']).toBe(I140_FORM);
    });
  });
});
