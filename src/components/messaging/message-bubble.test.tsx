import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble } from './message-bubble';
import type { CaseMessage } from '@/hooks/use-case-messages';

function createMessage(overrides: Partial<CaseMessage> = {}): CaseMessage {
  return {
    id: 'msg-1',
    case_id: 'case-1',
    sender_id: 'user-1',
    content: 'Hello, I need help with my case.',
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

describe('MessageBubble', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders message content', () => {
    const message = createMessage({ content: 'Please review the documents.' });
    render(<MessageBubble message={message} isOwnMessage={false} />);
    expect(screen.getByText('Please review the documents.')).toBeInTheDocument();
  });

  test('displays sender full name', () => {
    const message = createMessage();
    render(<MessageBubble message={message} isOwnMessage={false} />);
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  test('shows initials in avatar fallback', () => {
    const message = createMessage();
    render(<MessageBubble message={message} isOwnMessage={false} />);
    expect(screen.getByText('JS')).toBeInTheDocument();
  });

  test('shows Attorney role label for attorney sender', () => {
    const message = createMessage({
      sender: {
        id: 'user-1',
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@example.com',
        role: 'attorney',
        avatar_url: null,
      },
    });
    render(<MessageBubble message={message} isOwnMessage={false} />);
    expect(screen.getByText('(Attorney)')).toBeInTheDocument();
  });

  test('shows Client role label for client sender', () => {
    const message = createMessage({
      sender: {
        id: 'user-2',
        first_name: 'Bob',
        last_name: 'Jones',
        email: 'bob@example.com',
        role: 'client',
        avatar_url: null,
      },
    });
    render(<MessageBubble message={message} isOwnMessage={false} />);
    expect(screen.getByText('(Client)')).toBeInTheDocument();
  });

  test('displays formatted timestamp', () => {
    const message = createMessage({ created_at: '2026-02-20T14:30:00.000Z' });
    render(<MessageBubble message={message} isOwnMessage={false} />);
    // date-fns format: "Feb 20, 2:30 PM" (depends on timezone but always has "Feb 20")
    expect(screen.getByText(/Feb 20/)).toBeInTheDocument();
  });

  test('shows Read indicator for own message that has been read', () => {
    const message = createMessage({
      read_at: '2026-02-20T15:00:00.000Z',
    });
    render(<MessageBubble message={message} isOwnMessage={true} />);
    expect(screen.getByText('Read')).toBeInTheDocument();
  });

  test('does not show Read indicator for own unread message', () => {
    const message = createMessage({ read_at: null });
    render(<MessageBubble message={message} isOwnMessage={true} />);
    expect(screen.queryByText('Read')).not.toBeInTheDocument();
  });

  test('does not show Read indicator for other user message even if read', () => {
    const message = createMessage({
      read_at: '2026-02-20T15:00:00.000Z',
    });
    render(<MessageBubble message={message} isOwnMessage={false} />);
    expect(screen.queryByText('Read')).not.toBeInTheDocument();
  });

  test('handles missing sender gracefully with Unknown User fallback', () => {
    const message = createMessage({ sender: undefined });
    render(<MessageBubble message={message} isOwnMessage={false} />);
    expect(screen.getByText('Unknown User')).toBeInTheDocument();
  });

  test('shows U initial when sender is missing', () => {
    const message = createMessage({ sender: undefined });
    render(<MessageBubble message={message} isOwnMessage={false} />);
    expect(screen.getByText('U')).toBeInTheDocument();
  });

  test('handles sender with only first name', () => {
    const message = createMessage({
      sender: {
        id: 'user-3',
        first_name: 'Alice',
        last_name: '',
        email: 'alice@example.com',
        role: 'client',
        avatar_url: null,
      },
    });
    render(<MessageBubble message={message} isOwnMessage={false} />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  test('own message has ml-auto class for right alignment', () => {
    const message = createMessage();
    const { container } = render(
      <MessageBubble message={message} isOwnMessage={true} />
    );
    const outer = container.firstElementChild;
    expect(outer?.className).toContain('ml-auto');
  });

  test('other user message does not have ml-auto class', () => {
    const message = createMessage();
    const { container } = render(
      <MessageBubble message={message} isOwnMessage={false} />
    );
    const outer = container.firstElementChild;
    expect(outer?.className).not.toContain('ml-auto');
  });

  test('own message bubble uses primary background', () => {
    const message = createMessage();
    const { container } = render(
      <MessageBubble message={message} isOwnMessage={true} />
    );
    const bubble = container.querySelector('.bg-primary');
    expect(bubble).toBeInTheDocument();
  });

  test('other user message bubble uses muted background', () => {
    const message = createMessage();
    const { container } = render(
      <MessageBubble message={message} isOwnMessage={false} />
    );
    const bubble = container.querySelector('.bg-muted');
    expect(bubble).toBeInTheDocument();
  });
});
