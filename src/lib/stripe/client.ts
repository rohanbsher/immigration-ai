/**
 * Stripe client for billing functionality.
 *
 * Uses lazy initialization to avoid errors during build/client import.
 * All server-only values are accessed through getters, not at module load.
 */

import Stripe from 'stripe';
import { serverEnv, env, features } from '@/lib/config';

let stripeInstance: Stripe | null = null;

/**
 * Get the Stripe client instance.
 * Returns null if billing is not configured.
 */
export function getStripeClient(): Stripe | null {
  if (!features.billing) {
    return null;
  }

  if (!stripeInstance) {
    stripeInstance = new Stripe(serverEnv.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    });
  }
  return stripeInstance;
}

/**
 * Stripe client proxy.
 * Throws an error if billing is not configured and you try to use it.
 */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const client = getStripeClient();
    if (!client) {
      throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.');
    }
    return client[prop as keyof Stripe];
  },
});

/**
 * Stripe configuration - uses getters to avoid server env access at module load.
 * This allows the module to be safely imported in any context.
 */
export const STRIPE_CONFIG = {
  /** Client-safe publishable key */
  get publishableKey() {
    return env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
  },
  /** Price IDs for subscription plans (server-only) */
  get prices() {
    return {
      proMonthly: serverEnv.STRIPE_PRICE_PRO_MONTHLY || '',
      proYearly: serverEnv.STRIPE_PRICE_PRO_YEARLY || '',
      enterpriseMonthly: serverEnv.STRIPE_PRICE_ENTERPRISE_MONTHLY || '',
      enterpriseYearly: serverEnv.STRIPE_PRICE_ENTERPRISE_YEARLY || '',
    };
  },
  /** Webhook secret for signature verification (server-only) */
  get webhookSecret() {
    return serverEnv.STRIPE_WEBHOOK_SECRET || '';
  },
} as const;
