import { stripe, STRIPE_CONFIG } from './client';
import { getOrCreateStripeCustomer } from './customers';
import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';
import type Stripe from 'stripe';

const log = createLogger('stripe:subscriptions');

export type PlanType = 'free' | 'pro' | 'enterprise';
export type BillingPeriod = 'monthly' | 'yearly';

export interface CreateCheckoutParams {
  userId: string;
  planType: PlanType;
  billingPeriod: BillingPeriod;
  successUrl: string;
  cancelUrl: string;
}

export interface CreatePortalParams {
  userId: string;
  returnUrl: string;
}

export function getPriceId(planType: PlanType, billingPeriod: BillingPeriod): string {
  if (planType === 'free') {
    throw new Error('Free plan does not have a price ID');
  }

  const priceKey = `${planType}${billingPeriod.charAt(0).toUpperCase()}${billingPeriod.slice(1)}` as keyof typeof STRIPE_CONFIG.prices;
  const priceId = STRIPE_CONFIG.prices[priceKey];

  if (!priceId) {
    throw new Error(`Price ID not configured for ${planType} ${billingPeriod}`);
  }

  return priceId;
}

export async function createCheckoutSession(params: CreateCheckoutParams): Promise<Stripe.Checkout.Session> {
  const { userId, planType, billingPeriod, successUrl, cancelUrl } = params;

  const stripeCustomerId = await getOrCreateStripeCustomer(userId);
  const priceId = getPriceId(planType, billingPeriod);

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: {
        supabase_user_id: userId,
        plan_type: planType,
        billing_period: billingPeriod,
      },
    },
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    customer_update: {
      address: 'auto',
      name: 'auto',
    },
  });

  return session;
}

export async function createBillingPortalSession(params: CreatePortalParams): Promise<Stripe.BillingPortal.Session> {
  const { userId, returnUrl } = params;

  const stripeCustomerId = await getOrCreateStripeCustomer(userId);

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });

  return session;
}

export async function cancelSubscription(subscriptionId: string, cancelImmediately = false): Promise<Stripe.Subscription> {
  if (cancelImmediately) {
    return stripe.subscriptions.cancel(subscriptionId);
  }

  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

export async function resumeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  return stripe.subscriptions.retrieve(subscriptionId);
}

export async function getUserSubscription(userId: string) {
  const supabase = await createClient();

  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .select(`
      *,
      customers!inner (
        user_id
      )
    `)
    .eq('customers.user_id', userId)
    .in('status', ['trialing', 'active', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch subscription: ${error.message}`);
  }

  return subscription;
}

export interface SyncResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
}

export async function syncSubscriptionFromStripe(
  stripeSubscription: Stripe.Subscription,
  eventId?: string
): Promise<SyncResult> {
  const supabase = await createClient();

  const customerId = typeof stripeSubscription.customer === 'string'
    ? stripeSubscription.customer
    : stripeSubscription.customer.id;

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (customerError || !customer) {
    throw new Error(`Customer not found for Stripe customer: ${customerId}`);
  }

  // Idempotency check: Skip if we've already processed this event
  if (eventId) {
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id, updated_at, stripe_event_id')
      .eq('stripe_subscription_id', stripeSubscription.id)
      .single();

    // Skip if we've already processed this exact event
    if (existing?.stripe_event_id === eventId) {
      log.info('Skipping duplicate webhook event', { eventId, subscriptionId: stripeSubscription.id });
      return { success: true, skipped: true, reason: 'duplicate_event' };
    }
  }

  const priceId = stripeSubscription.items.data[0]?.price?.id;
  const planType = getPlanTypeFromPriceId(priceId);
  const billingPeriod = getBillingPeriodFromPriceId(priceId);

  // Cast subscription to access properties that may vary between API versions
  const sub = stripeSubscription as unknown as {
    current_period_start?: number;
    current_period_end?: number;
    canceled_at?: number | null;
    trial_start?: number | null;
    trial_end?: number | null;
    cancel_at_period_end: boolean;
    status: string;
    id: string;
    metadata: Record<string, string>;
  };

  const subscriptionData = {
    customer_id: customer.id,
    stripe_subscription_id: stripeSubscription.id,
    stripe_price_id: priceId,
    plan_type: planType,
    status: stripeSubscription.status as string,
    billing_period: billingPeriod,
    current_period_start: sub.current_period_start
      ? new Date(sub.current_period_start * 1000).toISOString()
      : new Date().toISOString(),
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : new Date().toISOString(),
    cancel_at_period_end: stripeSubscription.cancel_at_period_end,
    canceled_at: sub.canceled_at
      ? new Date(sub.canceled_at * 1000).toISOString()
      : null,
    trial_start: sub.trial_start
      ? new Date(sub.trial_start * 1000).toISOString()
      : null,
    trial_end: sub.trial_end
      ? new Date(sub.trial_end * 1000).toISOString()
      : null,
    metadata: stripeSubscription.metadata || {},
    // Track which event last updated this subscription
    ...(eventId ? { stripe_event_id: eventId } : {}),
  };

  const { error: upsertError } = await supabase
    .from('subscriptions')
    .upsert(subscriptionData, {
      onConflict: 'stripe_subscription_id',
    });

  if (upsertError) {
    throw new Error(`Failed to sync subscription: ${upsertError.message}`);
  }

  return { success: true };
}

function getPlanTypeFromPriceId(priceId: string | undefined): PlanType {
  if (!priceId) return 'free';

  if (priceId === STRIPE_CONFIG.prices.proMonthly || priceId === STRIPE_CONFIG.prices.proYearly) {
    return 'pro';
  }

  if (priceId === STRIPE_CONFIG.prices.enterpriseMonthly || priceId === STRIPE_CONFIG.prices.enterpriseYearly) {
    return 'enterprise';
  }

  return 'free';
}

function getBillingPeriodFromPriceId(priceId: string | undefined): BillingPeriod | null {
  if (!priceId) return null;

  if (priceId === STRIPE_CONFIG.prices.proMonthly || priceId === STRIPE_CONFIG.prices.enterpriseMonthly) {
    return 'monthly';
  }

  if (priceId === STRIPE_CONFIG.prices.proYearly || priceId === STRIPE_CONFIG.prices.enterpriseYearly) {
    return 'yearly';
  }

  return null;
}
