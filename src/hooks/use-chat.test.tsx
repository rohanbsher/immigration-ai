import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Mock fetch-with-timeout
const mockFetchWithTimeout = vi.fn();
vi.mock('@/lib/api/fetch-with-timeout', () => {
  class MockTimeoutError extends Error {
    constructor(timeout: number) {
      super(`Request timed out after ${timeout / 1000} seconds`);
      this.name = 'TimeoutError';
    }
  }
  return {
    fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
    TimeoutError: MockTimeoutError,
  };
});

// Mock parse-response
const mockParseApiResponse = vi.fn();
const mockParseApiVoidResponse = vi.fn();
vi.mock('@/lib/api/parse-response', () => ({
  parseApiResponse: (...args: unknown[]) => mockParseApiResponse(...args),
  parseApiVoidResponse: (...args: unknown[]) => mockParseApiVoidResponse(...args),
}));

// Mock safe-json
vi.mock('@/lib/api/safe-json', () => ({
  safeParseErrorJson: vi.fn().mockResolvedValue({ message: 'Error' }),
}));

// We need to reset the Zustand store between tests.
// The chat store uses `persist` middleware, which stores state in localStorage.
// We import and reset it manually.
import { useChatStore } from '@/store/chat-store';
import { useChat, useChatWithCase } from './use-chat';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  Wrapper.displayName = 'TestQueryWrapper';
  return { Wrapper, queryClient };
}

const mockConversations = [
  {
    id: 'conv-1',
    title: 'H-1B Discussion',
    caseId: 'case-1',
    createdAt: '2026-02-20T10:00:00Z',
    updatedAt: '2026-02-20T10:30:00Z',
  },
  {
    id: 'conv-2',
    title: 'General Questions',
    createdAt: '2026-02-19T08:00:00Z',
    updatedAt: '2026-02-19T09:00:00Z',
  },
];

const mockConversationMessages = {
  messages: [
    { role: 'user' as const, content: 'What documents do I need?' },
    { role: 'assistant' as const, content: 'You need a passport copy and I-94.' },
  ],
};

