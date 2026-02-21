import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DocumentRequestList } from './document-request-list';
import type { DocumentRequest, DocumentRequestStatus } from '@/hooks/use-document-requests';

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

// Mock hooks
const mockUseDocumentRequests = vi.fn();
const mockMarkFulfilled = vi.fn();
const mockUseMarkRequestAsFulfilled = vi.fn();
const mockDeleteRequest = vi.fn();
const mockUseDeleteDocumentRequest = vi.fn();

vi.mock('@/hooks/use-document-requests', () => ({
  useDocumentRequests: (...args: unknown[]) => mockUseDocumentRequests(...args),
  useMarkRequestAsFulfilled: (...args: unknown[]) => mockUseMarkRequestAsFulfilled(...args),
  useDeleteDocumentRequest: (...args: unknown[]) => mockUseDeleteDocumentRequest(...args),
}));

const mockUseCanPerform = vi.fn();
vi.mock('@/hooks/use-role-guard', () => ({
  useCanPerform: (...args: unknown[]) => mockUseCanPerform(...args),
}));

// Mock CreateDocumentRequestDialog
vi.mock('./create-document-request-dialog', () => ({
  CreateDocumentRequestDialog: ({
    open,
  }: {
    caseId: string;
    open: boolean;
    onOpenChange: (v: boolean) => void;
  }) => (open ? <div data-testid="create-request-dialog">Create Request Dialog</div> : null),
}));

