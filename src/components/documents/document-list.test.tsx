import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DocumentList } from './document-list';

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

// Mock formatFileSize
vi.mock('@/lib/storage/utils', () => ({
  formatFileSize: (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  },
}));

// Mock hooks
const mockUseDocuments = vi.fn();
const mockDeleteDocument = vi.fn();
const mockVerifyDocument = vi.fn();
const mockAnalyzeDocument = vi.fn();

vi.mock('@/hooks/use-documents', () => ({
  useDocuments: (...args: unknown[]) => mockUseDocuments(...args),
  useDeleteDocument: () => ({
    mutate: mockDeleteDocument,
    isPending: false,
  }),
  useVerifyDocument: () => ({
    mutate: mockVerifyDocument,
    isPending: false,
  }),
  useAnalyzeDocument: () => ({
    mutate: mockAnalyzeDocument,
    isPending: false,
  }),
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

function makeDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-1',
    case_id: 'case-1',
    uploaded_by: 'user-1',
    document_type: 'passport',
    status: 'uploaded',
    file_name: 'passport.pdf',
    file_url: 'https://example.com/passport.pdf',
    file_size: 2048000,
    mime_type: 'application/pdf',
    ai_extracted_data: null,
    ai_confidence_score: null,
    verified_by: null,
    verified_at: null,
    expiration_date: null,
    notes: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    uploader: { id: 'user-1', first_name: 'John', last_name: 'Doe' },
    ...overrides,
  };
}

describe('DocumentList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    test('renders loading spinner when data is loading', () => {
      mockUseDocuments.mockReturnValue({
        data: undefined,
        isLoading: true,
      });

      const { container } = render(<DocumentList caseId="case-1" />, {
        wrapper: createWrapper(),
      });
      // Loader2 renders an svg with animate-spin class
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    test('renders empty state when no documents', () => {
      mockUseDocuments.mockReturnValue({
        data: [],
        isLoading: false,
      });

      render(<DocumentList caseId="case-1" />, { wrapper: createWrapper() });
      expect(
        screen.getByText('No documents uploaded yet.')
      ).toBeInTheDocument();
    });

    test('renders empty state when data is null', () => {
      mockUseDocuments.mockReturnValue({
        data: null,
        isLoading: false,
      });

      render(<DocumentList caseId="case-1" />, { wrapper: createWrapper() });
      expect(
        screen.getByText('No documents uploaded yet.')
      ).toBeInTheDocument();
    });
  });

  describe('document rows', () => {
    test('renders document file name', () => {
      mockUseDocuments.mockReturnValue({
        data: [makeDocument()],
        isLoading: false,
      });

      render(<DocumentList caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('passport.pdf')).toBeInTheDocument();
    });

    test('renders document type label', () => {
      mockUseDocuments.mockReturnValue({
        data: [makeDocument({ document_type: 'tax_return' })],
        isLoading: false,
      });

      render(<DocumentList caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Tax Return')).toBeInTheDocument();
    });

    test('renders file size', () => {
      mockUseDocuments.mockReturnValue({
        data: [makeDocument({ file_size: 2048000 })],
        isLoading: false,
      });

      render(<DocumentList caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('2 MB')).toBeInTheDocument();
    });

    test('renders status badge', () => {
      mockUseDocuments.mockReturnValue({
        data: [makeDocument({ status: 'verified' })],
        isLoading: false,
      });

      render(<DocumentList caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    test('renders AI confidence score when present', () => {
      mockUseDocuments.mockReturnValue({
        data: [makeDocument({ ai_confidence_score: 0.95 })],
        isLoading: false,
      });

      render(<DocumentList caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('95% confidence')).toBeInTheDocument();
    });

    test('does not render AI confidence when null', () => {
      mockUseDocuments.mockReturnValue({
        data: [makeDocument({ ai_confidence_score: null })],
        isLoading: false,
      });

      render(<DocumentList caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.queryByText(/confidence/)).not.toBeInTheDocument();
    });

    test('renders multiple documents', () => {
      mockUseDocuments.mockReturnValue({
        data: [
          makeDocument({ id: 'doc-1', file_name: 'passport.pdf' }),
          makeDocument({
            id: 'doc-2',
            file_name: 'visa.pdf',
            document_type: 'visa',
          }),
        ],
        isLoading: false,
      });

      render(<DocumentList caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('passport.pdf')).toBeInTheDocument();
      expect(screen.getByText('visa.pdf')).toBeInTheDocument();
    });
  });

  describe('status badges', () => {
    const statuses = [
      { status: 'uploaded', label: 'Uploaded' },
      { status: 'processing', label: 'Processing' },
      { status: 'analyzed', label: 'Analyzed' },
      { status: 'needs_review', label: 'Needs Review' },
      { status: 'verified', label: 'Verified' },
      { status: 'rejected', label: 'Rejected' },
      { status: 'expired', label: 'Expired' },
    ] as const;

    statuses.forEach(({ status, label }) => {
      test(`renders ${label} badge for status ${status}`, () => {
        mockUseDocuments.mockReturnValue({
          data: [makeDocument({ status })],
          isLoading: false,
        });

        render(<DocumentList caseId="case-1" />, {
          wrapper: createWrapper(),
        });
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });
  });

  describe('action buttons', () => {
    // Radix DropdownMenu opens on pointerDown, not click
    function openDropdown() {
      const trigger = screen.getByRole('button', { name: 'Actions for passport.pdf' });
      fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' });
    }

    test('renders actions dropdown button for each document', () => {
      mockUseDocuments.mockReturnValue({
        data: [makeDocument()],
        isLoading: false,
      });

      render(<DocumentList caseId="case-1" />, { wrapper: createWrapper() });
      expect(
        screen.getByRole('button', { name: 'Actions for passport.pdf' })
      ).toBeInTheDocument();
    });

    test('dropdown shows View and Download menu items', () => {
      mockUseDocuments.mockReturnValue({
        data: [makeDocument()],
        isLoading: false,
      });

      render(<DocumentList caseId="case-1" />, { wrapper: createWrapper() });
      openDropdown();

      expect(screen.getByRole('menuitem', { name: /View/ })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Download/ })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Delete/ })).toBeInTheDocument();
    });

    test('shows Analyze with AI option for uploaded documents', () => {
      mockUseDocuments.mockReturnValue({
        data: [makeDocument({ status: 'uploaded' })],
        isLoading: false,
      });

      render(<DocumentList caseId="case-1" />, { wrapper: createWrapper() });
      openDropdown();

      expect(screen.getByRole('menuitem', { name: /Analyze with AI/ })).toBeInTheDocument();
    });

    test('shows Re-analyze with AI option for needs_review documents', () => {
      mockUseDocuments.mockReturnValue({
        data: [makeDocument({ status: 'needs_review' })],
        isLoading: false,
      });

      render(<DocumentList caseId="case-1" />, { wrapper: createWrapper() });
      openDropdown();

      expect(screen.getByRole('menuitem', { name: /Re-analyze with AI/ })).toBeInTheDocument();
    });

    test('shows Verify option for analyzed documents', () => {
      mockUseDocuments.mockReturnValue({
        data: [makeDocument({ status: 'analyzed' })],
        isLoading: false,
      });

      render(<DocumentList caseId="case-1" />, { wrapper: createWrapper() });
      openDropdown();

      expect(screen.getByRole('menuitem', { name: /Verify/ })).toBeInTheDocument();
    });

    test('does not show Verify option for uploaded documents', () => {
      mockUseDocuments.mockReturnValue({
        data: [makeDocument({ status: 'uploaded' })],
        isLoading: false,
      });

      render(<DocumentList caseId="case-1" />, { wrapper: createWrapper() });
      openDropdown();

      // Only "Analyze with AI" should appear, not "Verify"
      const menuItems = screen.getAllByRole('menuitem');
      const verifyItem = menuItems.find((item) => item.textContent?.includes('Verify'));
      expect(verifyItem).toBeUndefined();
    });
  });
});
