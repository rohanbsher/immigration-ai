import { vi } from 'vitest';

// Mock Anthropic API responses
export const mockMessageResponse = {
  id: 'msg_mock_id',
  type: 'message',
  role: 'assistant',
  content: [
    {
      type: 'text',
      text: 'This is a mock response from Claude.',
    },
  ],
  model: 'claude-3-opus-20240229',
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: {
    input_tokens: 10,
    output_tokens: 50,
  },
};

// Mock for document analysis response
export const mockDocumentAnalysisResponse = {
  id: 'msg_mock_doc_id',
  type: 'message',
  role: 'assistant',
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        document_type: 'passport',
        extracted_fields: {
          full_name: 'John Doe',
          date_of_birth: '1990-01-15',
          passport_number: 'AB1234567',
          nationality: 'United States',
          expiry_date: '2030-01-15',
        },
        confidence: 0.95,
      }),
    },
  ],
  model: 'claude-3-opus-20240229',
  stop_reason: 'end_turn',
  usage: {
    input_tokens: 500,
    output_tokens: 100,
  },
};

// Mock for form autofill response
export const mockFormAutofillResponse = {
  id: 'msg_mock_form_id',
  type: 'message',
  role: 'assistant',
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        fields: {
          first_name: 'John',
          last_name: 'Doe',
          date_of_birth: '1990-01-15',
          country_of_birth: 'United States',
          current_address: '123 Main St, Anytown, USA 12345',
        },
        suggestions: [
          'Verify date of birth format matches form requirements',
          'Address may need to be split into separate fields',
        ],
      }),
    },
  ],
  model: 'claude-3-opus-20240229',
  stop_reason: 'end_turn',
  usage: {
    input_tokens: 200,
    output_tokens: 80,
  },
};

// Mock Anthropic client
export const mockAnthropicClient = {
  messages: {
    create: vi.fn().mockResolvedValue(mockMessageResponse),
  },
  beta: {
    messages: {
      create: vi.fn().mockResolvedValue(mockMessageResponse),
    },
  },
};

// Factory to create mock Anthropic instance
export const createMockAnthropic = () => mockAnthropicClient;

// Helper to set custom text response
export const setMockTextResponse = (text: string) => {
  mockAnthropicClient.messages.create.mockResolvedValueOnce({
    ...mockMessageResponse,
    content: [{ type: 'text', text }],
  });
};

// Helper to set JSON response (auto-stringifies)
export const setMockJsonResponse = (data: unknown) => {
  mockAnthropicClient.messages.create.mockResolvedValueOnce({
    ...mockMessageResponse,
    content: [{ type: 'text', text: JSON.stringify(data) }],
  });
};

// Helper to simulate document analysis
export const setMockDocumentAnalysis = () => {
  mockAnthropicClient.messages.create.mockResolvedValueOnce(mockDocumentAnalysisResponse);
};

// Helper to simulate form autofill
export const setMockFormAutofill = () => {
  mockAnthropicClient.messages.create.mockResolvedValueOnce(mockFormAutofillResponse);
};

// Helper to simulate API error
export const simulateAnthropicError = (error: Error) => {
  mockAnthropicClient.messages.create.mockRejectedValueOnce(error);
};

// Reset all mocks
export const resetMocks = () => {
  vi.clearAllMocks();
};

export default {
  mockMessageResponse,
  mockDocumentAnalysisResponse,
  mockFormAutofillResponse,
  mockAnthropicClient,
  createMockAnthropic,
  setMockTextResponse,
  setMockJsonResponse,
  setMockDocumentAnalysis,
  setMockFormAutofill,
  simulateAnthropicError,
  resetMocks,
};
