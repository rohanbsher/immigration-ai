import { describe, it, expect } from 'vitest';
import {
  VISA_TYPES,
  CASE_STATUSES,
  DOCUMENT_TYPES,
  DOCUMENT_STATUSES,
  FORM_TYPES,
  FORM_STATUSES,
  schemas,
} from './index';

describe('Enum arrays', () => {
  it('VISA_TYPES is non-empty and includes visa categories and form numbers', () => {
    expect(VISA_TYPES.length).toBeGreaterThan(0);
    expect(VISA_TYPES).toContain('H1B');
    expect(VISA_TYPES).toContain('O1');
    expect(VISA_TYPES).toContain('EB2');
    expect(VISA_TYPES).toContain('I-130');
    expect(VISA_TYPES).toContain('I-485');
    expect(VISA_TYPES).toContain('other');
  });

  it('CASE_STATUSES is non-empty and includes key statuses', () => {
    expect(CASE_STATUSES.length).toBeGreaterThan(0);
    expect(CASE_STATUSES).toContain('intake');
    expect(CASE_STATUSES).toContain('filed');
    expect(CASE_STATUSES).toContain('approved');
    expect(CASE_STATUSES).toContain('denied');
    expect(CASE_STATUSES).toContain('closed');
  });

  it('DOCUMENT_TYPES is non-empty and includes key types', () => {
    expect(DOCUMENT_TYPES.length).toBeGreaterThan(0);
    expect(DOCUMENT_TYPES).toContain('passport');
    expect(DOCUMENT_TYPES).toContain('visa');
    expect(DOCUMENT_TYPES).toContain('tax_return');
    expect(DOCUMENT_TYPES).toContain('other');
  });

  it('DOCUMENT_STATUSES is non-empty and includes key statuses', () => {
    expect(DOCUMENT_STATUSES.length).toBeGreaterThan(0);
    expect(DOCUMENT_STATUSES).toContain('uploaded');
    expect(DOCUMENT_STATUSES).toContain('verified');
    expect(DOCUMENT_STATUSES).toContain('rejected');
  });

  it('FORM_TYPES is non-empty and includes I-140', () => {
    expect(FORM_TYPES.length).toBeGreaterThan(0);
    expect(FORM_TYPES).toContain('I-140');
    expect(FORM_TYPES).toContain('I-130');
    expect(FORM_TYPES).toContain('N-400');
  });

  it('FORM_STATUSES is non-empty and includes key statuses', () => {
    expect(FORM_STATUSES.length).toBeGreaterThan(0);
    expect(FORM_STATUSES).toContain('draft');
    expect(FORM_STATUSES).toContain('autofilling');
    expect(FORM_STATUSES).toContain('ai_filled');
    expect(FORM_STATUSES).toContain('filed');
  });
});

describe('Enum schemas - valid values', () => {
  it('visaType accepts valid visa types', () => {
    for (const vt of VISA_TYPES) {
      expect(schemas.visaType.safeParse(vt).success).toBe(true);
    }
  });

  it('caseStatus accepts valid case statuses', () => {
    for (const cs of CASE_STATUSES) {
      expect(schemas.caseStatus.safeParse(cs).success).toBe(true);
    }
  });

  it('documentType accepts valid document types', () => {
    for (const dt of DOCUMENT_TYPES) {
      expect(schemas.documentType.safeParse(dt).success).toBe(true);
    }
  });

  it('documentStatus accepts valid document statuses', () => {
    for (const ds of DOCUMENT_STATUSES) {
      expect(schemas.documentStatus.safeParse(ds).success).toBe(true);
    }
  });

  it('formType accepts valid form types', () => {
    for (const ft of FORM_TYPES) {
      expect(schemas.formType.safeParse(ft).success).toBe(true);
    }
  });

  it('formStatus accepts valid form statuses', () => {
    for (const fs of FORM_STATUSES) {
      expect(schemas.formStatus.safeParse(fs).success).toBe(true);
    }
  });
});

describe('Enum schemas - invalid values', () => {
  const invalidValues = ['INVALID_TYPE', '', 'foo', 'h1b', 123, null, undefined];

  it('visaType rejects invalid values', () => {
    for (const val of invalidValues) {
      expect(schemas.visaType.safeParse(val).success).toBe(false);
    }
  });

  it('caseStatus rejects invalid values', () => {
    for (const val of invalidValues) {
      expect(schemas.caseStatus.safeParse(val).success).toBe(false);
    }
  });

  it('documentType rejects invalid values', () => {
    for (const val of invalidValues) {
      expect(schemas.documentType.safeParse(val).success).toBe(false);
    }
  });

  it('documentStatus rejects invalid values', () => {
    for (const val of invalidValues) {
      expect(schemas.documentStatus.safeParse(val).success).toBe(false);
    }
  });

  it('formType rejects invalid values', () => {
    for (const val of invalidValues) {
      expect(schemas.formType.safeParse(val).success).toBe(false);
    }
  });

  it('formStatus rejects invalid values', () => {
    for (const val of invalidValues) {
      expect(schemas.formStatus.safeParse(val).success).toBe(false);
    }
  });
});
