import { NextResponse } from 'next/server';
import { casesService } from '@/lib/db';
import { z } from 'zod';
import {
  withAuth,
  withAttorneyAuth,
  errorResponse,
  successResponse,
  safeParseBody,
} from '@/lib/auth/api-helpers';
import { createLogger } from '@/lib/logger';
import { enforceQuota, QuotaExceededError } from '@/lib/billing/quota';
import { VISA_TYPES } from '@/lib/validation';

const log = createLogger('api:cases');

const createCaseSchema = z.object({
  client_id: z.string().uuid('Invalid client ID'),
  visa_type: z.enum(VISA_TYPES, { message: 'Invalid visa type' }),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  priority_date: z.string().optional(),
  deadline: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * GET /api/cases
 * List cases with optional filtering and pagination.
 */
export const GET = withAuth(async (request, _context, auth) => {
  try {
    const { searchParams } = new URL(request.url);

    const statusValues = searchParams.getAll('status').filter(s => s !== '');
    const filters = {
      status: statusValues.length > 0
        ? statusValues
        : undefined,
      visa_type: searchParams.getAll('visa_type').length > 0
        ? searchParams.getAll('visa_type')
        : searchParams.get('visa_type') || undefined,
      search: searchParams.get('search') || undefined,
    };

    const SORT_BY_ALLOWLIST = ['created_at', 'updated_at', 'title', 'status', 'visa_type'];
    const rawSortBy = searchParams.get('sortBy');
    const sortBy = rawSortBy && SORT_BY_ALLOWLIST.includes(rawSortBy) ? rawSortBy : 'created_at';
    const sortOrder: 'asc' | 'desc' = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    const pagination = {
      page: parseInt(searchParams.get('page') || '1', 10) || 1,
      limit: Math.min(parseInt(searchParams.get('limit') || '10', 10) || 10, 100),
      sortBy,
      sortOrder,
    };

    log.debug('Fetching cases', { userId: auth.user.id, filters, pagination });

    const result = await casesService.getCases(
      filters as Parameters<typeof casesService.getCases>[0],
      pagination
    );

    return NextResponse.json(result);
  } catch (error) {
    log.logError('Failed to fetch cases', error);
    return errorResponse('Failed to fetch cases', 500);
  }
});

/**
 * POST /api/cases
 * Create a new case (attorney only).
 */
export const POST = withAttorneyAuth(async (request, _context, auth) => {
  try {
    // Enforce case quota
    await enforceQuota(auth.user.id, 'cases');

    const parsed = await safeParseBody(request);
    if (!parsed.success) return parsed.response;
    const body = parsed.data;
    const validatedData = createCaseSchema.parse(body);

    const newCase = await casesService.createCase(
      validatedData as Parameters<typeof casesService.createCase>[0]
    );

    return successResponse(newCase, 201);
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return NextResponse.json(
        { error: 'You have reached your case limit. Please upgrade your plan to create more cases.', code: 'QUOTA_EXCEEDED' },
        { status: 402 }
      );
    }

    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }

    log.logError('Failed to create case', error);
    return errorResponse('Failed to create case', 500);
  }
});
