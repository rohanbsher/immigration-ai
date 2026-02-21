import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Mock fetch-with-timeout
const mockFetchWithTimeout = vi.fn();
vi.mock('@/lib/api/fetch-with-timeout', () => {
  class MockTimeoutError extends Error {
    constructor(timeout: number) {
      super(`Request timed out after ${timeout / 1000} seconds`);
      this.name = 'TimeoutError';
    }
  }
  return {
    fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
    TimeoutError: MockTimeoutError,
  };
});

// Mock parse-response
const mockParseApiResponse = vi.fn();
vi.mock('@/lib/api/parse-response', () => ({
  parseApiResponse: (...args: unknown[]) => mockParseApiResponse(...args),
}));

import {
  useDeadlines,
  useUpdateDeadlineAlert,
  useDeadlineCounts,
  getSeverityColors,
  formatDaysRemaining,
  getAlertTypeLabel,
} from './use-deadlines';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  Wrapper.displayName = 'TestQueryWrapper';
  return { Wrapper, queryClient };
}

const mockDeadlineAlert = {
  id: 'alert-1',
  caseId: 'case-1',
  userId: 'user-1',
  alertType: 'case_deadline' as const,
  deadlineDate: new Date('2026-03-01'),
  severity: 'critical' as const,
  message: 'H-1B filing deadline approaching',
  daysRemaining: 5,
  acknowledged: false,
  acknowledgedAt: null,
  snoozedUntil: null,
  createdAt: new Date('2026-02-01'),
  caseInfo: {
    title: 'Test H-1B Case',
    visaType: 'H-1B',
    clientName: 'John Doe',
  },
};

const mockDeadlinesResponse = {
  deadlines: [mockDeadlineAlert],
  summary: {
    total: 3,
    critical: 1,
    warning: 1,
    info: 1,
    acknowledged: 0,
  },
  grouped: {
    critical: [mockDeadlineAlert],
    warning: [],
    info: [],
    acknowledged: [],
  },
};

describe('useDeadlines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches deadlines with default 60 days', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockDeadlinesResponse);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeadlines(), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockDeadlinesResponse);
    expect(result.current.error).toBeNull();
    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/cases/deadlines?days=60', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });

  test('fetches deadlines with custom days', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockDeadlinesResponse);

    const { Wrapper } = createWrapper();
    renderHook(() => useDeadlines({ days: 30 }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(mockFetchWithTimeout).toHaveBeenCalled();
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/cases/deadlines?days=30', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });

  test('does not fetch when enabled is false', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeadlines({ enabled: false }), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });

  test('handles fetch error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 500 });
    mockParseApiResponse.mockRejectedValue(new Error('Internal Server Error'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeadlines(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.data).toBeUndefined();
  });
});

describe('useUpdateDeadlineAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('acknowledges an alert and invalidates queries', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue({ success: true });

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateDeadlineAlert(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.acknowledgeAlert('alert-1');
    });

    await waitFor(() => {
      expect(mockFetchWithTimeout).toHaveBeenCalled();
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/cases/deadlines/alert-1', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'acknowledge', snoozeDays: undefined }),
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['deadlines'] });
    });
  });

  test('snoozes an alert with custom days', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue({ success: true });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateDeadlineAlert(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.snoozeAlert('alert-1', 3);
    });

    await waitFor(() => {
      expect(mockFetchWithTimeout).toHaveBeenCalled();
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/cases/deadlines/alert-1', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'snooze', snoozeDays: 3 }),
    });
  });

  test('snoozes with default 1 day', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue({ success: true });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateDeadlineAlert(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.snoozeAlert('alert-1');
    });

    await waitFor(() => {
      expect(mockFetchWithTimeout).toHaveBeenCalled();
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/cases/deadlines/alert-1', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'snooze', snoozeDays: 1 }),
    });
  });

  test('reports error state', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 404 });
    mockParseApiResponse.mockRejectedValue(new Error('Alert not found'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateDeadlineAlert(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.acknowledgeAlert('nonexistent');
    });

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
    });
  });
});

