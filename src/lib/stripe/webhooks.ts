import { stripe, STRIPE_CONFIG } from './client';
import { syncSubscriptionFromStripe } from './subscriptions';
import { createClient } from '@/lib/supabase/server';
import { sendBillingUpdateEmail } from '@/lib/email/notifications';
import { createLogger } from '@/lib/logger';
import type Stripe from 'stripe';

const log = createLogger('stripe:webhooks');

/**
 * Idempotent email sending for webhook events.
 * Prevents duplicate emails when Stripe retries webhook delivery.
 *
 * Uses INSERT + UNIQUE constraint on idempotency_key for atomic duplicate
 * detection. This is safe against concurrent webhook retries because the
 * database enforces uniqueness at the row level -- only one INSERT can
 * succeed for a given key, and the loser gets a unique_violation (23505).
 */
async function sendIdempotentBillingEmail(
  eventId: string,
  userId: string,
  eventType: Parameters<typeof sendBillingUpdateEmail>[1],
  details: Parameters<typeof sendBillingUpdateEmail>[2]
): Promise<void> {
  const supabase = await createClient();
  const idempotencyKey = `stripe:${eventId}:${eventType}`;

  // Attempt to claim this event by inserting a sentinel row.
  // The UNIQUE constraint on idempotency_key ensures only one concurrent
  // request can succeed. If the insert fails with a duplicate key error,
  // another process already handled (or is handling) this event.
  const { error: insertError } = await supabase
    .from('email_log')
    .insert({
      user_id: userId,
      email_to: 'pending',
      email_from: 'system',
      subject: `idempotency:${eventType}`,
      template_name: 'billing_update',
      idempotency_key: idempotencyKey,
      status: 'pending' as const,
    });

  if (insertError) {
    // Postgres unique_violation code is 23505. Supabase surfaces this as
    // error.code === '23505'. Any other error is unexpected and should
    // be logged but should not cause the webhook to fail.
    if (insertError.code === '23505') {
      log.info('Skipping duplicate email', { eventId, eventType, userId });
      return;
    }
    log.logError('Failed to insert idempotency record', insertError);
    return;
  }

  // We won the race -- send the email.
  await sendBillingUpdateEmail(userId, eventType, details);
}

/**
 * Extended invoice interface for properties that may vary between Stripe API versions.
 * Uses Omit to remove and redefine properties with broader types.
 *
 * Note: In webhook events, `subscription` is typically a string ID. However, we
 * handle both string and object cases defensively to support:
 * - Future API version changes
 * - Explicit expand[] requests
 * - Test fixtures with expanded objects
 */
type ExtendedStripeInvoice = Omit<Stripe.Invoice, 'subscription' | 'payment_intent'> & {
  subscription?: string | Stripe.Subscription | null;
  payment_intent?: string | Stripe.PaymentIntent | null;
};

/**
 * Extended subscription interface for type-safe access to current_period_end.
 *
 * While Stripe.Subscription includes current_period_end, TypeScript's strict null
 * checking can cause issues when the property is accessed after a type cast.
 * This interface explicitly marks the property as optional to silence type errors
 * when accessing it on a cast object, while maintaining runtime safety through
 * the existing null checks in the code.
 */
interface ExtendedStripeSubscription extends Stripe.Subscription {
  current_period_end?: number;
}

/**
 * Looks up database subscription ID from Stripe subscription ID.
 * Returns null if not found or not provided.
 */
async function lookupDbSubscriptionId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  stripeSubscriptionId: string | null | undefined
): Promise<string | null> {
  if (!stripeSubscriptionId) return null;

  const { data } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .single();

  return data?.id ?? null;
}

export type WebhookEvent =
  | 'checkout.session.completed'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'customer.updated';

