import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateDocumentRequestDialog } from './create-document-request-dialog';

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock useCreateDocumentRequest
const mockCreateRequest = vi.fn();
let mockIsPending = false;

vi.mock('@/hooks/use-document-requests', () => ({
  useCreateDocumentRequest: () => ({
    mutate: mockCreateRequest,
    isPending: mockIsPending,
  }),
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

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('CreateDocumentRequestDialog', () => {
  const defaultProps = {
    caseId: 'case-1',
    open: true,
    onOpenChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
  });

  test('renders dialog title and description', () => {
    render(<CreateDocumentRequestDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText('Request Document from Client')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Create a request for your client to upload a specific document.'
      )
    ).toBeInTheDocument();
  });

  test('renders document type select', () => {
    render(<CreateDocumentRequestDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByLabelText('Document Type *')).toBeInTheDocument();
    expect(screen.getByText('Select document type...')).toBeInTheDocument();
  });

  test('renders all document type options', () => {
    render(<CreateDocumentRequestDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText('Passport')).toBeInTheDocument();
    expect(screen.getByText('Visa')).toBeInTheDocument();
    expect(screen.getByText('Birth Certificate')).toBeInTheDocument();
    expect(screen.getByText('Employment Letter')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
  });

  test('renders title input', () => {
    render(<CreateDocumentRequestDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByLabelText('Request Title *')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('e.g., Current passport copy')
    ).toBeInTheDocument();
  });

  test('renders description textarea', () => {
    render(<CreateDocumentRequestDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
  });

  test('renders due date input', () => {
    render(<CreateDocumentRequestDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByLabelText('Due Date')).toBeInTheDocument();
  });

  test('renders priority select with Normal as default', () => {
    render(<CreateDocumentRequestDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByLabelText('Priority')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Normal')).toBeInTheDocument();
  });

  test('renders Cancel and Create Request buttons', () => {
    render(<CreateDocumentRequestDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Create Request')).toBeInTheDocument();
  });

  test('calls onOpenChange(false) when Cancel is clicked', () => {
    render(<CreateDocumentRequestDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  test('shows validation toast when submitting without required fields', async () => {
    render(<CreateDocumentRequestDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    // Submit the form directly (bypasses HTML required validation in JSDOM)
    const form = screen.getByText('Create Request').closest('form')!;
    fireEvent.submit(form);

    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith(
      'Please fill in required fields'
    );
  });

  test('calls createRequest when form is valid', () => {
    render(<CreateDocumentRequestDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    // Fill required fields
    fireEvent.change(screen.getByLabelText('Document Type *'), {
      target: { value: 'passport' },
    });
    fireEvent.change(screen.getByLabelText('Request Title *'), {
      target: { value: 'Valid passport copy' },
    });

    fireEvent.click(screen.getByText('Create Request'));

    expect(mockCreateRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        document_type: 'passport',
        title: 'Valid passport copy',
        priority: 'normal',
      }),
      expect.any(Object)
    );
  });

  test('shows "Creating..." text when pending', () => {
    mockIsPending = true;
    render(<CreateDocumentRequestDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText('Creating...')).toBeInTheDocument();
  });

  test('disables buttons when pending', () => {
    mockIsPending = true;
    render(<CreateDocumentRequestDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText('Cancel').closest('button')).toBeDisabled();
    expect(screen.getByText('Creating...').closest('button')).toBeDisabled();
  });

  test('allows changing priority', () => {
    render(<CreateDocumentRequestDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });
    const select = screen.getByLabelText('Priority');
    fireEvent.change(select, { target: { value: 'urgent' } });
    expect(select).toHaveValue('urgent');
  });

  test('does not render dialog when open is false', () => {
    render(
      <CreateDocumentRequestDialog
        {...defaultProps}
        open={false}
      />,
      { wrapper: createWrapper() }
    );
    expect(
      screen.queryByText('Request Document from Client')
    ).not.toBeInTheDocument();
  });

  test('submits with description and due date', () => {
    render(<CreateDocumentRequestDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    fireEvent.change(screen.getByLabelText('Document Type *'), {
      target: { value: 'visa' },
    });
    fireEvent.change(screen.getByLabelText('Request Title *'), {
      target: { value: 'Current visa' },
    });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Please upload front and back' },
    });
    fireEvent.change(screen.getByLabelText('Due Date'), {
      target: { value: '2025-06-01' },
    });

    fireEvent.click(screen.getByText('Create Request'));

    expect(mockCreateRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        document_type: 'visa',
        title: 'Current visa',
        description: 'Please upload front and back',
        due_date: '2025-06-01',
        priority: 'normal',
      }),
      expect.any(Object)
    );
  });
});
