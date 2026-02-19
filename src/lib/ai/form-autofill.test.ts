import { describe, it, expect, vi } from 'vitest';

vi.mock('./anthropic', () => ({
  generateFormAutofill: vi.fn(),
  validateFormData: vi.fn(),
  analyzeDataConsistency: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  }),
}));

import {
  mapExtractedFieldToFormField,
  getRequiredDocuments,
  getUnfilledRequiredFields,
  calculateFormCompletion,
  getAutofillGaps,
} from './form-autofill';
import { ExtractedField, FormField } from './types';

const ALL_FORM_TYPES = [
  'I-129', 'I-130', 'I-131', 'I-140', 'I-485',
  'I-539', 'I-765', 'I-20', 'DS-160', 'N-400', 'G-1145',
];

describe('mapExtractedFieldToFormField', () => {
  const createExtractedField = (fieldName: string, value: string | null = 'test'): ExtractedField => ({
    field_name: fieldName,
    value,
    confidence: 0.95,
    source_location: 'passport',
    requires_verification: false,
  });

  describe('returns a mapping for all 11 form types', () => {
    it.each(ALL_FORM_TYPES)(
      'returns a mapping for given_name field on %s',
      (formType) => {
        const field = createExtractedField('given_name', 'John');
        const result = mapExtractedFieldToFormField(field, formType);
        expect(result).not.toBeNull();
        expect(result!.field_id).toBeTruthy();
      }
    );
  });

  describe('specific passport field mappings', () => {
    it('maps given_name correctly for I-129', () => {
      const field = createExtractedField('given_name', 'Jane');
      const result = mapExtractedFieldToFormField(field, 'I-129');
      expect(result).not.toBeNull();
      expect(result!.field_id).toBe('beneficiary_first_name');
      expect(result!.suggested_value).toBe('Jane');
      expect(result!.confidence).toBe(0.95);
    });

    it('maps given_name correctly for I-485', () => {
      const field = createExtractedField('given_name', 'Jane');
      const result = mapExtractedFieldToFormField(field, 'I-485');
      expect(result).not.toBeNull();
      expect(result!.field_id).toBe('pt1_given_name');
    });

    it('maps given_name correctly for I-20', () => {
      const field = createExtractedField('given_name', 'Jane');
      const result = mapExtractedFieldToFormField(field, 'I-20');
      expect(result).not.toBeNull();
      expect(result!.field_id).toBe('student_first_name');
    });

    it('maps given_name correctly for DS-160', () => {
      const field = createExtractedField('given_name', 'Jane');
      const result = mapExtractedFieldToFormField(field, 'DS-160');
      expect(result).not.toBeNull();
      expect(result!.field_id).toBe('first_name');
    });

    it('maps given_name correctly for G-1145', () => {
      const field = createExtractedField('given_name', 'Jane');
      const result = mapExtractedFieldToFormField(field, 'G-1145');
      expect(result).not.toBeNull();
      expect(result!.field_id).toBe('applicant_first_name');
    });

    it('maps surname correctly for I-130', () => {
      const field = createExtractedField('surname', 'Doe');
      const result = mapExtractedFieldToFormField(field, 'I-130');
      expect(result).not.toBeNull();
      expect(result!.field_id).toBe('pt2_family_name');
    });

    it('maps surname correctly for I-539', () => {
      const field = createExtractedField('surname', 'Doe');
      const result = mapExtractedFieldToFormField(field, 'I-539');
      expect(result).not.toBeNull();
      expect(result!.field_id).toBe('applicant_last_name');
    });

    it('maps surname correctly for N-400', () => {
      const field = createExtractedField('surname', 'Doe');
      const result = mapExtractedFieldToFormField(field, 'N-400');
      expect(result).not.toBeNull();
      expect(result!.field_id).toBe('pt2_family_name');
    });

    it('maps date_of_birth correctly for I-140', () => {
      const field = createExtractedField('date_of_birth', '1990-01-01');
      const result = mapExtractedFieldToFormField(field, 'I-140');
      expect(result).not.toBeNull();
      expect(result!.field_id).toBe('pt4_dob');
    });

    it('maps passport_number correctly for I-765', () => {
      const field = createExtractedField('passport_number', 'AB1234567');
      const result = mapExtractedFieldToFormField(field, 'I-765');
      expect(result).not.toBeNull();
      expect(result!.field_id).toBe('pt2_passport_number');
    });

    it('maps i94_number correctly for I-131', () => {
      const field = createExtractedField('i94_number', '12345678901');
      const result = mapExtractedFieldToFormField(field, 'I-131');
      expect(result).not.toBeNull();
      expect(result!.field_id).toBe('pt1_i94_number');
    });
  });

  describe('cross-document source mappings', () => {
    it('maps employer_name from employment letter for I-129', () => {
      const field = createExtractedField('employer_name', 'Acme Corp');
      const result = mapExtractedFieldToFormField(field, 'I-129');
      expect(result).not.toBeNull();
      expect(result!.field_id).toBe('petitioner_company_name');
    });

    it('maps job_title from employment letter for I-485', () => {
      const field = createExtractedField('job_title', 'Software Engineer');
      const result = mapExtractedFieldToFormField(field, 'I-485');
      expect(result).not.toBeNull();
      expect(result!.field_id).toBe('pt4_occupation');
    });

    it('maps degree_type from diploma for I-20', () => {
      const field = createExtractedField('degree_type', 'Master of Science');
      const result = mapExtractedFieldToFormField(field, 'I-20');
      expect(result).not.toBeNull();
      expect(result!.field_id).toBe('education_level');
    });

    it('maps father_name from birth certificate for DS-160', () => {
      const field = createExtractedField('father_name', 'John Sr.');
      const result = mapExtractedFieldToFormField(field, 'DS-160');
      expect(result).not.toBeNull();
      expect(result!.field_id).toBe('father_last_name');
    });

    it('maps date_of_marriage from marriage certificate for N-400', () => {
      const field = createExtractedField('date_of_marriage', '2020-06-15');
      const result = mapExtractedFieldToFormField(field, 'N-400');
      expect(result).not.toBeNull();
      expect(result!.field_id).toBe('pt6_marriage_date');
    });
  });

  describe('unknown form type or unmapped field', () => {
    it('returns null for unknown form type', () => {
      const field = createExtractedField('given_name', 'Jane');
      const result = mapExtractedFieldToFormField(field, 'UNKNOWN');
      expect(result).toBeNull();
    });

    it('returns null for unmapped field name', () => {
      const field = createExtractedField('nonexistent_field', 'value');
      const result = mapExtractedFieldToFormField(field, 'I-129');
      expect(result).toBeNull();
    });
  });

  describe('result structure', () => {
    it('returns properly structured FormField', () => {
      const field: ExtractedField = {
        field_name: 'given_name',
        value: 'Jane',
        confidence: 0.92,
        source_location: 'passport: name field',
        requires_verification: true,
      };
      const result = mapExtractedFieldToFormField(field, 'I-129');
      expect(result).not.toBeNull();
      expect(result!.field_id).toBe('beneficiary_first_name');
      expect(result!.field_name).toBe('given_name');
      expect(result!.field_type).toBe('text');
      expect(result!.suggested_value).toBe('Jane');
      expect(result!.confidence).toBe(0.92);
      expect(result!.source_document).toBe('passport: name field');
      expect(result!.requires_review).toBe(true);
    });
  });
});

