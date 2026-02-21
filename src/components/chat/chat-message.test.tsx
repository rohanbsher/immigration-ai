import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatMessage, TypingIndicator } from './chat-message';

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

describe('ChatMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders user message content', () => {
    render(<ChatMessage role="user" content="Hello world" />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  test('renders assistant message content', () => {
    render(<ChatMessage role="assistant" content="I can help you with that" />);
    expect(screen.getByText('I can help you with that')).toBeInTheDocument();
  });

  test('shows ellipsis when streaming with empty content for assistant', () => {
    render(<ChatMessage role="assistant" content="" isStreaming />);
    expect(screen.getByText('...')).toBeInTheDocument();
  });

  test('does not show ellipsis when streaming with content', () => {
    render(<ChatMessage role="assistant" content="Thinking..." isStreaming />);
    expect(screen.getByText('Thinking...')).toBeInTheDocument();
  });

  test('shows animated cursor when assistant is streaming', () => {
    const { container } = render(
      <ChatMessage role="assistant" content="Generating" isStreaming />
    );
    const cursor = container.querySelector('.animate-blink');
    expect(cursor).toBeInTheDocument();
  });

  test('does not show animated cursor for user messages even when streaming', () => {
    const { container } = render(
      <ChatMessage role="user" content="My message" isStreaming />
    );
    const cursor = container.querySelector('.animate-blink');
    expect(cursor).not.toBeInTheDocument();
  });

  test('shows pulse animation on assistant bubble when streaming', () => {
    const { container } = render(
      <ChatMessage role="assistant" content="Loading" isStreaming />
    );
    const bubble = container.querySelector('.animate-pulse');
    expect(bubble).toBeInTheDocument();
  });

  test('does not show pulse animation when not streaming', () => {
    const { container } = render(
      <ChatMessage role="assistant" content="Done" />
    );
    const bubble = container.querySelector('.animate-pulse');
    expect(bubble).not.toBeInTheDocument();
  });

  test('displays formatted timestamp when provided and not streaming', () => {
    render(
      <ChatMessage
        role="user"
        content="Hello"
        timestamp="2026-02-20T14:30:00.000Z"
      />
    );
    // The timestamp should be rendered (format depends on locale)
    const timeEl = screen.getByText(/\d{1,2}:\d{2}/);
    expect(timeEl).toBeInTheDocument();
  });

  test('hides timestamp when streaming', () => {
    render(
      <ChatMessage
        role="assistant"
        content="Typing"
        isStreaming
        timestamp="2026-02-20T14:30:00.000Z"
      />
    );
    const timeEls = screen.queryAllByText(/\d{1,2}:\d{2}/);
    expect(timeEls).toHaveLength(0);
  });

  test('does not render timestamp when not provided', () => {
    const { container } = render(
      <ChatMessage role="user" content="No timestamp" />
    );
    // No timestamp span should exist beyond the bubble
    const spans = container.querySelectorAll('.text-muted-foreground');
    const timeSpans = Array.from(spans).filter((s) =>
      /\d{1,2}:\d{2}/.test(s.textContent || '')
    );
    expect(timeSpans).toHaveLength(0);
  });

  test('handles invalid timestamp gracefully', () => {
    render(
      <ChatMessage
        role="user"
        content="Bad time"
        timestamp="not-a-date"
      />
    );
    // Should still render content without crashing
    expect(screen.getByText('Bad time')).toBeInTheDocument();
  });

  test('user message has flex-row-reverse layout', () => {
    const { container } = render(
      <ChatMessage role="user" content="User msg" />
    );
    const outer = container.firstElementChild;
    expect(outer?.className).toContain('flex-row-reverse');
  });

  test('assistant message has flex-row layout', () => {
    const { container } = render(
      <ChatMessage role="assistant" content="Bot msg" />
    );
    const outer = container.firstElementChild;
    expect(outer?.className).toContain('flex-row');
    expect(outer?.className).not.toContain('flex-row-reverse');
  });
});

describe('TypingIndicator', () => {
  test('renders three animated dots', () => {
    const { container } = render(<TypingIndicator />);
    const dots = container.querySelectorAll('.animate-bounce');
    expect(dots).toHaveLength(3);
  });

  test('dots have staggered animation delays', () => {
    const { container } = render(<TypingIndicator />);
    const dots = container.querySelectorAll('.animate-bounce');
    expect(dots[0]).toHaveStyle({ animationDelay: '0ms' });
    expect(dots[1]).toHaveStyle({ animationDelay: '150ms' });
    expect(dots[2]).toHaveStyle({ animationDelay: '300ms' });
  });

  test('renders assistant avatar icon', () => {
    const { container } = render(<TypingIndicator />);
    // Should have the Sparkles icon in the avatar circle
    const avatar = container.querySelector('.rounded-full');
    expect(avatar).toBeInTheDocument();
  });
});
