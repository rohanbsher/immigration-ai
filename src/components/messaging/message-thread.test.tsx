import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageThread } from './message-thread';
import type { CaseMessage } from '@/hooks/use-case-messages';

// Mock the MessageBubble to isolate thread behavior
vi.mock('./message-bubble', () => ({
  MessageBubble: ({
    message,
    isOwnMessage,
  }: {
    message: CaseMessage;
    isOwnMessage: boolean;
  }) => (
    <div data-testid={`bubble-${message.id}`} data-own={isOwnMessage}>
      {message.content}
    </div>
  ),
}));

function createMessage(overrides: Partial<CaseMessage> = {}): CaseMessage {
  return {
    id: 'msg-1',
    case_id: 'case-1',
    sender_id: 'user-1',
    content: 'Test message',
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

describe('MessageThread', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom doesn't implement scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  test('renders loading spinner when isLoading is true', () => {
    const { container } = render(
      <MessageThread messages={[]} currentUserId="user-1" isLoading />
    );
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  test('renders empty state when no messages', () => {
    render(
      <MessageThread messages={[]} currentUserId="user-1" />
    );
    expect(screen.getByText('No messages yet')).toBeInTheDocument();
    expect(
      screen.getByText('Start the conversation by sending a message below.')
    ).toBeInTheDocument();
  });

  test('renders messages when provided', () => {
    const messages = [
      createMessage({ id: 'msg-1', content: 'First message' }),
      createMessage({ id: 'msg-2', content: 'Second message' }),
    ];

    render(
      <MessageThread messages={messages} currentUserId="user-1" />
    );
    expect(screen.getByText('First message')).toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();
  });

  test('passes isOwnMessage=true for messages from current user', () => {
    const messages = [
      createMessage({ id: 'msg-1', sender_id: 'user-1', content: 'My msg' }),
    ];

    render(
      <MessageThread messages={messages} currentUserId="user-1" />
    );
    const bubble = screen.getByTestId('bubble-msg-1');
    expect(bubble).toHaveAttribute('data-own', 'true');
  });

  test('passes isOwnMessage=false for messages from other users', () => {
    const messages = [
      createMessage({
        id: 'msg-2',
        sender_id: 'user-2',
        content: 'Their msg',
      }),
    ];

    render(
      <MessageThread messages={messages} currentUserId="user-1" />
    );
    const bubble = screen.getByTestId('bubble-msg-2');
    expect(bubble).toHaveAttribute('data-own', 'false');
  });

  test('renders multiple messages with correct ownership', () => {
    const messages = [
      createMessage({ id: 'msg-1', sender_id: 'user-1', content: 'From me' }),
      createMessage({ id: 'msg-2', sender_id: 'user-2', content: 'From them' }),
      createMessage({ id: 'msg-3', sender_id: 'user-1', content: 'From me again' }),
    ];

    render(
      <MessageThread messages={messages} currentUserId="user-1" />
    );

    expect(screen.getByTestId('bubble-msg-1')).toHaveAttribute('data-own', 'true');
    expect(screen.getByTestId('bubble-msg-2')).toHaveAttribute('data-own', 'false');
    expect(screen.getByTestId('bubble-msg-3')).toHaveAttribute('data-own', 'true');
  });

  test('calls scrollIntoView when messages arrive', () => {
    const messages = [createMessage({ id: 'msg-1' })];
    render(
      <MessageThread messages={messages} currentUserId="user-1" />
    );
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
    });
  });

  test('does not show loading spinner when isLoading is false', () => {
    const { container } = render(
      <MessageThread messages={[]} currentUserId="user-1" isLoading={false} />
    );
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).not.toBeInTheDocument();
  });

  test('handles empty messages array without crash', () => {
    const { container } = render(
      <MessageThread messages={[]} currentUserId="user-1" />
    );
    expect(container).toBeInTheDocument();
    expect(screen.getByText('No messages yet')).toBeInTheDocument();
  });

  test('renders all messages preserving order', () => {
    const messages = [
      createMessage({ id: 'msg-a', content: 'First' }),
      createMessage({ id: 'msg-b', content: 'Second' }),
      createMessage({ id: 'msg-c', content: 'Third' }),
    ];

    render(
      <MessageThread messages={messages} currentUserId="user-1" />
    );

    const bubbles = screen.getAllByTestId(/^bubble-/);
    expect(bubbles).toHaveLength(3);
    expect(bubbles[0]).toHaveTextContent('First');
    expect(bubbles[1]).toHaveTextContent('Second');
    expect(bubbles[2]).toHaveTextContent('Third');
  });

  test('loading state takes priority over empty state', () => {
    const { container } = render(
      <MessageThread messages={[]} currentUserId="user-1" isLoading />
    );
    expect(screen.queryByText('No messages yet')).not.toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});
