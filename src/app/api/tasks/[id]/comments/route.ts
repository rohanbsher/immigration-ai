import { tasksService } from '@/lib/db';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';
import { withAuth, errorResponse, successResponse, safeParseBody } from '@/lib/auth/api-helpers';

const log = createLogger('api:task-comments');

const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
});

/**
 * GET /api/tasks/[id]/comments - Get comments for a task
 */
export const GET = withAuth(async (_request, context, _auth) => {
  try {
    const { id } = await context.params!;
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
