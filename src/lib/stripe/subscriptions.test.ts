import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import type Stripe from 'stripe';

// Use vi.hoisted so these are available inside hoisted vi.mock factories
const { mockStripe, mockSupabaseClient, mockAdminClient } = vi.hoisted(() => ({
  mockStripe: {
    checkout: {
      sessions: { create: vi.fn() },
    },
    billingPortal: {
      sessions: { create: vi.fn() },
    },
    subscriptions: {
      cancel: vi.fn(),
      update: vi.fn(),
      retrieve: vi.fn(),
    },
  },
  mockSupabaseClient: {
    from: vi.fn(),
  },
  mockAdminClient: {
    from: vi.fn(),
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock retry to pass-through
vi.mock('@/lib/utils/retry', () => ({
  withRetry: vi.fn((fn: () => unknown) => fn()),
  STRIPE_RETRY_OPTIONS: {},
}));

// Mock Stripe client
vi.mock('./client', () => ({
  stripe: new Proxy({} as Record<string, unknown>, {
    get: (_target, prop: string) => mockStripe[prop as keyof typeof mockStripe],
  }),
  STRIPE_CONFIG: {
    prices: {
      proMonthly: 'price_pro_monthly_123',
      proYearly: 'price_pro_yearly_456',
      enterpriseMonthly: 'price_enterprise_monthly_789',
      enterpriseYearly: 'price_enterprise_yearly_abc',
    },
  },
}));

// Mock customers
vi.mock('./customers', () => ({
  getOrCreateStripeCustomer: vi.fn().mockResolvedValue('cus_test123'),
}));

// Mock Supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabaseClient),
}));

// Mock Supabase admin client
vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: vi.fn().mockReturnValue(mockAdminClient),
}));

import {
  getPriceId,
  createCheckoutSession,
  createBillingPortalSession,
  cancelSubscription,
  resumeSubscription,
  getSubscription,
  getUserSubscription,
  syncSubscriptionFromStripe,
} from './subscriptions';
import { STRIPE_CONFIG } from './client';

// Helper to build a minimal Stripe subscription object
function buildStripeSubscription(overrides: Record<string, unknown> = {}): Stripe.Subscription {
  return {
    id: 'sub_test_123',
    customer: 'cus_stripe_456',
    status: 'active',
    cancel_at_period_end: false,
    current_period_start: 1700000000,
    current_period_end: 1702592000,
    canceled_at: null,
    trial_start: null,
    trial_end: null,
    metadata: {},
    items: {
      data: [
        {
          price: {
            id: 'price_pro_monthly_123',
          },
        },
      ],
    },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

describe('getPriceId', () => {
  const originalPrices = { ...STRIPE_CONFIG.prices };

  afterEach(() => {
    Object.assign(STRIPE_CONFIG.prices, originalPrices);
  });

  it('should return price ID for pro monthly', () => {
    expect(getPriceId('pro', 'monthly')).toBe('price_pro_monthly_123');
  });

  it('should return price ID for pro yearly', () => {
    expect(getPriceId('pro', 'yearly')).toBe('price_pro_yearly_456');
  });

  it('should return price ID for enterprise monthly', () => {
    expect(getPriceId('enterprise', 'monthly')).toBe('price_enterprise_monthly_789');
  });

  it('should return price ID for enterprise yearly', () => {
    expect(getPriceId('enterprise', 'yearly')).toBe('price_enterprise_yearly_abc');
  });

  it('should throw for free plan', () => {
    expect(() => getPriceId('free', 'monthly')).toThrow('Free plan does not have a price ID');
  });

  it('should throw for empty/unconfigured price ID', () => {
    (STRIPE_CONFIG.prices as Record<string, string>).proMonthly = '';
    expect(() => getPriceId('pro', 'monthly')).toThrow('Price ID not configured');
  });

  it('should throw for invalid Stripe price ID format', () => {
    (STRIPE_CONFIG.prices as Record<string, string>).proMonthly = 'invalid_not_price';
    expect(() => getPriceId('pro', 'monthly')).toThrow('Invalid Stripe price ID format');
  });
});

describe('createCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a checkout session with correct params', async () => {
    const mockSession = { id: 'cs_test_123', url: 'https://checkout.stripe.com/test' };
    mockStripe.checkout.sessions.create.mockResolvedValue(mockSession);

    const result = await createCheckoutSession({
      userId: 'user_abc',
      planType: 'pro',
      billingPeriod: 'monthly',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    });

    expect(result).toEqual(mockSession);
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_test123',
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: 'price_pro_monthly_123', quantity: 1 }],
        success_url: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'https://example.com/cancel',
        allow_promotion_codes: true,
        billing_address_collection: 'required',
      }),
    );
  });
});

