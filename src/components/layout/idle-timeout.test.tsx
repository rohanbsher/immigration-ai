import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const mockSignOut = vi.fn().mockResolvedValue({});
const mockPush = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: { signOut: mockSignOut },
  })),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}));

import { IdleTimeoutProvider } from './idle-timeout';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const WARNING_BEFORE_MS = 2 * 60 * 1000;
const CHECK_INTERVAL_MS = 30_000;

describe('IdleTimeoutProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders children without showing the warning dialog', () => {
    render(
      <IdleTimeoutProvider>
        <p>Child content</p>
      </IdleTimeoutProvider>
    );

    expect(screen.getByText('Child content')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('shows warning dialog after idle timeout minus warning period', () => {
    render(
      <IdleTimeoutProvider>
        <p>Child content</p>
      </IdleTimeoutProvider>
    );

    // Advance past the warning threshold (28 minutes) plus one interval tick
    act(() => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS - WARNING_BEFORE_MS + CHECK_INTERVAL_MS);
    });

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('Session Expiring Soon')).toBeInTheDocument();
    expect(screen.getByText('Stay Logged In')).toBeInTheDocument();
  });

  it('resets timer on user activity (mousedown)', () => {
    render(
      <IdleTimeoutProvider>
        <p>Child content</p>
      </IdleTimeoutProvider>
    );

    // Advance close to warning threshold
    act(() => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS - WARNING_BEFORE_MS - CHECK_INTERVAL_MS);
    });

    // Simulate user activity which resets lastActivityRef to current Date.now()
    fireEvent.mouseDown(window);

    // Advance another interval tick - should NOT trigger warning because activity just reset
    act(() => {
      vi.advanceTimersByTime(CHECK_INTERVAL_MS * 2);
    });

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('dismisses the warning when "Stay Logged In" button is clicked', () => {
    render(
      <IdleTimeoutProvider>
        <p>Child content</p>
      </IdleTimeoutProvider>
    );

    // Trigger the warning
    act(() => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS - WARNING_BEFORE_MS + CHECK_INTERVAL_MS);
    });

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    // Click "Stay Logged In"
    fireEvent.click(screen.getByText('Stay Logged In'));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('calls signOut and redirects to login after full timeout', async () => {
    render(
      <IdleTimeoutProvider>
        <p>Child content</p>
      </IdleTimeoutProvider>
    );

    // Advance past the full idle timeout plus one interval tick
    act(() => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS + CHECK_INTERVAL_MS);
    });

    // Allow the async signOut promise to resolve
    await vi.waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });

    expect(mockPush).toHaveBeenCalledWith('/login?reason=idle');
  });

  it('only calls signOut once even after multiple interval ticks past timeout', async () => {
    render(
      <IdleTimeoutProvider>
        <p>Child content</p>
      </IdleTimeoutProvider>
    );

    // Advance well past the timeout — multiple interval ticks
    act(() => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS + CHECK_INTERVAL_MS * 5);
    });

    await vi.waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });

    // Despite multiple ticks past the timeout, signOut should only fire once
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
