import { describe, it, expect } from 'vitest';
import {
  getExtractionPrompt,
  getAutofillPrompt,
  DOCUMENT_ANALYSIS_SYSTEM_PROMPT,
  GENERIC_DOCUMENT_EXTRACTION_PROMPT,
  PASSPORT_EXTRACTION_PROMPT,
  BIRTH_CERTIFICATE_EXTRACTION_PROMPT,
  MARRIAGE_CERTIFICATE_EXTRACTION_PROMPT,
  EMPLOYMENT_LETTER_EXTRACTION_PROMPT,
  BANK_STATEMENT_EXTRACTION_PROMPT,
  TAX_RETURN_EXTRACTION_PROMPT,
  MEDICAL_EXAM_EXTRACTION_PROMPT,
  POLICE_CLEARANCE_EXTRACTION_PROMPT,
  DIVORCE_CERTIFICATE_EXTRACTION_PROMPT,
  I94_EXTRACTION_PROMPT,
  W2_EXTRACTION_PROMPT,
  PAY_STUB_EXTRACTION_PROMPT,
  DIPLOMA_EXTRACTION_PROMPT,
  TRANSCRIPT_EXTRACTION_PROMPT,
  RECOMMENDATION_LETTER_EXTRACTION_PROMPT,
  PHOTO_VALIDATION_PROMPT,
  UTILITY_BILL_EXTRACTION_PROMPT,
  FORM_AUTOFILL_SYSTEM_PROMPT,
  I129_AUTOFILL_PROMPT,
  I130_AUTOFILL_PROMPT,
  I131_AUTOFILL_PROMPT,
  I140_AUTOFILL_PROMPT,
  I485_AUTOFILL_PROMPT,
  I539_AUTOFILL_PROMPT,
  I765_AUTOFILL_PROMPT,
  I20_AUTOFILL_PROMPT,
  DS160_AUTOFILL_PROMPT,
  N400_AUTOFILL_PROMPT,
  G1145_AUTOFILL_PROMPT,
} from './prompts';

