import { NextResponse } from 'next/server';
import { casesService } from '@/lib/db';
import { withAuth, errorResponse } from '@/lib/auth/api-helpers';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:case-stats');

export const GET = withAuth(
  async () => {
    try {
      const stats = await casesService.getCaseStats();
      return NextResponse.json(stats);
    } catch (error) {
      log.logError('Error fetching case stats', error);
      return errorResponse('Failed to fetch case stats', 500);
    }
  },
  { roles: ['attorney', 'admin'] }
);
