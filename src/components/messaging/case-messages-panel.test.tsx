import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CaseMessagesPanel } from './case-messages-panel';
import { useUser } from '@/hooks/use-user';
import { useCaseMessages, useSendMessage } from '@/hooks/use-case-messages';
import { toast } from 'sonner';
import type { CaseMessage } from '@/hooks/use-case-messages';

vi.mock('@/hooks/use-user', () => ({
  useUser: vi.fn(),
}));

vi.mock('@/hooks/use-case-messages', () => ({
  useCaseMessages: vi.fn(),
  useSendMessage: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock child components to isolate panel behavior
vi.mock('./message-thread', () => ({
  MessageThread: ({
    messages,
    currentUserId,
    isLoading,
  }: {
    messages: CaseMessage[];
    currentUserId: string;
    isLoading?: boolean;
  }) => (
    <div data-testid="message-thread" data-loading={isLoading} data-user={currentUserId}>
      {messages.map((m) => (
        <div key={m.id} data-testid={`thread-msg-${m.id}`}>
          {m.content}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('./message-input', () => ({
  MessageInput: ({
    onSend,
    isLoading,
    disabled,
    placeholder,
  }: {
    onSend: (content: string) => void;
    isLoading?: boolean;
    disabled?: boolean;
    placeholder?: string;
  }) => (
    <div data-testid="message-input" data-loading={isLoading} data-disabled={disabled}>
      <input
        data-testid="mock-input"
        placeholder={placeholder}
        disabled={disabled || isLoading}
        onChange={() => {}}
      />
      <button
        data-testid="mock-send-btn"
        onClick={() => onSend('test message')}
        disabled={disabled || isLoading}
      >
        Send
      </button>
    </div>
  ),
}));

const mockedUseUser = vi.mocked(useUser);
const mockedUseCaseMessages = vi.mocked(useCaseMessages);
const mockedUseSendMessage = vi.mocked(useSendMessage);

const mockSendMutate = vi.fn();

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function defaultUserReturn(overrides: Partial<ReturnType<typeof useUser>> = {}) {
  return {
    user: { id: 'user-1', email: 'attorney@example.com' } as ReturnType<typeof useUser>['user'],
    profile: {
      id: 'user-1',
      email: 'attorney@example.com',
      role: 'attorney' as const,
      first_name: 'Jane',
      last_name: 'Smith',
      phone: null,
      mfa_enabled: false,
      avatar_url: null,
      bar_number: null,
      firm_name: null,
      specializations: null,
      date_of_birth: null,
      country_of_birth: null,
      nationality: null,
      alien_number: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    isLoading: false,
    error: null,
    signOut: vi.fn(),
    refreshProfile: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useUser>;
}

function createMessage(overrides: Partial<CaseMessage> = {}): CaseMessage {
  return {
    id: 'msg-1',
    case_id: 'case-1',
    sender_id: 'user-1',
    content: 'Hello',
    read_at: null,
    created_at: '2026-02-20T14:30:00.000Z',
    deleted_at: null,
    sender: {
      id: 'user-1',
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane@example.com',
      role: 'attorney',
      avatar_url: null,
    },
    ...overrides,
  };
}

describe('CaseMessagesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedUseUser.mockReturnValue(defaultUserReturn());

    mockedUseCaseMessages.mockReturnValue({
      data: { data: [], total: 0, limit: 50, offset: 0 },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCaseMessages>);

    mockedUseSendMessage.mockReturnValue({
      mutate: mockSendMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useSendMessage>);
  });

  test('renders Messages header', () => {
    render(<CaseMessagesPanel caseId="case-1" />, {
      wrapper: createQueryWrapper(),
    });
    expect(screen.getByText('Messages')).toBeInTheDocument();
  });

  test('renders error state when messages fail to load', () => {
    mockedUseCaseMessages.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
    } as unknown as ReturnType<typeof useCaseMessages>);

    render(<CaseMessagesPanel caseId="case-1" />, {
      wrapper: createQueryWrapper(),
    });
    expect(screen.getByText('Failed to load messages')).toBeInTheDocument();
  });

  test('passes messages data to MessageThread', () => {
    const messages = [
      createMessage({ id: 'msg-1', content: 'Hello there' }),
      createMessage({ id: 'msg-2', content: 'How are you?' }),
    ];

    mockedUseCaseMessages.mockReturnValue({
      data: { data: messages, total: 2, limit: 50, offset: 0 },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCaseMessages>);

    render(<CaseMessagesPanel caseId="case-1" />, {
      wrapper: createQueryWrapper(),
    });
    expect(screen.getByTestId('thread-msg-msg-1')).toHaveTextContent('Hello there');
    expect(screen.getByTestId('thread-msg-msg-2')).toHaveTextContent('How are you?');
  });

  test('passes current user ID to MessageThread', () => {
    render(<CaseMessagesPanel caseId="case-1" />, {
      wrapper: createQueryWrapper(),
    });
    const thread = screen.getByTestId('message-thread');
    expect(thread).toHaveAttribute('data-user', 'user-1');
  });

  test('shows loading state in thread when messages are loading', () => {
    mockedUseCaseMessages.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useCaseMessages>);

    render(<CaseMessagesPanel caseId="case-1" />, {
      wrapper: createQueryWrapper(),
    });
    const thread = screen.getByTestId('message-thread');
    expect(thread).toHaveAttribute('data-loading', 'true');
  });

  test('shows loading state when profile is loading', () => {
    mockedUseUser.mockReturnValue(
      defaultUserReturn({ isLoading: true })
    );

    render(<CaseMessagesPanel caseId="case-1" />, {
      wrapper: createQueryWrapper(),
    });
    const thread = screen.getByTestId('message-thread');
    expect(thread).toHaveAttribute('data-loading', 'true');
  });

  test('calls sendMessage mutate when message is sent', async () => {
    const user = userEvent.setup();
    render(<CaseMessagesPanel caseId="case-1" />, {
      wrapper: createQueryWrapper(),
    });

    await user.click(screen.getByTestId('mock-send-btn'));
    expect(mockSendMutate).toHaveBeenCalledWith('test message', expect.any(Object));
  });

  test('shows toast error when sendMessage fails', async () => {
    mockSendMutate.mockImplementation((_content: string, options: { onError: (err: Error) => void }) => {
      options.onError(new Error('Send failed'));
    });

    const user = userEvent.setup();
    render(<CaseMessagesPanel caseId="case-1" />, {
      wrapper: createQueryWrapper(),
    });

    await user.click(screen.getByTestId('mock-send-btn'));
    expect(toast.error).toHaveBeenCalledWith('Send failed');
  });

  test('shows generic error message when error has no message', async () => {
    mockSendMutate.mockImplementation((_content: string, options: { onError: (err: Error) => void }) => {
      options.onError(new Error(''));
    });

    const user = userEvent.setup();
    render(<CaseMessagesPanel caseId="case-1" />, {
      wrapper: createQueryWrapper(),
    });

    await user.click(screen.getByTestId('mock-send-btn'));
    expect(toast.error).toHaveBeenCalledWith('Failed to send message');
  });

  test('disables input when profile is null', () => {
    mockedUseUser.mockReturnValue(
      defaultUserReturn({ profile: null } as unknown as Partial<ReturnType<typeof useUser>>)
    );

    render(<CaseMessagesPanel caseId="case-1" />, {
      wrapper: createQueryWrapper(),
    });
    const input = screen.getByTestId('message-input');
    expect(input).toHaveAttribute('data-disabled', 'true');
  });

  test('shows isSending state in message input', () => {
    mockedUseSendMessage.mockReturnValue({
      mutate: mockSendMutate,
      isPending: true,
    } as unknown as ReturnType<typeof useSendMessage>);

    render(<CaseMessagesPanel caseId="case-1" />, {
      wrapper: createQueryWrapper(),
    });
    const input = screen.getByTestId('message-input');
    expect(input).toHaveAttribute('data-loading', 'true');
  });

  test('sets attorney placeholder for attorney role', () => {
    render(<CaseMessagesPanel caseId="case-1" />, {
      wrapper: createQueryWrapper(),
    });
    const mockInput = screen.getByTestId('mock-input');
    expect(mockInput).toHaveAttribute('placeholder', 'Message your client...');
  });

  test('sets client placeholder for client role', () => {
    mockedUseUser.mockReturnValue(
      defaultUserReturn({
        profile: {
          id: 'user-1',
          email: 'client@example.com',
          role: 'client' as const,
          first_name: 'Bob',
          last_name: 'Jones',
          phone: null,
          mfa_enabled: false,
          avatar_url: null,
          bar_number: null,
          firm_name: null,
          specializations: null,
          date_of_birth: null,
          country_of_birth: null,
          nationality: null,
          alien_number: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      })
    );

    render(<CaseMessagesPanel caseId="case-1" />, {
      wrapper: createQueryWrapper(),
    });
    const mockInput = screen.getByTestId('mock-input');
    expect(mockInput).toHaveAttribute('placeholder', 'Message your attorney...');
  });

  test('passes className to Card wrapper', () => {
    const { container } = render(
      <CaseMessagesPanel caseId="case-1" className="custom-class" />,
      { wrapper: createQueryWrapper() }
    );
    // The Card element should have the custom class
    const card = container.firstElementChild;
    expect(card?.className).toContain('custom-class');
  });
});
