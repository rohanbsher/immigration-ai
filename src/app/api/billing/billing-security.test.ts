/**
 * Security-focused tests for Billing API routes.
 *
 * Supplements the existing billing.test.ts with:
 * - Rate limit enforcement on all routes
 * - Subscription state transitions (cancel -> resume flow)
 * - Webhook replay attack prevention
 * - Webhook idempotency edge cases
 * - Quota boundary conditions
 * - Stripe client configuration handling
 * - Plan validation boundaries
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const MOCK_USER_ID = 'user-sec-123';
const MOCK_EMAIL = 'security-test@example.com';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({
  serverAuth: {
    getUser: vi.fn(),
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(),
  RATE_LIMITS: {
    STANDARD: { maxRequests: 100, windowMs: 60_000, keyPrefix: 'standard' },
    SENSITIVE: { maxRequests: 20, windowMs: 60_000, keyPrefix: 'sensitive' },
  },
  standardRateLimiter: {
    limit: vi.fn(),
  },
}));

vi.mock('@/lib/stripe', () => ({
  createCheckoutSession: vi.fn(),
  createBillingPortalSession: vi.fn(),
  cancelSubscription: vi.fn(),
  resumeSubscription: vi.fn(),
  getUserSubscription: vi.fn(),
  getCustomerWithSubscription: vi.fn(),
  constructWebhookEvent: vi.fn(),
  handleWebhookEvent: vi.fn(),
}));

vi.mock('@/lib/stripe/client', () => ({
  getStripeClient: vi.fn(),
}));

vi.mock('@/lib/db/subscriptions', () => ({
  getSubscriptionByUserId: vi.fn(),
  getUserPlanLimits: vi.fn(),
  getAllPlanLimits: vi.fn(),
}));

vi.mock('@/lib/billing/quota', () => ({
  checkQuota: vi.fn(),
}));

vi.mock('@/lib/auth/api-helpers', () => ({
  safeParseBody: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  }),
}));

const mockAdminSingle = vi.fn().mockResolvedValue({ data: { id: 'claimed-1' }, error: null });
const mockAdminClaimSelect = vi.fn(() => ({ single: mockAdminSingle }));
const mockAdminInsert = vi.fn(() => ({ select: mockAdminClaimSelect }));
const mockAdminDeleteEq = vi.fn().mockResolvedValue({ error: null });
const mockAdminDelete = vi.fn(() => ({ eq: mockAdminDeleteEq }));
vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: mockAdminInsert,
      delete: mockAdminDelete,
    })),
  })),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { serverAuth } from '@/lib/auth';
import { rateLimit, standardRateLimiter } from '@/lib/rate-limit';
import {
  createCheckoutSession,
  createBillingPortalSession,
  cancelSubscription,
  resumeSubscription,
  getUserSubscription,
  getCustomerWithSubscription,
  constructWebhookEvent,
  handleWebhookEvent,
} from '@/lib/stripe';
import { getStripeClient } from '@/lib/stripe/client';
import {
  getSubscriptionByUserId,
  getUserPlanLimits,
  getAllPlanLimits,
} from '@/lib/db/subscriptions';
import { checkQuota } from '@/lib/billing/quota';
import { safeParseBody } from '@/lib/auth/api-helpers';

import { POST as checkoutPOST } from './checkout/route';
import { POST as portalPOST } from './portal/route';
import { POST as cancelPOST } from './cancel/route';
import { POST as resumePOST } from './resume/route';
import { GET as subscriptionGET } from './subscription/route';
import { GET as quotaGET } from './quota/route';
import { POST as webhookPOST } from './webhooks/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(
  method: string,
  url: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>
): NextRequest {
  const init: RequestInit = {
    method,
    headers: { 'x-forwarded-for': '10.0.0.1', ...headers },
  };
  if (body) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)['content-type'] = 'application/json';
  }
  const req = new NextRequest(`http://localhost:3000${url}`, init);
  if (body) {
    req.json = async () => body;
  }
  return req;
}

function createWebhookRequest(body: string, signature?: string): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (signature) headers['stripe-signature'] = signature;
  const req = new NextRequest('http://localhost:3000/api/billing/webhooks', {
    method: 'POST',
    body,
    headers,
  });
  req.text = async () => body;
  return req;
}

function mockAuthenticated() {
  vi.mocked(serverAuth.getUser).mockResolvedValue({
    id: MOCK_USER_ID,
    email: MOCK_EMAIL,
  } as never);
}

function mockRateLimitOk() {
  vi.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 10 } as never);
}

function mockRateLimited(retryAfter = 60) {
  vi.mocked(rateLimit).mockResolvedValue({
    success: false,
    retryAfter,
  } as never);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Billing API - Rate Limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('checkout returns 429 with correct Retry-After', async () => {
    mockRateLimited(90);
    const req = createRequest('POST', '/api/billing/checkout', {
      planType: 'pro',
      billingPeriod: 'monthly',
    });
    const res = await checkoutPOST(req);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('90');
  });

  it('portal returns 429 with Retry-After', async () => {
    mockRateLimited(30);
    const req = createRequest('POST', '/api/billing/portal');
    const res = await portalPOST(req);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('30');
  });

  it('cancel returns 429 with Retry-After', async () => {
    mockRateLimited(45);
    const req = createRequest('POST', '/api/billing/cancel', {});
    const res = await cancelPOST(req);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('45');
  });

  it('resume returns 429 with Retry-After', async () => {
    mockRateLimited(15);
    const req = createRequest('POST', '/api/billing/resume');
    const res = await resumePOST(req);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('15');
  });

  it('subscription returns 429 with Retry-After', async () => {
    mockRateLimited(20);
    const req = createRequest('GET', '/api/billing/subscription');
    const res = await subscriptionGET(req);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('20');
  });

  it('defaults Retry-After to 60 when retryAfter is undefined', async () => {
    vi.mocked(rateLimit).mockResolvedValue({ success: false } as never);
    const req = createRequest('POST', '/api/billing/checkout', {
      planType: 'pro',
      billingPeriod: 'monthly',
    });
    const res = await checkoutPOST(req);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
  });
});

describe('Billing API - Checkout Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimitOk();
    mockAuthenticated();
  });

  it('rejects free plan type (only pro/enterprise allowed)', async () => {
    vi.mocked(safeParseBody).mockResolvedValue({
      success: true,
      data: { planType: 'free', billingPeriod: 'monthly' },
    } as never);

    const req = createRequest('POST', '/api/billing/checkout', {
      planType: 'free',
      billingPeriod: 'monthly',
    });
    const res = await checkoutPOST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Invalid request');
  });

  it('rejects malformed JSON body', async () => {
    vi.mocked(safeParseBody).mockResolvedValue({
      success: false,
      response: new (await import('next/server')).NextResponse(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400 }
      ),
    } as never);

    const req = createRequest('POST', '/api/billing/checkout');
    const res = await checkoutPOST(req);

    expect(res.status).toBe(400);
  });

  it('passes userId, planType, and billingPeriod to createCheckoutSession', async () => {
    vi.mocked(safeParseBody).mockResolvedValue({
      success: true,
      data: { planType: 'enterprise', billingPeriod: 'yearly' },
    } as never);
    vi.mocked(createCheckoutSession).mockResolvedValue({
      id: 'cs_test',
      url: 'https://checkout.stripe.com/test',
    } as never);

    const req = createRequest('POST', '/api/billing/checkout', {
      planType: 'enterprise',
      billingPeriod: 'yearly',
    });
    await checkoutPOST(req);

    expect(createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({
      userId: MOCK_USER_ID,
      planType: 'enterprise',
      billingPeriod: 'yearly',
    }));
  });
});

describe('Billing API - Subscription State', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimitOk();
    mockAuthenticated();
  });

  it('subscription GET returns stripeConfigured=true when Stripe is set up', async () => {
    vi.mocked(getStripeClient).mockReturnValue({} as never);
    vi.mocked(getSubscriptionByUserId).mockResolvedValue(null as never);
    vi.mocked(getUserPlanLimits).mockResolvedValue({ planType: 'free', maxCases: 100 } as never);
    vi.mocked(getAllPlanLimits).mockResolvedValue([] as never);

    const req = createRequest('GET', '/api/billing/subscription');
    const res = await subscriptionGET(req);
    const data = await res.json();

    expect(data.data.stripeConfigured).toBe(true);
  });

  it('subscription GET returns stripeConfigured=false when Stripe is not configured', async () => {
    vi.mocked(getStripeClient).mockReturnValue(null);
    vi.mocked(getSubscriptionByUserId).mockResolvedValue(null as never);
    vi.mocked(getUserPlanLimits).mockResolvedValue({ planType: 'free', maxCases: 100 } as never);
    vi.mocked(getAllPlanLimits).mockResolvedValue([] as never);

    const req = createRequest('GET', '/api/billing/subscription');
    const res = await subscriptionGET(req);
    const data = await res.json();

    expect(data.data.stripeConfigured).toBe(false);
  });

  it('subscription GET skips Stripe customer fetch when Stripe not configured', async () => {
    vi.mocked(getStripeClient).mockReturnValue(null);
    vi.mocked(getSubscriptionByUserId).mockResolvedValue(null as never);
    vi.mocked(getUserPlanLimits).mockResolvedValue({ planType: 'free', maxCases: 100 } as never);
    vi.mocked(getAllPlanLimits).mockResolvedValue([] as never);

    const req = createRequest('GET', '/api/billing/subscription');
    const res = await subscriptionGET(req);
    const data = await res.json();

    expect(getCustomerWithSubscription).not.toHaveBeenCalled();
    expect(data.data.customer).toBeNull();
  });

  it('cancel returns 404 when subscription has no stripe_subscription_id', async () => {
    vi.mocked(getUserSubscription).mockResolvedValue({
      stripe_subscription_id: null,
    } as never);

    const req = createRequest('POST', '/api/billing/cancel', {});
    const res = await cancelPOST(req);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('No active subscription found');
  });

  it('cancel with immediately=true passes to cancelSubscription', async () => {
    vi.mocked(getUserSubscription).mockResolvedValue({
      stripe_subscription_id: 'sub_test',
    } as never);
    vi.mocked(cancelSubscription).mockResolvedValue({
      status: 'canceled',
      cancel_at_period_end: false,
    } as never);

    const req = createRequest('POST', '/api/billing/cancel', { immediately: true });
    const res = await cancelPOST(req);

    expect(res.status).toBe(200);
    expect(cancelSubscription).toHaveBeenCalledWith('sub_test', true);
  });

  it('cancel with immediately=false (default) passes false to cancelSubscription', async () => {
    vi.mocked(getUserSubscription).mockResolvedValue({
      stripe_subscription_id: 'sub_test',
    } as never);
    vi.mocked(cancelSubscription).mockResolvedValue({
      status: 'active',
      cancel_at_period_end: true,
      current_period_end: Math.floor(Date.now() / 1000) + 86400,
    } as never);

    const req = createRequest('POST', '/api/billing/cancel', {});
    const res = await cancelPOST(req);

    expect(res.status).toBe(200);
    expect(cancelSubscription).toHaveBeenCalledWith('sub_test', false);
  });

  it('cancel response includes currentPeriodEnd when available', async () => {
    const futureTs = Math.floor(Date.now() / 1000) + 86400;
    vi.mocked(getUserSubscription).mockResolvedValue({
      stripe_subscription_id: 'sub_test',
    } as never);
    vi.mocked(cancelSubscription).mockResolvedValue({
      status: 'active',
      cancel_at_period_end: true,
      current_period_end: futureTs,
    } as never);

    const req = createRequest('POST', '/api/billing/cancel', {});
    const res = await cancelPOST(req);
    const data = await res.json();

    expect(data.data.currentPeriodEnd).toBeDefined();
    expect(new Date(data.data.currentPeriodEnd).getTime()).toBeGreaterThan(0);
  });

  it('resume returns 400 when subscription is not scheduled for cancellation', async () => {
    vi.mocked(getUserSubscription).mockResolvedValue({
      stripe_subscription_id: 'sub_test',
      cancel_at_period_end: false,
    } as never);

    const req = createRequest('POST', '/api/billing/resume');
    const res = await resumePOST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Subscription is not scheduled for cancellation');
  });

  it('resume returns 404 when subscription has no stripe_subscription_id', async () => {
    vi.mocked(getUserSubscription).mockResolvedValue({
      stripe_subscription_id: null,
    } as never);

    const req = createRequest('POST', '/api/billing/resume');
    const res = await resumePOST(req);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('No subscription found');
  });
});

describe('Billing API - Webhook Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminSingle.mockResolvedValue({ data: { id: 'claimed-1' }, error: null });
  });

  it('rejects requests without stripe-signature header', async () => {
    const req = createWebhookRequest('{}');
    const res = await webhookPOST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Missing stripe-signature header');
  });

  it('rejects requests with invalid signature', async () => {
    vi.mocked(constructWebhookEvent).mockRejectedValue(
      new Error('No signature found matching the expected signature verification')
    );

    const req = createWebhookRequest('{}', 'bad_sig');
    const res = await webhookPOST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Invalid signature');
  });

  it('rejects events older than 5 minutes (replay attack prevention)', async () => {
    const sixMinutesAgo = Math.floor(Date.now() / 1000) - 360;
    vi.mocked(constructWebhookEvent).mockResolvedValue({
      id: 'evt_stale',
      created: sixMinutesAgo,
      type: 'checkout.session.completed',
    } as never);

    const req = createWebhookRequest('{}', 'valid_sig');
    const res = await webhookPOST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Event too old');
  });

  it('accepts events within 5 minutes', async () => {
    const twoMinutesAgo = Math.floor(Date.now() / 1000) - 120;
    vi.mocked(constructWebhookEvent).mockResolvedValue({
      id: 'evt_recent',
      created: twoMinutesAgo,
      type: 'checkout.session.completed',
    } as never);
    vi.mocked(handleWebhookEvent).mockResolvedValue(undefined);

    const req = createWebhookRequest('{}', 'valid_sig');
    const res = await webhookPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.received).toBe(true);
  });

  it('skips duplicate events (idempotency via unique constraint)', async () => {
    const now = Math.floor(Date.now() / 1000);
    vi.mocked(constructWebhookEvent).mockResolvedValue({
      id: 'evt_dup',
      created: now,
      type: 'invoice.paid',
    } as never);

    mockAdminSingle.mockResolvedValueOnce({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    });

    const req = createWebhookRequest('{}', 'valid_sig');
    const res = await webhookPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.deduplicated).toBe(true);
    expect(handleWebhookEvent).not.toHaveBeenCalled();
  });

  it('processes event when claim insert has non-23505 error', async () => {
    const now = Math.floor(Date.now() / 1000);
    vi.mocked(constructWebhookEvent).mockResolvedValue({
      id: 'evt_claim_fail',
      created: now,
      type: 'invoice.paid',
    } as never);
    vi.mocked(handleWebhookEvent).mockResolvedValue(undefined);

    mockAdminSingle.mockResolvedValueOnce({
      data: null,
      error: { code: '42P01', message: 'relation does not exist' },
    });

    const req = createWebhookRequest('{}', 'valid_sig');
    const res = await webhookPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.received).toBe(true);
    expect(handleWebhookEvent).toHaveBeenCalled();
  });

  it('deletes dedup record when processing fails', async () => {
    const now = Math.floor(Date.now() / 1000);
    vi.mocked(constructWebhookEvent).mockResolvedValue({
      id: 'evt_fail',
      created: now,
      type: 'checkout.session.completed',
    } as never);

    mockAdminSingle.mockResolvedValueOnce({
      data: { id: 'claimed-id-123' },
      error: null,
    });

    vi.mocked(handleWebhookEvent).mockRejectedValue(
      new Error('Database write failed')
    );

    const req = createWebhookRequest('{}', 'valid_sig');
    const res = await webhookPOST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('Webhook handler failed');
    expect(mockAdminDeleteEq).toHaveBeenCalledWith('id', 'claimed-id-123');
  });

  it('does not attempt dedup cleanup when claim was not successful', async () => {
    const now = Math.floor(Date.now() / 1000);
    vi.mocked(constructWebhookEvent).mockResolvedValue({
      id: 'evt_no_claim',
      created: now,
      type: 'checkout.session.completed',
    } as never);

    mockAdminSingle.mockResolvedValueOnce({
      data: null,
      error: { code: 'UNEXPECTED', message: 'some error' },
    });

    vi.mocked(handleWebhookEvent).mockRejectedValue(
      new Error('Processing error')
    );

    const req = createWebhookRequest('{}', 'valid_sig');
    const res = await webhookPOST(req);

    expect(res.status).toBe(500);
    // Should NOT try to delete since there was no claimed record
    expect(mockAdminDeleteEq).not.toHaveBeenCalled();
  });
});

describe('Billing API - Quota Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticated();
    vi.mocked(standardRateLimiter.limit).mockResolvedValue({ allowed: true } as never);
  });

  it('accepts all valid metric types', async () => {
    const validMetrics = ['cases', 'documents', 'ai_requests', 'storage', 'team_members'];

    for (const metric of validMetrics) {
      vi.mocked(checkQuota).mockResolvedValue({
        allowed: true,
        current: 0,
        limit: 100,
        remaining: 100,
        isUnlimited: false,
      } as never);

      const req = createRequest('GET', `/api/billing/quota?metric=${metric}`);
      const res = await quotaGET(req);

      expect(res.status).toBe(200);
    }
  });

  it('rejects invalid metric parameter', async () => {
    const req = createRequest('GET', '/api/billing/quota?metric=invalid');
    const res = await quotaGET(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Invalid metric parameter');
  });

  it('rejects missing metric parameter', async () => {
    const req = createRequest('GET', '/api/billing/quota');
    const res = await quotaGET(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Invalid metric parameter');
  });

  it('returns over-quota status correctly', async () => {
    vi.mocked(checkQuota).mockResolvedValue({
      allowed: false,
      current: 100,
      limit: 100,
      remaining: 0,
      isUnlimited: false,
      message: 'You have reached your cases limit.',
    } as never);

    const req = createRequest('GET', '/api/billing/quota?metric=cases');
    const res = await quotaGET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.allowed).toBe(false);
    expect(data.data.remaining).toBe(0);
    expect(data.data.message).toContain('limit');
  });

  it('returns unlimited status for enterprise plans', async () => {
    vi.mocked(checkQuota).mockResolvedValue({
      allowed: true,
      current: 0,
      limit: -1,
      remaining: -1,
      isUnlimited: true,
    } as never);

    const req = createRequest('GET', '/api/billing/quota?metric=cases');
    const res = await quotaGET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.isUnlimited).toBe(true);
    expect(data.data.limit).toBe(-1);
  });

  it('returns 401 before rate limit check for unauthenticated requests', async () => {
    vi.mocked(serverAuth.getUser).mockResolvedValue(null as never);

    const req = createRequest('GET', '/api/billing/quota?metric=cases');
    const res = await quotaGET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    // standardRateLimiter should not even be called
    expect(standardRateLimiter.limit).not.toHaveBeenCalled();
  });
});

describe('Billing API - IDOR Protection', () => {
  const USER_1 = { id: MOCK_USER_ID, email: MOCK_EMAIL };
  const USER_2_ID = 'user-attacker-456';

  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimitOk();
    mockAuthenticated();
    vi.mocked(standardRateLimiter.limit).mockResolvedValue({ allowed: true } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('quota endpoint queries only the authenticated user\'s usage', async () => {
    vi.mocked(checkQuota).mockResolvedValue({
      allowed: true,
      current: 5,
      limit: 100,
      remaining: 95,
      isUnlimited: false,
    } as never);

    const req = createRequest('GET', `/api/billing/quota?metric=cases&userId=${USER_2_ID}`);
    const res = await quotaGET(req);

    expect(res.status).toBe(200);
    expect(checkQuota).toHaveBeenCalledWith(USER_1.id, 'cases');
    expect(checkQuota).not.toHaveBeenCalledWith(USER_2_ID, expect.anything());
  });

  it('subscription endpoint queries only the authenticated user\'s subscription', async () => {
    vi.mocked(getStripeClient).mockReturnValue({} as never);
    vi.mocked(getSubscriptionByUserId).mockResolvedValue(null as never);
    vi.mocked(getCustomerWithSubscription).mockResolvedValue(null as never);
    vi.mocked(getUserPlanLimits).mockResolvedValue({ planType: 'free', maxCases: 100 } as never);
    vi.mocked(getAllPlanLimits).mockResolvedValue([] as never);

    const req = createRequest('GET', `/api/billing/subscription?userId=${USER_2_ID}`);
    const res = await subscriptionGET(req);

    expect(res.status).toBe(200);
    expect(getSubscriptionByUserId).toHaveBeenCalledWith(USER_1.id);
    expect(getSubscriptionByUserId).not.toHaveBeenCalledWith(USER_2_ID);
    expect(getUserPlanLimits).toHaveBeenCalledWith(USER_1.id);
    expect(getUserPlanLimits).not.toHaveBeenCalledWith(USER_2_ID);
    expect(getCustomerWithSubscription).toHaveBeenCalledWith(USER_1.id);
    expect(getCustomerWithSubscription).not.toHaveBeenCalledWith(USER_2_ID);
  });

  it('checkout creates session for authenticated user only, ignoring userId in body', async () => {
    vi.mocked(safeParseBody).mockResolvedValue({
      success: true,
      data: { planType: 'pro', billingPeriod: 'monthly' },
    } as never);
    vi.mocked(createCheckoutSession).mockResolvedValue({
      id: 'cs_test',
      url: 'https://checkout.stripe.com/test',
    } as never);

    const req = createRequest('POST', '/api/billing/checkout', {
      planType: 'pro',
      billingPeriod: 'monthly',
      userId: USER_2_ID,
    });
    const res = await checkoutPOST(req);

    expect(res.status).toBe(200);
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_1.id })
    );
    expect(createCheckoutSession).not.toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_2_ID })
    );
  });

  it('cancel operates on authenticated user\'s subscription only', async () => {
    vi.mocked(getUserSubscription).mockResolvedValue({
      stripe_subscription_id: 'sub_user1',
    } as never);
    vi.mocked(cancelSubscription).mockResolvedValue({
      status: 'canceled',
      cancel_at_period_end: false,
    } as never);

    const req = createRequest('POST', '/api/billing/cancel', {
      immediately: true,
      userId: USER_2_ID,
    });
    const res = await cancelPOST(req);

    expect(res.status).toBe(200);
    expect(getUserSubscription).toHaveBeenCalledWith(USER_1.id);
    expect(getUserSubscription).not.toHaveBeenCalledWith(USER_2_ID);
  });

  it('resume operates on authenticated user\'s subscription only', async () => {
    vi.mocked(getUserSubscription).mockResolvedValue({
      stripe_subscription_id: 'sub_user1',
      cancel_at_period_end: true,
    } as never);
    vi.mocked(resumeSubscription).mockResolvedValue({
      status: 'active',
      cancel_at_period_end: false,
    } as never);

    const req = createRequest('POST', '/api/billing/resume', {
      userId: USER_2_ID,
    });
    const res = await resumePOST(req);

    expect(res.status).toBe(200);
    expect(getUserSubscription).toHaveBeenCalledWith(USER_1.id);
    expect(getUserSubscription).not.toHaveBeenCalledWith(USER_2_ID);
  });
});

describe('Billing API - Cross-cutting Auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimitOk();
  });

  const authProtectedRoutes = [
    { name: 'checkout', handler: checkoutPOST, method: 'POST', url: '/api/billing/checkout', body: { planType: 'pro', billingPeriod: 'monthly' } },
    { name: 'portal', handler: portalPOST, method: 'POST', url: '/api/billing/portal' },
    { name: 'cancel', handler: cancelPOST, method: 'POST', url: '/api/billing/cancel', body: {} },
    { name: 'resume', handler: resumePOST, method: 'POST', url: '/api/billing/resume' },
    { name: 'subscription', handler: subscriptionGET, method: 'GET', url: '/api/billing/subscription' },
  ];

  for (const route of authProtectedRoutes) {
    it(`${route.name}: returns 401 when unauthenticated`, async () => {
      vi.mocked(serverAuth.getUser).mockResolvedValue(null as never);

      const req = createRequest(route.method, route.url, route.body);
      const res = await route.handler(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  }
});
