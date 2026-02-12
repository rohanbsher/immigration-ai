import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent, handleWebhookEvent } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';
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

    // Idempotency: skip if this event was already processed.
    // Uses UNIQUE constraint on event_id for atomic dedup.
    const supabase = await createClient();
    const { error: dedupeError } = await supabase
      .from('stripe_processed_events')
      .insert({ event_id: event.id, event_type: event.type });

    if (dedupeError) {
      if (dedupeError.code === '23505') {
        log.info('Skipping duplicate webhook event', { eventId: event.id });
        return NextResponse.json({ received: true, deduplicated: true });
      }
      // Non-duplicate DB error — log but continue processing to avoid
      // silently dropping events if the dedup table is unavailable
      log.warn('Failed to record webhook event for idempotency', { error: dedupeError.message });
    }

    await handleWebhookEvent(event);

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
