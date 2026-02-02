import { NextRequest, NextResponse } from 'next/server';
import { casesService } from '@/lib/db';
import { requireAttorneyOrAdmin, errorResponse } from '@/lib/auth/api-helpers';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:case-stats');

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAttorneyOrAdmin(request);
    if (!auth.success) return auth.response;

    const stats = await casesService.getCaseStats();

    return NextResponse.json(stats);
  } catch (error) {
    log.logError('Error fetching case stats', error);
    return errorResponse('Failed to fetch case stats', 500);
  }
}
