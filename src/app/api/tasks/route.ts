import { NextResponse } from 'next/server';
import { tasksService } from '@/lib/db';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';
import {
  withAuth,
  withAttorneyAuth,
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
export const GET = withAuth(async (request, _context, auth) => {
  try {
    const { searchParams } = new URL(request.url);

    const filters = {
      case_id: searchParams.get('case_id') || undefined,
      assigned_to: searchParams.get('assigned_to') || (searchParams.get('my') === 'true' ? auth.user.id : undefined),
      status: searchParams.get('status') || undefined,
      priority: searchParams.get('priority') || undefined,
      search: searchParams.get('search') || undefined,
    };

    const tasks = await tasksService.getTasks(
      auth.user.id,
      filters as Parameters<typeof tasksService.getTasks>[1]
    );

    return NextResponse.json({ data: tasks });
  } catch (error) {
    log.logError('Failed to fetch tasks', error);
    return errorResponse('Failed to fetch tasks', 500);
  }
});

/**
 * POST /api/tasks - Create a new task (attorney only)
 */
export const POST = withAttorneyAuth(async (request, _context, auth) => {
  try {
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
});
