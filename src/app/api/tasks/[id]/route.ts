import { tasksService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';
import { withAuth, errorResponse, successResponse } from '@/lib/auth/api-helpers';

const log = createLogger('api:task');

const updateTaskSchema = z.object({
  assigned_to: z.string().uuid().nullable().optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  due_date: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * GET /api/tasks/[id] - Get a single task
 */
export const GET = withAuth(async (_request, context, auth) => {
  try {
    const { id } = await context.params!;

    const task = await tasksService.getTask(id);

    if (!task) {
      return errorResponse('Task not found', 404);
    }

    // Check if user has permission to view
    const canView =
      task.created_by === auth.user.id ||
      task.assigned_to === auth.user.id;

    if (!canView) {
      // Check if admin
      const supabase = await createClient();
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', auth.user.id)
        .single();

      if (profile?.role !== 'admin') {
        return errorResponse('Forbidden', 403);
      }
    }

    return successResponse(task);
  } catch (error) {
    log.logError('Failed to fetch task', error);
    return errorResponse('Failed to fetch task', 500);
  }
});

/**
 * PATCH /api/tasks/[id] - Update a task
 */
export const PATCH = withAuth(async (request, context, auth) => {
  try {
    const { id } = await context.params!;

    const task = await tasksService.getTask(id);

    if (!task) {
      return errorResponse('Task not found', 404);
    }

    // Check if user has permission to update
    const canUpdate =
      task.created_by === auth.user.id ||
      task.assigned_to === auth.user.id;

    if (!canUpdate) {
      // Check if admin
      const supabase = await createClient();
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', auth.user.id)
        .single();

      if (profile?.role !== 'admin') {
        return errorResponse('Forbidden', 403);
      }
    }

    const body = await request.json();
    const validatedData = updateTaskSchema.parse(body);

    // If marking as complete, set completed_at and completed_by
    if (validatedData.status === 'completed' && task.status !== 'completed') {
      (validatedData as Parameters<typeof tasksService.updateTask>[1]).completed_at = new Date().toISOString();
      (validatedData as Parameters<typeof tasksService.updateTask>[1]).completed_by = auth.user.id;
    }

    const updatedTask = await tasksService.updateTask(id, validatedData);

    log.info('Task updated', { taskId: id, updates: Object.keys(validatedData) });

    return successResponse(updatedTask);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }

    log.logError('Failed to update task', error);
    return errorResponse('Failed to update task', 500);
  }
});

/**
 * DELETE /api/tasks/[id] - Delete a task
 */
export const DELETE = withAuth(async (_request, context, auth) => {
  try {
    const { id } = await context.params!;

    const task = await tasksService.getTask(id);

    if (!task) {
      return errorResponse('Task not found', 404);
    }

    // Only creator can delete
    if (task.created_by !== auth.user.id) {
      // Check if admin
      const supabase = await createClient();
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', auth.user.id)
        .single();

      if (profile?.role !== 'admin') {
        return errorResponse('Forbidden', 403);
      }
    }

    await tasksService.deleteTask(id);

    log.info('Task deleted', { taskId: id });

    return successResponse({ success: true });
  } catch (error) {
    log.logError('Failed to delete task', error);
    return errorResponse('Failed to delete task', 500);
  }
}, { rateLimit: 'SENSITIVE' });
