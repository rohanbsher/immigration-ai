import { describe, it, expect } from 'vitest';
import { h1bRules } from '../rules/h1b-rules';
import { i130Rules } from '../rules/i130-rules';
import { i485Rules } from '../rules/i485-rules';
import { i140Rules } from '../rules/i140-rules';
import { commonRules } from '../rules/common-rules';
import { getRulesForVisaType, ALL_RULES } from '../rules';
import type { RFEAnalysisContext } from '../types';
import type { DocumentType } from '@/types';

function makeContext(overrides: Partial<RFEAnalysisContext> = {}): RFEAnalysisContext {
  return {
    caseId: 'test-case-id',
    visaType: 'H1B',
    caseStatus: 'document_collection',
    deadline: null,
    uploadedDocumentTypes: new Set<DocumentType>(),
    requiredDocumentTypes: new Set<DocumentType>(['passport', 'diploma', 'transcript']),
    extractedData: new Map(),
    formData: new Map(),
    formTypes: [],
    bonaFideEvidenceCount: 0,
    employerInfo: {},
    beneficiaryInfo: {},
    financialInfo: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Rule Registry
// ---------------------------------------------------------------------------

describe('Rule Registry', () => {
  it('all rules have unique IDs', () => {
    const ids = ALL_RULES.map((r) => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all rules have required fields', () => {
    for (const rule of ALL_RULES) {
      expect(rule.id).toBeTruthy();
      expect(rule.visaTypes.length).toBeGreaterThan(0);
      expect(rule.category).toBeTruthy();
      expect(rule.severity).toBeTruthy();
      expect(rule.title).toBeTruthy();
      expect(rule.description).toBeTruthy();
      expect(rule.recommendation).toBeTruthy();
      expect(typeof rule.evaluate).toBe('function');
    }
  });

  it('getRulesForVisaType returns H-1B specific and common rules for H1B', () => {
    const rules = getRulesForVisaType('H1B');
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.some((r) => r.id.startsWith('H1B-'))).toBe(true);
    expect(rules.some((r) => r.id.startsWith('COMMON-'))).toBe(true);
  });

  it('getRulesForVisaType returns I-130 specific and common rules for I-130', () => {
    const rules = getRulesForVisaType('I-130');
    expect(rules.some((r) => r.id.startsWith('I130-'))).toBe(true);
    expect(rules.some((r) => r.id.startsWith('COMMON-'))).toBe(true);
  });

  it('getRulesForVisaType returns I-485 rules for I-485', () => {
    const rules = getRulesForVisaType('I-485');
    expect(rules.some((r) => r.id === 'I485-MED-001')).toBe(true);
  });

  it('getRulesForVisaType returns I-140/EB rules for EB2', () => {
    const rules = getRulesForVisaType('EB2');
    expect(rules.some((r) => r.id.startsWith('I140-'))).toBe(true);
  });

  it('returns empty for unknown visa type', () => {
    const rules = getRulesForVisaType('other');
    // 'other' is not in any rule's visaTypes array
    expect(rules.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// H-1B Rules
// ---------------------------------------------------------------------------

describe('H1B-EER-001: Staffing firm without end-client docs', () => {
  const rule = h1bRules.find((r) => r.id === 'H1B-EER-001')!;

  it('does not trigger for non-staffing firms', () => {
    const ctx = makeContext({ employerInfo: { isStaffingFirm: false } });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(false);
  });

  it('triggers for staffing firm with no employment letter', () => {
    const ctx = makeContext({
      employerInfo: { isStaffingFirm: true },
      uploadedDocumentTypes: new Set<DocumentType>(),
      extractedData: new Map(),
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(true);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it('does not trigger for staffing firm with employment letter', () => {
    const ctx = makeContext({
      employerInfo: { isStaffingFirm: true },
      uploadedDocumentTypes: new Set<DocumentType>(['employment_letter']),
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(false);
  });
});

describe('H1B-WAGE-001: Wage Level I with experienced beneficiary', () => {
  const rule = h1bRules.find((r) => r.id === 'H1B-WAGE-001')!;

  it('does not trigger when beneficiary has < 5 years experience', () => {
    const ctx = makeContext({ beneficiaryInfo: { yearsOfExperience: 3 } });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(false);
  });

  it('does not trigger when experience is undefined', () => {
    const ctx = makeContext({ beneficiaryInfo: {} });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(false);
  });

  it('triggers when 5+ years and Level I wage', () => {
    const formData = new Map<string, Record<string, unknown>>();
    formData.set('I-129', { wage_level: 'Level I' });
    const ctx = makeContext({
      beneficiaryInfo: { yearsOfExperience: 8 },
      formData,
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(true);
    expect(result.evidence.some((e) => e.includes('8 years'))).toBe(true);
  });

  it('does not trigger when 5+ years and Level II wage', () => {
    const formData = new Map<string, Record<string, unknown>>();
    formData.set('I-129', { wage_level: 'Level II' });
    const ctx = makeContext({
      beneficiaryInfo: { yearsOfExperience: 10 },
      formData,
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// I-130 Rules
// ---------------------------------------------------------------------------

describe('I130-BONA-001: Bona fide marriage evidence', () => {
  const rule = i130Rules.find((r) => r.id === 'I130-BONA-001')!;

  it('triggers when fewer than 4 evidence categories', () => {
    const ctx = makeContext({
      visaType: 'I-130',
      bonaFideEvidenceCount: 2,
      uploadedDocumentTypes: new Set<DocumentType>(['marriage_certificate', 'photo']),
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(true);
    expect(result.evidence.some((e) => e.includes('2 category'))).toBe(true);
  });

  it('does not trigger with 4+ evidence categories', () => {
    const ctx = makeContext({
      visaType: 'I-130',
      bonaFideEvidenceCount: 4,
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(false);
  });

  it('lists specific missing evidence when triggered', () => {
    const ctx = makeContext({
      visaType: 'I-130',
      bonaFideEvidenceCount: 1,
      uploadedDocumentTypes: new Set<DocumentType>(['marriage_certificate']),
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(true);
    expect(result.evidence.some((e) => e.includes('Joint bank statements'))).toBe(true);
    expect(result.evidence.some((e) => e.includes('Joint tax return'))).toBe(true);
  });
});

describe('I130-BONA-002: Joint financial account', () => {
  const rule = i130Rules.find((r) => r.id === 'I130-BONA-002')!;

  it('triggers when no bank statements uploaded', () => {
    const ctx = makeContext({
      visaType: 'I-130',
      uploadedDocumentTypes: new Set<DocumentType>(),
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(true);
  });

  it('does not trigger when bank statements uploaded', () => {
    const ctx = makeContext({
      visaType: 'I-130',
      uploadedDocumentTypes: new Set<DocumentType>(['bank_statement']),
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// I-485 Rules
// ---------------------------------------------------------------------------

describe('I485-MED-001: Medical exam missing', () => {
  const rule = i485Rules.find((r) => r.id === 'I485-MED-001')!;

  it('triggers when medical_exam is not uploaded', () => {
    const ctx = makeContext({
      visaType: 'I-485',
      uploadedDocumentTypes: new Set<DocumentType>(),
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('does not trigger when medical_exam is uploaded', () => {
    const ctx = makeContext({
      visaType: 'I-485',
      uploadedDocumentTypes: new Set<DocumentType>(['medical_exam']),
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(false);
  });
});

describe('I485-SUPPORT-001: Income below FPG', () => {
  const rule = i485Rules.find((r) => r.id === 'I485-SUPPORT-001')!;

  it('triggers when income is below 125% FPG', () => {
    const ctx = makeContext({
      visaType: 'I-485',
      financialInfo: {
        sponsorIncome: 20000,
        householdSize: 3,
      },
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(true);
    expect(result.evidence.some((e) => e.includes('Shortfall'))).toBe(true);
  });

  it('does not trigger when income is sufficient', () => {
    const ctx = makeContext({
      visaType: 'I-485',
      financialInfo: {
        sponsorIncome: 80000,
        householdSize: 2,
      },
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(false);
  });

  it('does not trigger when financial data is missing', () => {
    const ctx = makeContext({ visaType: 'I-485', financialInfo: {} });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(false);
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('calculates correct threshold for household of 4', () => {
    // 125% of FPG for household of 4 = 32150 * 1.25 = 40188
    const ctx = makeContext({
      visaType: 'I-485',
      financialInfo: {
        sponsorIncome: 40000,
        householdSize: 4,
      },
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(true);
  });
});

describe('I485-SUPPORT-002: Tax return missing', () => {
  const rule = i485Rules.find((r) => r.id === 'I485-SUPPORT-002')!;

  it('triggers when no tax return uploaded', () => {
    const ctx = makeContext({
      visaType: 'I-485',
      uploadedDocumentTypes: new Set<DocumentType>(),
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(true);
  });

  it('does not trigger when tax return is uploaded', () => {
    const ctx = makeContext({
      visaType: 'I-485',
      uploadedDocumentTypes: new Set<DocumentType>(['tax_return']),
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Common Rules
// ---------------------------------------------------------------------------

describe('COMMON-PASSPORT-001: Passport missing', () => {
  const rule = commonRules.find((r) => r.id === 'COMMON-PASSPORT-001')!;

  it('triggers when passport is required but not uploaded', () => {
    const ctx = makeContext({
      requiredDocumentTypes: new Set<DocumentType>(['passport']),
      uploadedDocumentTypes: new Set<DocumentType>(),
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('does not trigger when passport is uploaded', () => {
    const ctx = makeContext({
      requiredDocumentTypes: new Set<DocumentType>(['passport']),
      uploadedDocumentTypes: new Set<DocumentType>(['passport']),
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(false);
  });

  it('does not trigger when passport is not required', () => {
    const ctx = makeContext({
      requiredDocumentTypes: new Set<DocumentType>(),
      uploadedDocumentTypes: new Set<DocumentType>(),
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(false);
  });
});

describe('COMMON-DEADLINE-001: Deadline approaching', () => {
  const rule = commonRules.find((r) => r.id === 'COMMON-DEADLINE-001')!;

  it('does not trigger when no deadline set', () => {
    const ctx = makeContext({ deadline: null });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(false);
  });

  it('triggers when deadline is within 14 days and docs missing', () => {
    const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const ctx = makeContext({
      deadline: soon,
      requiredDocumentTypes: new Set<DocumentType>(['passport', 'diploma']),
      uploadedDocumentTypes: new Set<DocumentType>(),
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(true);
  });

  it('does not trigger when deadline is far away', () => {
    const farAway = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const ctx = makeContext({
      deadline: farAway,
      requiredDocumentTypes: new Set<DocumentType>(['passport']),
      uploadedDocumentTypes: new Set<DocumentType>(),
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(false);
  });

  it('does not trigger when deadline is near but all docs uploaded', () => {
    const soon = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const ctx = makeContext({
      deadline: soon,
      requiredDocumentTypes: new Set<DocumentType>(['passport']),
      uploadedDocumentTypes: new Set<DocumentType>(['passport']),
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// I-140 Rules
// ---------------------------------------------------------------------------

describe('I140-PAY-001: Employer net income', () => {
  const rule = i140Rules.find((r) => r.id === 'I140-PAY-001')!;

  it('triggers when net income is zero or negative', () => {
    const ctx = makeContext({
      visaType: 'EB2',
      employerInfo: { netIncome: -5000 },
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(true);
  });

  it('does not trigger when net income is positive', () => {
    const ctx = makeContext({
      visaType: 'EB2',
      employerInfo: { netIncome: 100000 },
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(false);
  });

  it('does not trigger when financial data unavailable', () => {
    const ctx = makeContext({
      visaType: 'EB2',
      employerInfo: {},
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(false);
    expect(result.confidence).toBeLessThan(0.5);
  });
});

describe('I140-EDU-001: Degree/diploma missing', () => {
  const rule = i140Rules.find((r) => r.id === 'I140-EDU-001')!;

  it('triggers when neither diploma nor transcript uploaded', () => {
    const ctx = makeContext({
      visaType: 'EB2',
      uploadedDocumentTypes: new Set<DocumentType>(),
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(true);
  });

  it('does not trigger when diploma is uploaded', () => {
    const ctx = makeContext({
      visaType: 'EB2',
      uploadedDocumentTypes: new Set<DocumentType>(['diploma']),
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(false);
  });

  it('triggers with lower confidence when only transcript uploaded', () => {
    const ctx = makeContext({
      visaType: 'EB2',
      uploadedDocumentTypes: new Set<DocumentType>(['transcript']),
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(true);
    expect(result.confidence).toBeLessThan(0.85);
  });
});
