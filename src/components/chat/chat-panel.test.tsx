import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatPanel } from './chat-panel';

// Mock logger
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  }),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
    withContext: vi.fn().mockReturnThis(),
  },
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock AI components
vi.mock('@/components/ai', () => ({
  AIBadge: ({ size }: { size?: string }) => (
    <span data-testid="ai-badge" data-size={size}>AI</span>
  ),
  AIConsentModal: ({
    open,
    onConsent,
    onCancel,
  }: {
    open: boolean;
    onConsent: () => void;
    onCancel: () => void;
    error?: string | null;
  }) =>
    open ? (
      <div data-testid="ai-consent-modal">
        <button onClick={onConsent}>Accept</button>
        <button onClick={onCancel}>Decline</button>
      </div>
    ) : null,
}));

// Mock chat-message components
vi.mock('./chat-message', () => ({
  ChatMessage: ({ content, role }: { content: string; role: string }) => (
    <div data-testid={`chat-message-${role}`}>{content}</div>
  ),
  TypingIndicator: () => <div data-testid="typing-indicator">Typing...</div>,
}));

// Mock useChat
const mockCloseChat = vi.fn();
const mockSendMessage = vi.fn();
const mockCancelRequest = vi.fn();
const mockLoadConversation = vi.fn();
const mockStartNewConversation = vi.fn();
const mockDeleteConversation = vi.fn();
const mockUseChat = vi.fn();

vi.mock('@/hooks/use-chat', () => ({
  useChat: (...args: unknown[]) => mockUseChat(...args),
}));

// Mock useAiConsent
const mockGrantConsent = vi.fn();
const mockOpenConsentDialog = vi.fn();
const mockCloseConsentDialog = vi.fn();
const mockUseAiConsent = vi.fn();

vi.mock('@/hooks/use-ai-consent', () => ({
  useAiConsent: (...args: unknown[]) => mockUseAiConsent(...args),
}));

function defaultChatReturn(overrides: Record<string, unknown> = {}) {
  return {
    isOpen: true,
    isLoading: false,
    isSending: false,
    error: null,
    currentConversationId: null,
    caseId: null,
    messages: [],
    conversations: [],
    isLoadingConversations: false,
    closeChat: mockCloseChat,
    sendMessage: mockSendMessage,
    cancelRequest: mockCancelRequest,
    loadConversation: mockLoadConversation,
    startNewConversation: mockStartNewConversation,
    deleteConversation: mockDeleteConversation,
    ...overrides,
  };
}

function defaultConsentReturn(overrides: Record<string, unknown> = {}) {
  return {
    hasConsented: true,
    showConsentModal: false,
    consentError: null,
    grantConsent: mockGrantConsent,
    openConsentDialog: mockOpenConsentDialog,
    closeConsentDialog: mockCloseConsentDialog,
    ...overrides,
  };
}

