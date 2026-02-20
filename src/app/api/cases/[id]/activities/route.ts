import { withAuth, errorResponse, verifyCaseAccess } from '@/lib/auth/api-helpers';
import { activitiesService } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { NextResponse } from 'next/server';

const log = createLogger('api:case-activities');

export const GET = withAuth(async (request, context, auth) => {
  try {
    const { id: caseId } = await context.params!;

    const caseAccess = await verifyCaseAccess(auth.user.id, caseId);
    if (!caseAccess.success) {
      return errorResponse(caseAccess.error, caseAccess.status);
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    const activities = await activitiesService.getActivitiesByCase(caseId, limit);

    return NextResponse.json({ data: activities });
  } catch (error) {
    log.logError('Failed to fetch activities', error);
    return errorResponse('Failed to fetch activities', 500);
  }
});
