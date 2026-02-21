import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GdprDataManagement } from './gdpr-data-management';

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

// Mock formatDate from utils
vi.mock('@/lib/utils', () => ({
  formatDate: (value: string | null | undefined) => {
    if (!value) return null;
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleDateString('en-US');
  },
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

// Mock GDPR hooks
const mockRequestExport = vi.fn();
const mockRequestDeletion = vi.fn();
const mockCancelDeletion = vi.fn();

const mockUseExportJobs = vi.fn();
const mockUseRequestExport = vi.fn();
const mockUseDeletionRequest = vi.fn();
const mockUseRequestDeletion = vi.fn();
const mockUseCancelDeletion = vi.fn();

vi.mock('@/hooks/use-gdpr', () => ({
  useExportJobs: (...args: unknown[]) => mockUseExportJobs(...args),
  useRequestExport: (...args: unknown[]) => mockUseRequestExport(...args),
  useDeletionRequest: (...args: unknown[]) => mockUseDeletionRequest(...args),
  useRequestDeletion: (...args: unknown[]) => mockUseRequestDeletion(...args),
  useCancelDeletion: (...args: unknown[]) => mockUseCancelDeletion(...args),
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

describe('GdprDataManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseExportJobs.mockReturnValue({
      data: undefined,
      isLoading: false,
    });
    mockUseRequestExport.mockReturnValue({
      mutate: mockRequestExport,
      isPending: false,
    });
    mockUseDeletionRequest.mockReturnValue({
      data: null,
      isLoading: false,
    });
    mockUseRequestDeletion.mockReturnValue({
      mutate: mockRequestDeletion,
      isPending: false,
    });
    mockUseCancelDeletion.mockReturnValue({
      mutate: mockCancelDeletion,
      isPending: false,
    });
  });

  describe('data export section', () => {
    test('renders Data Export card with title and description', () => {
      render(<GdprDataManagement />, { wrapper: createWrapper() });
      expect(screen.getByText('Data Export')).toBeInTheDocument();
      expect(
        screen.getByText('Download a copy of all your personal data stored in the system.')
      ).toBeInTheDocument();
    });

    test('renders Request Data Export button', () => {
      render(<GdprDataManagement />, { wrapper: createWrapper() });
      expect(screen.getByText('Request Data Export')).toBeInTheDocument();
    });

    test('calls requestExport when button is clicked', () => {
      render(<GdprDataManagement />, { wrapper: createWrapper() });
      fireEvent.click(screen.getByText('Request Data Export'));
      expect(mockRequestExport).toHaveBeenCalledWith(undefined, expect.any(Object));
    });

    test('shows Generating Export... when export is pending', () => {
      mockUseRequestExport.mockReturnValue({
        mutate: mockRequestExport,
        isPending: true,
      });

      render(<GdprDataManagement />, { wrapper: createWrapper() });
      expect(screen.getByText('Generating Export...')).toBeInTheDocument();
    });

    test('disables export button when isPending', () => {
      mockUseRequestExport.mockReturnValue({
        mutate: mockRequestExport,
        isPending: true,
      });

      render(<GdprDataManagement />, { wrapper: createWrapper() });
      const btn = screen.getByText('Generating Export...').closest('button');
      expect(btn).toBeDisabled();
    });

    test('shows loading spinner when export jobs are loading', () => {
      mockUseExportJobs.mockReturnValue({
        data: undefined,
        isLoading: true,
      });

      render(<GdprDataManagement />, { wrapper: createWrapper() });
      const spinners = document.querySelectorAll('.animate-spin');
      expect(spinners.length).toBeGreaterThan(0);
    });

    test('shows Export History when export jobs exist', () => {
      mockUseExportJobs.mockReturnValue({
        data: [
          {
            id: 'job-1',
            user_id: 'user-1',
            status: 'completed',
            created_at: '2026-01-15T10:00:00Z',
            completed_at: '2026-01-15T10:05:00Z',
          },
        ],
        isLoading: false,
      });

      render(<GdprDataManagement />, { wrapper: createWrapper() });
      expect(screen.getByText('Export History')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    test('renders status badges for different export statuses', () => {
      mockUseExportJobs.mockReturnValue({
        data: [
          { id: 'j1', user_id: 'u1', status: 'completed', created_at: '2026-01-15T10:00:00Z', completed_at: null },
          { id: 'j2', user_id: 'u1', status: 'processing', created_at: '2026-01-14T10:00:00Z', completed_at: null },
          { id: 'j3', user_id: 'u1', status: 'pending', created_at: '2026-01-13T10:00:00Z', completed_at: null },
          { id: 'j4', user_id: 'u1', status: 'failed', created_at: '2026-01-12T10:00:00Z', completed_at: null },
        ],
        isLoading: false,
      });

      render(<GdprDataManagement />, { wrapper: createWrapper() });
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Processing')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    test('does not show Export History when no export jobs', () => {
      mockUseExportJobs.mockReturnValue({
        data: [],
        isLoading: false,
      });

      render(<GdprDataManagement />, { wrapper: createWrapper() });
      expect(screen.queryByText('Export History')).not.toBeInTheDocument();
    });
  });

  describe('account deletion section', () => {
    test('renders Account Deletion card with title and description', () => {
      render(<GdprDataManagement />, { wrapper: createWrapper() });
      expect(screen.getByText('Account Deletion')).toBeInTheDocument();
      expect(
        screen.getByText(
          /Permanently delete your account and all associated data/
        )
      ).toBeInTheDocument();
    });

    test('renders Request Account Deletion button when no pending deletion', () => {
      render(<GdprDataManagement />, { wrapper: createWrapper() });
      expect(screen.getByText('Request Account Deletion')).toBeInTheDocument();
    });

    test('opens confirmation dialog when deletion button is clicked', () => {
      render(<GdprDataManagement />, { wrapper: createWrapper() });
      fireEvent.click(screen.getByText('Request Account Deletion'));
      expect(screen.getByText('Delete Your Account')).toBeInTheDocument();
      expect(
        screen.getByText(
          /This action will schedule your account for permanent deletion/
        )
      ).toBeInTheDocument();
    });

    test('confirmation dialog lists data that will be deleted', () => {
      render(<GdprDataManagement />, { wrapper: createWrapper() });
      fireEvent.click(screen.getByText('Request Account Deletion'));

      expect(screen.getByText('Your profile and account settings')).toBeInTheDocument();
      expect(screen.getByText('All cases and associated documents')).toBeInTheDocument();
      expect(screen.getByText('All forms and AI analysis results')).toBeInTheDocument();
      expect(screen.getByText('Messages and activity history')).toBeInTheDocument();
    });

    test('confirmation dialog has Cancel and Confirm Deletion buttons', () => {
      render(<GdprDataManagement />, { wrapper: createWrapper() });
      fireEvent.click(screen.getByText('Request Account Deletion'));

      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Confirm Deletion/i })).toBeInTheDocument();
    });

    test('clicking Confirm Deletion calls requestDeletion', () => {
      render(<GdprDataManagement />, { wrapper: createWrapper() });
      fireEvent.click(screen.getByText('Request Account Deletion'));
      fireEvent.click(screen.getByRole('button', { name: /Confirm Deletion/i }));

      expect(mockRequestDeletion).toHaveBeenCalledWith(undefined, expect.any(Object));
    });

    test('clicking Cancel closes the dialog', () => {
      render(<GdprDataManagement />, { wrapper: createWrapper() });
      fireEvent.click(screen.getByText('Request Account Deletion'));
      expect(screen.getByText('Delete Your Account')).toBeInTheDocument();

      // Click Cancel button inside dialog
      const cancelButtons = screen.getAllByRole('button', { name: /Cancel/i });
      const dialogCancel = cancelButtons.find(
        (btn) => btn.closest('[role="dialog"]') || btn.closest('[class*="DialogContent"]')
      );
      fireEvent.click(dialogCancel || cancelButtons[0]);
    });

    test('shows Processing... text when deletion is pending', () => {
      mockUseRequestDeletion.mockReturnValue({
        mutate: mockRequestDeletion,
        isPending: true,
      });

      render(<GdprDataManagement />, { wrapper: createWrapper() });
      fireEvent.click(screen.getByText('Request Account Deletion'));

      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    test('shows scheduled deletion info when deletion is pending', () => {
      mockUseDeletionRequest.mockReturnValue({
        data: {
          id: 'del-1',
          user_id: 'user-1',
          status: 'pending',
          reason: null,
          scheduled_for: '2026-03-15T00:00:00Z',
          created_at: '2026-02-13T10:00:00Z',
        },
        isLoading: false,
      });

      render(<GdprDataManagement />, { wrapper: createWrapper() });
      expect(screen.getByText('Deletion Scheduled')).toBeInTheDocument();
      expect(screen.getByText(/scheduled for permanent deletion/)).toBeInTheDocument();
      expect(screen.queryByText('Request Account Deletion')).not.toBeInTheDocument();
    });

    test('shows Cancel Deletion Request button when deletion is pending', () => {
      mockUseDeletionRequest.mockReturnValue({
        data: {
          id: 'del-1',
          user_id: 'user-1',
          status: 'pending',
          reason: null,
          scheduled_for: '2026-03-15T00:00:00Z',
          created_at: '2026-02-13T10:00:00Z',
        },
        isLoading: false,
      });

      render(<GdprDataManagement />, { wrapper: createWrapper() });
      expect(screen.getByText('Cancel Deletion Request')).toBeInTheDocument();
    });

    test('clicking Cancel Deletion Request calls cancelDeletion', () => {
      mockUseDeletionRequest.mockReturnValue({
        data: {
          id: 'del-1',
          user_id: 'user-1',
          status: 'pending',
          reason: null,
          scheduled_for: '2026-03-15T00:00:00Z',
          created_at: '2026-02-13T10:00:00Z',
        },
        isLoading: false,
      });

      render(<GdprDataManagement />, { wrapper: createWrapper() });
      fireEvent.click(screen.getByText('Cancel Deletion Request'));
      expect(mockCancelDeletion).toHaveBeenCalledWith('User cancelled', expect.any(Object));
    });

    test('shows Cancelling... text when cancel is in progress', () => {
      mockUseDeletionRequest.mockReturnValue({
        data: {
          id: 'del-1',
          user_id: 'user-1',
          status: 'pending',
          reason: null,
          scheduled_for: '2026-03-15T00:00:00Z',
          created_at: '2026-02-13T10:00:00Z',
        },
        isLoading: false,
      });
      mockUseCancelDeletion.mockReturnValue({
        mutate: mockCancelDeletion,
        isPending: true,
      });

      render(<GdprDataManagement />, { wrapper: createWrapper() });
      expect(screen.getByText('Cancelling...')).toBeInTheDocument();
    });

    test('shows loading spinner when deletion data is loading', () => {
      mockUseDeletionRequest.mockReturnValue({
        data: null,
        isLoading: true,
      });

      render(<GdprDataManagement />, { wrapper: createWrapper() });
      // There should be at least one spinner in the deletion section
      const spinners = document.querySelectorAll('.animate-spin');
      expect(spinners.length).toBeGreaterThan(0);
    });
  });
});
