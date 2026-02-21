import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandPalette, useCommandPalette } from './command-palette';
import { renderHook, act } from '@testing-library/react';

// Polyfill ResizeObserver for JSDOM (required by cmdk)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Polyfill scrollIntoView for JSDOM (required by cmdk)
Element.prototype.scrollIntoView = vi.fn();

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders without crashing', () => {
    render(<CommandPalette />);
    // Dialog is initially closed so should not show content
    expect(screen.queryByPlaceholderText('Type a command or search...')).not.toBeInTheDocument();
  });

  test('opens on Cmd+K keyboard shortcut', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(screen.getByPlaceholderText('Type a command or search...')).toBeInTheDocument();
  });

  test('opens on Ctrl+K keyboard shortcut', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(screen.getByPlaceholderText('Type a command or search...')).toBeInTheDocument();
  });

  test('toggles open/close on repeated Cmd+K', () => {
    render(<CommandPalette />);

    // Open
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(screen.getByPlaceholderText('Type a command or search...')).toBeInTheDocument();

    // Close
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(screen.queryByPlaceholderText('Type a command or search...')).not.toBeInTheDocument();
  });

  test('displays Navigation group with all pages', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Cases')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('Forms')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('Clients')).toBeInTheDocument();
    expect(screen.getByText('Firm')).toBeInTheDocument();
    expect(screen.getByText('Billing')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  test('displays Quick Actions group', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByText('New Case')).toBeInTheDocument();
    expect(screen.getByText('Upload Document')).toBeInTheDocument();
    expect(screen.getByText('Search Cases')).toBeInTheDocument();
  });

  test('shows "No results found" for non-matching search', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    const input = screen.getByPlaceholderText('Type a command or search...');
    fireEvent.change(input, { target: { value: 'zzzznonexistent' } });

    expect(screen.getByText('No results found.')).toBeInTheDocument();
  });

  test('does not open on plain K key without modifier', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: 'k' });
    expect(screen.queryByPlaceholderText('Type a command or search...')).not.toBeInTheDocument();
  });

  test('cleans up event listener on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(<CommandPalette />);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeSpy.mockRestore();
  });
});

describe('useCommandPalette', () => {
  test('initializes with closed state', () => {
    const { result } = renderHook(() => useCommandPalette());
    expect(result.current.open).toBe(false);
  });

  test('toggle flips the open state', () => {
    const { result } = renderHook(() => useCommandPalette());

    act(() => {
      result.current.toggle();
    });
    expect(result.current.open).toBe(true);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.open).toBe(false);
  });

  test('setOpen sets the state directly', () => {
    const { result } = renderHook(() => useCommandPalette());

    act(() => {
      result.current.setOpen(true);
    });
    expect(result.current.open).toBe(true);

    act(() => {
      result.current.setOpen(false);
    });
    expect(result.current.open).toBe(false);
  });
});
