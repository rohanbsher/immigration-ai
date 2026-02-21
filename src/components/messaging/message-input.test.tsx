import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageInput } from './message-input';

describe('MessageInput', () => {
  const mockOnSend = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders textarea with default placeholder', () => {
    render(<MessageInput onSend={mockOnSend} />);
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
  });

  test('renders textarea with custom placeholder', () => {
    render(<MessageInput onSend={mockOnSend} placeholder="Message your attorney..." />);
    expect(screen.getByPlaceholderText('Message your attorney...')).toBeInTheDocument();
  });

  test('send button is disabled when textarea is empty', () => {
    render(<MessageInput onSend={mockOnSend} />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  test('send button is disabled when textarea contains only whitespace', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSend={mockOnSend} />);

    const textarea = screen.getByPlaceholderText('Type your message...');
    await user.type(textarea, '   ');

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  test('send button is enabled when textarea has content', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSend={mockOnSend} />);

    const textarea = screen.getByPlaceholderText('Type your message...');
    await user.type(textarea, 'Hello');

    const button = screen.getByRole('button');
    expect(button).not.toBeDisabled();
  });

  test('calls onSend with trimmed content when button is clicked', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSend={mockOnSend} />);

    const textarea = screen.getByPlaceholderText('Type your message...');
    await user.type(textarea, '  Hello world  ');
    await user.click(screen.getByRole('button'));

    expect(mockOnSend).toHaveBeenCalledWith('Hello world');
  });

  test('clears textarea after sending', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSend={mockOnSend} />);

    const textarea = screen.getByPlaceholderText('Type your message...');
    await user.type(textarea, 'Hello');
    await user.click(screen.getByRole('button'));

    expect(textarea).toHaveValue('');
  });

  test('sends message on Enter key press', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSend={mockOnSend} />);

    const textarea = screen.getByPlaceholderText('Type your message...');
    await user.type(textarea, 'Hello');
    await user.keyboard('{Enter}');

    expect(mockOnSend).toHaveBeenCalledWith('Hello');
  });

  test('does not send on Shift+Enter (allows multiline)', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSend={mockOnSend} />);

    const textarea = screen.getByPlaceholderText('Type your message...');
    await user.type(textarea, 'Line 1');

    // Shift+Enter should NOT trigger send
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(mockOnSend).not.toHaveBeenCalled();
  });

  test('textarea is disabled when disabled prop is true', () => {
    render(<MessageInput onSend={mockOnSend} disabled />);
    const textarea = screen.getByPlaceholderText('Type your message...');
    expect(textarea).toBeDisabled();
  });

  test('textarea is disabled when isLoading is true', () => {
    render(<MessageInput onSend={mockOnSend} isLoading />);
    const textarea = screen.getByPlaceholderText('Type your message...');
    expect(textarea).toBeDisabled();
  });

  test('send button is disabled when isLoading', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSend={mockOnSend} isLoading />);

    // Even if we could type, button should be disabled
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  test('send button is disabled when disabled prop is true even with content', () => {
    render(<MessageInput onSend={mockOnSend} disabled />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  test('does not call onSend when empty and Enter is pressed', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSend={mockOnSend} />);

    const textarea = screen.getByPlaceholderText('Type your message...');
    await user.keyboard('{Enter}');

    expect(mockOnSend).not.toHaveBeenCalled();
  });

  test('does not call onSend when disabled and button clicked', async () => {
    render(<MessageInput onSend={mockOnSend} disabled />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(mockOnSend).not.toHaveBeenCalled();
  });
});