// Mock ConfirmationDialog — render a simple version to test delete flow
vi.mock('@/components/ui/confirmation-dialog', () => ({
  ConfirmationDialog: ({
    open,
    title,
    description,
    onConfirm,
    onOpenChange,
  }: {
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    onOpenChange: (v: boolean) => void;
    confirmLabel?: string;
    cancelLabel?: string;
    isLoading?: boolean;
    variant?: string;
  }) =>
    open ? (
      <div data-testid="confirmation-dialog">
        <p>{title}</p>
        <p>{description}</p>
        <button onClick={onConfirm}>Confirm Delete</button>
        <button onClick={() => onOpenChange(false)}>Cancel Delete</button>
      </div>
    ) : null,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function makeRequest(overrides: Partial<DocumentRequest> = {}): DocumentRequest {
  return {
    id: 'req-1',
    case_id: 'case-1',
    requested_by: 'user-1',
    document_type: 'passport',
    status: 'pending',
    title: 'Upload Passport',
    description: 'Please upload a valid passport copy',
    due_date: null,
    priority: 'normal',
    fulfilled_by_document_id: null,
    fulfilled_at: null,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
    ...overrides,
  };
}

describe('DocumentRequestList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMarkRequestAsFulfilled.mockReturnValue({
      mutate: mockMarkFulfilled,
      isPending: false,
    });
    mockUseDeleteDocumentRequest.mockReturnValue({
      mutate: mockDeleteRequest,
      isPending: false,
    });
    mockUseCanPerform.mockReturnValue(true); // attorney by default
  });

  test('renders card title with Document Requests', () => {
    mockUseDocumentRequests.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    render(<DocumentRequestList caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('Document Requests')).toBeInTheDocument();
  });

  test('shows loading spinner when data is loading', () => {
    mockUseDocumentRequests.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(<DocumentRequestList caseId="case-1" />, { wrapper: createWrapper() });
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  test('shows error state when there is an error', () => {
    mockUseDocumentRequests.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
    });

    render(<DocumentRequestList caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('Failed to load document requests')).toBeInTheDocument();
  });

  test('shows empty state when no requests exist', () => {
    mockUseDocumentRequests.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    render(<DocumentRequestList caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('No document requests yet')).toBeInTheDocument();
  });

  test('shows "Create First Request" button in empty state for attorneys', () => {
    mockUseDocumentRequests.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    render(<DocumentRequestList caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('Create First Request')).toBeInTheDocument();
  });

  test('hides "Create First Request" button for non-attorneys', () => {
    mockUseCanPerform.mockReturnValue(false);
    mockUseDocumentRequests.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    render(<DocumentRequestList caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.queryByText('Create First Request')).not.toBeInTheDocument();
  });

  test('shows Request Document button in header for attorneys', () => {
    mockUseDocumentRequests.mockReturnValue({
      data: [makeRequest()],
      isLoading: false,
      error: null,
    });

    render(<DocumentRequestList caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('Request Document')).toBeInTheDocument();
  });

  test('hides Request Document button for non-attorneys', () => {
    mockUseCanPerform.mockReturnValue(false);
    mockUseDocumentRequests.mockReturnValue({
      data: [makeRequest()],
      isLoading: false,
      error: null,
    });

    render(<DocumentRequestList caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.queryByText('Request Document')).not.toBeInTheDocument();
  });

  test('renders pending requests with status badge', () => {
    mockUseDocumentRequests.mockReturnValue({
      data: [makeRequest({ id: 'r1', title: 'Upload Passport', status: 'pending' })],
      isLoading: false,
      error: null,
    });

    render(<DocumentRequestList caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('Upload Passport')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Pending Requests (1)')).toBeInTheDocument();
  });

  test('renders fulfilled requests in completed section', () => {
    mockUseDocumentRequests.mockReturnValue({
      data: [makeRequest({ id: 'r1', title: 'Tax Return', status: 'fulfilled' })],
      isLoading: false,
      error: null,
    });

    render(<DocumentRequestList caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('Tax Return')).toBeInTheDocument();
    expect(screen.getByText('Fulfilled')).toBeInTheDocument();
    expect(screen.getByText('Completed Requests (1)')).toBeInTheDocument();
  });

  test('renders request description when present', () => {
    mockUseDocumentRequests.mockReturnValue({
      data: [
        makeRequest({
          description: 'Please upload front and back copies',
        }),
      ],
      isLoading: false,
      error: null,
    });

    render(<DocumentRequestList caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('Please upload front and back copies')).toBeInTheDocument();
  });

  test('renders priority badge for non-normal priorities', () => {
    mockUseDocumentRequests.mockReturnValue({
      data: [makeRequest({ priority: 'urgent' })],
      isLoading: false,
      error: null,
    });

    render(<DocumentRequestList caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });

  test('does not show priority badge for normal priority', () => {
    mockUseDocumentRequests.mockReturnValue({
      data: [makeRequest({ priority: 'normal' })],
      isLoading: false,
      error: null,
    });

    render(<DocumentRequestList caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.queryByText('Normal')).not.toBeInTheDocument();
  });

  test('shows Mark Fulfilled button for uploaded requests when attorney', () => {
    mockUseDocumentRequests.mockReturnValue({
      data: [makeRequest({ status: 'uploaded' })],
      isLoading: false,
      error: null,
    });

    render(<DocumentRequestList caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('Mark Fulfilled')).toBeInTheDocument();
  });

  test('hides Mark Fulfilled button for non-attorneys', () => {
    mockUseCanPerform.mockReturnValue(false);
    mockUseDocumentRequests.mockReturnValue({
      data: [makeRequest({ status: 'uploaded' })],
      isLoading: false,
      error: null,
    });

    render(<DocumentRequestList caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.queryByText('Mark Fulfilled')).not.toBeInTheDocument();
  });

  test('shows delete button for pending requests when attorney', () => {
    mockUseDocumentRequests.mockReturnValue({
      data: [makeRequest({ status: 'pending' })],
      isLoading: false,
      error: null,
    });

    render(<DocumentRequestList caseId="case-1" />, { wrapper: createWrapper() });
    // Delete button has Trash2 icon, find it by destructive text class
    const deleteBtn = document.querySelector('.text-destructive');
    expect(deleteBtn).toBeInTheDocument();
  });

  test('opens confirmation dialog when delete button clicked', () => {
    mockUseDocumentRequests.mockReturnValue({
      data: [makeRequest({ status: 'pending', title: 'Upload Passport' })],
      isLoading: false,
      error: null,
    });

    render(<DocumentRequestList caseId="case-1" />, { wrapper: createWrapper() });
    const deleteBtn = document.querySelector('button.text-destructive') as HTMLElement;
    fireEvent.click(deleteBtn);

    expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete Request')).toBeInTheDocument();
  });

  test('calls deleteRequest when delete is confirmed', () => {
    mockUseDocumentRequests.mockReturnValue({
      data: [makeRequest({ id: 'req-1', status: 'pending' })],
      isLoading: false,
      error: null,
    });

    render(<DocumentRequestList caseId="case-1" />, { wrapper: createWrapper() });
    const deleteBtn = document.querySelector('button.text-destructive') as HTMLElement;
    fireEvent.click(deleteBtn);

    fireEvent.click(screen.getByText('Confirm Delete'));
    expect(mockDeleteRequest).toHaveBeenCalledWith('req-1', expect.any(Object));
  });

  test('renders document type badge', () => {
    mockUseDocumentRequests.mockReturnValue({
      data: [makeRequest({ document_type: 'birth_certificate' })],
      isLoading: false,
      error: null,
    });

    render(<DocumentRequestList caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('birth certificate')).toBeInTheDocument();
  });

  test('renders due date when present', () => {
    mockUseDocumentRequests.mockReturnValue({
      data: [makeRequest({ due_date: '2026-03-15T12:00:00Z' })],
      isLoading: false,
      error: null,
    });

    render(<DocumentRequestList caseId="case-1" />, { wrapper: createWrapper() });
    // date-fns format converts to local time, so check for the "Due" prefix with a date
    expect(screen.getByText(/Due Mar \d+, 2026/)).toBeInTheDocument();
  });

  test('renders fulfilled document link when present', () => {
    mockUseDocumentRequests.mockReturnValue({
      data: [
        makeRequest({
          status: 'fulfilled',
          fulfilled_document: {
            id: 'doc-1',
            file_name: 'passport-scan.pdf',
            file_url: 'https://example.com/passport-scan.pdf',
          },
        }),
      ],
      isLoading: false,
      error: null,
    });

    render(<DocumentRequestList caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('passport-scan.pdf')).toBeInTheDocument();
    expect(screen.getByText('Fulfilled with:')).toBeInTheDocument();
  });

  test('renders status badges for various statuses', () => {
    const statuses: DocumentRequestStatus[] = ['pending', 'uploaded', 'fulfilled', 'expired', 'cancelled'];
    const labels = ['Pending', 'Uploaded', 'Fulfilled', 'Expired', 'Cancelled'];

    statuses.forEach((status, idx) => {
      mockUseDocumentRequests.mockReturnValue({
        data: [makeRequest({ id: `req-${idx}`, status })],
        isLoading: false,
        error: null,
      });

      const { unmount } = render(<DocumentRequestList caseId="case-1" />, {
        wrapper: createWrapper(),
      });
      expect(screen.getByText(labels[idx])).toBeInTheDocument();
      unmount();
    });
  });
});