describe('getRequiredDocuments', () => {
  describe('returns non-empty arrays for all 11 form types', () => {
    it.each(ALL_FORM_TYPES)(
      'returns non-empty document list for %s',
      (formType) => {
        const docs = getRequiredDocuments(formType);
        expect(Array.isArray(docs)).toBe(true);
        expect(docs.length).toBeGreaterThan(0);
      }
    );
  });

  it('returns passport as required for I-129', () => {
    const docs = getRequiredDocuments('I-129');
    expect(docs.some((d) => d.toLowerCase().includes('passport'))).toBe(true);
  });

  it('returns empty array for unknown form type', () => {
    const docs = getRequiredDocuments('UNKNOWN');
    expect(docs).toEqual([]);
  });

  it('G-1145 returns a minimal document list', () => {
    const docs = getRequiredDocuments('G-1145');
    expect(docs).toHaveLength(1);
    expect(docs[0].toLowerCase()).toContain('no supporting documents');
  });

  it('I-485 requires medical examination', () => {
    const docs = getRequiredDocuments('I-485');
    expect(docs.some((d) => d.toLowerCase().includes('medical'))).toBe(true);
  });

  it('I-20 requires financial documents', () => {
    const docs = getRequiredDocuments('I-20');
    expect(docs.some((d) => d.toLowerCase().includes('financial'))).toBe(true);
  });
});

