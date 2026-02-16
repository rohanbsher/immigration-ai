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

    // Idempotency: claim the event BEFORE processing using INSERT ON CONFLICT.
    // This prevents race conditions where two concurrent webhook deliveries
    // both pass a SELECT check and both process the same event.
    // Admin client required — RLS on stripe_processed_events restricts to service_role.
    const supabase = getAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: claimed, error: claimError } = await (supabase.from('stripe_processed_events') as any)
      .insert({ event_id: event.id, event_type: event.type })
      .select('id')
      .single();

    if (claimError) {
      // Unique constraint violation (code 23505) means another request already claimed it
      if (claimError.code === '23505') {
        log.info('Skipping duplicate webhook event', { eventId: event.id });
        return NextResponse.json({ received: true, deduplicated: true });
      }
      // Other insert errors are non-critical — process anyway to avoid missing events
      log.warn('Failed to claim webhook event for dedup', { eventId: event.id, error: claimError.message });
    }

    // Process the event. If processing fails, delete the dedup record so
    // Stripe can retry successfully.
    try {
      await handleWebhookEvent(event);
    } catch (processingError) {
      // Remove the dedup record so Stripe's retry will be processed
      if (claimed?.id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('stripe_processed_events') as any)
          .delete()
          .eq('id', claimed.id);
      }
      throw processingError;
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
