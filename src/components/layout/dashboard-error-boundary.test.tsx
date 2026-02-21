import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardErrorBoundary } from './dashboard-error-boundary';

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  }),
}));

function makeError(message: string, digest?: string): Error & { digest?: string } {
  const err = new Error(message) as Error & { digest?: string };
  if (digest) err.digest = digest;
  return err;
}

describe('DashboardErrorBoundary', () => {
  const defaultProps = {
    area: 'cases',
    error: makeError('Something broke'),
    reset: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('title and description', () => {
    test('renders default title derived from area name', () => {
      render(<DashboardErrorBoundary {...defaultProps} />);
      expect(screen.getByText('Cases Error')).toBeInTheDocument();
    });

    test('renders default description with area name', () => {
      render(<DashboardErrorBoundary {...defaultProps} />);
      expect(screen.getByText('Something went wrong while loading cases.')).toBeInTheDocument();
    });

    test('renders custom title when provided', () => {
      render(<DashboardErrorBoundary {...defaultProps} title="Custom Title" />);
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    test('renders custom description when provided', () => {
      render(
        <DashboardErrorBoundary
          {...defaultProps}
          description="Custom description here."
        />
      );
      expect(screen.getByText('Custom description here.')).toBeInTheDocument();
    });

    test('capitalizes first letter of area for default title', () => {
      render(
        <DashboardErrorBoundary
          {...defaultProps}
          area="documents"
          error={makeError('fail')}
        />
      );
      expect(screen.getByText('Documents Error')).toBeInTheDocument();
    });
  });

  describe('action buttons', () => {
    test('renders Try Again button that calls reset', () => {
      const resetFn = vi.fn();
      render(<DashboardErrorBoundary {...defaultProps} reset={resetFn} />);

      const tryAgainButton = screen.getByRole('button', { name: /Try Again/i });
      expect(tryAgainButton).toBeInTheDocument();

      fireEvent.click(tryAgainButton);
      expect(resetFn).toHaveBeenCalledTimes(1);
    });

    test('renders Dashboard Home link', () => {
      render(<DashboardErrorBoundary {...defaultProps} />);
      const dashboardLink = screen.getByRole('link', { name: /Dashboard Home/i });
      expect(dashboardLink).toHaveAttribute('href', '/dashboard');
    });

    test('renders Home link pointing to root', () => {
      render(<DashboardErrorBoundary {...defaultProps} />);
      const homeLink = screen.getByRole('link', { name: /^Home$/i });
      expect(homeLink).toHaveAttribute('href', '/');
    });
  });

  describe('help text', () => {
    test('shows logged error guidance', () => {
      render(<DashboardErrorBoundary {...defaultProps} />);
      expect(
        screen.getByText(/This error has been logged/)
      ).toBeInTheDocument();
    });
  });

  describe('development error details', () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      // vitest sets NODE_ENV to 'test', but the component checks 'development'
      // so dev details should NOT show in test env by default
    });

    test('does not show error message in non-development env', () => {
      render(
        <DashboardErrorBoundary
          {...defaultProps}
          error={makeError('Detailed error info')}
        />
      );
      // The error message text should not appear in a visible element
      // (the component conditionally renders it only in 'development')
      expect(screen.queryByText('Detailed error info')).not.toBeInTheDocument();
    });
  });

  describe('Sentry integration', () => {
    test('calls Sentry.captureException on mount', async () => {
      const Sentry = await import('@sentry/nextjs');
      const error = makeError('Sentry test error');

      render(<DashboardErrorBoundary {...defaultProps} error={error} />);

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: { area: 'cases' },
      });
    });
  });
});
