import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary, ErrorFallbackUI } from './error-boundary';

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

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(() => 'sentry-event-id-123'),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
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

// Intentionally throw from a child component
function ThrowingComponent({ error }: { error: Error }) {
  throw error;
}

function GoodComponent() {
  return <div>Everything is fine</div>;
}

describe('ErrorBoundary', () => {
  // Suppress React's console.error output during expected error boundary catches
  const originalConsoleError = console.error;
  beforeEach(() => {
    vi.clearAllMocks();
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  test('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <GoodComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('Everything is fine')).toBeInTheDocument();
  });

  test('renders default error UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent error={new Error('Test error')} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  test('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom Error UI</div>}>
        <ThrowingComponent error={new Error('Test error')} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Custom Error UI')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  test('calls onError callback when error is caught', () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <ThrowingComponent error={new Error('Callback test')} />
      </ErrorBoundary>
    );
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Callback test' }),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });

  test('reports error to Sentry', async () => {
    const Sentry = await import('@sentry/nextjs');
    render(
      <ErrorBoundary>
        <ThrowingComponent error={new Error('Sentry test')} />
      </ErrorBoundary>
    );
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  test('displays Sentry event ID', async () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent error={new Error('ID test')} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Error ID: sentry-event-id-123')).toBeInTheDocument();
  });

  test('Try Again button resets the error state', () => {
    const TestComponent = () => {
      return <GoodComponent />;
    };

    // We need to test reset behavior
    let shouldThrow = true;
    const MaybeThrow = () => {
      if (shouldThrow) throw new Error('Resettable error');
      return <div>Recovered</div>;
    };

    const { rerender } = render(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Now stop throwing and click Try Again
    shouldThrow = false;
    fireEvent.click(screen.getByText('Try Again'));

    // After reset, the component should render children again
    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });

  test('renders Go to Dashboard link', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent error={new Error('Dashboard link test')} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
  });

  test('renders Reload Page button', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent error={new Error('Reload test')} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Reload Page')).toBeInTheDocument();
  });
});

describe('ErrorFallbackUI', () => {
  const defaultProps = {
    error: new Error('Test error message'),
    eventId: 'evt-123',
    onReset: vi.fn(),
    onReload: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders error title and description', () => {
    render(<ErrorFallbackUI {...defaultProps} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(
      screen.getByText(/We encountered an unexpected error/)
    ).toBeInTheDocument();
  });

  test('renders event ID when provided', () => {
    render(<ErrorFallbackUI {...defaultProps} />);
    expect(screen.getByText('Error ID: evt-123')).toBeInTheDocument();
  });

  test('does not render event ID when null', () => {
    render(<ErrorFallbackUI {...defaultProps} eventId={null} />);
    expect(screen.queryByText(/Error ID/)).not.toBeInTheDocument();
  });

  test('calls onReset when Try Again is clicked', () => {
    render(<ErrorFallbackUI {...defaultProps} />);
    fireEvent.click(screen.getByText('Try Again'));
    expect(defaultProps.onReset).toHaveBeenCalledTimes(1);
  });

  test('calls onReload when Reload Page is clicked', () => {
    render(<ErrorFallbackUI {...defaultProps} />);
    fireEvent.click(screen.getByText('Reload Page'));
    expect(defaultProps.onReload).toHaveBeenCalledTimes(1);
  });

  test('renders error details in development mode', () => {
    // NODE_ENV is 'test' in vitest, which is not 'development'
    // so error details should NOT be shown
    render(<ErrorFallbackUI {...defaultProps} />);
    expect(screen.queryByText('Test error message')).not.toBeInTheDocument();
  });

  test('renders Go to Dashboard button', () => {
    render(<ErrorFallbackUI {...defaultProps} />);
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
  });

  test('renders help text about refreshing', () => {
    render(<ErrorFallbackUI {...defaultProps} />);
    expect(
      screen.getByText(/Try refreshing the page or returning to the dashboard/)
    ).toBeInTheDocument();
  });
});
