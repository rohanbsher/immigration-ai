import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent, handleWebhookEvent } from '@/lib/stripe';
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
