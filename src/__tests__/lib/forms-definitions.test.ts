import {
  FORM_DEFINITIONS,
  getFormDefinition,
  getAvailableFormTypes,
  getFormSummaries,
  countRequiredFields,
  getAIMappableFields,
} from '@/lib/forms/definitions';

describe('Form Definitions', () => {
  describe('FORM_DEFINITIONS', () => {
    it('should contain I-130, I-485, I-765, and N-400 forms', () => {
      expect(FORM_DEFINITIONS).toHaveProperty('I-130');
      expect(FORM_DEFINITIONS).toHaveProperty('I-485');
      expect(FORM_DEFINITIONS).toHaveProperty('I-765');
      expect(FORM_DEFINITIONS).toHaveProperty('N-400');
    });

    it('should have valid form structure for each form', () => {
      Object.values(FORM_DEFINITIONS).forEach((form) => {
        expect(form).toHaveProperty('formType');
        expect(form).toHaveProperty('title');
        expect(form).toHaveProperty('sections');
        expect(Array.isArray(form.sections)).toBe(true);
      });
    });
  });

  describe('getFormDefinition', () => {
    it('should return I-130 form definition', () => {
      const form = getFormDefinition('I-130');
      expect(form).not.toBeNull();
      expect(form?.formType).toBe('I-130');
    });

    it('should return null for unknown form type', () => {
      const form = getFormDefinition('UNKNOWN-999');
      expect(form).toBeNull();
    });

    it('should return I-485 form with correct structure', () => {
      const form = getFormDefinition('I-485');
      expect(form).not.toBeNull();
      expect(form?.sections.length).toBeGreaterThan(0);
    });
  });

  describe('getAvailableFormTypes', () => {
    it('should return array of form types', () => {
      const types = getAvailableFormTypes();
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThanOrEqual(4);
    });

    it('should include all expected form types', () => {
      const types = getAvailableFormTypes();
      expect(types).toContain('I-130');
      expect(types).toContain('I-485');
      expect(types).toContain('I-765');
      expect(types).toContain('N-400');
    });
  });

  describe('getFormSummaries', () => {
    it('should return array of form summaries', () => {
      const summaries = getFormSummaries();
      expect(Array.isArray(summaries)).toBe(true);
      expect(summaries.length).toBeGreaterThanOrEqual(4);
    });

    it('should include formType and title in each summary', () => {
      const summaries = getFormSummaries();
      summaries.forEach((summary) => {
        expect(summary).toHaveProperty('formType');
        expect(summary).toHaveProperty('title');
        expect(typeof summary.formType).toBe('string');
        expect(typeof summary.title).toBe('string');
      });
    });

    it('should include optional filingFee and estimatedTime', () => {
      const summaries = getFormSummaries();
      // At least some forms should have these fields
      const formsWithFees = summaries.filter((s) => s.filingFee !== undefined);
      expect(formsWithFees.length).toBeGreaterThan(0);
    });
  });

  describe('countRequiredFields', () => {
    it('should return 0 for unknown form type', () => {
      const count = countRequiredFields('UNKNOWN');
      expect(count).toBe(0);
    });

    it('should return positive number for I-130', () => {
      const count = countRequiredFields('I-130');
      expect(count).toBeGreaterThan(0);
    });

    it('should return positive number for I-485', () => {
      const count = countRequiredFields('I-485');
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('getAIMappableFields', () => {
    it('should return empty array for unknown form', () => {
      const fields = getAIMappableFields('UNKNOWN');
      expect(fields).toEqual([]);
    });

    it('should return array of mappable fields for I-130', () => {
      const fields = getAIMappableFields('I-130');
      expect(Array.isArray(fields)).toBe(true);
    });

    it('should have correct structure for mappable fields', () => {
      const fields = getAIMappableFields('I-130');
      if (fields.length > 0) {
        fields.forEach((field) => {
          expect(field).toHaveProperty('fieldId');
          expect(field).toHaveProperty('aiFieldKey');
          expect(field).toHaveProperty('fieldLabel');
        });
      }
    });
  });
});