describe('createBillingPortalSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a billing portal session', async () => {
    const mockSession = { id: 'bps_test_123', url: 'https://billing.stripe.com/test' };
    mockStripe.billingPortal.sessions.create.mockResolvedValue(mockSession);

    const result = await createBillingPortalSession({
      userId: 'user_abc',
      returnUrl: 'https://example.com/billing',
    });

    expect(result).toEqual(mockSession);
    expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: 'cus_test123',
      return_url: 'https://example.com/billing',
    });
  });
});

describe('cancelSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should cancel immediately when cancelImmediately is true', async () => {
    const mockSub = { id: 'sub_123', status: 'canceled' };
    mockStripe.subscriptions.cancel.mockResolvedValue(mockSub);

    const result = await cancelSubscription('sub_123', true);

    expect(result).toEqual(mockSub);
    expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith('sub_123');
    expect(mockStripe.subscriptions.update).not.toHaveBeenCalled();
  });

  it('should set cancel_at_period_end when cancelImmediately is false (default)', async () => {
    const mockSub = { id: 'sub_123', cancel_at_period_end: true };
    mockStripe.subscriptions.update.mockResolvedValue(mockSub);

    const result = await cancelSubscription('sub_123');

    expect(result).toEqual(mockSub);
    expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
      cancel_at_period_end: true,
    });
    expect(mockStripe.subscriptions.cancel).not.toHaveBeenCalled();
  });
});

describe('resumeSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should resume subscription by setting cancel_at_period_end to false', async () => {
    const mockSub = { id: 'sub_123', cancel_at_period_end: false };
    mockStripe.subscriptions.update.mockResolvedValue(mockSub);

    const result = await resumeSubscription('sub_123');

    expect(result).toEqual(mockSub);
    expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
      cancel_at_period_end: false,
    });
  });
});

describe('getSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should retrieve a subscription by ID', async () => {
    const mockSub = { id: 'sub_123', status: 'active' };
    mockStripe.subscriptions.retrieve.mockResolvedValue(mockSub);

    const result = await getSubscription('sub_123');

    expect(result).toEqual(mockSub);
    expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_123');
  });
});

describe('getUserSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return subscription data on success', async () => {
    const mockData = { id: 'sub_db_1', plan_type: 'pro', status: 'active' };
    const mockBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    };
    mockSupabaseClient.from.mockReturnValue(mockBuilder);

    const result = await getUserSubscription('user_abc');

    expect(result).toEqual(mockData);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('subscriptions');
  });

  it('should return null when error code is PGRST116 (not found)', async () => {
    const mockBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      }),
    };
    mockSupabaseClient.from.mockReturnValue(mockBuilder);

    const result = await getUserSubscription('user_nonexistent');
    expect(result).toBeNull();
  });

  it('should throw on non-PGRST116 errors', async () => {
    const mockBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '42P01', message: 'relation does not exist' },
      }),
    };
    mockSupabaseClient.from.mockReturnValue(mockBuilder);

    await expect(getUserSubscription('user_abc')).rejects.toThrow(
      'Failed to fetch subscription: relation does not exist',
    );
  });
});

