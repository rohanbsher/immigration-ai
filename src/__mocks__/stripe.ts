import { vi } from 'vitest';

// Mock Stripe customer
export const mockCustomer = {
  id: 'cus_mock_customer_id',
  object: 'customer',
  email: 'test@example.com',
  name: 'Test User',
  metadata: {
    userId: 'test-user-id',
    firmId: 'test-firm-id',
  },
  created: Math.floor(Date.now() / 1000),
};

// Mock Stripe subscription
export const mockSubscription = {
  id: 'sub_mock_subscription_id',
  object: 'subscription',
  customer: 'cus_mock_customer_id',
  status: 'active',
  items: {
    data: [
      {
        id: 'si_mock_item_id',
        price: {
          id: 'price_mock_price_id',
          product: 'prod_mock_product_id',
          unit_amount: 9900,
          currency: 'usd',
          recurring: {
            interval: 'month',
            interval_count: 1,
          },
        },
        quantity: 1,
      },
    ],
  },
  current_period_start: Math.floor(Date.now() / 1000),
  current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  metadata: {},
};

// Mock Stripe invoice
export const mockInvoice = {
  id: 'in_mock_invoice_id',
  object: 'invoice',
  customer: 'cus_mock_customer_id',
  subscription: 'sub_mock_subscription_id',
  status: 'paid',
  amount_due: 9900,
  amount_paid: 9900,
  currency: 'usd',
  created: Math.floor(Date.now() / 1000),
};

// Mock Stripe payment intent
export const mockPaymentIntent = {
  id: 'pi_mock_payment_intent_id',
  object: 'payment_intent',
  amount: 9900,
  currency: 'usd',
  status: 'succeeded',
  client_secret: 'pi_mock_secret_mock',
};

// Mock Stripe checkout session
export const mockCheckoutSession = {
  id: 'cs_mock_session_id',
  object: 'checkout.session',
  url: 'https://checkout.stripe.com/mock',
  customer: 'cus_mock_customer_id',
  mode: 'subscription',
  payment_status: 'unpaid',
  status: 'open',
};

// Mock Stripe portal session
export const mockPortalSession = {
  id: 'bps_mock_portal_id',
  object: 'billing_portal.session',
  url: 'https://billing.stripe.com/mock',
  customer: 'cus_mock_customer_id',
};

// Mock Stripe client
export const mockStripeClient = {
  customers: {
    create: vi.fn().mockResolvedValue(mockCustomer),
    retrieve: vi.fn().mockResolvedValue(mockCustomer),
    update: vi.fn().mockResolvedValue(mockCustomer),
    del: vi.fn().mockResolvedValue({ id: mockCustomer.id, deleted: true }),
    list: vi.fn().mockResolvedValue({ data: [mockCustomer] }),
  },
  subscriptions: {
    create: vi.fn().mockResolvedValue(mockSubscription),
    retrieve: vi.fn().mockResolvedValue(mockSubscription),
    update: vi.fn().mockResolvedValue(mockSubscription),
    cancel: vi.fn().mockResolvedValue({ ...mockSubscription, status: 'canceled' }),
    list: vi.fn().mockResolvedValue({ data: [mockSubscription] }),
  },
  invoices: {
    create: vi.fn().mockResolvedValue(mockInvoice),
    retrieve: vi.fn().mockResolvedValue(mockInvoice),
    list: vi.fn().mockResolvedValue({ data: [mockInvoice] }),
    pay: vi.fn().mockResolvedValue({ ...mockInvoice, status: 'paid' }),
  },
  paymentIntents: {
    create: vi.fn().mockResolvedValue(mockPaymentIntent),
    retrieve: vi.fn().mockResolvedValue(mockPaymentIntent),
    confirm: vi.fn().mockResolvedValue({ ...mockPaymentIntent, status: 'succeeded' }),
  },
  checkout: {
    sessions: {
      create: vi.fn().mockResolvedValue(mockCheckoutSession),
      retrieve: vi.fn().mockResolvedValue(mockCheckoutSession),
    },
  },
  billingPortal: {
    sessions: {
      create: vi.fn().mockResolvedValue(mockPortalSession),
    },
  },
  webhooks: {
    constructEvent: vi.fn().mockImplementation((payload, signature, secret) => {
      return JSON.parse(payload);
    }),
  },
};

// Factory to create mock Stripe instance
export const createMockStripe = () => mockStripeClient;

// Helper to simulate subscription status
export const setSubscriptionStatus = (status: string) => {
  mockStripeClient.subscriptions.retrieve.mockResolvedValueOnce({
    ...mockSubscription,
    status,
  });
};

// Helper to simulate webhook event
export const createWebhookEvent = (type: string, data: unknown) => ({
  id: 'evt_mock_event_id',
  type,
  data: { object: data },
  created: Math.floor(Date.now() / 1000),
});

// Helper to simulate Stripe error
export const simulateStripeError = (code: string, message: string) => {
  const error = new Error(message);
  (error as unknown as Record<string, string>).code = code;
  (error as unknown as Record<string, string>).type = 'StripeCardError';
  return error;
};

// Reset all mocks
export const resetMocks = () => {
  vi.clearAllMocks();
};

export default {
  mockCustomer,
  mockSubscription,
  mockInvoice,
  mockPaymentIntent,
  mockCheckoutSession,
  mockPortalSession,
  mockStripeClient,
  createMockStripe,
  setSubscriptionStatus,
  createWebhookEvent,
  simulateStripeError,
  resetMocks,
};