describe('Extraction Prompts', () => {
  describe('getExtractionPrompt returns correct prompt for each document type', () => {
    const originalDocTypes: Record<string, string> = {
      passport: 'PASSPORT_EXTRACTION_PROMPT',
      birth_certificate: 'BIRTH_CERTIFICATE_EXTRACTION_PROMPT',
      marriage_certificate: 'MARRIAGE_CERTIFICATE_EXTRACTION_PROMPT',
      employment_letter: 'EMPLOYMENT_LETTER_EXTRACTION_PROMPT',
      bank_statement: 'BANK_STATEMENT_EXTRACTION_PROMPT',
      tax_return: 'TAX_RETURN_EXTRACTION_PROMPT',
      medical_exam: 'MEDICAL_EXAM_EXTRACTION_PROMPT',
      police_clearance: 'POLICE_CLEARANCE_EXTRACTION_PROMPT',
      divorce_certificate: 'DIVORCE_CERTIFICATE_EXTRACTION_PROMPT',
    };

    it.each(Object.entries(originalDocTypes))(
      'getExtractionPrompt("%s") returns the correct prompt',
      (docType) => {
        const result = getExtractionPrompt(docType);
        expect(result).not.toBe(GENERIC_DOCUMENT_EXTRACTION_PROMPT);
        expect(result.length).toBeGreaterThan(0);
      }
    );
  });

  describe('8 new extraction prompts are correctly registered', () => {
    it('getExtractionPrompt("i94") returns I94_EXTRACTION_PROMPT', () => {
      expect(getExtractionPrompt('i94')).toBe(I94_EXTRACTION_PROMPT);
      expect(getExtractionPrompt('i94')).not.toBe(GENERIC_DOCUMENT_EXTRACTION_PROMPT);
    });

    it('getExtractionPrompt("w2") returns W2_EXTRACTION_PROMPT', () => {
      expect(getExtractionPrompt('w2')).toBe(W2_EXTRACTION_PROMPT);
      expect(getExtractionPrompt('w2')).not.toBe(GENERIC_DOCUMENT_EXTRACTION_PROMPT);
    });

    it('getExtractionPrompt("pay_stub") returns PAY_STUB_EXTRACTION_PROMPT', () => {
      expect(getExtractionPrompt('pay_stub')).toBe(PAY_STUB_EXTRACTION_PROMPT);
      expect(getExtractionPrompt('pay_stub')).not.toBe(GENERIC_DOCUMENT_EXTRACTION_PROMPT);
    });

    it('getExtractionPrompt("diploma") returns DIPLOMA_EXTRACTION_PROMPT', () => {
      expect(getExtractionPrompt('diploma')).toBe(DIPLOMA_EXTRACTION_PROMPT);
      expect(getExtractionPrompt('diploma')).not.toBe(GENERIC_DOCUMENT_EXTRACTION_PROMPT);
    });

    it('getExtractionPrompt("transcript") returns TRANSCRIPT_EXTRACTION_PROMPT', () => {
      expect(getExtractionPrompt('transcript')).toBe(TRANSCRIPT_EXTRACTION_PROMPT);
      expect(getExtractionPrompt('transcript')).not.toBe(GENERIC_DOCUMENT_EXTRACTION_PROMPT);
    });

    it('getExtractionPrompt("recommendation_letter") returns RECOMMENDATION_LETTER_EXTRACTION_PROMPT', () => {
      expect(getExtractionPrompt('recommendation_letter')).toBe(RECOMMENDATION_LETTER_EXTRACTION_PROMPT);
      expect(getExtractionPrompt('recommendation_letter')).not.toBe(GENERIC_DOCUMENT_EXTRACTION_PROMPT);
    });

    it('getExtractionPrompt("photo") returns PHOTO_VALIDATION_PROMPT', () => {
      expect(getExtractionPrompt('photo')).toBe(PHOTO_VALIDATION_PROMPT);
      expect(getExtractionPrompt('photo')).not.toBe(GENERIC_DOCUMENT_EXTRACTION_PROMPT);
    });

    it('getExtractionPrompt("utility_bill") returns UTILITY_BILL_EXTRACTION_PROMPT', () => {
      expect(getExtractionPrompt('utility_bill')).toBe(UTILITY_BILL_EXTRACTION_PROMPT);
      expect(getExtractionPrompt('utility_bill')).not.toBe(GENERIC_DOCUMENT_EXTRACTION_PROMPT);
    });
  });

  describe('total extraction prompt count', () => {
    it('has exactly 17 registered extraction prompts (9 original + 8 new)', () => {
      const allDocTypes = [
        'passport', 'birth_certificate', 'marriage_certificate',
        'employment_letter', 'bank_statement', 'tax_return',
        'medical_exam', 'police_clearance', 'divorce_certificate',
        'i94', 'w2', 'pay_stub', 'diploma', 'transcript',
        'recommendation_letter', 'photo', 'utility_bill',
      ];

      expect(allDocTypes).toHaveLength(17);

      for (const docType of allDocTypes) {
        const prompt = getExtractionPrompt(docType);
        expect(prompt).not.toBe(GENERIC_DOCUMENT_EXTRACTION_PROMPT);
      }
    });
  });

  describe('unknown document type falls back to generic', () => {
    it('getExtractionPrompt("unknown_type") returns GENERIC_DOCUMENT_EXTRACTION_PROMPT', () => {
      expect(getExtractionPrompt('unknown_type')).toBe(GENERIC_DOCUMENT_EXTRACTION_PROMPT);
    });

    it('getExtractionPrompt("") returns GENERIC_DOCUMENT_EXTRACTION_PROMPT', () => {
      expect(getExtractionPrompt('')).toBe(GENERIC_DOCUMENT_EXTRACTION_PROMPT);
    });
  });
});

