import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateCaseDialog } from './create-case-dialog';

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

// Mock next/dynamic — returns a simple stub component.
// The dynamic() calls in create-case-dialog load UpgradePromptDialog and UpgradePromptBanner.
// We render them as simple div stubs keyed on their props.
vi.mock('next/dynamic', () => ({
  default: () => {
    const Stub = (props: Record<string, unknown>) => {
      // Render as upgrade-dialog when "open" prop exists (UpgradePromptDialog)
      if ('open' in props && props.open) {
        return <div data-testid="upgrade-dialog">Upgrade Dialog</div>;
      }
      // Render as upgrade-banner when "quota" prop exists but not "open" (UpgradePromptBanner)
      if ('quota' in props && !('open' in props)) {
        const quota = props.quota as { allowed: boolean; isUnlimited: boolean } | null;
        if (quota && !quota.isUnlimited && !quota.allowed) {
          return <div data-testid="upgrade-banner">Quota limit reached</div>;
        }
      }
      return null;
    };
    Stub.displayName = 'DynamicStub';
    return Stub;
  },
}));

// Mock FieldHelp
vi.mock('@/components/workflow/contextual-help', () => ({
  FieldHelp: ({ title }: { title: string }) => (
    <span data-testid={`field-help-${title}`} />
  ),
}));

// Mock hooks
const mockCreateCase = vi.fn();
const mockUseCreateCase = vi.fn();
vi.mock('@/hooks/use-cases', () => ({
  useCreateCase: (...args: unknown[]) => mockUseCreateCase(...args),
}));

const mockUseSearchClients = vi.fn();
vi.mock('@/hooks/use-clients', () => ({
  useSearchClients: (...args: unknown[]) => mockUseSearchClients(...args),
}));

const mockUseQuota = vi.fn();
vi.mock('@/hooks/use-quota', () => ({
  useQuota: (...args: unknown[]) => mockUseQuota(...args),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'TestQueryWrapper';
  return Wrapper;
}

/**
 * Submit the form by directly firing submit on the form element.
 * This bypasses browser built-in HTML validation (required attribute)
 * which doesn't fire in jsdom the same way.
 */
function submitForm() {
  const form = document.querySelector('form');
  if (form) {
    fireEvent.submit(form);
  }
}

describe('CreateCaseDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCreateCase.mockReturnValue({
      mutate: mockCreateCase,
      isPending: false,
    });
    mockUseSearchClients.mockReturnValue({
      data: undefined,
      isLoading: false,
    });
    mockUseQuota.mockReturnValue({
      data: null,
    });
  });

  test('renders dialog with title and description when open', () => {
    render(<CreateCaseDialog {...defaultProps} />, { wrapper: createWrapper() });
    expect(screen.getByText('Create New Case')).toBeInTheDocument();
    expect(screen.getByText('Start a new immigration case for your client.')).toBeInTheDocument();
  });

  test('renders form fields: title, client search, visa type, description, deadline', () => {
    render(<CreateCaseDialog {...defaultProps} />, { wrapper: createWrapper() });
    expect(screen.getByLabelText(/Case Title/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search by name or email...')).toBeInTheDocument();
    expect(screen.getByText('Select visa type...')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Deadline')).toBeInTheDocument();
  });

  test('shows required field indicators', () => {
    render(<CreateCaseDialog {...defaultProps} />, { wrapper: createWrapper() });
    const labels = screen.getAllByText('*');
    expect(labels.length).toBeGreaterThanOrEqual(2);
  });

  test('renders Cancel and Create Case buttons', () => {
    render(<CreateCaseDialog {...defaultProps} />, { wrapper: createWrapper() });
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Case/i })).toBeInTheDocument();
  });

  test('Cancel button calls onOpenChange(false)', () => {
    const onOpenChange = vi.fn();
    render(<CreateCaseDialog open={true} onOpenChange={onOpenChange} />, {
      wrapper: createWrapper(),
    });
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test('shows inline error when submitting without required fields', () => {
    render(<CreateCaseDialog {...defaultProps} />, { wrapper: createWrapper() });
    submitForm();
    expect(screen.getByText('Please fill in all required fields')).toBeInTheDocument();
  });

  test('shows Creating... button text when isPending', () => {
    mockUseCreateCase.mockReturnValue({
      mutate: mockCreateCase,
      isPending: true,
    });

    render(<CreateCaseDialog {...defaultProps} />, { wrapper: createWrapper() });
    expect(screen.getByText('Creating...')).toBeInTheDocument();
  });

  test('shows upgrade banner when quota is at limit', () => {
    mockUseQuota.mockReturnValue({
      data: {
        allowed: false,
        isUnlimited: false,
        current: 100,
        limit: 100,
        remaining: 0,
      },
    });

    render(<CreateCaseDialog {...defaultProps} />, { wrapper: createWrapper() });
    // Use getAllByTestId since dynamic mock may produce multiple elements
    const banners = screen.getAllByTestId('upgrade-banner');
    expect(banners.length).toBeGreaterThanOrEqual(1);
    expect(banners[0]).toHaveTextContent('Quota limit reached');
  });

  test('clears formError when dialog reopens', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = render(
      <QueryClientProvider client={qc}>
        <CreateCaseDialog open={true} onOpenChange={defaultProps.onOpenChange} />
      </QueryClientProvider>
    );

    // Trigger an error by submitting empty form
    submitForm();
    expect(screen.getByText('Please fill in all required fields')).toBeInTheDocument();

    // Close dialog
    rerender(
      <QueryClientProvider client={qc}>
        <CreateCaseDialog open={false} onOpenChange={defaultProps.onOpenChange} />
      </QueryClientProvider>
    );

    // Reopen dialog — useEffect should clear the error
    rerender(
      <QueryClientProvider client={qc}>
        <CreateCaseDialog open={true} onOpenChange={defaultProps.onOpenChange} />
      </QueryClientProvider>
    );

    // Error should be cleared
    expect(screen.queryByText('Please fill in all required fields')).not.toBeInTheDocument();
  });

  test('does not call createCase when required fields are empty', () => {
    render(<CreateCaseDialog {...defaultProps} />, { wrapper: createWrapper() });
    submitForm();
    expect(mockCreateCase).not.toHaveBeenCalled();
    expect(screen.getByText('Please fill in all required fields')).toBeInTheDocument();
  });

  test('opens upgrade dialog when submitting at quota limit', () => {
    mockUseQuota.mockReturnValue({
      data: {
        allowed: false,
        isUnlimited: false,
        current: 100,
        limit: 100,
        remaining: 0,
      },
    });

    render(<CreateCaseDialog {...defaultProps} />, { wrapper: createWrapper() });
    submitForm();

    // The createCase should NOT be called when at limit
    expect(mockCreateCase).not.toHaveBeenCalled();
  });

  test('shows client search hint text', () => {
    render(<CreateCaseDialog {...defaultProps} />, { wrapper: createWrapper() });
    expect(screen.getByText('Type at least 2 characters to search')).toBeInTheDocument();
  });

  test('disables form inputs when isPending', () => {
    mockUseCreateCase.mockReturnValue({
      mutate: mockCreateCase,
      isPending: true,
    });

    render(<CreateCaseDialog {...defaultProps} />, { wrapper: createWrapper() });
    expect(screen.getByLabelText(/Case Title/)).toBeDisabled();
    expect(screen.getByPlaceholderText('Search by name or email...')).toBeDisabled();
  });
});