describe('useDeadlineCounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns summary counts from deadlines data', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockDeadlinesResponse);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeadlineCounts(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.total).toBe(3);
    expect(result.current.critical).toBe(1);
    expect(result.current.warning).toBe(1);
    expect(result.current.hasUrgent).toBe(true);
  });

  test('returns zeros when data is not loaded', () => {
    mockFetchWithTimeout.mockReturnValue(new Promise(() => {}));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeadlineCounts(), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.total).toBe(0);
    expect(result.current.critical).toBe(0);
    expect(result.current.warning).toBe(0);
    expect(result.current.hasUrgent).toBe(false);
  });

  test('hasUrgent is false when no critical deadlines', async () => {
    const noCritical = {
      ...mockDeadlinesResponse,
      summary: { total: 2, critical: 0, warning: 1, info: 1, acknowledged: 0 },
    };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(noCritical);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeadlineCounts(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasUrgent).toBe(false);
  });
});

// Pure utility function tests (no React hooks needed)
describe('getSeverityColors', () => {
  test('returns correct colors for critical severity', () => {
    const colors = getSeverityColors('critical');
    expect(colors.bg).toBe('bg-red-50');
    expect(colors.text).toBe('text-red-700');
    expect(colors.border).toBe('border-red-200');
    expect(colors.dot).toBe('bg-red-500');
    expect(colors.icon).toBe('text-red-500');
  });

  test('returns correct colors for warning severity', () => {
    const colors = getSeverityColors('warning');
    expect(colors.bg).toBe('bg-yellow-50');
    expect(colors.text).toBe('text-yellow-700');
    expect(colors.border).toBe('border-yellow-200');
    expect(colors.dot).toBe('bg-yellow-500');
    expect(colors.icon).toBe('text-yellow-500');
  });

  test('returns correct colors for info severity', () => {
    const colors = getSeverityColors('info');
    expect(colors.bg).toBe('bg-blue-50');
    expect(colors.text).toBe('text-blue-700');
    expect(colors.border).toBe('border-blue-200');
    expect(colors.dot).toBe('bg-blue-500');
    expect(colors.icon).toBe('text-blue-500');
  });
});

describe('formatDaysRemaining', () => {
  test('returns overdue for negative days', () => {
    expect(formatDaysRemaining(-3)).toBe('3 days overdue');
  });

  test('handles single day overdue', () => {
    expect(formatDaysRemaining(-1)).toBe('1 day overdue');
  });

  test('returns Today for 0 days', () => {
    expect(formatDaysRemaining(0)).toBe('Today');
  });

  test('returns Tomorrow for 1 day', () => {
    expect(formatDaysRemaining(1)).toBe('Tomorrow');
  });

  test('returns days for 2-7 days', () => {
    expect(formatDaysRemaining(3)).toBe('3 days');
    expect(formatDaysRemaining(7)).toBe('7 days');
  });

  test('returns weeks for 8-30 days', () => {
    expect(formatDaysRemaining(8)).toBe('2 weeks');
    expect(formatDaysRemaining(14)).toBe('2 weeks');
    expect(formatDaysRemaining(15)).toBe('3 weeks');
    expect(formatDaysRemaining(30)).toBe('5 weeks');
  });

  test('returns months for 31+ days', () => {
    expect(formatDaysRemaining(31)).toBe('2 months');
    expect(formatDaysRemaining(60)).toBe('2 months');
    expect(formatDaysRemaining(90)).toBe('3 months');
  });

  test('handles single month', () => {
    // 30 days = 5 weeks (handled by weeks branch), not months
    // 31 days / 30 = ceil(1.03) = 2 months
    // To get 1 month, we need ceil(days/30) == 1, meaning days <= 30
    // But days > 30 enters months branch, so smallest is ceil(31/30) = 2
    expect(formatDaysRemaining(31)).toBe('2 months');
  });
});

describe('getAlertTypeLabel', () => {
  test('returns correct label for case_deadline', () => {
    expect(getAlertTypeLabel('case_deadline')).toBe('Case Deadline');
  });

  test('returns correct label for document_expiry', () => {
    expect(getAlertTypeLabel('document_expiry')).toBe('Document Expiring');
  });

  test('returns correct label for processing_estimate', () => {
    expect(getAlertTypeLabel('processing_estimate')).toBe('Processing Update');
  });
});
