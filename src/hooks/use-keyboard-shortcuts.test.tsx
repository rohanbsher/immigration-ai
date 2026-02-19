import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

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
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

import { useKeyboardShortcuts, NAV_SHORTCUT_HINTS } from './use-keyboard-shortcuts';

function dispatchKey(key: string, options: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    ...options,
  });
  document.dispatchEvent(event);
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns shortcuts array and dialogOpen false initially', () => {
    const { result } = renderHook(() => useKeyboardShortcuts());

    expect(result.current.shortcuts).toBeInstanceOf(Array);
    expect(result.current.shortcuts.length).toBeGreaterThan(0);
    expect(result.current.dialogOpen).toBe(false);
  });

  test('? key toggles dialogOpen to true', () => {
    const { result } = renderHook(() => useKeyboardShortcuts());

    act(() => {
      dispatchKey('?');
    });

    expect(result.current.dialogOpen).toBe(true);
  });

  test('dialog closes on second ? press (toggles back)', () => {
    const { result } = renderHook(() => useKeyboardShortcuts());

    act(() => {
      dispatchKey('?');
    });
    expect(result.current.dialogOpen).toBe(true);

    act(() => {
      dispatchKey('?');
    });
    expect(result.current.dialogOpen).toBe(false);
  });

  test('two-key g then d navigates to /dashboard', () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => {
      dispatchKey('g');
    });
    act(() => {
      dispatchKey('d');
    });

    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  test('two-key g then c navigates to /dashboard/cases', () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => {
      dispatchKey('g');
    });
    act(() => {
      dispatchKey('c');
    });

    expect(mockPush).toHaveBeenCalledWith('/dashboard/cases');
  });

  test('two-key n then c navigates to /dashboard/cases/new', () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => {
      dispatchKey('n');
    });
    act(() => {
      dispatchKey('c');
    });

    expect(mockPush).toHaveBeenCalledWith('/dashboard/cases/new');
  });

  test('sequence timeout: g, wait 800ms+, then d does not navigate', () => {
    vi.useFakeTimers();

    renderHook(() => useKeyboardShortcuts());

    act(() => {
      dispatchKey('g');
    });

    act(() => {
      vi.advanceTimersByTime(900);
    });

    act(() => {
      dispatchKey('d');
    });

    expect(mockPush).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  test('ignored when activeElement is an input', () => {
    renderHook(() => useKeyboardShortcuts());

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    act(() => {
      dispatchKey('?');
    });

    // dialogOpen should remain false since input is focused
    // We can't check result.current here directly, but we verify
    // by checking that no navigation happens for g+d
    act(() => {
      dispatchKey('g');
    });
    act(() => {
      dispatchKey('d');
    });

    expect(mockPush).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  test('ignored when activeElement is a textarea', () => {
    renderHook(() => useKeyboardShortcuts());

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    act(() => {
      dispatchKey('g');
    });
    act(() => {
      dispatchKey('d');
    });

    expect(mockPush).not.toHaveBeenCalled();

    document.body.removeChild(textarea);
  });

  test('modifier keys (Ctrl+g) do not start a sequence', () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => {
      dispatchKey('g', { ctrlKey: true });
    });
    act(() => {
      dispatchKey('d');
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  test('unknown second key (g then x) does not trigger action', () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => {
      dispatchKey('g');
    });
    act(() => {
      dispatchKey('x');
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  test('event listener removed on unmount (no errors after unmount)', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts());

    unmount();

    // Should not throw when dispatching keys after unmount
    act(() => {
      dispatchKey('g');
    });
    act(() => {
      dispatchKey('d');
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  test('NAV_SHORTCUT_HINTS exports correct mappings', () => {
    expect(NAV_SHORTCUT_HINTS).toEqual({
      Dashboard: 'G D',
      Cases: 'G C',
      Tasks: 'G T',
      Settings: 'G S',
      Clients: 'G L',
      Documents: 'G O',
    });
  });
});