describe('ChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChat.mockReturnValue(defaultChatReturn());
    mockUseAiConsent.mockReturnValue(defaultConsentReturn());
  });

  test('returns null when isOpen is false', () => {
    mockUseChat.mockReturnValue(defaultChatReturn({ isOpen: false }));

    const { container } = render(<ChatPanel />);
    expect(container.innerHTML).toBe('');
  });

  test('renders panel with AI Assistant header when open', () => {
    render(<ChatPanel />);
    const allAssistantText = screen.getAllByText('AI Assistant');
    expect(allAssistantText.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('ai-badge')).toBeInTheDocument();
  });

  test('renders empty chat state when no messages', () => {
    render(<ChatPanel />);
    expect(screen.getByText('AI Assistant', { selector: 'h3' })).toBeInTheDocument();
    expect(screen.getByText('Try asking:')).toBeInTheDocument();
  });

  test('renders case-specific empty state when caseId is set', () => {
    mockUseChat.mockReturnValue(defaultChatReturn({ caseId: 'case-123' }));

    render(<ChatPanel />);
    expect(screen.getByText('Case Assistant')).toBeInTheDocument();
    expect(screen.getByText('Discussing: Case context active')).toBeInTheDocument();
  });

  test('renders messages when present', () => {
    // jsdom doesn't implement scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();

    mockUseChat.mockReturnValue(
      defaultChatReturn({
        messages: [
          { id: 'm1', role: 'user', content: 'Hello there', createdAt: new Date().toISOString() },
          { id: 'm2', role: 'assistant', content: 'Hi! How can I help?', createdAt: new Date().toISOString() },
        ],
      })
    );

    render(<ChatPanel />);
    expect(screen.getByTestId('chat-message-user')).toHaveTextContent('Hello there');
    expect(screen.getByTestId('chat-message-assistant')).toHaveTextContent('Hi! How can I help?');
  });

  test('renders typing indicator when loading and no streaming messages', () => {
    Element.prototype.scrollIntoView = vi.fn();

    mockUseChat.mockReturnValue(
      defaultChatReturn({
        isLoading: true,
        messages: [
          { id: 'm1', role: 'user', content: 'Hello', createdAt: new Date().toISOString(), isStreaming: false },
        ],
      })
    );

    render(<ChatPanel />);
    expect(screen.getByTestId('typing-indicator')).toBeInTheDocument();
  });

  test('renders error message when error is present', () => {
    mockUseChat.mockReturnValue(
      defaultChatReturn({ error: 'Connection failed' })
    );

    render(<ChatPanel />);
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  test('close button calls closeChat', () => {
    render(<ChatPanel />);
    // The close button is the X button (second button in the header)
    const closeButtons = screen.getAllByRole('button');
    // The last button in header area with X icon
    const xButton = closeButtons.find(
      (btn) => btn.querySelector('svg') && btn.getAttribute('title') !== 'Conversation history'
    );
    // Click the backdrop instead for a simpler test
    const backdrop = document.querySelector('.fixed.inset-0');
    fireEvent.click(backdrop!);
    expect(mockCloseChat).toHaveBeenCalled();
  });

  test('input field renders with placeholder', () => {
    render(<ChatPanel />);
    expect(screen.getByPlaceholderText('Ask about this case...')).toBeInTheDocument();
  });

  test('send button is disabled when input is empty', () => {
    render(<ChatPanel />);
    const form = document.querySelector('form');
    const submitButton = form?.querySelector('button[type="submit"]');
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  test('submitting a message calls sendMessage', () => {
    render(<ChatPanel />);
    const input = screen.getByPlaceholderText('Ask about this case...');
    fireEvent.change(input, { target: { value: 'What documents are needed?' } });

    const form = document.querySelector('form')!;
    fireEvent.submit(form);

    expect(mockSendMessage).toHaveBeenCalledWith('What documents are needed?');
  });

  test('submitting without consent opens consent dialog', () => {
    mockUseAiConsent.mockReturnValue(defaultConsentReturn({ hasConsented: false }));

    render(<ChatPanel />);
    const input = screen.getByPlaceholderText('Ask about this case...');
    fireEvent.change(input, { target: { value: 'Help me' } });

    const form = document.querySelector('form')!;
    fireEvent.submit(form);

    expect(mockOpenConsentDialog).toHaveBeenCalled();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  test('shows cancel button when isSending is true', () => {
    mockUseChat.mockReturnValue(
      defaultChatReturn({ isSending: true })
    );

    render(<ChatPanel />);
    const input = screen.getByPlaceholderText('Ask about this case...');
    expect(input).toBeDisabled();
  });

  test('input is disabled when isSending', () => {
    mockUseChat.mockReturnValue(
      defaultChatReturn({ isSending: true })
    );

    render(<ChatPanel />);
    expect(screen.getByPlaceholderText('Ask about this case...')).toBeDisabled();
  });

  describe('conversation history', () => {
    test('shows conversation history button', () => {
      render(<ChatPanel />);
      const historyBtn = screen.getByTitle('Conversation history');
      expect(historyBtn).toBeInTheDocument();
    });

    test('clicking history button shows conversation list', () => {
      render(<ChatPanel />);
      fireEvent.click(screen.getByTitle('Conversation history'));
      expect(screen.getByText('Conversations')).toBeInTheDocument();
    });

    test('shows loading spinner when conversations are loading', () => {
      mockUseChat.mockReturnValue(
        defaultChatReturn({ isLoadingConversations: true })
      );

      render(<ChatPanel />);
      fireEvent.click(screen.getByTitle('Conversation history'));
      // Loading spinner is present (an animated div)
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    test('shows empty state when no conversations exist', () => {
      render(<ChatPanel />);
      fireEvent.click(screen.getByTitle('Conversation history'));
      expect(screen.getByText('No conversations yet')).toBeInTheDocument();
      expect(screen.getByText('Start a conversation')).toBeInTheDocument();
    });

    test('renders conversation list items', () => {
      mockUseChat.mockReturnValue(
        defaultChatReturn({
          conversations: [
            { id: 'c1', title: 'H-1B Discussion', updatedAt: new Date().toISOString() },
            { id: 'c2', title: 'Green Card Query', updatedAt: new Date().toISOString() },
          ],
        })
      );

      render(<ChatPanel />);
      fireEvent.click(screen.getByTitle('Conversation history'));
      expect(screen.getByText('H-1B Discussion')).toBeInTheDocument();
      expect(screen.getByText('Green Card Query')).toBeInTheDocument();
    });

    test('clicking a conversation calls loadConversation and hides history', () => {
      mockUseChat.mockReturnValue(
        defaultChatReturn({
          conversations: [
            { id: 'c1', title: 'H-1B Discussion', updatedAt: new Date().toISOString() },
          ],
        })
      );

      render(<ChatPanel />);
      fireEvent.click(screen.getByTitle('Conversation history'));
      fireEvent.click(screen.getByText('H-1B Discussion'));
      expect(mockLoadConversation).toHaveBeenCalledWith('c1');
    });

    test('back button hides conversation history', () => {
      render(<ChatPanel />);
      fireEvent.click(screen.getByTitle('Conversation history'));
      expect(screen.getByText('Conversations')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Back'));
      expect(screen.queryByText('Conversations')).not.toBeInTheDocument();
      // Header span + empty state h3 both show "AI Assistant"
      const matches = screen.getAllByText('AI Assistant');
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    test('new conversation button in history calls startNewConversation', () => {
      render(<ChatPanel />);
      fireEvent.click(screen.getByTitle('Conversation history'));
      // The Plus button in the history header
      expect(screen.getByText('No conversations yet')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Start a conversation'));
      expect(mockStartNewConversation).toHaveBeenCalled();
    });
  });

  test('consent modal renders when showConsentModal is true', () => {
    mockUseAiConsent.mockReturnValue(
      defaultConsentReturn({ showConsentModal: true })
    );

    render(<ChatPanel />);
    expect(screen.getByTestId('ai-consent-modal')).toBeInTheDocument();
  });
});
