import { stripe } from './client';
import { createClient } from '@/lib/supabase/server';
import type Stripe from 'stripe';
import { withRetry, STRIPE_RETRY_OPTIONS } from '@/lib/utils/retry';

export interface CreateCustomerParams {
  userId: string;
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface CustomerWithSubscription {
  customerId: string;
  stripeCustomerId: string | null;
  email: string;
  name: string | null;
  subscription: {
    id: string;
    planType: string;
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
}

export async function createStripeCustomer(params: CreateCustomerParams): Promise<Stripe.Customer> {
  const { userId, email, name, metadata = {} } = params;

  const customer = await withRetry(
    () => stripe.customers.create({
      email,
      name: name || undefined,
      metadata: {
        supabase_user_id: userId,
        ...metadata,
      },
    }),
    STRIPE_RETRY_OPTIONS
  );

  return customer;
}

export async function getOrCreateStripeCustomer(userId: string): Promise<string> {
  const supabase = await createClient();

  const { data: customer, error: fetchError } = await supabase
    .from('customers')
    .select('stripe_customer_id, email, name')
    .eq('user_id', userId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw new Error(`Failed to fetch customer: ${fetchError.message}`);
  }

  if (customer?.stripe_customer_id) {
    return customer.stripe_customer_id;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('email, first_name, last_name')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    throw new Error('User profile not found');
  }

  const stripeCustomer = await createStripeCustomer({
    userId,
    email: profile.email,
    name: profile.first_name && profile.last_name
      ? `${profile.first_name} ${profile.last_name}`
      : undefined,
  });

  if (customer) {
    await supabase
      .from('customers')
      .update({ stripe_customer_id: stripeCustomer.id })
      .eq('user_id', userId);
  } else {
    await supabase.from('customers').insert({
      user_id: userId,
      stripe_customer_id: stripeCustomer.id,
      email: profile.email,
      name: profile.first_name && profile.last_name
        ? `${profile.first_name} ${profile.last_name}`
        : null,
    });
  }

  return stripeCustomer.id;
}

export async function getCustomerWithSubscription(userId: string): Promise<CustomerWithSubscription | null> {
  const supabase = await createClient();

  const { data: customer, error } = await supabase
    .from('customers')
    .select(`
      id,
      stripe_customer_id,
      email,
      name,
      subscriptions (
        id,
        plan_type,
        status,
        current_period_end,
        cancel_at_period_end
      )
    `)
    .eq('user_id', userId)
    .single();

  if (error || !customer) {
    return null;
  }

  const activeSubscription = Array.isArray(customer.subscriptions)
    ? customer.subscriptions.find((s: { status: string }) =>
        ['trialing', 'active', 'past_due'].includes(s.status)
      )
    : null;

  return {
    customerId: customer.id,
    stripeCustomerId: customer.stripe_customer_id,
    email: customer.email,
    name: customer.name,
    subscription: activeSubscription
      ? {
          id: activeSubscription.id,
          planType: activeSubscription.plan_type,
          status: activeSubscription.status,
          currentPeriodEnd: activeSubscription.current_period_end,
          cancelAtPeriodEnd: activeSubscription.cancel_at_period_end,
        }
      : null,
  };
}

export async function updateStripeCustomer(
  stripeCustomerId: string,
  updates: Stripe.CustomerUpdateParams
): Promise<Stripe.Customer> {
  return withRetry(
    () => stripe.customers.update(stripeCustomerId, updates),
    STRIPE_RETRY_OPTIONS
  );
}

export async function deleteStripeCustomer(stripeCustomerId: string): Promise<Stripe.DeletedCustomer> {
  return withRetry(
    () => stripe.customers.del(stripeCustomerId),
    STRIPE_RETRY_OPTIONS
  );
}
