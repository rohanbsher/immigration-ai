import { stripe, STRIPE_CONFIG } from './client';
import { syncSubscriptionFromStripe } from './subscriptions';
import { createClient } from '@/lib/supabase/server';
import { sendBillingUpdateEmail } from '@/lib/email/notifications';
import type Stripe from 'stripe';

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
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionChange(event.data.object as Stripe.Subscription);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    case 'invoice.paid':
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
      break;

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;

    case 'customer.updated':
      await handleCustomerUpdated(event.data.object as Stripe.Customer);
      break;

    default:
      console.log(`Unhandled webhook event type: ${event.type}`);
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.mode !== 'subscription') return;

  const subscriptionId = session.subscription as string;
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription;
  await syncSubscriptionFromStripe(subscription);

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
      const periodEnd = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end;
      const nextBillingDate = periodEnd
        ? new Date(periodEnd * 1000).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : undefined;

      sendBillingUpdateEmail(customer.user_id, 'subscription_created', {
        planName,
        amount: subscription.items.data[0]?.price?.unit_amount || undefined,
        currency: subscription.currency,
        nextBillingDate,
      }).catch((err) => {
        console.error('Failed to send billing email:', err);
      });
    }
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
  await syncSubscriptionFromStripe(subscription);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('Failed to update canceled subscription:', error);
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
      const periodEnd = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end;
      const accessUntil = periodEnd
        ? new Date(periodEnd * 1000).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : undefined;

      sendBillingUpdateEmail(customer.user_id, 'subscription_cancelled', {
        nextBillingDate: accessUntil,
      }).catch((err) => {
        console.error('Failed to send cancellation email:', err);
      });
    }
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
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

  // Cast invoice to access properties that may vary between API versions
  const inv = invoice as unknown as {
    subscription?: string | { id: string } | null;
    period_start?: number;
    period_end?: number;
    due_date?: number;
    payment_intent?: string | { id: string } | null;
  };

  const subscriptionId = typeof inv.subscription === 'string'
    ? inv.subscription
    : inv.subscription?.id;

  let dbSubscriptionId = null;
  if (subscriptionId) {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('stripe_subscription_id', subscriptionId)
      .single();
    dbSubscriptionId = subscription?.id;
  }

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

    sendBillingUpdateEmail(customerData.user_id, 'payment_succeeded', {
      amount: invoice.amount_paid,
      currency: invoice.currency,
      nextBillingDate,
    }).catch((err) => {
      console.error('Failed to send payment success email:', err);
    });
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
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

  // Cast invoice to access properties that may vary between API versions
  const inv = invoice as unknown as {
    due_date?: number;
    period_start?: number;
    period_end?: number;
    payment_intent?: string | { id: string } | null;
  };

  await supabase.from('invoices').upsert({
    customer_id: customer.id,
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
    sendBillingUpdateEmail(customerData.user_id, 'payment_failed', {
      amount: invoice.amount_due,
      currency: invoice.currency,
    }).catch((err) => {
      console.error('Failed to send payment failed email:', err);
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
