import { vi } from 'vitest';

// Mock OpenAI API responses
export const mockChatCompletion = {
  id: 'chatcmpl-mock-id',
  object: 'chat.completion',
  created: Date.now(),
  model: 'gpt-4',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'This is a mock response from OpenAI.',
      },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 20,
    total_tokens: 30,
  },
};

export const mockEmbedding = {
  object: 'list',
  data: [
    {
      object: 'embedding',
      index: 0,
      embedding: Array(1536).fill(0).map(() => Math.random()),
    },
  ],
  model: 'text-embedding-ada-002',
  usage: {
    prompt_tokens: 5,
    total_tokens: 5,
  },
};

// Mock OpenAI client
export const mockOpenAIClient = {
  chat: {
    completions: {
      create: vi.fn().mockResolvedValue(mockChatCompletion),
    },
  },
  embeddings: {
    create: vi.fn().mockResolvedValue(mockEmbedding),
  },
  images: {
    generate: vi.fn().mockResolvedValue({
      data: [{ url: 'https://example.com/generated-image.png' }],
    }),
  },
  moderations: {
    create: vi.fn().mockResolvedValue({
      results: [{ flagged: false, categories: {}, category_scores: {} }],
    }),
  },
};

// Factory to create mock OpenAI instance
export const createMockOpenAI = () => mockOpenAIClient;

// Helper to set custom response
export const setMockChatResponse = (content: string) => {
  mockOpenAIClient.chat.completions.create.mockResolvedValueOnce({
    ...mockChatCompletion,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: 'stop',
      },
    ],
  });
};

// Helper to simulate API error
export const simulateOpenAIError = (error: Error) => {
  mockOpenAIClient.chat.completions.create.mockRejectedValueOnce(error);
};

// Reset all mocks
export const resetMocks = () => {
  vi.clearAllMocks();
};

export default {
  mockChatCompletion,
  mockEmbedding,
  mockOpenAIClient,
  createMockOpenAI,
  setMockChatResponse,
  simulateOpenAIError,
  resetMocks,
};
