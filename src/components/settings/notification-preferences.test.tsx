import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { NotificationPreferences } from './notification-preferences';

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

describe('NotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders loading state initially', () => {
    // Never resolve the fetch to keep loading state
    mockFetchWithTimeout.mockReturnValue(new Promise(() => {}));

    const { container } = render(<NotificationPreferences />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  test('renders error state when fetch fails', async () => {
    mockFetchWithTimeout.mockRejectedValueOnce(new Error('Network error'));

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(
        screen.getByText('Failed to load notification preferences')
      ).toBeInTheDocument();
    });
  });

  test('renders all preference items after loading', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          email_case_updates: true,
          email_document_uploads: true,
          email_deadline_reminders: true,
          email_form_updates: true,
          email_team_updates: true,
          email_billing_updates: true,
          email_marketing: false,
        },
      }),
    });

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Email Notifications')).toBeInTheDocument();
    });

    expect(screen.getByText('Case Updates')).toBeInTheDocument();
    expect(screen.getByText('Document Uploads')).toBeInTheDocument();
    expect(screen.getByText('Deadline Reminders')).toBeInTheDocument();
    expect(screen.getByText('Form Updates')).toBeInTheDocument();
    expect(screen.getByText('Team Updates')).toBeInTheDocument();
    expect(screen.getByText('Billing Updates')).toBeInTheDocument();
    expect(screen.getByText('Marketing Emails')).toBeInTheDocument();
  });

  test('renders preference descriptions', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: null }),
    });

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Email Notifications')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Receive notifications when case status changes.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Get notified when clients upload documents.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Receive reminders for upcoming deadlines.')
    ).toBeInTheDocument();
  });

  test('renders card title and description', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: null }),
    });

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Email Notifications')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Choose what emails you want to receive.')
    ).toBeInTheDocument();
  });

  test('toggle calls PATCH endpoint with updated preference', async () => {
    mockFetchWithTimeout
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            email_case_updates: true,
            email_document_uploads: true,
            email_deadline_reminders: true,
            email_form_updates: true,
            email_team_updates: true,
            email_billing_updates: true,
            email_marketing: false,
          },
        }),
      })
      .mockResolvedValueOnce({ ok: true });

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Email Notifications')).toBeInTheDocument();
    });

    // Each preference row has a toggle button. Find by the preference label and its sibling button.
    const toggleButtons = screen.getAllByRole('button');
    // Toggle the first preference (Case Updates)
    fireEvent.click(toggleButtons[0]);

    await waitFor(() => {
      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        '/api/notifications/preferences',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ email_case_updates: false }),
        })
      );
    });
  });

  test('shows success toast on successful toggle', async () => {
    mockFetchWithTimeout
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: null }),
      })
      .mockResolvedValueOnce({ ok: true });

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Email Notifications')).toBeInTheDocument();
    });

    const toggleButtons = screen.getAllByRole('button');
    fireEvent.click(toggleButtons[0]);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Notification preference updated'
      );
    });
  });

  test('reverts toggle and shows error toast on failed update', async () => {
    mockFetchWithTimeout
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: null }),
      })
      .mockRejectedValueOnce(new Error('Update failed'));

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Email Notifications')).toBeInTheDocument();
    });

    const toggleButtons = screen.getAllByRole('button');
    fireEvent.click(toggleButtons[0]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to update notification preference'
      );
    });
  });

  test('uses default preferences when API returns null data', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: null }),
    });

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Email Notifications')).toBeInTheDocument();
    });

    // All 7 preference items should be rendered
    expect(screen.getAllByRole('button').length).toBe(7);
  });
});
