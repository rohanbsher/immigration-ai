import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeyboardShortcutsDialog } from './keyboard-shortcuts-dialog';

const sampleShortcuts = [
  { keys: ['g', 'd'], label: 'G D', description: 'Go to Dashboard', category: 'Navigation' },
  { keys: ['g', 'c'], label: 'G C', description: 'Go to Cases', category: 'Navigation' },
  { keys: ['n', 'c'], label: 'N C', description: 'New Case', category: 'Actions' },
  { keys: ['?'], label: '?', description: 'Show keyboard shortcuts', category: 'Help' },
];

describe('KeyboardShortcutsDialog', () => {
  test('renders dialog content when open=true', () => {
    render(
      <KeyboardShortcutsDialog
        open={true}
        onOpenChange={vi.fn()}
        shortcuts={sampleShortcuts}
      />
    );

    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  test('does not render content when open=false', () => {
    render(
      <KeyboardShortcutsDialog
        open={false}
        onOpenChange={vi.fn()}
        shortcuts={sampleShortcuts}
      />
    );

    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
  });

  test('groups shortcuts by category', () => {
    render(
      <KeyboardShortcutsDialog
        open={true}
        onOpenChange={vi.fn()}
        shortcuts={sampleShortcuts}
      />
    );

    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Help')).toBeInTheDocument();
  });

  test('includes built-in General category with "Open command palette"', () => {
    render(
      <KeyboardShortcutsDialog
        open={true}
        onOpenChange={vi.fn()}
        shortcuts={sampleShortcuts}
      />
    );

    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Open command palette')).toBeInTheDocument();
  });

  test('shows "then" separator for two-key shortcuts', () => {
    render(
      <KeyboardShortcutsDialog
        open={true}
        onOpenChange={vi.fn()}
        shortcuts={sampleShortcuts}
      />
    );

    // Two-key shortcuts like "G D" should have "then" separators
    const thenElements = screen.getAllByText('then');
    expect(thenElements.length).toBeGreaterThan(0);

    // Single-key shortcut "?" should not have "then"
    // There are 3 two-key shortcuts (G D, G C, N C) plus built-in (Cmd K)
    // so there should be 4 "then" elements
    expect(thenElements).toHaveLength(4);
  });

  test('calls onOpenChange when dismissed via close button', async () => {
    const user = userEvent.setup();
    const mockOnOpenChange = vi.fn();

    render(
      <KeyboardShortcutsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        shortcuts={sampleShortcuts}
      />
    );

    // Click the close button (sr-only "Close" text)
    const closeButton = screen.getByRole('button', { name: 'Close' });
    await user.click(closeButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});
