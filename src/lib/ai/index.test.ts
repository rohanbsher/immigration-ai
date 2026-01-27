import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Setup environment variables before anything else
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.OPENAI_API_KEY = 'test-openai-key';

// Use vi.hoisted to define mock state and classes that need to be accessible
// by the hoisted vi.mock calls
const { anthropicMockState, openaiMockState, AnthropicAPIError, OpenAIAPIError } = vi.hoisted(() => {
  const anthropicMockState = {
    messagesCreate: vi.fn(),
  };

  const openaiMockState = {
    completionsCreate: vi.fn(),
  };

  // Create separate error classes for each SDK to properly support instanceof checks
  class AnthropicAPIError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = 'APIError';
    }
  }

  class OpenAIAPIError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = 'APIError';
    }
  }

  return { anthropicMockState, openaiMockState, AnthropicAPIError, OpenAIAPIError };
});

// Mock the SDK modules - APIError must be a static property on the default class
// since the code uses `error instanceof Anthropic.APIError`
vi.mock('@anthropic-ai/sdk', () => {
  class Anthropic {
    messages = {
      create: (...args: unknown[]) => anthropicMockState.messagesCreate(...args),
    };
    static APIError = AnthropicAPIError;
  }
  return {
    default: Anthropic,
    APIError: AnthropicAPIError,
  };
});

vi.mock('openai', () => {
  class OpenAI {
    chat = {
      completions: {
        create: (...args: unknown[]) => openaiMockState.completionsCreate(...args),
      },
    };
    static APIError = OpenAIAPIError;
  }
  return {
    default: OpenAI,
    APIError: OpenAIAPIError,
  };
});

// Mock the storage module
vi.mock('@/lib/storage', () => ({
  storage: {
    getSignedUrl: vi.fn().mockResolvedValue('https://example.com/signed-url'),
    uploadFile: vi.fn(),
    downloadFile: vi.fn(),
    deleteFile: vi.fn(),
  },
  SIGNED_URL_EXPIRATION: {
    AI_PROCESSING: 600,
    USER_DOWNLOAD: 300,
    PREVIEW: 900,
    DEFAULT: 3600,
  },
}));

// Import the modules after mocking
import {
  getExtractionPrompt,
  getAutofillPrompt,
  DOCUMENT_ANALYSIS_SYSTEM_PROMPT,
  FORM_AUTOFILL_SYSTEM_PROMPT,
} from './prompts';
import {
  mapExtractedFieldToFormField,
  getRequiredDocuments,
  getUnfilledRequiredFields,
  calculateFormCompletion,
} from './form-autofill';
import { validateDocumentForVisa } from './document-analysis';
import type {
  ExtractedField,
  FormField,
  DocumentAnalysisResult,
} from './types';

// Helper functions for setting mock responses
function setAnthropicJsonResponse(data: unknown) {
  anthropicMockState.messagesCreate.mockResolvedValueOnce({
    content: [{ type: 'text', text: JSON.stringify(data) }],
  });
}

function setAnthropicTextResponse(text: string) {
  anthropicMockState.messagesCreate.mockResolvedValueOnce({
    content: [{ type: 'text', text }],
  });
}

function setOpenAIJsonResponse(data: unknown) {
  openaiMockState.completionsCreate.mockResolvedValueOnce({
    choices: [{ message: { content: JSON.stringify(data) } }],
  });
}

function setOpenAITextResponse(text: string) {
  openaiMockState.completionsCreate.mockResolvedValueOnce({
    choices: [{ message: { content: text } }],
  });
}