describe('Autofill Prompts', () => {
  describe('getAutofillPrompt returns correct prompt for each form type', () => {
    it('getAutofillPrompt("I-129") returns I129_AUTOFILL_PROMPT', () => {
      expect(getAutofillPrompt('I-129')).toBe(I129_AUTOFILL_PROMPT);
    });

    it('getAutofillPrompt("I-130") returns I130_AUTOFILL_PROMPT', () => {
      expect(getAutofillPrompt('I-130')).toBe(I130_AUTOFILL_PROMPT);
    });

    it('getAutofillPrompt("I-131") returns I131_AUTOFILL_PROMPT', () => {
      expect(getAutofillPrompt('I-131')).toBe(I131_AUTOFILL_PROMPT);
    });

    it('getAutofillPrompt("I-140") returns I140_AUTOFILL_PROMPT', () => {
      expect(getAutofillPrompt('I-140')).toBe(I140_AUTOFILL_PROMPT);
    });

    it('getAutofillPrompt("I-485") returns I485_AUTOFILL_PROMPT', () => {
      expect(getAutofillPrompt('I-485')).toBe(I485_AUTOFILL_PROMPT);
    });

    it('getAutofillPrompt("I-539") returns I539_AUTOFILL_PROMPT', () => {
      expect(getAutofillPrompt('I-539')).toBe(I539_AUTOFILL_PROMPT);
    });

    it('getAutofillPrompt("I-765") returns I765_AUTOFILL_PROMPT', () => {
      expect(getAutofillPrompt('I-765')).toBe(I765_AUTOFILL_PROMPT);
    });

    it('getAutofillPrompt("I-20") returns I20_AUTOFILL_PROMPT', () => {
      expect(getAutofillPrompt('I-20')).toBe(I20_AUTOFILL_PROMPT);
    });

    it('getAutofillPrompt("DS-160") returns DS160_AUTOFILL_PROMPT', () => {
      expect(getAutofillPrompt('DS-160')).toBe(DS160_AUTOFILL_PROMPT);
    });

    it('getAutofillPrompt("N-400") returns N400_AUTOFILL_PROMPT', () => {
      expect(getAutofillPrompt('N-400')).toBe(N400_AUTOFILL_PROMPT);
    });

    it('getAutofillPrompt("G-1145") returns G1145_AUTOFILL_PROMPT', () => {
      expect(getAutofillPrompt('G-1145')).toBe(G1145_AUTOFILL_PROMPT);
    });
  });

  describe('unknown form type falls back to generic', () => {
    it('getAutofillPrompt("UNKNOWN") returns FORM_AUTOFILL_SYSTEM_PROMPT (not I130)', () => {
      const result = getAutofillPrompt('UNKNOWN');
      expect(result).toBe(FORM_AUTOFILL_SYSTEM_PROMPT);
      expect(result).not.toBe(I130_AUTOFILL_PROMPT);
    });

    it('getAutofillPrompt("") returns FORM_AUTOFILL_SYSTEM_PROMPT', () => {
      expect(getAutofillPrompt('')).toBe(FORM_AUTOFILL_SYSTEM_PROMPT);
    });
  });

  describe('total autofill prompt count', () => {
    it('has exactly 11 registered autofill prompts', () => {
      const allFormTypes = [
        'I-129', 'I-130', 'I-131', 'I-140', 'I-485',
        'I-539', 'I-765', 'I-20', 'DS-160', 'N-400', 'G-1145',
      ];

      expect(allFormTypes).toHaveLength(11);

      for (const formType of allFormTypes) {
        const prompt = getAutofillPrompt(formType);
        expect(prompt).not.toBe(FORM_AUTOFILL_SYSTEM_PROMPT);
      }
    });
  });

  describe('prompt content sanity checks', () => {
    it('each extraction prompt mentions its document type', () => {
      expect(I94_EXTRACTION_PROMPT).toContain('I-94');
      expect(W2_EXTRACTION_PROMPT).toContain('W-2');
      expect(PAY_STUB_EXTRACTION_PROMPT).toContain('pay stub');
      expect(DIPLOMA_EXTRACTION_PROMPT).toContain('diploma');
      expect(TRANSCRIPT_EXTRACTION_PROMPT).toContain('transcript');
      expect(RECOMMENDATION_LETTER_EXTRACTION_PROMPT).toContain('recommendation');
      expect(PHOTO_VALIDATION_PROMPT).toContain('photograph');
      expect(UTILITY_BILL_EXTRACTION_PROMPT).toContain('utility bill');
    });

    it('each autofill prompt mentions its form type', () => {
      expect(I129_AUTOFILL_PROMPT).toContain('I-129');
      expect(I539_AUTOFILL_PROMPT).toContain('I-539');
      expect(I20_AUTOFILL_PROMPT).toContain('I-20');
      expect(DS160_AUTOFILL_PROMPT).toContain('DS-160');
      expect(G1145_AUTOFILL_PROMPT).toContain('G-1145');
    });
  });

  describe('extraction prompts include required field names', () => {
    it('passport prompt includes key fields', () => {
      const prompt = getExtractionPrompt('passport');
      expect(prompt).toContain('full_name');
      expect(prompt).toContain('passport_number');
      expect(prompt).toContain('expiry_date');
      expect(prompt).toContain('date_of_birth');
      expect(prompt).toContain('nationality');
    });

    it('birth_certificate prompt includes key fields', () => {
      const prompt = getExtractionPrompt('birth_certificate');
      expect(prompt).toContain('full_name');
      expect(prompt).toContain('date_of_birth');
      expect(prompt).toContain('father_name');
      expect(prompt).toContain('mother_name');
    });

    it('marriage_certificate prompt includes key fields', () => {
      const prompt = getExtractionPrompt('marriage_certificate');
      expect(prompt).toContain('spouse_1_name');
      expect(prompt).toContain('spouse_2_name');
      expect(prompt).toContain('date_of_marriage');
    });

    it('employment_letter prompt includes key fields', () => {
      const prompt = getExtractionPrompt('employment_letter');
      expect(prompt).toContain('employee_name');
      expect(prompt).toContain('employer_name');
      expect(prompt).toContain('job_title');
      expect(prompt).toContain('salary');
    });

    it('bank_statement prompt includes key fields', () => {
      const prompt = getExtractionPrompt('bank_statement');
      expect(prompt).toContain('account_holder');
      expect(prompt).toContain('bank_name');
      expect(prompt).toContain('ending_balance');
    });

    it('tax_return prompt includes key fields', () => {
      const prompt = getExtractionPrompt('tax_return');
      expect(prompt).toContain('taxpayer_name');
      expect(prompt).toContain('total_income');
      expect(prompt).toContain('tax_year');
    });

    it('w2 prompt includes key fields', () => {
      const prompt = getExtractionPrompt('w2');
      expect(prompt).toContain('employee_name');
      expect(prompt).toContain('employer_name');
      expect(prompt).toContain('wages_tips');
    });

    it('utility_bill prompt includes key fields', () => {
      const prompt = getExtractionPrompt('utility_bill');
      expect(prompt).toContain('account_holder_name');
      expect(prompt).toContain('service_address_street');
      expect(prompt).toContain('bill_date');
    });
  });

  describe('all extraction prompts request structured output', () => {
    const allDocTypes = [
      'passport', 'birth_certificate', 'marriage_certificate',
      'employment_letter', 'bank_statement', 'tax_return',
      'medical_exam', 'police_clearance', 'divorce_certificate',
      'i94', 'w2', 'pay_stub', 'diploma', 'transcript',
      'recommendation_letter', 'photo', 'utility_bill',
    ];

    it.each(allDocTypes)('"%s" prompt contains confidence score instruction', (docType) => {
      const prompt = getExtractionPrompt(docType);
      expect(prompt).toContain('confidence');
    });

    it.each(allDocTypes)('"%s" prompt contains JSON response structure', (docType) => {
      const prompt = getExtractionPrompt(docType);
      expect(prompt).toContain('document_type');
    });
  });

  describe('system prompts', () => {
    it('DOCUMENT_ANALYSIS_SYSTEM_PROMPT contains key instructions', () => {
      expect(DOCUMENT_ANALYSIS_SYSTEM_PROMPT).toContain('immigration');
      expect(DOCUMENT_ANALYSIS_SYSTEM_PROMPT).toContain('confidence');
      expect(DOCUMENT_ANALYSIS_SYSTEM_PROMPT).toContain('tool');
    });

    it('FORM_AUTOFILL_SYSTEM_PROMPT lists common form types', () => {
      expect(FORM_AUTOFILL_SYSTEM_PROMPT).toContain('I-130');
      expect(FORM_AUTOFILL_SYSTEM_PROMPT).toContain('I-485');
      expect(FORM_AUTOFILL_SYSTEM_PROMPT).toContain('N-400');
      expect(FORM_AUTOFILL_SYSTEM_PROMPT).toContain('USCIS');
    });
  });

  describe('autofill prompts request structured JSON output', () => {
    const allFormTypes = [
      'I-129', 'I-130', 'I-131', 'I-140', 'I-485',
      'I-539', 'I-765', 'I-20', 'DS-160', 'N-400', 'G-1145',
    ];

    it.each(allFormTypes)('"%s" prompt requests JSON with form_type', (formType) => {
      const prompt = getAutofillPrompt(formType);
      expect(prompt).toContain('form_type');
      expect(prompt).toContain('fields');
      expect(prompt).toContain('confidence');
    });

    it.each(allFormTypes)('"%s" prompt includes missing_documents field', (formType) => {
      const prompt = getAutofillPrompt(formType);
      expect(prompt).toContain('missing_documents');
    });
  });
});
