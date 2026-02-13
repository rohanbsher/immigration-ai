import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent, handleWebhookEvent } from '@/lib/stripe';
import { getAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:billing-webhooks');

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    const event = await constructWebhookEvent(body, signature);

    // Reject replay attacks - events older than 5 minutes
    const eventAge = Date.now() - event.created * 1000;
    const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000; // 5 minutes
    if (eventAge > MAX_WEBHOOK_AGE_MS) {
      log.warn('Rejected stale webhook event', { eventId: event.id, ageMs: eventAge });
      return NextResponse.json({ error: 'Event too old' }, { status: 400 });
    }

    // Idempotency: check if this event was already processed.
    // Admin client required — RLS on stripe_processed_events restricts to service_role.
    const supabase = getAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from('stripe_processed_events') as any)
      .select('id')
      .eq('event_id', event.id)
      .maybeSingle();

    if (existing) {
      log.info('Skipping duplicate webhook event', { eventId: event.id });
      return NextResponse.json({ received: true, deduplicated: true });
    }

    // Process the event BEFORE marking it as handled.
    // If processing fails, the event is NOT marked — Stripe will retry.
    await handleWebhookEvent(event);

    // Mark as processed only after successful handling.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase.from('stripe_processed_events') as any)
      .insert({ event_id: event.id, event_type: event.type });

    if (insertError) {
      // Non-critical: event was processed but dedup record failed.
      // Worst case: event gets reprocessed on retry (idempotent handlers).
      log.warn('Failed to record processed webhook event', { eventId: event.id, error: insertError.message });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    log.logError('Webhook error', error);

    if (error instanceof Error && error.message.includes('signature')) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
