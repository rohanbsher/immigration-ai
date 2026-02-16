import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock the client module before importing getPriceId
vi.mock('./client', () => ({
  stripe: {},
  STRIPE_CONFIG: {
    prices: {
      proMonthly: 'price_pro_monthly_123',
      proYearly: 'price_pro_yearly_456',
      enterpriseMonthly: 'price_enterprise_monthly_789',
      enterpriseYearly: 'price_enterprise_yearly_abc',
    },
  },
}));

// Also mock dependencies that subscriptions.ts imports
vi.mock('./customers', () => ({
  getOrCreateStripeCustomer: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    logError: vi.fn(),
  }),
}));

vi.mock('@/lib/utils/retry', () => ({
  withRetry: vi.fn((fn: () => unknown) => fn()),
  STRIPE_RETRY_OPTIONS: {},
}));

import { getPriceId } from './subscriptions';
import { STRIPE_CONFIG } from './client';

describe('getPriceId', () => {
  // Save original prices and restore after each test to prevent
  // cross-test contamination even if a test throws mid-execution.
  const originalPrices = { ...STRIPE_CONFIG.prices };

  afterEach(() => {
    Object.assign(STRIPE_CONFIG.prices, originalPrices);
  });

  it('should return price ID for valid pro monthly', () => {
    expect(getPriceId('pro', 'monthly')).toBe('price_pro_monthly_123');
  });

  it('should return price ID for valid pro yearly', () => {
    expect(getPriceId('pro', 'yearly')).toBe('price_pro_yearly_456');
  });

  it('should return price ID for valid enterprise monthly', () => {
    expect(getPriceId('enterprise', 'monthly')).toBe('price_enterprise_monthly_789');
  });

  it('should return price ID for valid enterprise yearly', () => {
    expect(getPriceId('enterprise', 'yearly')).toBe('price_enterprise_yearly_abc');
  });

  it('should throw for free plan', () => {
    expect(() => getPriceId('free', 'monthly')).toThrow('Free plan does not have a price ID');
  });

  it('should throw for invalid Stripe price ID format', () => {
    (STRIPE_CONFIG.prices as Record<string, string>).proMonthly = 'invalid_not_a_price';

    expect(() => getPriceId('pro', 'monthly')).toThrow('Invalid Stripe price ID format');
  });

  it('should throw for empty/unconfigured price ID', () => {
    (STRIPE_CONFIG.prices as Record<string, string>).proMonthly = '';

    expect(() => getPriceId('pro', 'monthly')).toThrow('Price ID not configured');
  });
});