describe('getUnfilledRequiredFields', () => {
  describe('returns arrays for all 11 form types', () => {
    it.each(ALL_FORM_TYPES)(
      'returns required fields list for %s with no filled fields',
      (formType) => {
        const unfilled = getUnfilledRequiredFields(formType, []);
        expect(Array.isArray(unfilled)).toBe(true);
        expect(unfilled.length).toBeGreaterThan(0);
      }
    );
  });

  it('returns empty array for unknown form type', () => {
    const unfilled = getUnfilledRequiredFields('UNKNOWN', []);
    expect(unfilled).toEqual([]);
  });

  it('reduces unfilled count when fields are provided', () => {
    const allUnfilled = getUnfilledRequiredFields('I-129', []);
    const withSomeFilled = getUnfilledRequiredFields('I-129', [
      {
        field_id: 'petitioner_company_name',
        field_name: 'petitioner_company_name',
        field_type: 'text',
        suggested_value: 'Acme Corp',
      },
      {
        field_id: 'job_title',
        field_name: 'job_title',
        field_type: 'text',
        suggested_value: 'Engineer',
      },
    ]);
    expect(withSomeFilled.length).toBeLessThan(allUnfilled.length);
  });

  it('G-1145 requires applicant name and email', () => {
    const unfilled = getUnfilledRequiredFields('G-1145', []);
    expect(unfilled).toContain('applicant_name');
    expect(unfilled).toContain('email_address');
  });

  it('DS-160 requires passport and visa info', () => {
    const unfilled = getUnfilledRequiredFields('DS-160', []);
    expect(unfilled).toContain('passport_number');
    expect(unfilled).toContain('visa_type');
  });
});

