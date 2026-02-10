/**
 * Integration tests for Billing API routes.
 *
 * Tests cover all 7 billing endpoints:
 * - POST /api/billing/checkout
 * - POST /api/billing/portal
 * - POST /api/billing/cancel
 * - POST /api/billing/resume
 * - GET  /api/billing/subscription
 * - GET  /api/billing/quota
 * - POST /api/billing/webhooks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const MOCK_USER_ID = 'user-123';
const MOCK_EMAIL = 'test@example.com';

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

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  }),
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
    headers: { 'x-forwarded-for': '127.0.0.1', ...headers },
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
  } as any);
}

function mockUnauthenticated() {
  vi.mocked(serverAuth.getUser).mockResolvedValue(null as any);
}

function mockRateLimitOk() {
  vi.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 10 } as any);
}

function mockRateLimited() {
  vi.mocked(rateLimit).mockResolvedValue({
    success: false,
    retryAfter: 60,
  } as any);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Billing API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // POST /api/billing/checkout
  // =========================================================================
  describe('POST /api/billing/checkout', () => {
    it('returns 429 when rate limited', async () => {
      mockRateLimited();

      const req = createRequest('POST', '/api/billing/checkout', {
        planType: 'pro',
        billingPeriod: 'monthly',
      });
      const res = await checkoutPOST(req);
      const data = await res.json();

      expect(res.status).toBe(429);
      expect(data.error).toBe('Too many requests. Please try again later.');
    });

    it('returns 401 when not authenticated', async () => {
      mockRateLimitOk();
      mockUnauthenticated();

      const req = createRequest('POST', '/api/billing/checkout', {
        planType: 'pro',
        billingPeriod: 'monthly',
      });
      const res = await checkoutPOST(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 400 for invalid Zod schema (wrong planType)', async () => {
      mockRateLimitOk();
      mockAuthenticated();

      const req = createRequest('POST', '/api/billing/checkout', {
        planType: 'invalid',
        billingPeriod: 'monthly',
      });
      const res = await checkoutPOST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Invalid request');
      expect(data.details).toBeDefined();
    });

    it('returns 400 for invalid Zod schema (wrong billingPeriod)', async () => {
      mockRateLimitOk();
      mockAuthenticated();

      const req = createRequest('POST', '/api/billing/checkout', {
        planType: 'pro',
        billingPeriod: 'biweekly',
      });
      const res = await checkoutPOST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Invalid request');
    });

    it('returns 200 with session ID and URL on success', async () => {
      mockRateLimitOk();
      mockAuthenticated();
      vi.mocked(createCheckoutSession).mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/test',
      } as any);

      const req = createRequest('POST', '/api/billing/checkout', {
        planType: 'pro',
        billingPeriod: 'monthly',
      });
      const res = await checkoutPOST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.sessionId).toBe('cs_test_123');
      expect(data.data.url).toBe('https://checkout.stripe.com/test');
    });

    it('returns 500 when createCheckoutSession throws', async () => {
      mockRateLimitOk();
      mockAuthenticated();
      vi.mocked(createCheckoutSession).mockRejectedValue(new Error('Stripe down'));

      const req = createRequest('POST', '/api/billing/checkout', {
        planType: 'pro',
        billingPeriod: 'monthly',
      });
      const res = await checkoutPOST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe('Failed to create checkout session');
    });
  });

  // =========================================================================
  // POST /api/billing/portal
  // =========================================================================
  describe('POST /api/billing/portal', () => {
    it('returns 401 when not authenticated', async () => {
      mockRateLimitOk();
      mockUnauthenticated();

      const req = createRequest('POST', '/api/billing/portal');
      const res = await portalPOST(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 200 with portal URL on success', async () => {
      mockRateLimitOk();
      mockAuthenticated();
      vi.mocked(createBillingPortalSession).mockResolvedValue({
        url: 'https://billing.stripe.com/session/test',
      } as any);

      const req = createRequest('POST', '/api/billing/portal');
      const res = await portalPOST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.url).toBe('https://billing.stripe.com/session/test');
    });

    it('returns 500 on Stripe error', async () => {
      mockRateLimitOk();
      mockAuthenticated();
      vi.mocked(createBillingPortalSession).mockRejectedValue(
        new Error('Stripe API error')
      );

      const req = createRequest('POST', '/api/billing/portal');
      const res = await portalPOST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe('Failed to create billing portal session');
    });
  });

  // =========================================================================
  // POST /api/billing/cancel
  // =========================================================================
  describe('POST /api/billing/cancel', () => {
    it('returns 401 when not authenticated', async () => {
      mockRateLimitOk();
      mockUnauthenticated();

      const req = createRequest('POST', '/api/billing/cancel', {});
      const res = await cancelPOST(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 400 on Zod validation error (invalid immediately field)', async () => {
      mockRateLimitOk();
      mockAuthenticated();

      // Test the Zod validation branch when the body is valid JSON
      // but fails schema validation.
      const req = createRequest('POST', '/api/billing/cancel', {
        immediately: 'not-a-boolean',
      });
      const res = await cancelPOST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Invalid request');
      expect(data.details).toBeDefined();
    });

    it('returns 404 when no active subscription found', async () => {
      mockRateLimitOk();
      mockAuthenticated();
      vi.mocked(getUserSubscription).mockResolvedValue(null as any);

      const req = createRequest('POST', '/api/billing/cancel', {});
      const res = await cancelPOST(req);
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toBe('No active subscription found');
    });

    it('returns 200 on success', async () => {
      mockRateLimitOk();
      mockAuthenticated();
      vi.mocked(getUserSubscription).mockResolvedValue({
        stripe_subscription_id: 'sub_test_123',
      } as any);
      vi.mocked(cancelSubscription).mockResolvedValue({
        status: 'active',
        cancel_at_period_end: true,
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
      } as any);

      const req = createRequest('POST', '/api/billing/cancel', {
        immediately: false,
      });
      const res = await cancelPOST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('active');
      expect(data.data.cancelAtPeriodEnd).toBe(true);
      expect(data.data.currentPeriodEnd).toBeDefined();
    });

    it('returns 500 on error', async () => {
      mockRateLimitOk();
      mockAuthenticated();
      vi.mocked(getUserSubscription).mockRejectedValue(new Error('DB error'));

      const req = createRequest('POST', '/api/billing/cancel', {});
      const res = await cancelPOST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe('Failed to cancel subscription');
    });
  });

  // =========================================================================
  // POST /api/billing/resume
  // =========================================================================
  describe('POST /api/billing/resume', () => {
    it('returns 401 when not authenticated', async () => {
      mockRateLimitOk();
      mockUnauthenticated();

      const req = createRequest('POST', '/api/billing/resume');
      const res = await resumePOST(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 404 when no subscription found', async () => {
      mockRateLimitOk();
      mockAuthenticated();
      vi.mocked(getUserSubscription).mockResolvedValue(null as any);

      const req = createRequest('POST', '/api/billing/resume');
      const res = await resumePOST(req);
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toBe('No subscription found');
    });

    it('returns 400 when subscription is not scheduled for cancellation', async () => {
      mockRateLimitOk();
      mockAuthenticated();
      vi.mocked(getUserSubscription).mockResolvedValue({
        stripe_subscription_id: 'sub_test_123',
        cancel_at_period_end: false,
      } as any);

      const req = createRequest('POST', '/api/billing/resume');
      const res = await resumePOST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Subscription is not scheduled for cancellation');
    });

    it('returns 200 on success', async () => {
      mockRateLimitOk();
      mockAuthenticated();
      vi.mocked(getUserSubscription).mockResolvedValue({
        stripe_subscription_id: 'sub_test_123',
        cancel_at_period_end: true,
      } as any);
      vi.mocked(resumeSubscription).mockResolvedValue({
        status: 'active',
        cancel_at_period_end: false,
      } as any);

      const req = createRequest('POST', '/api/billing/resume');
      const res = await resumePOST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('active');
      expect(data.data.cancelAtPeriodEnd).toBe(false);
    });

    it('returns 500 on error', async () => {
      mockRateLimitOk();
      mockAuthenticated();
      vi.mocked(getUserSubscription).mockRejectedValue(new Error('DB error'));

      const req = createRequest('POST', '/api/billing/resume');
      const res = await resumePOST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe('Failed to resume subscription');
    });
  });

  // =========================================================================
  // GET /api/billing/subscription
  // =========================================================================
  describe('GET /api/billing/subscription', () => {
    it('returns 401 when not authenticated', async () => {
      mockRateLimitOk();
      mockUnauthenticated();

      const req = createRequest('GET', '/api/billing/subscription');
      const res = await subscriptionGET(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 200 with subscription and plan limits', async () => {
      mockRateLimitOk();
      mockAuthenticated();
      vi.mocked(getStripeClient).mockReturnValue({} as any);

      const mockSub = {
        id: 'sub-1',
        planType: 'pro',
        status: 'active',
        billingPeriod: 'monthly',
        currentPeriodStart: '2024-01-01',
        currentPeriodEnd: '2024-02-01',
        cancelAtPeriodEnd: false,
        trialEnd: null,
      };
      const mockCustomer = {
        customerId: 'cus_test',
        email: MOCK_EMAIL,
        name: 'Test User',
      };
      const mockLimits = {
        planType: 'pro',
        maxCases: 50,
        maxDocumentsPerCase: 50,
        maxAiRequestsPerMonth: 500,
        maxStorageGb: 25,
        maxTeamMembers: 5,
        features: {
          documentAnalysis: true,
          formAutofill: true,
          prioritySupport: true,
          apiAccess: false,
        },
      };
      const mockAllPlans = [mockLimits];

      vi.mocked(getSubscriptionByUserId).mockResolvedValue(mockSub as any);
      vi.mocked(getCustomerWithSubscription).mockResolvedValue(mockCustomer as any);
      vi.mocked(getUserPlanLimits).mockResolvedValue(mockLimits as any);
      vi.mocked(getAllPlanLimits).mockResolvedValue(mockAllPlans as any);

      const req = createRequest('GET', '/api/billing/subscription');
      const res = await subscriptionGET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.subscription.planType).toBe('pro');
      expect(data.data.customer.customerId).toBe('cus_test');
      expect(data.data.limits).toBeDefined();
      expect(data.data.availablePlans).toHaveLength(1);
    });

    it('returns 200 with null subscription when none exists', async () => {
      mockRateLimitOk();
      mockAuthenticated();
      vi.mocked(getStripeClient).mockReturnValue(null);

      vi.mocked(getSubscriptionByUserId).mockResolvedValue(null as any);
      vi.mocked(getUserPlanLimits).mockResolvedValue({
        planType: 'free',
        maxCases: 3,
      } as any);
      vi.mocked(getAllPlanLimits).mockResolvedValue([] as any);

      const req = createRequest('GET', '/api/billing/subscription');
      const res = await subscriptionGET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.subscription).toBeNull();
      expect(data.data.customer).toBeNull();
    });

    it('returns 500 on error', async () => {
      mockRateLimitOk();
      mockAuthenticated();
      vi.mocked(getStripeClient).mockReturnValue(null);
      vi.mocked(getSubscriptionByUserId).mockRejectedValue(new Error('DB error'));

      const req = createRequest('GET', '/api/billing/subscription');
      const res = await subscriptionGET(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe('Failed to fetch subscription');
    });
  });

  // =========================================================================
  // GET /api/billing/quota
  // =========================================================================
  describe('GET /api/billing/quota', () => {
    it('returns 401 when not authenticated', async () => {
      mockUnauthenticated();

      const req = createRequest('GET', '/api/billing/quota?metric=cases');
      const res = await quotaGET(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 400 for invalid metric parameter', async () => {
      mockAuthenticated();
      vi.mocked(standardRateLimiter.limit).mockResolvedValue({ allowed: true } as any);

      const req = createRequest('GET', '/api/billing/quota?metric=invalid');
      const res = await quotaGET(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Invalid metric parameter');
    });

    it('returns 400 when metric parameter is missing', async () => {
      mockAuthenticated();
      vi.mocked(standardRateLimiter.limit).mockResolvedValue({ allowed: true } as any);

      const req = createRequest('GET', '/api/billing/quota');
      const res = await quotaGET(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Invalid metric parameter');
    });

    it('returns 200 with quota status', async () => {
      mockAuthenticated();
      vi.mocked(standardRateLimiter.limit).mockResolvedValue({ allowed: true } as any);

      const mockQuota = {
        allowed: true,
        current: 3,
        limit: 10,
        remaining: 7,
        isUnlimited: false,
      };
      vi.mocked(checkQuota).mockResolvedValue(mockQuota as any);

      const req = createRequest('GET', '/api/billing/quota?metric=cases');
      const res = await quotaGET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockQuota);
    });

    it('returns 500 on error', async () => {
      mockAuthenticated();
      vi.mocked(standardRateLimiter.limit).mockResolvedValue({ allowed: true } as any);
      vi.mocked(checkQuota).mockRejectedValue(new Error('DB error'));

      const req = createRequest('GET', '/api/billing/quota?metric=cases');
      const res = await quotaGET(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe('Failed to check quota');
    });
  });

  // =========================================================================
  // POST /api/billing/webhooks
  // =========================================================================
  describe('POST /api/billing/webhooks', () => {
    it('returns 400 when stripe-signature header is missing', async () => {
      const req = createWebhookRequest('{}');
      const res = await webhookPOST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Missing stripe-signature header');
    });

    it('returns 400 when signature is invalid', async () => {
      vi.mocked(constructWebhookEvent).mockRejectedValue(
        new Error('Invalid signature verification')
      );

      const req = createWebhookRequest('{}', 'invalid_sig');
      const res = await webhookPOST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Invalid signature');
    });

    it('returns 400 when event is stale (>5 minutes old)', async () => {
      const staleTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
      vi.mocked(constructWebhookEvent).mockResolvedValue({
        id: 'evt_1',
        created: staleTimestamp,
        type: 'checkout.session.completed',
      } as any);

      const req = createWebhookRequest('{}', 'valid_sig');
      const res = await webhookPOST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Event too old');
    });

    it('returns 200 with { received: true } on valid event', async () => {
      const recentTimestamp = Math.floor(Date.now() / 1000); // now
      vi.mocked(constructWebhookEvent).mockResolvedValue({
        id: 'evt_1',
        created: recentTimestamp,
        type: 'checkout.session.completed',
      } as any);
      vi.mocked(handleWebhookEvent).mockResolvedValue(undefined);

      const req = createWebhookRequest('{}', 'valid_sig');
      const res = await webhookPOST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.received).toBe(true);
    });

    it('returns 500 when handler fails', async () => {
      const recentTimestamp = Math.floor(Date.now() / 1000);
      vi.mocked(constructWebhookEvent).mockResolvedValue({
        id: 'evt_1',
        created: recentTimestamp,
        type: 'checkout.session.completed',
      } as any);
      vi.mocked(handleWebhookEvent).mockRejectedValue(
        new Error('Database write failed')
      );

      const req = createWebhookRequest('{}', 'valid_sig');
      const res = await webhookPOST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe('Webhook handler failed');
    });
  });
});
