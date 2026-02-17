import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useChat } from '@/hooks/use-chat';
import { ChatButton } from './chat-button';

vi.mock('@/hooks/use-chat', () => ({
  useChat: vi.fn(),
}));

const mockToggleChat = vi.fn();
const mockOpenChat = vi.fn();
const mockedUseChat = vi.mocked(useChat);

function mockChatReturn(overrides: Partial<ReturnType<typeof useChat>> = {}): ReturnType<typeof useChat> {
  return {
    isOpen: false,
    isLoading: false,
    error: null,
    currentConversationId: null,
    caseId: null,
    messages: [],
    conversations: [],
    isLoadingConversations: false,
    openChat: mockOpenChat,
    closeChat: vi.fn(),
    toggleChat: mockToggleChat,
    setCaseContext: vi.fn(),
    sendMessage: vi.fn(),
    cancelRequest: vi.fn(),
    clearMessages: vi.fn(),
    loadConversation: vi.fn(),
    startNewConversation: vi.fn(),
    deleteConversation: vi.fn(),
    isSending: false,
    isDeleting: false,
    ...overrides,
  };
}

describe('ChatButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseChat.mockReturnValue(mockChatReturn());
  });

  test('renders button with correct aria-label', () => {
    render(<ChatButton />);
    expect(screen.getByRole('button', { name: 'Open AI chat assistant' })).toBeInTheDocument();
  });

  test('has data-chat-float attribute for CSS targeting', () => {
    render(<ChatButton />);
    const button = screen.getByRole('button', { name: 'Open AI chat assistant' });
    expect(button).toHaveAttribute('data-chat-float');
  });

  test('calls toggleChat on click', () => {
    render(<ChatButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Open AI chat assistant' }));
    expect(mockToggleChat).toHaveBeenCalledTimes(1);
  });

  test('shows active indicator when a message is streaming', () => {
    mockedUseChat.mockReturnValue(mockChatReturn({
      messages: [{ role: 'assistant', content: 'Hello', isStreaming: true }] as ReturnType<typeof useChat>['messages'],
    }));

    render(<ChatButton />);
    expect(screen.getByTestId('streaming-indicator')).toBeInTheDocument();
  });

  test('hides with pointer-events-none when chat is open', () => {
    mockedUseChat.mockReturnValue(mockChatReturn({ isOpen: true }));

    render(<ChatButton />);
    const button = screen.getByRole('button', { name: 'Open AI chat assistant' });
    expect(button).toHaveClass('pointer-events-none');
  });

  test('shows tooltip text "AI Assistant"', () => {
    render(<ChatButton />);
    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
  });
});
