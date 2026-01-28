import { NextRequest, NextResponse } from 'next/server';
import { tasksService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';
import {
  requireAuth,
  requireAttorney,
  errorResponse,
  successResponse,
} from '@/lib/auth/api-helpers';

const log = createLogger('api:tasks');

const createTaskSchema = z.object({
  case_id: z.string().uuid().optional(),
  firm_id: z.string().uuid().optional(),
  assigned_to: z.string().uuid().optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  due_date: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * GET /api/tasks - Get all tasks for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;

    const { searchParams } = new URL(request.url);

    const filters = {
      case_id: searchParams.get('case_id') || undefined,
      assigned_to: searchParams.get('assigned_to') || searchParams.get('my') === 'true' ? auth.user.id : undefined,
      status: searchParams.get('status') || undefined,
      priority: searchParams.get('priority') || undefined,
      search: searchParams.get('search') || undefined,
    };

    const tasks = await tasksService.getTasks(auth.user.id, filters as Parameters<typeof tasksService.getTasks>[1]);

    return NextResponse.json({ data: tasks });
  } catch (error) {
    log.logError('Failed to fetch tasks', error);
    return errorResponse('Failed to fetch tasks', 500);
  }
}

/**
 * POST /api/tasks - Create a new task
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAttorney(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const validatedData = createTaskSchema.parse(body);

    const task = await tasksService.createTask({
      ...validatedData,
      created_by: auth.user.id,
    });

    log.info('Task created', { taskId: task.id, createdBy: auth.user.id });

    return successResponse(task, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }

    log.logError('Failed to create task', error);
    return errorResponse('Failed to create task', 500);
  }
}
