import { NextResponse } from 'next/server';
import { features } from '@/lib/config/env';
import { enqueueDocumentAnalysis } from '@/lib/jobs/queues';

export const dynamic = 'force-dynamic';

export async function GET() {
  const results: Record<string, unknown> = {
    workerEnabled: features.workerEnabled,
    redisUrlSet: !!process.env.REDIS_URL,
    redisUrlPrefix: process.env.REDIS_URL?.substring(0, 30) + '...',
  };

  if (!features.workerEnabled) {
    return NextResponse.json({ ...results, error: 'Worker not enabled' });
  }

  // Test Redis connection via dynamic import
  try {
    const { getJobConnection } = await import('@/lib/jobs/connection');
    const conn = getJobConnection();
    results.connectionOptions = conn ? 'configured' : null;
  } catch (e) {
    results.connectionError = e instanceof Error ? e.message : String(e);
  }

  // Test Queue ping via dynamic import
  try {
    const { getDocumentAnalysisQueue } = await import('@/lib/jobs/queues');
    const queue = getDocumentAnalysisQueue();
    results.queueName = queue.name;
    const client = await queue.client;
    const pong = await client.ping();
    results.redisPing = pong;
  } catch (e) {
    results.queueError = e instanceof Error ? e.message : String(e);
  }

  // Test enqueueDocumentAnalysis (static import, same as analyze route)
  try {
    const job = await enqueueDocumentAnalysis({
      documentId: 'test-debug--' + Date.now(),
      userId: 'test-user',
      caseId: 'test-case',
      documentType: 'passport',
      storagePath: 'test/debug.pdf',
    });
    results.enqueueTest = {
      success: true,
      jobId: job.id,
      jobName: job.name,
    };
    // Clean up test job
    await job.remove();
    results.enqueueTest = { ...results.enqueueTest as object, cleaned: true };
  } catch (e) {
    results.enqueueTest = {
      success: false,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack?.split('\n').slice(0, 5) : undefined,
    };
  }

  return NextResponse.json(results);
}
