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
const mockParseApiVoidResponse = vi.fn();
vi.mock('@/lib/api/parse-response', () => ({
  parseApiResponse: (...args: unknown[]) => mockParseApiResponse(...args),
  parseApiVoidResponse: (...args: unknown[]) => mockParseApiVoidResponse(...args),
}));

import {
  useSubscription,
  useCheckout,
  useBillingPortal,
  useCancelSubscription,
  useResumeSubscription,
  useIsSubscribed,
  useHasFeature,
  useQuotaCheck,
  useUsage,
} from './use-subscription';

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

const mockSubscriptionData = {
  subscription: {
    id: 'sub-1',
    planType: 'pro' as const,
    status: 'active',
    billingPeriod: 'monthly' as const,
    currentPeriodStart: '2026-02-01T00:00:00Z',
    currentPeriodEnd: '2026-03-01T00:00:00Z',
    cancelAtPeriodEnd: false,
    trialEnd: null,
  },
  customer: {
    customerId: 'cus-1',
    email: 'jane@firm.com',
    name: 'Jane Smith',
  },
  limits: {
    planType: 'pro' as const,
    maxCases: 250,
    maxDocumentsPerCase: 100,
    maxAiRequestsPerMonth: 2500,
    maxStorageGb: 50,
    maxTeamMembers: 10,
    features: {
      documentAnalysis: true,
      formAutofill: true,
      prioritySupport: true,
      apiAccess: false,
    },
  },
  availablePlans: [],
  stripeConfigured: true,
};

const mockFreeSubscriptionData = {
  subscription: {
    id: 'sub-2',
    planType: 'free' as const,
    status: 'active',
    billingPeriod: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    trialEnd: null,
  },
  customer: null,
  limits: {
    planType: 'free' as const,
    maxCases: 100,
    maxDocumentsPerCase: 50,
    maxAiRequestsPerMonth: 1000,
    maxStorageGb: 25,
    maxTeamMembers: 5,
    features: {
      documentAnalysis: true,
      formAutofill: true,
      prioritySupport: false,
      apiAccess: false,
    },
  },
  availablePlans: [],
  stripeConfigured: true,
};

const mockEnterpriseData = {
  subscription: {
    id: 'sub-3',
    planType: 'enterprise' as const,
    status: 'active',
    billingPeriod: 'yearly' as const,
    currentPeriodStart: '2026-01-01T00:00:00Z',
    currentPeriodEnd: '2027-01-01T00:00:00Z',
    cancelAtPeriodEnd: false,
    trialEnd: null,
  },
  customer: {
    customerId: 'cus-3',
    email: 'admin@bigfirm.com',
    name: 'Big Firm',
  },
  limits: {
    planType: 'enterprise' as const,
    maxCases: -1,
    maxDocumentsPerCase: -1,
    maxAiRequestsPerMonth: -1,
    maxStorageGb: 500,
    maxTeamMembers: -1,
    features: {
      documentAnalysis: true,
      formAutofill: true,
      prioritySupport: true,
      apiAccess: true,
    },
  },
  availablePlans: [],
  stripeConfigured: true,
};

describe('useSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches subscription data', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockSubscriptionData);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSubscription(), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockSubscriptionData);
    expect(result.current.error).toBeNull();
    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/billing/subscription');
  });

  test('handles fetch error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 500 });
    mockParseApiResponse.mockRejectedValue(new Error('Internal Server Error'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSubscription(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.data).toBeUndefined();
  });
});