describe('calculateFormCompletion', () => {
  describe('returns valid percentages for all 11 form types', () => {
    it.each(ALL_FORM_TYPES)(
      'returns valid completion for %s with no filled fields',
      (formType) => {
        const result = calculateFormCompletion(formType, []);
        expect(result.percentage).toBe(0);
        expect(result.filledCount).toBe(0);
        expect(result.totalRequired).toBeGreaterThan(0);
        expect(result.highConfidenceCount).toBe(0);
      }
    );
  });

  it('calculates percentage based on filled fields', () => {
    const fields: FormField[] = [
      {
        field_id: 'f1',
        field_name: 'name',
        field_type: 'text',
        suggested_value: 'John',
        confidence: 0.95,
      },
      {
        field_id: 'f2',
        field_name: 'dob',
        field_type: 'date',
        suggested_value: '1990-01-01',
        confidence: 0.9,
      },
    ];
    const result = calculateFormCompletion('I-129', fields);
    expect(result.filledCount).toBe(2);
    expect(result.highConfidenceCount).toBe(2);
    expect(result.percentage).toBeGreaterThan(0);
    expect(result.percentage).toBeLessThanOrEqual(100);
  });

  it('counts high-confidence fields correctly', () => {
    const fields: FormField[] = [
      {
        field_id: 'f1',
        field_name: 'name',
        field_type: 'text',
        suggested_value: 'John',
        confidence: 0.95,
      },
      {
        field_id: 'f2',
        field_name: 'dob',
        field_type: 'date',
        suggested_value: '1990-01-01',
        confidence: 0.5,
      },
      {
        field_id: 'f3',
        field_name: 'place',
        field_type: 'text',
        suggested_value: 'NY',
        confidence: 0.85,
      },
    ];
    const result = calculateFormCompletion('I-130', fields);
    expect(result.filledCount).toBe(3);
    expect(result.highConfidenceCount).toBe(2);
  });

  it('caps percentage at 100', () => {
    const manyFields: FormField[] = Array.from({ length: 200 }, (_, i) => ({
      field_id: `f${i}`,
      field_name: `field_${i}`,
      field_type: 'text' as const,
      suggested_value: `value_${i}`,
      confidence: 0.9,
    }));
    const result = calculateFormCompletion('G-1145', manyFields);
    expect(result.percentage).toBe(100);
  });

  it('counts current_value fields as filled', () => {
    const fields: FormField[] = [
      {
        field_id: 'f1',
        field_name: 'name',
        field_type: 'text',
        current_value: 'John',
        confidence: 0.8,
      },
    ];
    const result = calculateFormCompletion('I-140', fields);
    expect(result.filledCount).toBe(1);
  });

  it('returns fallback for unknown form type', () => {
    const result = calculateFormCompletion('UNKNOWN', []);
    expect(result.totalRequired).toBe(20);
    expect(result.percentage).toBe(0);
  });
});

describe('getAutofillGaps', () => {
  it('identifies missing utility bills for I-485 address history', () => {
    const gaps = getAutofillGaps('I-485', [], ['passport']);
    const utilityGap = gaps.find(g => g.missingDocType === 'utility_bill');
    expect(utilityGap).toBeDefined();
    expect(utilityGap!.priority).toBe('high');
    expect(utilityGap!.fieldCount).toBeGreaterThan(0);
  });

  it('excludes gaps for already-uploaded document types', () => {
    const gaps = getAutofillGaps('I-485', [], ['passport', 'utility_bill', 'w2', 'i94', 'birth_certificate', 'marriage_certificate']);
    expect(gaps).toHaveLength(0);
  });

  it('excludes gaps when fields are already filled', () => {
    const allFields = ['address_history_0_street', 'address_history_0_city', 'address_history_0_state', 'address_history_0_zip', 'address_history_0_country', 'address_history_0_from_date', 'address_history_0_to_date', 'address_history_1_street', 'address_history_1_city', 'address_history_1_state', 'address_history_1_zip'];
    const gaps = getAutofillGaps('I-485', allFields, []);
    const utilityGap = gaps.find(g => g.missingDocType === 'utility_bill');
    expect(utilityGap).toBeUndefined();
  });

  it('returns empty array for unknown form types', () => {
    expect(getAutofillGaps('UNKNOWN-FORM', [], [])).toEqual([]);
  });

  it('sorts high priority before medium', () => {
    const gaps = getAutofillGaps('I-485', [], []);
    const priorities = gaps.map(g => g.priority);
    const highIdx = priorities.indexOf('high');
    const mediumIdx = priorities.indexOf('medium');
    if (highIdx !== -1 && mediumIdx !== -1) {
      expect(highIdx).toBeLessThan(mediumIdx);
    }
  });

  it('works for N-400 form type', () => {
    const gaps = getAutofillGaps('N-400', [], []);
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps.some(g => g.missingDocType === 'utility_bill')).toBe(true);
  });

  it('works for I-130 form type', () => {
    const gaps = getAutofillGaps('I-130', [], []);
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps.some(g => g.missingDocType === 'birth_certificate')).toBe(true);
  });
});
