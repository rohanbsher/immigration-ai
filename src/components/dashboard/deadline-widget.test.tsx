import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeadlineWidget } from './deadline-widget';
import type { DeadlineAlert } from '@/lib/deadline';

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

// Mock the hooks
const mockUseDeadlines = vi.fn();
const mockAcknowledgeAlert = vi.fn();
const mockSnoozeAlert = vi.fn();
const mockUseUpdateDeadlineAlert = vi.fn();

vi.mock('@/hooks/use-deadlines', () => ({
  useDeadlines: (...args: unknown[]) => mockUseDeadlines(...args),
  useUpdateDeadlineAlert: (...args: unknown[]) => mockUseUpdateDeadlineAlert(...args),
  getSeverityColors: (severity: string) => {
    switch (severity) {
      case 'critical':
        return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500', icon: 'text-red-500' };
      case 'warning':
        return { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500', icon: 'text-yellow-500' };
      case 'info':
        return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500', icon: 'text-blue-500' };
      default:
        return { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', dot: 'bg-gray-500', icon: 'text-gray-500' };
    }
  },
  formatDaysRemaining: (days: number) => {
    if (days < 0) {
      const absDays = Math.abs(days);
      return `${absDays} ${absDays === 1 ? 'day' : 'days'} overdue`;
    }
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days <= 7) return `${days} days`;
    if (days <= 30) {
      const weeks = Math.ceil(days / 7);
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
    }
    const months = Math.ceil(days / 30);
    return `${months} ${months === 1 ? 'month' : 'months'}`;
  },
  getAlertTypeLabel: (alertType: string) => {
    switch (alertType) {
      case 'case_deadline':
        return 'Case Deadline';
      case 'document_expiry':
        return 'Document Expiring';
      case 'processing_estimate':
        return 'Processing Update';
      default:
        return alertType;
    }
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function makeDeadlineAlert(overrides: Partial<DeadlineAlert> = {}): DeadlineAlert {
  return {
    id: 'alert-1',
    caseId: 'case-1',
    userId: 'user-1',
    alertType: 'case_deadline',
    deadlineDate: new Date(),
    severity: 'warning',
    message: 'Filing deadline approaching',
    daysRemaining: 14,
    acknowledged: false,
    acknowledgedAt: null,
    snoozedUntil: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('DeadlineWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUpdateDeadlineAlert.mockReturnValue({
      acknowledgeAlert: mockAcknowledgeAlert,
      snoozeAlert: mockSnoozeAlert,
      isUpdating: false,
    });
  });

  describe('loading state', () => {
    test('renders loading indicator when data is loading', () => {
      mockUseDeadlines.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      render(<DeadlineWidget />, { wrapper: createWrapper() });
      expect(screen.getByText('Loading deadlines')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    test('renders error message when there is an error', () => {
      mockUseDeadlines.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Network error'),
      });

      render(<DeadlineWidget />, { wrapper: createWrapper() });
      expect(screen.getByText('Failed to load deadlines')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    test('renders empty state when data is null', () => {
      mockUseDeadlines.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      render(<DeadlineWidget />, { wrapper: createWrapper() });
      expect(screen.getByText('No upcoming deadlines')).toBeInTheDocument();
      expect(screen.getByText('All deadlines are more than 60 days away.')).toBeInTheDocument();
    });

    test('renders empty state when total is 0', () => {
      mockUseDeadlines.mockReturnValue({
        data: {
          deadlines: [],
          summary: { total: 0, critical: 0, warning: 0, info: 0, acknowledged: 0 },
          grouped: { critical: [], warning: [], info: [], acknowledged: [] },
        },
        isLoading: false,
        error: null,
      });

      render(<DeadlineWidget />, { wrapper: createWrapper() });
      expect(screen.getByText('No upcoming deadlines')).toBeInTheDocument();
    });
  });

  describe('deadline list', () => {
    test('renders header with Upcoming Deadlines', () => {
      mockUseDeadlines.mockReturnValue({
        data: {
          deadlines: [makeDeadlineAlert()],
          summary: { total: 1, critical: 0, warning: 1, info: 0, acknowledged: 0 },
          grouped: {
            critical: [],
            warning: [makeDeadlineAlert()],
            info: [],
            acknowledged: [],
          },
        },
        isLoading: false,
        error: null,
      });

      render(<DeadlineWidget />, { wrapper: createWrapper() });
      expect(screen.getByText('Upcoming Deadlines')).toBeInTheDocument();
    });

    test('hides header when showHeader is false', () => {
      mockUseDeadlines.mockReturnValue({
        data: {
          deadlines: [makeDeadlineAlert()],
          summary: { total: 1, critical: 0, warning: 1, info: 0, acknowledged: 0 },
          grouped: {
            critical: [],
            warning: [makeDeadlineAlert()],
            info: [],
            acknowledged: [],
          },
        },
        isLoading: false,
        error: null,
      });

      render(<DeadlineWidget showHeader={false} />, { wrapper: createWrapper() });
      expect(screen.queryByText('Upcoming Deadlines')).not.toBeInTheDocument();
    });

    test('renders deadline messages', () => {
      mockUseDeadlines.mockReturnValue({
        data: {
          deadlines: [
            makeDeadlineAlert({ id: 'a1', message: 'I-485 filing deadline', severity: 'critical', daysRemaining: 3 }),
            makeDeadlineAlert({ id: 'a2', message: 'Passport expiring soon', severity: 'warning', daysRemaining: 20 }),
          ],
          summary: { total: 2, critical: 1, warning: 1, info: 0, acknowledged: 0 },
          grouped: {
            critical: [makeDeadlineAlert({ id: 'a1', message: 'I-485 filing deadline', severity: 'critical', daysRemaining: 3 })],
            warning: [makeDeadlineAlert({ id: 'a2', message: 'Passport expiring soon', severity: 'warning', daysRemaining: 20 })],
            info: [],
            acknowledged: [],
          },
        },
        isLoading: false,
        error: null,
      });

      render(<DeadlineWidget />, { wrapper: createWrapper() });
      expect(screen.getByText('I-485 filing deadline')).toBeInTheDocument();
      expect(screen.getByText('Passport expiring soon')).toBeInTheDocument();
    });

    test('renders formatted days remaining', () => {
      mockUseDeadlines.mockReturnValue({
        data: {
          deadlines: [makeDeadlineAlert({ daysRemaining: 3, severity: 'critical' })],
          summary: { total: 1, critical: 1, warning: 0, info: 0, acknowledged: 0 },
          grouped: {
            critical: [makeDeadlineAlert({ daysRemaining: 3, severity: 'critical' })],
            warning: [],
            info: [],
            acknowledged: [],
          },
        },
        isLoading: false,
        error: null,
      });

      render(<DeadlineWidget />, { wrapper: createWrapper() });
      expect(screen.getByText('3 days')).toBeInTheDocument();
    });

    test('renders alert type label', () => {
      mockUseDeadlines.mockReturnValue({
        data: {
          deadlines: [makeDeadlineAlert({ alertType: 'document_expiry', severity: 'warning' })],
          summary: { total: 1, critical: 0, warning: 1, info: 0, acknowledged: 0 },
          grouped: {
            critical: [],
            warning: [makeDeadlineAlert({ alertType: 'document_expiry', severity: 'warning' })],
            info: [],
            acknowledged: [],
          },
        },
        isLoading: false,
        error: null,
      });

      render(<DeadlineWidget />, { wrapper: createWrapper() });
      expect(screen.getByText('Document Expiring')).toBeInTheDocument();
    });

    test('renders case info link when present', () => {
      const alert = makeDeadlineAlert({
        severity: 'critical',
        caseInfo: {
          title: 'Johnson H-1B Case',
          visaType: 'H-1B',
          clientName: 'Michael Johnson',
        },
      });

      mockUseDeadlines.mockReturnValue({
        data: {
          deadlines: [alert],
          summary: { total: 1, critical: 1, warning: 0, info: 0, acknowledged: 0 },
          grouped: {
            critical: [alert],
            warning: [],
            info: [],
            acknowledged: [],
          },
        },
        isLoading: false,
        error: null,
      });

      render(<DeadlineWidget />, { wrapper: createWrapper() });
      expect(screen.getByText('Johnson H-1B Case')).toBeInTheDocument();
    });

    test('renders overdue deadlines with correct formatting', () => {
      mockUseDeadlines.mockReturnValue({
        data: {
          deadlines: [makeDeadlineAlert({ daysRemaining: -3, severity: 'critical' })],
          summary: { total: 1, critical: 1, warning: 0, info: 0, acknowledged: 0 },
          grouped: {
            critical: [makeDeadlineAlert({ daysRemaining: -3, severity: 'critical' })],
            warning: [],
            info: [],
            acknowledged: [],
          },
        },
        isLoading: false,
        error: null,
      });

      render(<DeadlineWidget />, { wrapper: createWrapper() });
      expect(screen.getByText('3 days overdue')).toBeInTheDocument();
    });
  });

  describe('actions', () => {
    const alertWithData = () => {
      const alert = makeDeadlineAlert({ id: 'alert-42', severity: 'critical', daysRemaining: 5 });
      mockUseDeadlines.mockReturnValue({
        data: {
          deadlines: [alert],
          summary: { total: 1, critical: 1, warning: 0, info: 0, acknowledged: 0 },
          grouped: {
            critical: [alert],
            warning: [],
            info: [],
            acknowledged: [],
          },
        },
        isLoading: false,
        error: null,
      });
    };

    test('acknowledge button calls acknowledgeAlert with correct id', () => {
      alertWithData();

      render(<DeadlineWidget />, { wrapper: createWrapper() });
      // The acknowledge button has a Check icon, find it via tooltip text
      // Since tooltips may not be accessible easily, find by button role
      const buttons = screen.getAllByRole('button');
      // The last button in each deadline item is the acknowledge button (Check icon)
      const acknowledgeBtn = buttons[buttons.length - 1];
      fireEvent.click(acknowledgeBtn);
      expect(mockAcknowledgeAlert).toHaveBeenCalledWith('alert-42');
    });

    test('snooze button calls snoozeAlert with correct id', () => {
      alertWithData();

      render(<DeadlineWidget />, { wrapper: createWrapper() });
      const buttons = screen.getAllByRole('button');
      // The snooze button (BellOff) is the first action button, acknowledge (Check) is the second
      const snoozeBtn = buttons[buttons.length - 2];
      fireEvent.click(snoozeBtn);
      expect(mockSnoozeAlert).toHaveBeenCalledWith('alert-42');
    });
  });

  describe('View all link', () => {
    test('shows View all link when deadlines exceed maxItems', () => {
      const criticalAlerts = Array.from({ length: 6 }, (_, i) =>
        makeDeadlineAlert({ id: `alert-${i}`, severity: 'critical', daysRemaining: i + 1 })
      );

      mockUseDeadlines.mockReturnValue({
        data: {
          deadlines: criticalAlerts,
          summary: { total: 6, critical: 6, warning: 0, info: 0, acknowledged: 0 },
          grouped: {
            critical: criticalAlerts,
            warning: [],
            info: [],
            acknowledged: [],
          },
        },
        isLoading: false,
        error: null,
      });

      render(<DeadlineWidget maxItems={5} />, { wrapper: createWrapper() });
      expect(screen.getByText('View all 6 deadlines')).toBeInTheDocument();
    });

    test('does not show View all link when within maxItems', () => {
      const alert = makeDeadlineAlert({ severity: 'critical' });

      mockUseDeadlines.mockReturnValue({
        data: {
          deadlines: [alert],
          summary: { total: 1, critical: 1, warning: 0, info: 0, acknowledged: 0 },
          grouped: {
            critical: [alert],
            warning: [],
            info: [],
            acknowledged: [],
          },
        },
        isLoading: false,
        error: null,
      });

      render(<DeadlineWidget maxItems={5} />, { wrapper: createWrapper() });
      expect(screen.queryByText(/View all/)).not.toBeInTheDocument();
    });
  });

  describe('summary badges', () => {
    test('renders critical and warning badges in header', () => {
      mockUseDeadlines.mockReturnValue({
        data: {
          deadlines: [
            makeDeadlineAlert({ id: 'a1', severity: 'critical' }),
            makeDeadlineAlert({ id: 'a2', severity: 'warning' }),
          ],
          summary: { total: 2, critical: 1, warning: 1, info: 0, acknowledged: 0 },
          grouped: {
            critical: [makeDeadlineAlert({ id: 'a1', severity: 'critical' })],
            warning: [makeDeadlineAlert({ id: 'a2', severity: 'warning' })],
            info: [],
            acknowledged: [],
          },
        },
        isLoading: false,
        error: null,
      });

      render(<DeadlineWidget />, { wrapper: createWrapper() });
      // The summary badges show count numbers
      // Critical count "1" and warning count "1" should appear as badge text
      const badges = screen.getAllByText('1');
      expect(badges.length).toBeGreaterThanOrEqual(2);
    });
  });
});
