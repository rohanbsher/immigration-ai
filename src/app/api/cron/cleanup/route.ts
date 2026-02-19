import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';
import { serverEnv, features } from '@/lib/config';
import { safeCompare } from '@/lib/security/timing-safe';

const log = createLogger('cron:cleanup');

const DOCUMENT_PROCESSING_TIMEOUT_MS = 15 * 60 * 1000;
const CHAT_STREAMING_TIMEOUT_MS = 10 * 60 * 1000;
const FORM_AUTOFILLING_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * GET /api/cron/cleanup
 *
 * Cron job endpoint to clean up orphaned records that are stuck
 * in transient states due to server crashes or timeouts.
 *
 * Handles:
 * - Documents stuck in 'processing' status (>15 min) -> reset to 'uploaded'
 * - Chat messages stuck in 'streaming' status (>10 min) -> mark as 'error'
 * - Forms stuck in 'autofilling' status (>10 min) -> reset to 'draft'
 *
 * Vercel Cron config (in vercel.json):
 * "crons": [{ "path": "/api/cron/cleanup", "schedule": "0,30 * * * *" }]
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    if (!features.cronJobs) {
      log.error('CRON_SECRET not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('authorization');
    const vercelCronHeader = request.headers.get('x-vercel-cron-secret');
    const expectedSecret = serverEnv.CRON_SECRET ?? '';
    const expectedAuth = `Bearer ${expectedSecret}`;

    const isAuthorized =
      (authHeader && safeCompare(authHeader, expectedAuth)) ||
      (vercelCronHeader && safeCompare(vercelCronHeader, expectedSecret));

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    log.info('Starting orphaned record cleanup');

    const adminClient = getAdminClient();
    const now = Date.now();

    // 1. Reset documents stuck in 'processing' for >15 minutes
    const documentCutoff = new Date(now - DOCUMENT_PROCESSING_TIMEOUT_MS).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: stuckDocuments, error: docError } = await (adminClient.from('documents') as any)
      .update({ status: 'uploaded', updated_at: new Date().toISOString() })
      .eq('status', 'processing')
      .lt('updated_at', documentCutoff)
      .select('id');

    if (docError) {
      log.error('Failed to clean up stuck documents', { error: docError.message });
    }

    const documentsReset = (stuckDocuments as { id: string }[] | null)?.length ?? 0;

    // 2. Mark chat messages stuck in 'streaming' for >10 minutes as 'error'
    const chatCutoff = new Date(now - CHAT_STREAMING_TIMEOUT_MS).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: stuckMessages, error: msgError } = await (adminClient.from('conversation_messages') as any)
      .update({
        metadata: { status: 'error' },
        content: '[Error: Response generation timed out]',
      })
      .eq('metadata->>status', 'streaming')
      .lt('created_at', chatCutoff)
      .select('id');

    if (msgError) {
      log.error('Failed to clean up stuck chat messages', { error: msgError.message });
    }

    const messagesReset = (stuckMessages as { id: string }[] | null)?.length ?? 0;

    // 3. Reset forms stuck in 'autofilling' for >10 minutes
    //    Also catch forms where updated_at is NULL (never updated after creation)
    const formCutoff = new Date(now - FORM_AUTOFILLING_TIMEOUT_MS).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: stuckForms, error: formError } = await (adminClient.from('forms') as any)
      .update({ status: 'draft', updated_at: new Date().toISOString() })
      .eq('status', 'autofilling')
      .or(`updated_at.lt.${formCutoff},updated_at.is.null`)
      .select('id');

    if (formError) {
      log.error('Failed to clean up stuck forms', { error: formError.message });
    }

    const formsReset = (stuckForms as { id: string }[] | null)?.length ?? 0;

    const summary = {
      documentsReset,
      messagesReset,
      formsReset,
    };

    log.info('Orphaned record cleanup complete', summary);

    return NextResponse.json({
      success: true,
      message: 'Cleanup complete',
      ...summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.logError('Error during orphaned record cleanup', error);

    return NextResponse.json(
      { error: 'Failed to run cleanup' },
      { status: 500 }
    );
  }
}