describe('syncSubscriptionFromStripe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupAdminMock(
    customerResult: { data: unknown; error: unknown },
    existingResult?: { data: unknown; error: unknown },
    upsertResult?: { error: unknown },
  ) {
    const mockBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      upsert: vi.fn(),
    };

    let callCount = 0;
    mockAdminClient.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        mockBuilder.single.mockResolvedValueOnce(customerResult);
      } else if (callCount === 2 && existingResult) {
        mockBuilder.single.mockResolvedValueOnce(existingResult);
      }
      if (upsertResult !== undefined) {
        mockBuilder.upsert.mockResolvedValue(upsertResult);
      }
      return mockBuilder;
    });

    return mockBuilder;
  }

  it('should sync subscription successfully', async () => {
    setupAdminMock(
      { data: { id: 'cust_db_1' }, error: null },
      undefined,
      { error: null },
    );

    const sub = buildStripeSubscription();
    const result = await syncSubscriptionFromStripe(sub);

    expect(result).toEqual({ success: true });
  });

  it('should throw when customer is not found', async () => {
    setupAdminMock(
      { data: null, error: { message: 'not found' } },
    );

    const sub = buildStripeSubscription();
    await expect(syncSubscriptionFromStripe(sub)).rejects.toThrow(
      'Customer not found for Stripe customer: cus_stripe_456',
    );
  });

  it('should skip duplicate event when eventId matches existing', async () => {
    const mockBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      upsert: vi.fn(),
    };

    let callCount = 0;
    mockAdminClient.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        mockBuilder.single.mockResolvedValueOnce({ data: { id: 'cust_db_1' }, error: null });
      } else if (callCount === 2) {
        mockBuilder.single.mockResolvedValueOnce({
          data: { id: 'sub_1', updated_at: '2024-01-01', stripe_event_id: 'evt_duplicate' },
          error: null,
        });
      }
      return mockBuilder;
    });

    const sub = buildStripeSubscription();
    const result = await syncSubscriptionFromStripe(sub, 'evt_duplicate');

    expect(result).toEqual({ success: true, skipped: true, reason: 'duplicate_event' });
    expect(mockBuilder.upsert).not.toHaveBeenCalled();
  });

  it('should throw when upsert fails', async () => {
    setupAdminMock(
      { data: { id: 'cust_db_1' }, error: null },
      undefined,
      { error: { message: 'upsert failed' } },
    );

    const sub = buildStripeSubscription();
    await expect(syncSubscriptionFromStripe(sub)).rejects.toThrow(
      'Failed to sync subscription: upsert failed',
    );
  });

  it('should handle customer as object (not string)', async () => {
    setupAdminMock(
      { data: { id: 'cust_db_1' }, error: null },
      undefined,
      { error: null },
    );

    const sub = buildStripeSubscription({
      customer: { id: 'cus_object_789' } as unknown as string,
    });

    const result = await syncSubscriptionFromStripe(sub);
    expect(result).toEqual({ success: true });
  });

  it('should skip idempotency check when no eventId provided', async () => {
    setupAdminMock(
      { data: { id: 'cust_db_1' }, error: null },
      undefined,
      { error: null },
    );

    const sub = buildStripeSubscription();
    const result = await syncSubscriptionFromStripe(sub);

    expect(result).toEqual({ success: true });
    // Only customers + subscriptions upsert (no idempotency check)
    expect(mockAdminClient.from).toHaveBeenCalledTimes(2);
  });

  it('should map pro monthly price ID correctly', async () => {
    const mockBuilder = setupAdminMock(
      { data: { id: 'cust_db_1' }, error: null },
      undefined,
      { error: null },
    );

    const sub = buildStripeSubscription({
      items: { data: [{ price: { id: 'price_pro_monthly_123' } }] },
    });

    await syncSubscriptionFromStripe(sub);

    const upsertCall = mockBuilder.upsert.mock.calls[0][0];
    expect(upsertCall.plan_type).toBe('pro');
    expect(upsertCall.billing_period).toBe('monthly');
  });

  it('should map enterprise yearly price ID correctly', async () => {
    const mockBuilder = setupAdminMock(
      { data: { id: 'cust_db_1' }, error: null },
      undefined,
      { error: null },
    );

    const sub = buildStripeSubscription({
      items: { data: [{ price: { id: 'price_enterprise_yearly_abc' } }] },
    });

    await syncSubscriptionFromStripe(sub);

    const upsertCall = mockBuilder.upsert.mock.calls[0][0];
    expect(upsertCall.plan_type).toBe('enterprise');
    expect(upsertCall.billing_period).toBe('yearly');
  });

  it('should map unknown price ID to free plan with null billing period', async () => {
    const mockBuilder = setupAdminMock(
      { data: { id: 'cust_db_1' }, error: null },
      undefined,
      { error: null },
    );

    const sub = buildStripeSubscription({
      items: { data: [{ price: { id: 'price_unknown_999' } }] },
    });

    await syncSubscriptionFromStripe(sub);

    const upsertCall = mockBuilder.upsert.mock.calls[0][0];
    expect(upsertCall.plan_type).toBe('free');
    expect(upsertCall.billing_period).toBeNull();
  });

  it('should include eventId in upsert data when provided', async () => {
    const mockBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    };

    let callCount = 0;
    mockAdminClient.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        mockBuilder.single.mockResolvedValueOnce({ data: { id: 'cust_db_1' }, error: null });
      } else if (callCount === 2) {
        mockBuilder.single.mockResolvedValueOnce({
          data: { id: 'sub_1', stripe_event_id: 'evt_old' },
          error: null,
        });
      }
      return mockBuilder;
    });

    const sub = buildStripeSubscription();
    await syncSubscriptionFromStripe(sub, 'evt_new_123');

    const upsertCall = mockBuilder.upsert.mock.calls[0][0];
    expect(upsertCall.stripe_event_id).toBe('evt_new_123');
  });

  it('should handle subscription with undefined price ID', async () => {
    const mockBuilder = setupAdminMock(
      { data: { id: 'cust_db_1' }, error: null },
      undefined,
      { error: null },
    );

    const sub = buildStripeSubscription({
      items: { data: [{ price: { id: undefined } }] },
    });

    await syncSubscriptionFromStripe(sub);

    const upsertCall = mockBuilder.upsert.mock.calls[0][0];
    expect(upsertCall.plan_type).toBe('free');
    expect(upsertCall.billing_period).toBeNull();
  });
});