describe('AI Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    anthropicMockState.messagesCreate.mockReset();
    openaiMockState.completionsCreate.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================
  // Prompts Tests
  // ==========================================
  describe('Prompts', () => {
    describe('getExtractionPrompt', () => {
      it('should return passport prompt for passport document type', () => {
        const prompt = getExtractionPrompt('passport');
        expect(prompt).toContain('passport');
        expect(prompt).toContain('passport_number');
        expect(prompt).toContain('full_name');
      });

      it('should return birth certificate prompt for birth_certificate type', () => {
        const prompt = getExtractionPrompt('birth_certificate');
        expect(prompt).toContain('birth certificate');
        expect(prompt).toContain('father_name');
        expect(prompt).toContain('mother_name');
      });

      it('should return marriage certificate prompt for marriage_certificate type', () => {
        const prompt = getExtractionPrompt('marriage_certificate');
        expect(prompt).toContain('marriage certificate');
        expect(prompt).toContain('spouse_1_name');
        expect(prompt).toContain('spouse_2_name');
      });

      it('should return employment letter prompt for employment_letter type', () => {
        const prompt = getExtractionPrompt('employment_letter');
        expect(prompt).toContain('employment');
        expect(prompt).toContain('employer_name');
        expect(prompt).toContain('job_title');
      });

      it('should return bank statement prompt for bank_statement type', () => {
        const prompt = getExtractionPrompt('bank_statement');
        expect(prompt).toContain('bank statement');
        expect(prompt).toContain('account_holder');
        expect(prompt).toContain('ending_balance');
      });

      it('should return generic prompt for unknown document type', () => {
        const prompt = getExtractionPrompt('unknown_type');
        expect(prompt).toContain('Analyze this document');
        expect(prompt).toContain('identify the document type');
      });

      it('should return generic prompt for empty string', () => {
        const prompt = getExtractionPrompt('');
        expect(prompt).toContain('Analyze this document');
      });
    });

    describe('getAutofillPrompt', () => {
      it('should return I-130 prompt for I-130 form type', () => {
        const prompt = getAutofillPrompt('I-130');
        expect(prompt).toContain('I-130');
        expect(prompt).toContain('Petition for Alien Relative');
      });

      it('should return I-485 prompt for I-485 form type', () => {
        const prompt = getAutofillPrompt('I-485');
        expect(prompt).toContain('I-485');
        expect(prompt).toContain('Permanent Residence');
      });

      it('should return I-765 prompt for I-765 form type', () => {
        const prompt = getAutofillPrompt('I-765');
        expect(prompt).toContain('I-765');
        expect(prompt).toContain('Employment Authorization');
      });

      it('should return N-400 prompt for N-400 form type', () => {
        const prompt = getAutofillPrompt('N-400');
        expect(prompt).toContain('N-400');
        expect(prompt).toContain('Naturalization');
      });

      it('should return I-130 prompt as default for unknown form type', () => {
        const prompt = getAutofillPrompt('unknown-form');
        expect(prompt).toContain('I-130');
      });
    });

    describe('System Prompts', () => {
      it('should have DOCUMENT_ANALYSIS_SYSTEM_PROMPT defined', () => {
        expect(DOCUMENT_ANALYSIS_SYSTEM_PROMPT).toBeDefined();
        expect(typeof DOCUMENT_ANALYSIS_SYSTEM_PROMPT).toBe('string');
        expect(DOCUMENT_ANALYSIS_SYSTEM_PROMPT.length).toBeGreaterThan(100);
      });

      it('should have FORM_AUTOFILL_SYSTEM_PROMPT defined', () => {
        expect(FORM_AUTOFILL_SYSTEM_PROMPT).toBeDefined();
        expect(typeof FORM_AUTOFILL_SYSTEM_PROMPT).toBe('string');
        expect(FORM_AUTOFILL_SYSTEM_PROMPT.length).toBeGreaterThan(100);
      });

      it('DOCUMENT_ANALYSIS_SYSTEM_PROMPT should include key instructions', () => {
        expect(DOCUMENT_ANALYSIS_SYSTEM_PROMPT).toContain('immigration');
        expect(DOCUMENT_ANALYSIS_SYSTEM_PROMPT).toContain('confidence');
        expect(DOCUMENT_ANALYSIS_SYSTEM_PROMPT).toContain('JSON');
      });

      it('FORM_AUTOFILL_SYSTEM_PROMPT should include key instructions', () => {
        expect(FORM_AUTOFILL_SYSTEM_PROMPT).toContain('immigration');
        expect(FORM_AUTOFILL_SYSTEM_PROMPT).toContain('USCIS');
        expect(FORM_AUTOFILL_SYSTEM_PROMPT).toContain('JSON');
      });
    });
  });

  // ==========================================
  // Form Autofill Utility Tests
  // ==========================================
  describe('Form Autofill Utilities', () => {
    describe('mapExtractedFieldToFormField', () => {
      const mockExtractedField: ExtractedField = {
        field_name: 'full_name',
        value: 'John Doe',
        confidence: 0.95,
        source_location: 'passport page 1',
        requires_verification: false,
      };

      it('should map full_name to I-130 form field', () => {
        const result = mapExtractedFieldToFormField(mockExtractedField, 'I-130');
        expect(result).not.toBeNull();
        expect(result?.field_id).toBe('pt2_legal_name');
        expect(result?.suggested_value).toBe('John Doe');
        expect(result?.confidence).toBe(0.95);
      });

      it('should map full_name to I-485 form field', () => {
        const result = mapExtractedFieldToFormField(mockExtractedField, 'I-485');
        expect(result).not.toBeNull();
        expect(result?.field_id).toBe('pt1_current_name');
      });

      it('should map full_name to I-765 form field', () => {
        const result = mapExtractedFieldToFormField(mockExtractedField, 'I-765');
        expect(result).not.toBeNull();
        expect(result?.field_id).toBe('pt2_legal_name');
      });

      it('should map full_name to N-400 form field', () => {
        const result = mapExtractedFieldToFormField(mockExtractedField, 'N-400');
        expect(result).not.toBeNull();
        expect(result?.field_id).toBe('pt2_current_name');
      });

      it('should return null for unknown form type', () => {
        const result = mapExtractedFieldToFormField(mockExtractedField, 'UNKNOWN-FORM');
        expect(result).toBeNull();
      });

      it('should return null for unmapped field name', () => {
        const unmappedField: ExtractedField = {
          field_name: 'some_unmapped_field',
          value: 'test',
          confidence: 0.9,
          requires_verification: false,
        };
        const result = mapExtractedFieldToFormField(unmappedField, 'I-130');
        expect(result).toBeNull();
      });

      it('should handle date_of_birth mapping for I-130', () => {
        const dobField: ExtractedField = {
          field_name: 'date_of_birth',
          value: '1990-01-15',
          confidence: 0.92,
          requires_verification: false,
        };
        const result = mapExtractedFieldToFormField(dobField, 'I-130');
        expect(result).not.toBeNull();
        expect(result?.field_id).toBe('pt2_dob');
        expect(result?.suggested_value).toBe('1990-01-15');
      });

      it('should handle null value in extracted field', () => {
        const nullField: ExtractedField = {
          field_name: 'full_name',
          value: null,
          confidence: 0,
          requires_verification: true,
        };
        const result = mapExtractedFieldToFormField(nullField, 'I-130');
        expect(result).not.toBeNull();
        expect(result?.suggested_value).toBeUndefined();
      });

      it('should preserve requires_review flag from requires_verification', () => {
        const verifyField: ExtractedField = {
          field_name: 'passport_number',
          value: 'AB123456',
          confidence: 0.7,
          requires_verification: true,
        };
        const result = mapExtractedFieldToFormField(verifyField, 'I-130');
        expect(result).not.toBeNull();
        expect(result?.requires_review).toBe(true);
      });
    });

    describe('getRequiredDocuments', () => {
      it('should return required documents for I-130', () => {
        const docs = getRequiredDocuments('I-130');
        expect(docs).toBeInstanceOf(Array);
        expect(docs.length).toBeGreaterThan(0);
        expect(docs).toContain('Petitioner passport or birth certificate');
        expect(docs).toContain('Beneficiary passport');
      });

      it('should return required documents for I-485', () => {
        const docs = getRequiredDocuments('I-485');
        expect(docs).toContain('Passport');
        expect(docs).toContain('Birth certificate');
        expect(docs).toContain('Medical examination (I-693)');
      });

      it('should return required documents for I-765', () => {
        const docs = getRequiredDocuments('I-765');
        expect(docs).toContain('Passport');
        expect(docs).toContain('I-94 arrival/departure record');
      });

      it('should return required documents for N-400', () => {
        const docs = getRequiredDocuments('N-400');
        expect(docs).toContain('Green card (front and back)');
        expect(docs).toContain('Tax returns (5 years)');
      });

      it('should return empty array for unknown form type', () => {
        const docs = getRequiredDocuments('UNKNOWN-FORM');
        expect(docs).toEqual([]);
      });

      it('should ignore visaType parameter (currently unused)', () => {
        const docs1 = getRequiredDocuments('I-130');
        const docs2 = getRequiredDocuments('I-130', 'F-1');
        expect(docs1).toEqual(docs2);
      });
    });

    describe('getUnfilledRequiredFields', () => {
      const mockFilledFields: FormField[] = [
        {
          field_id: 'f1',
          field_name: 'petitioner_name',
          field_type: 'text',
          suggested_value: 'John Doe',
        },
        {
          field_id: 'f2',
          field_name: 'petitioner_dob',
          field_type: 'date',
          current_value: '1990-01-01',
        },
      ];

      it('should return unfilled fields for I-130', () => {
        const unfilled = getUnfilledRequiredFields('I-130', mockFilledFields);
        expect(unfilled).toBeInstanceOf(Array);
        expect(unfilled).toContain('petitioner_address');
        expect(unfilled).toContain('beneficiary_name');
        expect(unfilled).not.toContain('petitioner_name');
        expect(unfilled).not.toContain('petitioner_dob');
      });

      it('should return all required fields when no fields are filled', () => {
        const unfilled = getUnfilledRequiredFields('I-130', []);
        expect(unfilled).toContain('petitioner_name');
        expect(unfilled).toContain('petitioner_dob');
        expect(unfilled).toContain('beneficiary_name');
        expect(unfilled.length).toBe(6);
      });

      it('should return empty array when all required fields are filled', () => {
        const allFilledFields: FormField[] = [
          { field_id: 'f1', field_name: 'petitioner_name', field_type: 'text', suggested_value: 'John' },
          { field_id: 'f2', field_name: 'petitioner_dob', field_type: 'date', suggested_value: '1990-01-01' },
          { field_id: 'f3', field_name: 'petitioner_address', field_type: 'text', suggested_value: '123 Main St' },
          { field_id: 'f4', field_name: 'beneficiary_name', field_type: 'text', suggested_value: 'Jane' },
          { field_id: 'f5', field_name: 'beneficiary_dob', field_type: 'date', suggested_value: '1992-02-02' },
          { field_id: 'f6', field_name: 'relationship', field_type: 'text', suggested_value: 'spouse' },
        ];
        const unfilled = getUnfilledRequiredFields('I-130', allFilledFields);
        expect(unfilled).toEqual([]);
      });

      it('should handle I-485 form type', () => {
        const unfilled = getUnfilledRequiredFields('I-485', []);
        expect(unfilled).toContain('applicant_name');
        expect(unfilled).toContain('country_of_birth');
      });

      it('should handle I-765 form type', () => {
        const unfilled = getUnfilledRequiredFields('I-765', []);
        expect(unfilled).toContain('eligibility_category');
      });

      it('should handle N-400 form type', () => {
        const unfilled = getUnfilledRequiredFields('N-400', []);
        expect(unfilled).toContain('green_card_number');
        expect(unfilled).toContain('date_became_lpr');
      });

      it('should return empty array for unknown form type', () => {
        const unfilled = getUnfilledRequiredFields('UNKNOWN', []);
        expect(unfilled).toEqual([]);
      });

      it('should consider both suggested_value and current_value as filled', () => {
        const mixedFields: FormField[] = [
          { field_id: 'f1', field_name: 'petitioner_name', field_type: 'text', suggested_value: 'John' },
          { field_id: 'f2', field_name: 'petitioner_dob', field_type: 'date', current_value: '1990-01-01' },
        ];
        const unfilled = getUnfilledRequiredFields('I-130', mixedFields);
        expect(unfilled).not.toContain('petitioner_name');
        expect(unfilled).not.toContain('petitioner_dob');
      });
    });

    describe('calculateFormCompletion', () => {
      it('should calculate completion percentage correctly', () => {
        const fields: FormField[] = [
          { field_id: 'f1', field_name: 'name', field_type: 'text', suggested_value: 'John', confidence: 0.95 },
          { field_id: 'f2', field_name: 'dob', field_type: 'date', suggested_value: '1990-01-01', confidence: 0.9 },
        ];
        const result = calculateFormCompletion('I-130', fields);
        expect(result.filledCount).toBe(2);
        expect(result.totalRequired).toBe(25);
        expect(result.percentage).toBe(8);
        expect(result.highConfidenceCount).toBe(2);
      });

      it('should cap percentage at 100', () => {
        const manyFields: FormField[] = Array(30).fill(null).map((_, i) => ({
          field_id: `f${i}`,
          field_name: `field_${i}`,
          field_type: 'text' as const,
          suggested_value: 'value',
          confidence: 0.9,
        }));
        const result = calculateFormCompletion('I-765', manyFields);
        expect(result.percentage).toBe(100);
      });

      it('should count high confidence fields correctly', () => {
        const fields: FormField[] = [
          { field_id: 'f1', field_name: 'name', field_type: 'text', suggested_value: 'John', confidence: 0.95 },
          { field_id: 'f2', field_name: 'dob', field_type: 'date', suggested_value: '1990-01-01', confidence: 0.75 },
          { field_id: 'f3', field_name: 'address', field_type: 'text', suggested_value: '123 St', confidence: 0.8 },
        ];
        const result = calculateFormCompletion('I-130', fields);
        expect(result.highConfidenceCount).toBe(2);
      });

      it('should handle fields with current_value', () => {
        const fields: FormField[] = [
          { field_id: 'f1', field_name: 'name', field_type: 'text', current_value: 'John' },
        ];
        const result = calculateFormCompletion('I-130', fields);
        expect(result.filledCount).toBe(1);
      });

      it('should return correct total for each form type', () => {
        expect(calculateFormCompletion('I-130', []).totalRequired).toBe(25);
        expect(calculateFormCompletion('I-485', []).totalRequired).toBe(50);
        expect(calculateFormCompletion('I-765', []).totalRequired).toBe(15);
        expect(calculateFormCompletion('N-400', []).totalRequired).toBe(40);
      });

      it('should default to 20 for unknown form type', () => {
        const result = calculateFormCompletion('UNKNOWN', []);
        expect(result.totalRequired).toBe(20);
      });

      it('should handle empty fields array', () => {
        const result = calculateFormCompletion('I-130', []);
        expect(result.filledCount).toBe(0);
        expect(result.percentage).toBe(0);
        expect(result.highConfidenceCount).toBe(0);
      });

      it('should handle fields without confidence', () => {
        const fields: FormField[] = [
          { field_id: 'f1', field_name: 'name', field_type: 'text', suggested_value: 'John' },
        ];
        const result = calculateFormCompletion('I-130', fields);
        expect(result.highConfidenceCount).toBe(0);
      });
    });
  });

  // ==========================================
  // Document Analysis Utility Tests
  // ==========================================
  describe('Document Analysis Utilities', () => {
    describe('validateDocumentForVisa', () => {
      const mockValidPassportResult: DocumentAnalysisResult = {
        document_type: 'passport',
        extracted_fields: [
          { field_name: 'full_name', value: 'John Doe', confidence: 0.95, requires_verification: false },
          { field_name: 'date_of_birth', value: '1990-01-15', confidence: 0.92, requires_verification: false },
          { field_name: 'passport_number', value: 'AB1234567', confidence: 0.98, requires_verification: false },
          { field_name: 'expiry_date', value: '2030-01-15', confidence: 0.95, requires_verification: false },
          { field_name: 'nationality', value: 'United States', confidence: 0.90, requires_verification: false },
        ],
        overall_confidence: 0.94,
        processing_time_ms: 1500,
      };

      it('should accept valid passport with all required fields', async () => {
        const result = await validateDocumentForVisa(mockValidPassportResult, 'F-1');
        expect(result.isAcceptable).toBe(true);
        expect(result.issues).toHaveLength(0);
      });

      it('should flag low overall confidence', async () => {
        const lowConfResult: DocumentAnalysisResult = {
          ...mockValidPassportResult,
          overall_confidence: 0.5,
        };
        const result = await validateDocumentForVisa(lowConfResult, 'F-1');
        expect(result.isAcceptable).toBe(false);
        expect(result.issues.some(i => i.includes('quality'))).toBe(true);
      });

      it('should flag missing required fields for passport', async () => {
        const missingFieldResult: DocumentAnalysisResult = {
          ...mockValidPassportResult,
          extracted_fields: [
            { field_name: 'full_name', value: 'John Doe', confidence: 0.95, requires_verification: false },
          ],
        };
        const result = await validateDocumentForVisa(missingFieldResult, 'F-1');
        expect(result.isAcceptable).toBe(false);
        expect(result.issues.some(i => i.includes('date_of_birth'))).toBe(true);
        expect(result.issues.some(i => i.includes('passport_number'))).toBe(true);
      });

      it('should suggest review for low confidence fields', async () => {
        const lowFieldConfResult: DocumentAnalysisResult = {
          ...mockValidPassportResult,
          extracted_fields: [
            { field_name: 'full_name', value: 'John Doe', confidence: 0.75, requires_verification: false },
            { field_name: 'date_of_birth', value: '1990-01-15', confidence: 0.92, requires_verification: false },
            { field_name: 'passport_number', value: 'AB1234567', confidence: 0.98, requires_verification: false },
            { field_name: 'expiry_date', value: '2030-01-15', confidence: 0.95, requires_verification: false },
            { field_name: 'nationality', value: 'United States', confidence: 0.90, requires_verification: false },
          ],
        };
        const result = await validateDocumentForVisa(lowFieldConfResult, 'F-1');
        expect(result.suggestions.some(s => s.includes('full_name') && s.includes('low confidence'))).toBe(true);
      });

      it('should flag expiring passport (less than 6 months validity)', async () => {
        const today = new Date();
        const expiryDate = new Date(today);
        expiryDate.setMonth(expiryDate.getMonth() + 3);
        const expiryString = expiryDate.toISOString().split('T')[0];

        const expiringResult: DocumentAnalysisResult = {
          ...mockValidPassportResult,
          extracted_fields: [
            { field_name: 'full_name', value: 'John Doe', confidence: 0.95, requires_verification: false },
            { field_name: 'date_of_birth', value: '1990-01-15', confidence: 0.92, requires_verification: false },
            { field_name: 'passport_number', value: 'AB1234567', confidence: 0.98, requires_verification: false },
            { field_name: 'expiry_date', value: expiryString, confidence: 0.95, requires_verification: false },
            { field_name: 'nationality', value: 'United States', confidence: 0.90, requires_verification: false },
          ],
        };
        const result = await validateDocumentForVisa(expiringResult, 'F-1');
        expect(result.isAcceptable).toBe(false);
        expect(result.issues.some(i => i.includes('expires within 6 months'))).toBe(true);
      });

      it('should handle birth certificate validation', async () => {
        const birthCertResult: DocumentAnalysisResult = {
          document_type: 'birth_certificate',
          extracted_fields: [
            { field_name: 'full_name', value: 'John Doe', confidence: 0.95, requires_verification: false },
            { field_name: 'date_of_birth', value: '1990-01-15', confidence: 0.90, requires_verification: false },
            { field_name: 'place_of_birth', value: 'New York, USA', confidence: 0.88, requires_verification: false },
          ],
          overall_confidence: 0.91,
          processing_time_ms: 1200,
        };
        const result = await validateDocumentForVisa(birthCertResult, 'F-1');
        expect(result.isAcceptable).toBe(true);
      });

      it('should handle marriage certificate validation', async () => {
        const marriageCertResult: DocumentAnalysisResult = {
          document_type: 'marriage_certificate',
          extracted_fields: [
            { field_name: 'spouse_1_name', value: 'John Doe', confidence: 0.95, requires_verification: false },
            { field_name: 'spouse_2_name', value: 'Jane Doe', confidence: 0.95, requires_verification: false },
            { field_name: 'date_of_marriage', value: '2020-06-15', confidence: 0.90, requires_verification: false },
          ],
          overall_confidence: 0.93,
          processing_time_ms: 1100,
        };
        const result = await validateDocumentForVisa(marriageCertResult, 'F-1');
        expect(result.isAcceptable).toBe(true);
      });

      it('should handle employment letter validation', async () => {
        const employmentResult: DocumentAnalysisResult = {
          document_type: 'employment_letter',
          extracted_fields: [
            { field_name: 'employee_name', value: 'John Doe', confidence: 0.95, requires_verification: false },
            { field_name: 'employer_name', value: 'ACME Corp', confidence: 0.92, requires_verification: false },
            { field_name: 'job_title', value: 'Software Engineer', confidence: 0.90, requires_verification: false },
          ],
          overall_confidence: 0.92,
          processing_time_ms: 1000,
        };
        const result = await validateDocumentForVisa(employmentResult, 'H-1B');
        expect(result.isAcceptable).toBe(true);
      });

      it('should include warnings from analysis result in suggestions', async () => {
        const resultWithWarnings: DocumentAnalysisResult = {
          ...mockValidPassportResult,
          warnings: ['Image quality could be improved', 'Slight blur detected'],
        };
        const result = await validateDocumentForVisa(resultWithWarnings, 'F-1');
        expect(result.suggestions).toContain('Image quality could be improved');
        expect(result.suggestions).toContain('Slight blur detected');
      });

      it('should handle unknown document type gracefully', async () => {
        const unknownResult: DocumentAnalysisResult = {
          document_type: 'unknown_document',
          extracted_fields: [],
          overall_confidence: 0.8,
          processing_time_ms: 500,
        };
        const result = await validateDocumentForVisa(unknownResult, 'F-1');
        expect(result.isAcceptable).toBe(true);
      });

      it('should handle null field values', async () => {
        const nullFieldResult: DocumentAnalysisResult = {
          document_type: 'passport',
          extracted_fields: [
            { field_name: 'full_name', value: null, confidence: 0, requires_verification: true },
            { field_name: 'date_of_birth', value: null, confidence: 0, requires_verification: true },
            { field_name: 'passport_number', value: null, confidence: 0, requires_verification: true },
            { field_name: 'expiry_date', value: null, confidence: 0, requires_verification: true },
            { field_name: 'nationality', value: null, confidence: 0, requires_verification: true },
          ],
          overall_confidence: 0.3,
          processing_time_ms: 1500,
        };
        const result = await validateDocumentForVisa(nullFieldResult, 'F-1');
        expect(result.isAcceptable).toBe(false);
        expect(result.issues.length).toBeGreaterThan(0);
      });
    });
  });

  // ==========================================
  // OpenAI Integration Tests
  // ==========================================
  describe('OpenAI Integration', () => {
    describe('analyzeDocumentWithVision', () => {
      beforeEach(() => {
        vi.clearAllMocks();
        openaiMockState.completionsCreate.mockReset();
      });

      it('should successfully analyze document with imageUrl', async () => {
        const mockResponse = {
          document_type: 'passport',
          extracted_fields: [
            { field_name: 'full_name', value: 'John Doe', confidence: 0.95, requires_verification: false },
          ],
          overall_confidence: 0.95,
        };

        setOpenAIJsonResponse(mockResponse);

        const { analyzeDocumentWithVision } = await import('./openai');
        const result = await analyzeDocumentWithVision({
          imageUrl: 'https://example.com/passport.jpg',
          documentType: 'passport',
        });

        expect(result.document_type).toBe('passport');
        expect(result.extracted_fields).toHaveLength(1);
        expect(result.processing_time_ms).toBeDefined();
      });

      it('should successfully analyze document with imageBase64', async () => {
        const mockResponse = {
          document_type: 'passport',
          extracted_fields: [],
          overall_confidence: 0.9,
        };

        setOpenAIJsonResponse(mockResponse);

        const { analyzeDocumentWithVision } = await import('./openai');
        const result = await analyzeDocumentWithVision({
          imageBase64: 'base64encodedimage',
          documentType: 'passport',
        });

        expect(result.document_type).toBe('passport');
      });

      it('should throw error when neither imageUrl nor imageBase64 provided', async () => {
        const { analyzeDocumentWithVision } = await import('./openai');

        await expect(analyzeDocumentWithVision({})).rejects.toThrow(
          'Either imageUrl or imageBase64 must be provided'
        );
      });

      it('should throw error when no response content', async () => {
        openaiMockState.completionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: null } }],
        });

        const { analyzeDocumentWithVision } = await import('./openai');

        await expect(
          analyzeDocumentWithVision({
            imageUrl: 'https://example.com/doc.jpg',
          })
        ).rejects.toThrow('No response content from OpenAI');
      });

      it('should throw error for invalid JSON response', async () => {
        setOpenAITextResponse('not valid json');

        const { analyzeDocumentWithVision } = await import('./openai');

        await expect(
          analyzeDocumentWithVision({
            imageUrl: 'https://example.com/doc.jpg',
          })
        ).rejects.toThrow('Failed to parse OpenAI response as JSON');
      });

      it('should handle 401 unauthorized error', async () => {
        const apiError = new OpenAIAPIError(401, 'Unauthorized');
        openaiMockState.completionsCreate.mockRejectedValueOnce(apiError);

        const { analyzeDocumentWithVision } = await import('./openai');

        await expect(
          analyzeDocumentWithVision({
            imageUrl: 'https://example.com/doc.jpg',
          })
        ).rejects.toThrow('Invalid OpenAI API key');
      });

      it('should handle 429 rate limit error', async () => {
        const apiError = new OpenAIAPIError(429, 'Rate limit exceeded');
        openaiMockState.completionsCreate.mockRejectedValueOnce(apiError);

        const { analyzeDocumentWithVision } = await import('./openai');

        await expect(
          analyzeDocumentWithVision({
            imageUrl: 'https://example.com/doc.jpg',
          })
        ).rejects.toThrow('OpenAI rate limit exceeded');
      });

      it('should handle 400 bad request error', async () => {
        const apiError = new OpenAIAPIError(400, 'Bad request');
        openaiMockState.completionsCreate.mockRejectedValueOnce(apiError);

        const { analyzeDocumentWithVision } = await import('./openai');

        await expect(
          analyzeDocumentWithVision({
            imageUrl: 'https://example.com/doc.jpg',
          })
        ).rejects.toThrow('Invalid image format or size');
      });

      it('should use high detail when high_accuracy_mode is enabled', async () => {
        const mockResponse = {
          document_type: 'passport',
          extracted_fields: [],
          overall_confidence: 0.95,
        };

        setOpenAIJsonResponse(mockResponse);

        const { analyzeDocumentWithVision } = await import('./openai');
        await analyzeDocumentWithVision({
          imageUrl: 'https://example.com/passport.jpg',
          options: { high_accuracy_mode: true },
        });

        expect(openaiMockState.completionsCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: expect.arrayContaining([
              expect.objectContaining({
                role: 'user',
                content: expect.arrayContaining([
                  expect.objectContaining({
                    type: 'image_url',
                    image_url: expect.objectContaining({
                      detail: 'high',
                    }),
                  }),
                ]),
              }),
            ]),
          })
        );
      });
    });

    describe('extractTextFromImage', () => {
      beforeEach(() => {
        openaiMockState.completionsCreate.mockReset();
      });

      it('should extract text from image', async () => {
        setOpenAITextResponse('Extracted text content from document');

        const { extractTextFromImage } = await import('./openai');
        const result = await extractTextFromImage('https://example.com/doc.jpg');

        expect(result.text).toBe('Extracted text content from document');
        expect(result.confidence).toBe(0.9);
      });

      it('should return 0 confidence for empty text', async () => {
        setOpenAITextResponse('');

        const { extractTextFromImage } = await import('./openai');
        const result = await extractTextFromImage('https://example.com/doc.jpg');

        expect(result.text).toBe('');
        expect(result.confidence).toBe(0);
      });
    });

    describe('detectDocumentType', () => {
      beforeEach(() => {
        openaiMockState.completionsCreate.mockReset();
      });

      it('should detect passport type', async () => {
        setOpenAIJsonResponse({ type: 'passport', confidence: 0.95 });

        const { detectDocumentType } = await import('./openai');
        const result = await detectDocumentType('https://example.com/passport.jpg');

        expect(result.type).toBe('passport');
        expect(result.confidence).toBe(0.95);
      });

      it('should return other for unknown documents', async () => {
        setOpenAIJsonResponse({ type: 'other', confidence: 0.5 });

        const { detectDocumentType } = await import('./openai');
        const result = await detectDocumentType('https://example.com/unknown.jpg');

        expect(result.type).toBe('other');
      });

      it('should handle empty response', async () => {
        openaiMockState.completionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: null } }],
        });

        const { detectDocumentType } = await import('./openai');
        const result = await detectDocumentType('https://example.com/doc.jpg');

        expect(result.type).toBe('other');
        expect(result.confidence).toBe(0);
      });

      it('should handle invalid JSON response', async () => {
        setOpenAITextResponse('not json');

        const { detectDocumentType } = await import('./openai');
        const result = await detectDocumentType('https://example.com/doc.jpg');

        expect(result.type).toBe('other');
        expect(result.confidence).toBe(0);
      });
    });

    describe('validateDocumentImage', () => {
      beforeEach(() => {
        openaiMockState.completionsCreate.mockReset();
      });

      it('should validate a good document image', async () => {
        setOpenAIJsonResponse({
          isValid: true,
          suggestedType: 'passport',
        });

        const { validateDocumentImage } = await import('./openai');
        const result = await validateDocumentImage('https://example.com/passport.jpg');

        expect(result.isValid).toBe(true);
        expect(result.suggestedType).toBe('passport');
      });

      it('should reject blank images', async () => {
        setOpenAIJsonResponse({
          isValid: false,
          reason: 'Image appears to be blank',
        });

        const { validateDocumentImage } = await import('./openai');
        const result = await validateDocumentImage('https://example.com/blank.jpg');

        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('blank');
      });

      it('should handle empty response', async () => {
        openaiMockState.completionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: null } }],
        });

        const { validateDocumentImage } = await import('./openai');
        const result = await validateDocumentImage('https://example.com/doc.jpg');

        expect(result.isValid).toBe(false);
        expect(result.reason).toBe('Unable to analyze image');
      });

      it('should handle parse errors', async () => {
        setOpenAITextResponse('not json');

        const { validateDocumentImage } = await import('./openai');
        const result = await validateDocumentImage('https://example.com/doc.jpg');

        expect(result.isValid).toBe(false);
        expect(result.reason).toBe('Failed to parse validation response');
      });
    });
  });

  // ==========================================
  // Anthropic Integration Tests
  // ==========================================
  describe('Anthropic Integration', () => {
    describe('generateFormAutofill', () => {
      beforeEach(() => {
        vi.clearAllMocks();
        anthropicMockState.messagesCreate.mockReset();
      });

      it('should generate autofill suggestions from extracted data', async () => {
        const mockResponse = {
          form_type: 'I-130',
          fields: [
            { field_id: 'pt2_legal_name', field_name: 'full_name', suggested_value: 'John Doe', confidence: 0.95 },
          ],
          overall_confidence: 0.9,
          missing_documents: [],
          warnings: [],
        };

        setAnthropicJsonResponse(mockResponse);

        const { generateFormAutofill } = await import('./anthropic');
        const result = await generateFormAutofill({
          formType: 'I-130',
          extractedData: [
            { field_name: 'full_name', value: 'John Doe', confidence: 0.95, requires_verification: false },
          ],
        });

        expect(result.form_type).toBe('I-130');
        expect(result.fields).toHaveLength(1);
        expect(result.processing_time_ms).toBeDefined();
      });

      it('should handle JSON response wrapped in markdown code blocks', async () => {
        const mockResponse = {
          form_type: 'I-130',
          fields: [],
          overall_confidence: 0.9,
        };

        anthropicMockState.messagesCreate.mockResolvedValueOnce({
          content: [{ type: 'text', text: '```json\n' + JSON.stringify(mockResponse) + '\n```' }],
        });

        const { generateFormAutofill } = await import('./anthropic');
        const result = await generateFormAutofill({
          formType: 'I-130',
          extractedData: [],
        });

        expect(result.form_type).toBe('I-130');
      });

      it('should throw error when no text content in response', async () => {
        anthropicMockState.messagesCreate.mockResolvedValueOnce({
          content: [],
        });

        const { generateFormAutofill } = await import('./anthropic');

        await expect(
          generateFormAutofill({
            formType: 'I-130',
            extractedData: [],
          })
        ).rejects.toThrow('No response content from Claude');
      });

      it('should throw error when JSON cannot be parsed', async () => {
        anthropicMockState.messagesCreate.mockResolvedValueOnce({
          content: [{ type: 'text', text: 'This is not JSON at all' }],
        });

        const { generateFormAutofill } = await import('./anthropic');

        await expect(
          generateFormAutofill({
            formType: 'I-130',
            extractedData: [],
          })
        ).rejects.toThrow('Could not parse JSON response from Claude');
      });

      it('should handle 401 unauthorized error', async () => {
        const apiError = new AnthropicAPIError(401, 'Unauthorized');
        anthropicMockState.messagesCreate.mockRejectedValueOnce(apiError);

        const { generateFormAutofill } = await import('./anthropic');

        await expect(
          generateFormAutofill({
            formType: 'I-130',
            extractedData: [],
          })
        ).rejects.toThrow('Invalid Anthropic API key');
      });

      it('should handle 429 rate limit error', async () => {
        const apiError = new AnthropicAPIError(429, 'Rate limit exceeded');
        anthropicMockState.messagesCreate.mockRejectedValueOnce(apiError);

        const { generateFormAutofill } = await import('./anthropic');

        await expect(
          generateFormAutofill({
            formType: 'I-130',
            extractedData: [],
          })
        ).rejects.toThrow('Anthropic rate limit exceeded');
      });

      it('should include case context when provided', async () => {
        const mockResponse = {
          form_type: 'I-130',
          fields: [],
          overall_confidence: 0.9,
        };

        setAnthropicJsonResponse(mockResponse);

        const { generateFormAutofill } = await import('./anthropic');
        await generateFormAutofill({
          formType: 'I-130',
          extractedData: [],
          caseContext: {
            visa_type: 'F-1',
            petitioner_relationship: 'spouse',
          },
        });

        expect(anthropicMockState.messagesCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: expect.arrayContaining([
              expect.objectContaining({
                content: expect.stringContaining('visa_type'),
              }),
            ]),
          })
        );
      });
    });

    describe('validateFormData', () => {
      beforeEach(() => {
        anthropicMockState.messagesCreate.mockReset();
      });

      it('should validate form data and return issues', async () => {
        const mockResponse = {
          isValid: false,
          errors: ['Date of birth format is incorrect'],
          warnings: ['Consider adding middle name'],
          suggestions: ['Double-check address format'],
        };

        setAnthropicJsonResponse(mockResponse);

        const { validateFormData } = await import('./anthropic');
        const result = await validateFormData(
          'I-130',
          { first_name: 'John', dob: 'invalid-date' }
        );

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Date of birth format is incorrect');
      });

      it('should return default valid response when no content', async () => {
        anthropicMockState.messagesCreate.mockResolvedValueOnce({
          content: [],
        });

        const { validateFormData } = await import('./anthropic');
        const result = await validateFormData('I-130', {});

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain('Unable to validate form data');
      });

      it('should return default response when JSON parse fails', async () => {
        anthropicMockState.messagesCreate.mockResolvedValueOnce({
          content: [{ type: 'text', text: 'invalid json' }],
        });

        const { validateFormData } = await import('./anthropic');
        const result = await validateFormData('I-130', {});

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain('Unable to parse validation response');
      });
    });

    describe('explainFormRequirements', () => {
      beforeEach(() => {
        anthropicMockState.messagesCreate.mockReset();
      });

      it('should explain form requirements', async () => {
        const explanation = 'Form I-130 is used to petition for alien relatives...';

        anthropicMockState.messagesCreate.mockResolvedValueOnce({
          content: [{ type: 'text', text: explanation }],
        });

        const { explainFormRequirements } = await import('./anthropic');
        const result = await explainFormRequirements('I-130', 'F-1');

        expect(result).toBe(explanation);
      });

      it('should return empty string when no content', async () => {
        anthropicMockState.messagesCreate.mockResolvedValueOnce({
          content: [],
        });

        const { explainFormRequirements } = await import('./anthropic');
        const result = await explainFormRequirements('I-130', 'F-1');

        expect(result).toBe('');
      });
    });

    describe('analyzeDataConsistency', () => {
      beforeEach(() => {
        anthropicMockState.messagesCreate.mockReset();
      });

      it('should analyze data consistency across documents', async () => {
        const mockResponse = {
          consistencyScore: 0.95,
          discrepancies: [
            {
              field: 'full_name',
              values: [
                { document: 'passport', value: 'JOHN DOE' },
                { document: 'birth_certificate', value: 'John Doe' },
              ],
              recommendation: 'Minor formatting difference, acceptable',
            },
          ],
        };

        setAnthropicJsonResponse(mockResponse);

        const { analyzeDataConsistency } = await import('./anthropic');
        const result = await analyzeDataConsistency([
          {
            type: 'passport',
            extractedFields: [{ field_name: 'full_name', value: 'JOHN DOE', confidence: 0.95, requires_verification: false }],
          },
          {
            type: 'birth_certificate',
            extractedFields: [{ field_name: 'full_name', value: 'John Doe', confidence: 0.92, requires_verification: false }],
          },
        ]);

        expect(result.consistencyScore).toBe(0.95);
        expect(result.discrepancies).toHaveLength(1);
      });

      it('should return perfect consistency when no content', async () => {
        anthropicMockState.messagesCreate.mockResolvedValueOnce({
          content: [],
        });

        const { analyzeDataConsistency } = await import('./anthropic');
        const result = await analyzeDataConsistency([]);

        expect(result.consistencyScore).toBe(1);
        expect(result.discrepancies).toEqual([]);
      });

      it('should return perfect consistency when JSON parse fails', async () => {
        anthropicMockState.messagesCreate.mockResolvedValueOnce({
          content: [{ type: 'text', text: 'invalid' }],
        });

        const { analyzeDataConsistency } = await import('./anthropic');
        const result = await analyzeDataConsistency([]);

        expect(result.consistencyScore).toBe(1);
        expect(result.discrepancies).toEqual([]);
      });
    });

    describe('suggestNextSteps', () => {
      beforeEach(() => {
        anthropicMockState.messagesCreate.mockReset();
      });

      it('should suggest next steps based on case data', async () => {
        const mockResponse = {
          nextSteps: [
            {
              priority: 'high',
              action: 'Collect passport copy',
              reason: 'Required for all immigration applications',
            },
            {
              priority: 'medium',
              action: 'Gather employment letters',
              reason: 'Needed for visa sponsorship',
            },
          ],
        };

        setAnthropicJsonResponse(mockResponse);

        const { suggestNextSteps } = await import('./anthropic');
        const result = await suggestNextSteps({
          visa_type: 'H-1B',
          status: 'document_collection',
          documents: [],
          forms_completed: [],
        });

        expect(result.nextSteps).toHaveLength(2);
        expect(result.nextSteps[0].priority).toBe('high');
      });

      it('should return empty steps when no content', async () => {
        anthropicMockState.messagesCreate.mockResolvedValueOnce({
          content: [],
        });

        const { suggestNextSteps } = await import('./anthropic');
        const result = await suggestNextSteps({
          visa_type: 'H-1B',
          status: 'initial',
          documents: [],
          forms_completed: [],
        });

        expect(result.nextSteps).toEqual([]);
      });

      it('should return empty steps when JSON parse fails', async () => {
        anthropicMockState.messagesCreate.mockResolvedValueOnce({
          content: [{ type: 'text', text: 'not json' }],
        });

        const { suggestNextSteps } = await import('./anthropic');
        const result = await suggestNextSteps({
          visa_type: 'H-1B',
          status: 'initial',
          documents: [],
          forms_completed: [],
        });

        expect(result.nextSteps).toEqual([]);
      });
    });
  });

  // ==========================================
  // Document Analysis High-Level API Tests
  // ==========================================
  describe('Document Analysis High-Level API', () => {
    describe('analyzeDocument', () => {
      beforeEach(() => {
        vi.clearAllMocks();
        openaiMockState.completionsCreate.mockReset();
      });

      it('should analyze document with progress callbacks', async () => {
        // Mock validateDocumentImage
        setOpenAIJsonResponse({ isValid: true, suggestedType: 'passport' });
        // Mock detectDocumentType
        setOpenAIJsonResponse({ type: 'passport', confidence: 0.95 });
        // Mock analyzeDocumentWithVision
        setOpenAIJsonResponse({
          document_type: 'passport',
          extracted_fields: [
            { field_name: 'full_name', value: 'John Doe', confidence: 0.95, requires_verification: false },
          ],
          overall_confidence: 0.95,
        });

        const progressStages: string[] = [];
        const { analyzeDocument } = await import('./document-analysis');

        const result = await analyzeDocument(
          {
            documentId: 'doc-123',
            fileUrl: 'https://example.com/passport.jpg',
          },
          (progress) => {
            progressStages.push(progress.stage);
          }
        );

        expect(result.document_type).toBe('passport');
        expect(progressStages).toContain('validating');
        expect(progressStages).toContain('complete');
      });

      it('should return invalid result for invalid document image', async () => {
        setOpenAIJsonResponse({
          isValid: false,
          reason: 'Image is blank',
        });

        const { analyzeDocument } = await import('./document-analysis');

        const result = await analyzeDocument({
          documentId: 'doc-123',
          fileUrl: 'https://example.com/blank.jpg',
        });

        expect(result.document_type).toBe('invalid');
        expect(result.overall_confidence).toBe(0);
        expect(result.errors).toContain('Image is blank');
      });

      it('should throw error when no document URL available', async () => {
        const { analyzeDocument } = await import('./document-analysis');

        await expect(
          analyzeDocument({
            documentId: 'doc-123',
          })
        ).rejects.toThrow('No document URL available for analysis');
      });

      it('should use provided document type instead of detecting', async () => {
        // Mock validateDocumentImage
        setOpenAIJsonResponse({ isValid: true });
        // Mock analyzeDocumentWithVision (detectDocumentType should be skipped)
        setOpenAIJsonResponse({
          document_type: 'passport',
          extracted_fields: [],
          overall_confidence: 0.9,
        });

        const { analyzeDocument } = await import('./document-analysis');

        const result = await analyzeDocument({
          documentId: 'doc-123',
          fileUrl: 'https://example.com/passport.jpg',
          documentType: 'passport',
        });

        expect(result.document_type).toBe('passport');
        // Verify detectDocumentType was not called (only 2 calls: validate + analyze)
        expect(openaiMockState.completionsCreate).toHaveBeenCalledTimes(2);
      });
    });

    describe('extractSpecificFields', () => {
      beforeEach(() => {
        openaiMockState.completionsCreate.mockReset();
      });

      it('should extract only requested fields', async () => {
        setOpenAIJsonResponse({
          document_type: 'passport',
          extracted_fields: [
            { field_name: 'full_name', value: 'John Doe', confidence: 0.95, requires_verification: false },
            { field_name: 'date_of_birth', value: '1990-01-15', confidence: 0.92, requires_verification: false },
            { field_name: 'passport_number', value: 'AB123', confidence: 0.9, requires_verification: false },
          ],
          overall_confidence: 0.92,
        });

        const { extractSpecificFields } = await import('./document-analysis');

        const result = await extractSpecificFields(
          'https://example.com/passport.jpg',
          ['full_name', 'date_of_birth']
        );

        expect(result).toHaveLength(2);
        expect(result.map(f => f.field_name)).toContain('full_name');
        expect(result.map(f => f.field_name)).toContain('date_of_birth');
        expect(result.map(f => f.field_name)).not.toContain('passport_number');
      });
    });

    describe('getDocumentText', () => {
      beforeEach(() => {
        openaiMockState.completionsCreate.mockReset();
      });

      it('should extract text from document', async () => {
        setOpenAITextResponse('This is the extracted text from the document');

        const { getDocumentText } = await import('./document-analysis');
        const text = await getDocumentText('https://example.com/doc.jpg');

        expect(text).toBe('This is the extracted text from the document');
      });
    });

    describe('compareDocuments', () => {
      beforeEach(() => {
        openaiMockState.completionsCreate.mockReset();
      });

      it('should identify same documents', async () => {
        const mockResponse = {
          document_type: 'passport',
          extracted_fields: [
            { field_name: 'full_name', value: 'John Doe', confidence: 0.95, requires_verification: false },
          ],
          overall_confidence: 0.95,
        };

        setOpenAIJsonResponse(mockResponse);
        setOpenAIJsonResponse(mockResponse);

        const { compareDocuments } = await import('./document-analysis');

        const result = await compareDocuments(
          'https://example.com/doc1.jpg',
          'https://example.com/doc2.jpg'
        );

        expect(result.isSameDocument).toBe(true);
        expect(result.similarityScore).toBe(1);
        expect(result.differences).toHaveLength(0);
      });

      it('should identify different document types', async () => {
        setOpenAIJsonResponse({
          document_type: 'passport',
          extracted_fields: [],
          overall_confidence: 0.9,
        });
        setOpenAIJsonResponse({
          document_type: 'birth_certificate',
          extracted_fields: [],
          overall_confidence: 0.9,
        });

        const { compareDocuments } = await import('./document-analysis');

        const result = await compareDocuments(
          'https://example.com/passport.jpg',
          'https://example.com/birth_cert.jpg'
        );

        expect(result.isSameDocument).toBe(false);
        expect(result.similarityScore).toBe(0);
        expect(result.differences[0]).toContain('Different document types');
      });

      it('should identify field differences', async () => {
        setOpenAIJsonResponse({
          document_type: 'passport',
          extracted_fields: [
            { field_name: 'full_name', value: 'John Doe', confidence: 0.95, requires_verification: false },
          ],
          overall_confidence: 0.95,
        });
        setOpenAIJsonResponse({
          document_type: 'passport',
          extracted_fields: [
            { field_name: 'full_name', value: 'Jane Doe', confidence: 0.95, requires_verification: false },
          ],
          overall_confidence: 0.95,
        });

        const { compareDocuments } = await import('./document-analysis');

        const result = await compareDocuments(
          'https://example.com/doc1.jpg',
          'https://example.com/doc2.jpg'
        );

        expect(result.isSameDocument).toBe(false);
        expect(result.differences.some(d => d.includes('full_name'))).toBe(true);
      });
    });
  });

  // ==========================================
  // Form Autofill High-Level API Tests
  // ==========================================
  describe('Form Autofill High-Level API', () => {
    describe('autofillForm', () => {
      beforeEach(() => {
        vi.clearAllMocks();
        anthropicMockState.messagesCreate.mockReset();
      });

      it('should autofill form with document analyses', async () => {
        // Mock analyzeDataConsistency
        setAnthropicJsonResponse({
          consistencyScore: 0.95,
          discrepancies: [],
        });
        // Mock generateFormAutofill
        setAnthropicJsonResponse({
          form_type: 'I-130',
          fields: [
            { field_id: 'pt2_legal_name', field_name: 'full_name', suggested_value: 'John Doe', confidence: 0.95 },
          ],
          overall_confidence: 0.9,
          warnings: [],
        });

        const progressStages: string[] = [];
        const { autofillForm } = await import('./form-autofill');

        const result = await autofillForm(
          {
            formType: 'I-130',
            caseId: 'case-123',
            documentAnalyses: [
              {
                document_type: 'passport',
                extracted_fields: [
                  { field_name: 'full_name', value: 'John Doe', confidence: 0.95, requires_verification: false },
                ],
                overall_confidence: 0.95,
                processing_time_ms: 1000,
              },
            ],
          },
          (progress) => {
            progressStages.push(progress.stage);
          }
        );

        expect(result.form_type).toBe('I-130');
        expect(result.fields).toHaveLength(1);
        expect(progressStages).toContain('gathering');
        expect(progressStages).toContain('complete');
      });

      it('should return empty result when no document data', async () => {
        const { autofillForm } = await import('./form-autofill');

        const result = await autofillForm({
          formType: 'I-130',
          caseId: 'case-123',
          documentAnalyses: [],
        });

        expect(result.overall_confidence).toBe(0);
        expect(result.missing_documents).toContain('No document data available for autofill');
      });

      it('should add discrepancy warnings', async () => {
        // Mock analyzeDataConsistency with discrepancies
        setAnthropicJsonResponse({
          consistencyScore: 0.7,
          discrepancies: [
            {
              field: 'full_name',
              values: [
                { document: 'passport', value: 'JOHN DOE' },
                { document: 'birth_certificate', value: 'John D. Doe' },
              ],
              recommendation: 'Names differ slightly',
            },
          ],
        });
        // Mock generateFormAutofill
        setAnthropicJsonResponse({
          form_type: 'I-130',
          fields: [
            { field_id: 'pt2_legal_name', field_name: 'full_name', suggested_value: 'John Doe', confidence: 0.8 },
          ],
          overall_confidence: 0.8,
          warnings: [],
        });

        const { autofillForm } = await import('./form-autofill');

        const result = await autofillForm({
          formType: 'I-130',
          caseId: 'case-123',
          documentAnalyses: [
            {
              document_type: 'passport',
              extracted_fields: [
                { field_name: 'full_name', value: 'JOHN DOE', confidence: 0.95, requires_verification: false },
              ],
              overall_confidence: 0.95,
              processing_time_ms: 1000,
            },
            {
              document_type: 'birth_certificate',
              extracted_fields: [
                { field_name: 'full_name', value: 'John D. Doe', confidence: 0.9, requires_verification: false },
              ],
              overall_confidence: 0.9,
              processing_time_ms: 800,
            },
          ],
        });

        expect(result.warnings?.some(w => w.includes('full_name'))).toBe(true);
        expect(result.fields[0].requires_review).toBe(true);
      });
    });

    describe('validateAutofill', () => {
      beforeEach(() => {
        anthropicMockState.messagesCreate.mockReset();
      });

      it('should validate autofill data', async () => {
        setAnthropicJsonResponse({
          isValid: true,
          errors: [],
          warnings: [],
          suggestions: ['Consider adding middle name'],
        });

        const { validateAutofill } = await import('./form-autofill');

        const result = await validateAutofill(
          'I-130',
          { first_name: 'John', last_name: 'Doe' },
          'F-1'
        );

        expect(result.isValid).toBe(true);
        expect(result.suggestions).toContain('Consider adding middle name');
      });
    });
  });

  // ==========================================
  // Types Tests
  // ==========================================
  describe('Types', () => {
    it('should export ExtractedField type', () => {
      const field: ExtractedField = {
        field_name: 'test',
        value: 'value',
        confidence: 0.9,
        requires_verification: false,
      };
      expect(field.field_name).toBe('test');
    });

    it('should export FormField type with all field types', () => {
      const textField: FormField = {
        field_id: 'f1',
        field_name: 'name',
        field_type: 'text',
      };
      const dateField: FormField = {
        field_id: 'f2',
        field_name: 'dob',
        field_type: 'date',
      };
      const selectField: FormField = {
        field_id: 'f3',
        field_name: 'country',
        field_type: 'select',
      };
      const checkboxField: FormField = {
        field_id: 'f4',
        field_name: 'agree',
        field_type: 'checkbox',
      };
      const radioField: FormField = {
        field_id: 'f5',
        field_name: 'gender',
        field_type: 'radio',
      };
      const textareaField: FormField = {
        field_id: 'f6',
        field_name: 'notes',
        field_type: 'textarea',
      };

      expect(textField.field_type).toBe('text');
      expect(dateField.field_type).toBe('date');
      expect(selectField.field_type).toBe('select');
      expect(checkboxField.field_type).toBe('checkbox');
      expect(radioField.field_type).toBe('radio');
      expect(textareaField.field_type).toBe('textarea');
    });

    it('should export DocumentAnalysisResult type', () => {
      const result: DocumentAnalysisResult = {
        document_type: 'passport',
        extracted_fields: [],
        overall_confidence: 0.9,
        processing_time_ms: 1000,
      };
      expect(result.document_type).toBe('passport');
    });
  });
});