export async function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Promise<Stripe.Event> {
  if (!STRIPE_CONFIG.webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }

  return stripe.webhooks.constructEvent(
    payload,
    signature,
    STRIPE_CONFIG.webhookSecret
  );
}

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, event.id);
      break;

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionChange(event.data.object as Stripe.Subscription, event.id);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, event.id);
      break;

    case 'invoice.paid':
      await handleInvoicePaid(event.data.object as Stripe.Invoice, event.id);
      break;

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, event.id);
      break;

    case 'customer.updated':
      await handleCustomerUpdated(event.data.object as Stripe.Customer);
      break;

    default:
      log.info('Unhandled webhook event', { eventType: event.type });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, eventId: string): Promise<void> {
  if (session.mode !== 'subscription') return;

  const subscriptionId = session.subscription as string;
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription;
  await syncSubscriptionFromStripe(subscription, eventId);

  // Send welcome email for new subscription
  const supabase = await createClient();
  const customerId = typeof session.customer === 'string'
    ? session.customer
    : session.customer?.id;

  if (customerId) {
    const { data: customer } = await supabase
      .from('customers')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (customer?.user_id) {
      const planName = subscription.items.data[0]?.price?.nickname || 'Pro';
      const periodEnd = (subscription as ExtendedStripeSubscription).current_period_end;
      const nextBillingDate = periodEnd
        ? new Date(periodEnd * 1000).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : undefined;

      sendIdempotentBillingEmail(eventId, customer.user_id, 'subscription_created', {
        planName,
        amount: subscription.items.data[0]?.price?.unit_amount || undefined,
        currency: subscription.currency,
        nextBillingDate,
      }).catch((err: unknown) => {
        log.logError('Failed to send billing email', err);
      });
    }
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription, eventId: string): Promise<void> {
  const result = await syncSubscriptionFromStripe(subscription, eventId);
  if (result.skipped) {
    log.info('Skipped subscription sync', { reason: result.reason, subscriptionId: subscription.id });
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, eventId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    log.logError('Failed to update canceled subscription', error);
    throw error;
  }

  // Send cancellation email
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id;

  if (customerId) {
    const { data: customer } = await supabase
      .from('customers')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (customer?.user_id) {
      const periodEnd = (subscription as ExtendedStripeSubscription).current_period_end;
      const accessUntil = periodEnd
        ? new Date(periodEnd * 1000).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : undefined;

      sendIdempotentBillingEmail(eventId, customer.user_id, 'subscription_cancelled', {
        nextBillingDate: accessUntil,
      }).catch((err: unknown) => {
        log.logError('Failed to send cancellation email', err);
      });
    }
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice, eventId: string): Promise<void> {
  const supabase = await createClient();

  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id;

  if (!customerId) return;

  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!customer) return;

  const inv = invoice as ExtendedStripeInvoice;

  const stripeSubId = typeof inv.subscription === 'string'
    ? inv.subscription
    : (inv.subscription as Stripe.Subscription | null)?.id;
  const dbSubscriptionId = await lookupDbSubscriptionId(supabase, stripeSubId);

  await supabase.from('invoices').upsert({
    customer_id: customer.id,
    subscription_id: dbSubscriptionId,
    stripe_invoice_id: invoice.id,
    stripe_invoice_url: invoice.hosted_invoice_url,
    stripe_invoice_pdf: invoice.invoice_pdf,
    amount_due_cents: invoice.amount_due,
    amount_paid_cents: invoice.amount_paid,
    currency: invoice.currency,
    status: invoice.status || 'paid',
    due_date: inv.due_date ? new Date(inv.due_date * 1000).toISOString() : null,
    paid_at: new Date().toISOString(),
    period_start: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
    period_end: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
    metadata: invoice.metadata || {},
  }, {
    onConflict: 'stripe_invoice_id',
  });

  const paymentIntentId = typeof inv.payment_intent === 'string'
    ? inv.payment_intent
    : inv.payment_intent?.id;

  if (paymentIntentId) {
    await supabase.from('payments').upsert({
      customer_id: customer.id,
      subscription_id: dbSubscriptionId,
      stripe_payment_intent_id: paymentIntentId,
      stripe_invoice_id: invoice.id,
      amount_cents: invoice.amount_paid,
      currency: invoice.currency,
      status: 'succeeded',
      receipt_url: invoice.hosted_invoice_url,
      metadata: {},
    }, {
      onConflict: 'stripe_payment_intent_id',
    });
  }

  // Send payment success email
  const { data: customerData } = await supabase
    .from('customers')
    .select('user_id')
    .eq('id', customer.id)
    .single();

  if (customerData?.user_id) {
    const nextBillingDate = inv.period_end
      ? new Date(inv.period_end * 1000).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : undefined;

    sendIdempotentBillingEmail(eventId, customerData.user_id, 'payment_succeeded', {
      amount: invoice.amount_paid,
      currency: invoice.currency,
      nextBillingDate,
    }).catch((err: unknown) => {
      log.logError('Failed to send payment success email', err);
    });
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice, eventId: string): Promise<void> {
  const supabase = await createClient();

  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id;

  if (!customerId) return;

  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!customer) return;

  const inv = invoice as ExtendedStripeInvoice;

  const stripeSubId = typeof inv.subscription === 'string'
    ? inv.subscription
    : (inv.subscription as Stripe.Subscription | null)?.id;
  const dbSubscriptionId = await lookupDbSubscriptionId(supabase, stripeSubId);

  await supabase.from('invoices').upsert({
    customer_id: customer.id,
    subscription_id: dbSubscriptionId,
    stripe_invoice_id: invoice.id,
    stripe_invoice_url: invoice.hosted_invoice_url,
    amount_due_cents: invoice.amount_due,
    amount_paid_cents: 0,
    currency: invoice.currency,
    status: 'payment_failed',
    due_date: inv.due_date ? new Date(inv.due_date * 1000).toISOString() : null,
    period_start: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
    period_end: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
    metadata: invoice.metadata || {},
  }, {
    onConflict: 'stripe_invoice_id',
  });

  const paymentIntentId = typeof inv.payment_intent === 'string'
    ? inv.payment_intent
    : inv.payment_intent?.id;

  if (paymentIntentId) {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    await supabase.from('payments').upsert({
      customer_id: customer.id,
      stripe_payment_intent_id: paymentIntentId,
      stripe_invoice_id: invoice.id,
      amount_cents: invoice.amount_due,
      currency: invoice.currency,
      status: 'failed',
      failure_message: paymentIntent.last_payment_error?.message || 'Payment failed',
      metadata: {},
    }, {
      onConflict: 'stripe_payment_intent_id',
    });
  }

  // Send payment failed email
  const { data: customerData } = await supabase
    .from('customers')
    .select('user_id')
    .eq('id', customer.id)
    .single();

  if (customerData?.user_id) {
    sendIdempotentBillingEmail(eventId, customerData.user_id, 'payment_failed', {
      amount: invoice.amount_due,
      currency: invoice.currency,
    }).catch((err: unknown) => {
      log.logError('Failed to send payment failed email', err);
    });
  }
}

async function handleCustomerUpdated(customer: Stripe.Customer): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from('customers')
    .update({
      email: customer.email || undefined,
      name: customer.name || undefined,
    })
    .eq('stripe_customer_id', customer.id);
}
