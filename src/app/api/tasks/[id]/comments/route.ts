import { tasksService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';
import { withAuth, errorResponse, successResponse, safeParseBody } from '@/lib/auth/api-helpers';

const log = createLogger('api:task-comments');

const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
});

/**
 * GET /api/tasks/[id]/comments - Get comments for a task
 *
 * Authorization: verifies the user can see the parent task (via RLS on tasks
 * table) before returning comments. This is defense-in-depth alongside RLS
 * policies on task_comments.
 */
export const GET = withAuth(async (_request, context, auth) => {
  try {
    const { id } = await context.params!;

    // Verify the user has visibility into this task (RLS on tasks table)
    const task = await tasksService.getTask(id);
    if (!task) {
      return errorResponse('Task not found', 404);
    }

    // Defense-in-depth: verify the authenticated user can access this task
    const canView =
      task.created_by === auth.user.id ||
      task.assigned_to === auth.user.id;

    if (!canView) {
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

    const comments = await tasksService.getComments(id);
    return successResponse(comments);
  } catch (error) {
    log.logError('Failed to get task comments', error);
    return errorResponse('Failed to get comments', 500);
  }
});

/**
 * POST /api/tasks/[id]/comments - Add a comment to a task
 */
export const POST = withAuth(async (request, context, auth) => {
  try {
    const { id } = await context.params!;

    const parsed = await safeParseBody(request);
    if (!parsed.success) return parsed.response;

    const validated = createCommentSchema.safeParse(parsed.data);
    if (!validated.success) {
      return errorResponse(validated.error.issues[0]?.message || 'Invalid input', 400);
    }

    const comment = await tasksService.addComment(id, auth.user.id, validated.data.content);
    return successResponse(comment);
  } catch (error) {
    log.logError('Failed to create task comment', error);
    return errorResponse('Failed to create comment', 500);
  }
});
