import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TwoFactorSetup } from './two-factor-setup';

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

// Mock fetchWithTimeout
const mockFetchWithTimeout = vi.fn();
vi.mock('@/lib/api/fetch-with-timeout', () => ({
  fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
}));

// Mock next/dynamic — render stub components
vi.mock('next/dynamic', () => ({
  default: () => {
    const Stub = (props: Record<string, unknown>) => {
      if (!props.open) return null;
      return <div data-testid="dynamic-dialog">{JSON.stringify(props)}</div>;
    };
    Stub.displayName = 'DynamicStub';
    return Stub;
  },
}));

describe('TwoFactorSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders loading state initially', () => {
    // fetchWithTimeout never resolves during this test
    mockFetchWithTimeout.mockReturnValue(new Promise(() => {}));

    render(<TwoFactorSetup />);
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  test('renders disabled state with Enable button when 2FA is not enabled', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            enabled: false,
            verified: false,
            lastUsedAt: null,
            backupCodesRemaining: 0,
          },
        }),
    });

    render(<TwoFactorSetup />);

    await waitFor(() => {
      expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
    });

    expect(screen.getByText('Authenticator App')).toBeInTheDocument();
    expect(
      screen.getByText('Use an authenticator app to generate one-time codes.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enable/i })).toBeInTheDocument();
  });

  test('renders enabled state with Disable and Regenerate buttons', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            enabled: true,
            verified: true,
            lastUsedAt: '2026-01-15T10:00:00Z',
            backupCodesRemaining: 8,
          },
        }),
    });

    render(<TwoFactorSetup />);

    await waitFor(() => {
      expect(
        screen.getByText('Two-factor authentication is enabled')
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/Backup codes remaining: 8/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Regenerate Backup Codes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Disable 2FA/i })).toBeInTheDocument();
  });

  test('shows last used date when available', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            enabled: true,
            verified: true,
            lastUsedAt: '2026-01-15T10:00:00Z',
            backupCodesRemaining: 5,
          },
        }),
    });

    render(<TwoFactorSetup />);

    await waitFor(() => {
      expect(screen.getByText(/Last used:/)).toBeInTheDocument();
    });
  });

  test('shows warning icon when backup codes are low (< 3)', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            enabled: true,
            verified: true,
            lastUsedAt: null,
            backupCodesRemaining: 2,
          },
        }),
    });

    render(<TwoFactorSetup />);

    await waitFor(() => {
      expect(screen.getByText(/Backup codes remaining: 2/)).toBeInTheDocument();
    });

    // AlertTriangle icon should be rendered (has the warning class)
    const warningIcon = document.querySelector('.text-warning');
    expect(warningIcon).toBeInTheDocument();
  });

  test('renders card title and description', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            enabled: false,
            verified: false,
            lastUsedAt: null,
            backupCodesRemaining: 0,
          },
        }),
    });

    render(<TwoFactorSetup />);

    await waitFor(() => {
      expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Add an extra layer of security to your account.')
    ).toBeInTheDocument();
  });

  test('handles fetch error gracefully', async () => {
    mockFetchWithTimeout.mockRejectedValue(new Error('Network error'));

    render(<TwoFactorSetup />);

    // After error, loading should stop — status remains null so it shows disabled UI
    await waitFor(() => {
      expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
    });

    // The Enable button should be present (fallback for null status)
    expect(screen.getByText('Authenticator App')).toBeInTheDocument();
  });
});
