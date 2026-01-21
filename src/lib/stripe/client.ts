import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    });
  }
  return stripeInstance;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return getStripe()[prop as keyof Stripe];
  },
});

export const STRIPE_CONFIG = {
  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
  prices: {
    proMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
    proYearly: process.env.STRIPE_PRICE_PRO_YEARLY || '',
    enterpriseMonthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || '',
    enterpriseYearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY || '',
  },
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
} as const;
