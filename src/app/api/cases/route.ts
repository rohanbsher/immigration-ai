import { NextRequest, NextResponse } from 'next/server';
import { casesService } from '@/lib/db';
import { z } from 'zod';
import {
  requireAuth,
  requireAttorney,
  errorResponse,
  successResponse,
} from '@/lib/auth/api-helpers';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:cases');

const createCaseSchema = z.object({
  client_id: z.string().uuid('Invalid client ID'),
  visa_type: z.string(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  priority_date: z.string().optional(),
  deadline: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;

    const { searchParams } = new URL(request.url);

    const filters = {
      status: searchParams.getAll('status').length > 0
        ? searchParams.getAll('status')
        : searchParams.get('status') || undefined,
      visa_type: searchParams.getAll('visa_type').length > 0
        ? searchParams.getAll('visa_type')
        : searchParams.get('visa_type') || undefined,
      search: searchParams.get('search') || undefined,
    };

    const pagination = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '10'),
      sortBy: searchParams.get('sortBy') || 'created_at',
      sortOrder: (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc',
    };

    const result = await casesService.getCases(filters as Parameters<typeof casesService.getCases>[0], pagination);

    return NextResponse.json(result);
  } catch (error) {
    log.logError('Failed to fetch cases', error);
    return errorResponse('Failed to fetch cases', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAttorney(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const validatedData = createCaseSchema.parse(body);

    const newCase = await casesService.createCase(validatedData as Parameters<typeof casesService.createCase>[0]);

    return successResponse(newCase, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }

    log.logError('Failed to create case', error);
    return errorResponse('Failed to create case', 500);
  }
}
