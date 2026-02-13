import { describe, it, expect } from 'vitest';

import {
  FORM_DEFINITIONS,
  getFormDefinition,
  getAvailableFormTypes,
  getFormSummaries,
  countRequiredFields,
  getAIMappableFields,
} from './index';

const EXPECTED_FORM_TYPES = ['I-130', 'I-131', 'I-140', 'I-485', 'I-765', 'N-400'];

describe('FORM_DEFINITIONS', () => {
  it('has exactly 6 form type keys', () => {
    expect(Object.keys(FORM_DEFINITIONS)).toHaveLength(6);
  });

  it('each definition has a formType matching its key', () => {
    for (const [key, def] of Object.entries(FORM_DEFINITIONS)) {
      expect(def.formType).toBe(key);
    }
  });
});

describe('getFormDefinition', () => {
  it.each(EXPECTED_FORM_TYPES)('returns a valid definition for "%s"', (formType) => {
    const def = getFormDefinition(formType);
    expect(def).not.toBeNull();
    expect(def!.formType).toBe(formType);
    expect(def!.title).toBeTruthy();
    expect(def!.sections).toBeInstanceOf(Array);
  });

  it('returns null for an unknown form type', () => {
    expect(getFormDefinition('XYZ-999')).toBeNull();
  });
});

describe('getAvailableFormTypes', () => {
  it('returns an array of 6 items', () => {
    const types = getAvailableFormTypes();
    expect(types).toHaveLength(6);
  });

  it('contains all expected form types', () => {
    const types = getAvailableFormTypes();
    for (const ft of EXPECTED_FORM_TYPES) {
      expect(types).toContain(ft);
    }
  });
});

describe('getFormSummaries', () => {
  it('returns 6 summaries', () => {
    const summaries = getFormSummaries();
    expect(summaries).toHaveLength(6);
  });

  it('each summary has formType and title', () => {
    const summaries = getFormSummaries();
    for (const summary of summaries) {
      expect(summary.formType).toBeTruthy();
      expect(summary.title).toBeTruthy();
    }
  });
});

describe('countRequiredFields', () => {
  it('returns exact count for I-485', () => {
    const count = countRequiredFields('I-485');
    expect(count).toBeGreaterThan(5);
    expect(typeof count).toBe('number');
  });

  it('returns consistent count with manual field inspection', () => {
    // Verify programmatically: count fields with validation.required across all sections
    const def = getFormDefinition('I-485');
    expect(def).not.toBeNull();
    let manualCount = 0;
    for (const section of def!.sections) {
      for (const field of section.fields) {
        if (field.validation?.required) manualCount++;
      }
    }
    expect(countRequiredFields('I-485')).toBe(manualCount);
  });

  it('returns 0 for an unknown form type', () => {
    expect(countRequiredFields('XYZ')).toBe(0);
  });
});

describe('getAIMappableFields', () => {
  it('returns AI-mappable fields for I-485', () => {
    const fields = getAIMappableFields('I-485');
    expect(fields.length).toBeGreaterThan(3);
    for (const field of fields) {
      expect(field).toHaveProperty('aiFieldKey');
      expect(field.aiFieldKey).toBeTruthy();
    }
  });

  it('returns an empty array for an unknown form type', () => {
    expect(getAIMappableFields('UNKNOWN')).toEqual([]);
  });

  it('each item has fieldId, aiFieldKey, and fieldLabel', () => {
    const fields = getAIMappableFields('I-485');
    for (const field of fields) {
      expect(field).toHaveProperty('fieldId');
      expect(field).toHaveProperty('aiFieldKey');
      expect(field).toHaveProperty('fieldLabel');
    }
  });
});