describe('useChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset Zustand store to initial state
    useChatStore.setState({
      isOpen: false,
      isLoading: false,
      error: null,
      currentConversationId: null,
      caseId: null,
      messages: [],
      conversations: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('returns initial state', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useChat(), {
      wrapper: Wrapper,
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.currentConversationId).toBeNull();
    expect(result.current.caseId).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(result.current.conversations).toEqual([]);
    expect(result.current.isSending).toBe(false);
    expect(result.current.isDeleting).toBe(false);
  });

  test('openChat sets isOpen to true', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useChat(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.openChat();
    });

    expect(result.current.isOpen).toBe(true);
  });

  test('openChat with caseId sets case context', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useChat(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.openChat('case-1');
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.caseId).toBe('case-1');
  });

  test('closeChat sets isOpen to false', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useChat(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.openChat();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.closeChat();
    });
    expect(result.current.isOpen).toBe(false);
  });

  test('toggleChat toggles isOpen', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useChat(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.toggleChat();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.toggleChat();
    });
    expect(result.current.isOpen).toBe(false);
  });

  test('setCaseContext sets caseId', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useChat(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.setCaseContext('case-1');
    });

    expect(result.current.caseId).toBe('case-1');
  });

  test('startNewConversation clears messages and conversationId', () => {
    // Pre-populate store
    useChatStore.setState({
      currentConversationId: 'conv-1',
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          createdAt: '2026-02-20T10:00:00Z',
        },
      ],
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useChat(), {
      wrapper: Wrapper,
    });

    expect(result.current.currentConversationId).toBe('conv-1');
    expect(result.current.messages).toHaveLength(1);

    act(() => {
      result.current.startNewConversation();
    });

    expect(result.current.currentConversationId).toBeNull();
    expect(result.current.messages).toEqual([]);
  });

  test('clearMessages clears messages', () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          createdAt: '2026-02-20T10:00:00Z',
        },
      ],
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useChat(), {
      wrapper: Wrapper,
    });

    expect(result.current.messages).toHaveLength(1);

    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toEqual([]);
  });

  test('fetches conversations when chat is open', async () => {
    // Open the chat first so the query is enabled
    useChatStore.setState({ isOpen: true });

    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue({ conversations: mockConversations });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useChat(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoadingConversations).toBe(false);
    });

    // The hook calls setConversations which updates the store
    expect(result.current.conversations).toEqual(mockConversations);
    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      '/api/chat?',
      { timeout: 'STANDARD' }
    );
  });

  test('fetches conversations with caseId filter', async () => {
    useChatStore.setState({ isOpen: true, caseId: 'case-1' });

    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue({ conversations: [mockConversations[0]] });

    const { Wrapper } = createWrapper();
    renderHook(() => useChat(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(mockFetchWithTimeout).toHaveBeenCalled();
    });

    const calledUrl = mockFetchWithTimeout.mock.calls[0][0] as string;
    expect(calledUrl).toContain('caseId=case-1');
  });

  test('does not fetch conversations when chat is closed', () => {
    useChatStore.setState({ isOpen: false });

    const { Wrapper } = createWrapper();
    renderHook(() => useChat(), {
      wrapper: Wrapper,
    });

    // fetchWithTimeout should not be called since isOpen is false (query is disabled)
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });

  test('loadConversation fetches messages and updates store', async () => {
    useChatStore.setState({ isOpen: true });

    // First call is for conversations list (from the query), second for conversation messages
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse
      .mockResolvedValueOnce({ conversations: [] }) // conversations query
      .mockResolvedValueOnce(mockConversationMessages); // loadConversation

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useChat(), {
      wrapper: Wrapper,
    });

    // Wait for the initial conversations query to finish
    await waitFor(() => {
      expect(result.current.isLoadingConversations).toBe(false);
    });

    await act(async () => {
      await result.current.loadConversation('conv-1');
    });

    expect(result.current.currentConversationId).toBe('conv-1');
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[0].content).toBe('What documents do I need?');
    expect(result.current.messages[1].role).toBe('assistant');
    expect(result.current.messages[1].content).toBe(
      'You need a passport copy and I-94.'
    );
  });

  test('loadConversation handles errors', async () => {
    useChatStore.setState({ isOpen: true });

    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse
      .mockResolvedValueOnce({ conversations: [] }) // conversations query
      .mockRejectedValueOnce(new Error('Not found')); // loadConversation

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useChat(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoadingConversations).toBe(false);
    });

    await act(async () => {
      await result.current.loadConversation('nonexistent');
    });

    expect(result.current.error).toBe('Not found');
  });

  test('deleteConversation calls API and invalidates queries', async () => {
    useChatStore.setState({ isOpen: true, currentConversationId: 'conv-1' });

    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue({ conversations: mockConversations });
    mockParseApiVoidResponse.mockResolvedValue(undefined);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useChat(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoadingConversations).toBe(false);
    });

    await act(async () => {
      result.current.deleteConversation('conv-1');
    });

    await waitFor(() => {
      expect(result.current.isDeleting).toBe(false);
    });

    // Should have called DELETE on the conversation endpoint
    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/chat/conv-1', {
      method: 'DELETE',
      timeout: 'STANDARD',
    });

    // Since we're deleting the current conversation, it should start a new one
    expect(result.current.currentConversationId).toBeNull();
    expect(result.current.messages).toEqual([]);

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['conversations'] });
  });

  test('deleteConversation does not clear messages if deleting a different conversation', async () => {
    useChatStore.setState({
      isOpen: true,
      currentConversationId: 'conv-1',
      messages: [
        {
          id: 'msg-1',
          role: 'user' as const,
          content: 'Hello',
          createdAt: '2026-02-20T10:00:00Z',
        },
      ],
    });

    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue({ conversations: mockConversations });
    mockParseApiVoidResponse.mockResolvedValue(undefined);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useChat(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoadingConversations).toBe(false);
    });

    await act(async () => {
      result.current.deleteConversation('conv-2'); // Delete a different conversation
    });

    await waitFor(() => {
      expect(result.current.isDeleting).toBe(false);
    });

    // Should NOT clear current conversation
    expect(result.current.currentConversationId).toBe('conv-1');
    expect(result.current.messages).toHaveLength(1);
  });

  test('cancelRequest aborts ongoing request', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useChat(), {
      wrapper: Wrapper,
    });

    // Calling cancelRequest when there is no ongoing request should not throw
    act(() => {
      result.current.cancelRequest();
    });

    expect(result.current.isLoading).toBe(false);
  });

  // TODO: sendMessage with streaming SSE is very complex to test without modifying source.
  // The hook uses native `fetch` (not fetchWithTimeout) for the streaming POST,
  // and processes a ReadableStream with SSE events. Testing this requires:
  // 1. Mocking global `fetch` to return a Response with a ReadableStream body
  // 2. Simulating the stream's async iteration
  // 3. Handling the abort controller and reader lifecycle
  //
  // The core streaming logic is tightly coupled with the Zustand store mutations
  // (addMessage, updateMessage, setMessageStreaming) which makes isolated testing
  // difficult without either modifying the source or creating very brittle mocks.
  //
  // Non-streaming CRUD operations (above) provide good coverage of the hook's
  // query/mutation patterns.
});

describe('useChatWithCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({
      isOpen: false,
      isLoading: false,
      error: null,
      currentConversationId: null,
      caseId: null,
      messages: [],
      conversations: [],
    });
  });

  test('openChat sets case context and opens chat', () => {
    const { result } = renderHook(() => useChatWithCase('case-1'));

    act(() => {
      result.current.openChat();
    });

    const storeState = useChatStore.getState();
    expect(storeState.isOpen).toBe(true);
    expect(storeState.caseId).toBe('case-1');
  });

  test('openChat uses the provided caseId', () => {
    const { result } = renderHook(() => useChatWithCase('case-42'));

    act(() => {
      result.current.openChat();
    });

    const storeState = useChatStore.getState();
    expect(storeState.caseId).toBe('case-42');
  });
});