describe('useCheckout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('creates checkout session and redirects', async () => {
    const checkoutUrl = 'https://checkout.stripe.com/session-123';
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue({ url: checkoutUrl });

    // Mock window.location.href
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: '' },
      writable: true,
      configurable: true,
    });

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCheckout(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        planType: 'pro',
        billingPeriod: 'monthly',
      });
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planType: 'pro', billingPeriod: 'monthly' }),
    });

    expect(window.location.href).toBe(checkoutUrl);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['subscription'] });

    // Restore
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  test('handles checkout error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 400 });
    mockParseApiResponse.mockRejectedValue(new Error('Invalid plan'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckout(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({
        planType: 'pro',
        billingPeriod: 'monthly',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Invalid plan');
  });
});

describe('useBillingPortal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('creates portal session and redirects', async () => {
    const portalUrl = 'https://billing.stripe.com/portal-123';
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue({ url: portalUrl });

    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: '' },
      writable: true,
      configurable: true,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useBillingPortal(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/billing/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(window.location.href).toBe(portalUrl);

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  test('handles portal error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 400 });
    mockParseApiResponse.mockRejectedValue(new Error('No subscription'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useBillingPortal(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('No subscription');
  });
});

describe('useCancelSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('cancels subscription and invalidates queries', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiVoidResponse.mockResolvedValue(undefined);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCancelSubscription(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync(false);
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/billing/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ immediately: false }),
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['subscription'] });
  });

  test('cancels immediately', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiVoidResponse.mockResolvedValue(undefined);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCancelSubscription(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync(true);
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/billing/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ immediately: true }),
    });
  });

  test('handles cancel error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 400 });
    mockParseApiVoidResponse.mockRejectedValue(new Error('Cannot cancel'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCancelSubscription(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate(false);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useResumeSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('resumes subscription and invalidates queries', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiVoidResponse.mockResolvedValue(undefined);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useResumeSubscription(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/billing/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['subscription'] });
  });

  test('handles resume error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 400 });
    mockParseApiVoidResponse.mockRejectedValue(new Error('No cancelled subscription'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useResumeSubscription(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useIsSubscribed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns subscribed for active pro plan', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockSubscriptionData);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useIsSubscribed(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isSubscribed).toBe(true);
  });

  test('returns subscribed for specific plan types', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockSubscriptionData);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useIsSubscribed(['pro', 'enterprise']), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isSubscribed).toBe(true);
  });

  test('returns not subscribed when plan does not match', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockSubscriptionData);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useIsSubscribed(['enterprise']), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isSubscribed).toBe(false);
  });

  test('returns not subscribed for free plan', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockFreeSubscriptionData);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useIsSubscribed(['pro']), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isSubscribed).toBe(false);
  });

  test('returns not subscribed when subscription is null', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue({
      ...mockSubscriptionData,
      subscription: null,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useIsSubscribed(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isSubscribed).toBe(false);
  });

  test('returns isLoading while fetching', () => {
    mockFetchWithTimeout.mockReturnValue(new Promise(() => {}));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useIsSubscribed(), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isSubscribed).toBe(false);
  });

  test('returns subscribed for trialing status', async () => {
    const trialingData = {
      ...mockSubscriptionData,
      subscription: {
        ...mockSubscriptionData.subscription,
        status: 'trialing',
      },
    };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(trialingData);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useIsSubscribed(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isSubscribed).toBe(true);
  });

  test('returns not subscribed for cancelled status', async () => {
    const cancelledData = {
      ...mockSubscriptionData,
      subscription: {
        ...mockSubscriptionData.subscription,
        status: 'cancelled',
      },
    };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(cancelledData);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useIsSubscribed(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isSubscribed).toBe(false);
  });
});

describe('useHasFeature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns true for enabled feature', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockSubscriptionData);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useHasFeature('documentAnalysis'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasFeature).toBe(true);
  });

  test('returns false for disabled feature', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockSubscriptionData);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useHasFeature('apiAccess'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasFeature).toBe(false);
  });

  test('returns false while loading', () => {
    mockFetchWithTimeout.mockReturnValue(new Promise(() => {}));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useHasFeature('documentAnalysis'), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasFeature).toBe(false);
  });

  test('returns true for enterprise api access', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockEnterpriseData);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useHasFeature('apiAccess'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasFeature).toBe(true);
  });
});

describe('useQuotaCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns correct limit for pro plan', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockSubscriptionData);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useQuotaCheck('maxCases'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.limit).toBe(250);
    expect(result.current.isUnlimited).toBe(false);
  });

  test('returns unlimited for enterprise plan', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockEnterpriseData);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useQuotaCheck('maxCases'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.limit).toBe(-1);
    expect(result.current.isUnlimited).toBe(true);
  });

  test('returns zero limit while loading', () => {
    mockFetchWithTimeout.mockReturnValue(new Promise(() => {}));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useQuotaCheck('maxCases'), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.limit).toBe(0);
    expect(result.current.isUnlimited).toBe(false);
  });

  test('checks different quota metrics', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockSubscriptionData);

    const { Wrapper } = createWrapper();

    const { result: casesResult } = renderHook(() => useQuotaCheck('maxCases'), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(casesResult.current.isLoading).toBe(false));
    expect(casesResult.current.limit).toBe(250);

    // Need a fresh wrapper to avoid shared query cache
    const { Wrapper: Wrapper2 } = createWrapper();
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockSubscriptionData);

    const { result: teamResult } = renderHook(() => useQuotaCheck('maxTeamMembers'), {
      wrapper: Wrapper2,
    });
    await waitFor(() => expect(teamResult.current.isLoading).toBe(false));
    expect(teamResult.current.limit).toBe(10);
  });
});

describe('useUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches usage data', async () => {
    const usageData = {
      cases: 45,
      documents: 12,
      aiRequests: 350,
      teamMembers: 3,
    };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(usageData);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUsage(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(usageData);
    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/billing/usage');
  });

  test('handles usage fetch error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 500 });
    mockParseApiResponse.mockRejectedValue(new Error('Server Error'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUsage(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});
