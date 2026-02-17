/**
 * Integration tests for Tasks API routes.
 *
 * Tests cover:
 * - GET /api/tasks - List tasks (withAuth from @/lib/auth/api-helpers)
 * - POST /api/tasks - Create task (withAttorneyAuth)
 * - GET /api/tasks/[id] - Get task detail
 * - PATCH /api/tasks/[id] - Update task
 * - DELETE /api/tasks/[id] - Delete task
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockUserId = 'user-123';
const mockTaskId = 'task-abc';

const mockAttorneyProfile = {
  id: mockUserId,
  email: 'attorney@example.com',
  role: 'attorney',
  first_name: 'Attorney',
  last_name: 'Test',
};

const mockTask = {
  id: mockTaskId,
  case_id: 'case-1',
  firm_id: null,
  created_by: mockUserId,
  assigned_to: 'user-456',
  title: 'Review documents',
  description: 'Review the uploaded documents',
  status: 'pending',
  priority: 'medium',
  due_date: '2024-06-01',
  completed_at: null,
  completed_by: null,
  tags: ['review'],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  deleted_at: null,
};

const mockTasks = [
  mockTask,
  {
    ...mockTask,
    id: 'task-def',
    title: 'File petition',
    priority: 'high',
    assigned_to: mockUserId,
  },
];

// ---------------------------------------------------------------------------
// Mock supabase (used by tasks/[id] for admin role check)
// ---------------------------------------------------------------------------

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// ---------------------------------------------------------------------------
// Mock supabase admin (used by authenticate in api-helpers)
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/admin', () => ({
  getProfileAsAdmin: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock db services
// ---------------------------------------------------------------------------

vi.mock('@/lib/db', () => ({
  tasksService: {
    getTasks: vi.fn(),
    createTask: vi.fn(),
    getTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock auth helpers - withAuth/withAttorneyAuth from @/lib/auth/api-helpers
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth/api-helpers', () => {
  const authenticateFn = vi.fn();

  const withAuth = (handler: any, options?: any) => {
    return async (request: any, context: any) => {
      const auth = await authenticateFn(request, options);
      if (!auth.success) {
        return auth.response;
      }
      try {
        return await handler(request, context, auth);
      } catch (error: any) {
        return new Response(
          JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    };
  };

  const withAttorneyAuth = (handler: any) => withAuth(handler, { roles: ['attorney'] });
  const withAdminAuth = (handler: any) => withAuth(handler, { roles: ['admin'] });

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { NextResponse } = require('next/server');
  return {
    authenticate: authenticateFn,
    withAuth,
    withAttorneyAuth,
    withAdminAuth,
    errorResponse: (error: string, status: number) =>
      new Response(JSON.stringify({ success: false, error }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    successResponse: (data: any, status = 200) =>
      new Response(JSON.stringify({ success: true, data }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    safeParseBody: async (request: any) => {
      try {
        const data = await request.json();
        return { success: true, data };
      } catch {
        return {
          success: false,
          response: NextResponse.json(
            { error: 'Invalid JSON in request body' },
            { status: 400 }
          ),
        };
      }
    },
  };
});

// ---------------------------------------------------------------------------
// Mock rate limiter
// ---------------------------------------------------------------------------

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: {
    STANDARD: { maxRequests: 100, windowMs: 60000, keyPrefix: 'standard' },
    AUTH: { maxRequests: 5, windowMs: 60000, keyPrefix: 'auth' },
    AI: { maxRequests: 10, windowMs: 3600000, keyPrefix: 'ai' },
    SENSITIVE: { maxRequests: 20, windowMs: 60000, keyPrefix: 'sensitive' },
  },
}));

// ---------------------------------------------------------------------------
// Mock logger
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { GET as getTasks, POST as createTask } from './route';
import { GET as getTask, PATCH as updateTask, DELETE as deleteTask } from './[id]/route';
import { tasksService } from '@/lib/db';
import { authenticate } from '@/lib/auth/api-helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(
  method: string,
  url: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>
) {
  const init: RequestInit = {
    method,
    headers: { 'x-forwarded-for': '127.0.0.1', ...headers },
  };
  if (body) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)['content-type'] = 'application/json';
  }
  const req = new NextRequest(`http://localhost:3000${url}`, init);
  if (body) {
    req.json = async () => body;
  }
  return req;
}

function mockAuthSuccess(userId = mockUserId, role = 'attorney') {
  return {
    success: true,
    user: { id: userId, email: 'attorney@example.com' },
    profile: { id: userId, email: 'attorney@example.com', role },
  };
}

function mockAuthFailure(status = 401, error = 'Unauthorized') {
  return {
    success: false,
    error,
    response: new Response(JSON.stringify({ success: false, error }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  };
}

function makeParams(id: string = mockTaskId) {
  return { params: Promise.resolve({ id }) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Tasks API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // GET /api/tasks
  // ==========================================================================
  describe('GET /api/tasks', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(authenticate).mockResolvedValue(mockAuthFailure() as any);

      const request = createRequest('GET', '/api/tasks');
      const response = await getTasks(request, {});
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 200 with tasks list', async () => {
      vi.mocked(authenticate).mockResolvedValue(mockAuthSuccess() as any);
      vi.mocked(tasksService.getTasks).mockResolvedValue(mockTasks as any);

      const request = createRequest('GET', '/api/tasks');
      const response = await getTasks(request, {});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(2);
      expect(tasksService.getTasks).toHaveBeenCalledWith(mockUserId, expect.any(Object));
    });

    it('should pass filter params to service', async () => {
      vi.mocked(authenticate).mockResolvedValue(mockAuthSuccess() as any);
      vi.mocked(tasksService.getTasks).mockResolvedValue([] as any);

      const request = createRequest('GET', '/api/tasks?case_id=case-1&status=pending&priority=high');
      const response = await getTasks(request, {});

      expect(response.status).toBe(200);
      expect(tasksService.getTasks).toHaveBeenCalledWith(mockUserId, expect.objectContaining({
        case_id: 'case-1',
        status: 'pending',
        priority: 'high',
      }));
    });

    it('should filter by assigned_to when my=true', async () => {
      vi.mocked(authenticate).mockResolvedValue(mockAuthSuccess() as any);
      vi.mocked(tasksService.getTasks).mockResolvedValue([] as any);

      const request = createRequest('GET', '/api/tasks?my=true');
      const response = await getTasks(request, {});

      expect(response.status).toBe(200);
      expect(tasksService.getTasks).toHaveBeenCalledWith(mockUserId, expect.objectContaining({
        assigned_to: mockUserId,
      }));
    });

    it('should return 500 on service error', async () => {
      vi.mocked(authenticate).mockResolvedValue(mockAuthSuccess() as any);
      vi.mocked(tasksService.getTasks).mockRejectedValue(new Error('DB error'));

      const request = createRequest('GET', '/api/tasks');
      const response = await getTasks(request, {});
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch tasks');
    });
  });

  // ==========================================================================
  // POST /api/tasks (attorney only)
  // ==========================================================================
  describe('POST /api/tasks', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(authenticate).mockResolvedValue(mockAuthFailure() as any);

      const request = createRequest('POST', '/api/tasks', { title: 'New task' });
      const response = await createTask(request, {});
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 for non-attorney', async () => {
      vi.mocked(authenticate).mockResolvedValue(
        mockAuthFailure(403, 'Access denied. Required role: attorney') as any
      );

      const request = createRequest('POST', '/api/tasks', { title: 'New task' });
      const response = await createTask(request, {});
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Access denied');
    });

    it('should return 400 for invalid Zod schema (missing title)', async () => {
      vi.mocked(authenticate).mockResolvedValue(mockAuthSuccess() as any);

      const request = createRequest('POST', '/api/tasks', { description: 'No title' });
      const response = await createTask(request, {});
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 400 for empty title', async () => {
      vi.mocked(authenticate).mockResolvedValue(mockAuthSuccess() as any);

      const request = createRequest('POST', '/api/tasks', { title: '' });
      const response = await createTask(request, {});
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Title is required');
    });

    it('should return 201 with created task', async () => {
      vi.mocked(authenticate).mockResolvedValue(mockAuthSuccess() as any);
      const newTask = { ...mockTask, id: 'task-new', title: 'New task' };
      vi.mocked(tasksService.createTask).mockResolvedValue(newTask as any);

      const request = createRequest('POST', '/api/tasks', {
        title: 'New task',
        priority: 'high',
        case_id: '550e8400-e29b-41d4-a716-446655440000',
      });
      const response = await createTask(request, {});
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.title).toBe('New task');
      expect(tasksService.createTask).toHaveBeenCalledWith(expect.objectContaining({
        title: 'New task',
        priority: 'high',
        created_by: mockUserId,
      }));
    });

    it('should return 500 on service error', async () => {
      vi.mocked(authenticate).mockResolvedValue(mockAuthSuccess() as any);
      vi.mocked(tasksService.createTask).mockRejectedValue(new Error('DB error'));

      const request = createRequest('POST', '/api/tasks', { title: 'New task' });
      const response = await createTask(request, {});
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create task');
    });
  });

  // ==========================================================================
  // GET /api/tasks/[id]
  // ==========================================================================
  describe('GET /api/tasks/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(authenticate).mockResolvedValue(mockAuthFailure() as any);

      const request = createRequest('GET', `/api/tasks/${mockTaskId}`);
      const response = await getTask(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when task not found', async () => {
      vi.mocked(authenticate).mockResolvedValue(mockAuthSuccess() as any);
      vi.mocked(tasksService.getTask).mockResolvedValue(null);

      const request = createRequest('GET', `/api/tasks/${mockTaskId}`);
      const response = await getTask(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Task not found');
    });

    it('should return 200 with task when user is creator', async () => {
      vi.mocked(authenticate).mockResolvedValue(mockAuthSuccess() as any);
      vi.mocked(tasksService.getTask).mockResolvedValue(mockTask as any);

      const request = createRequest('GET', `/api/tasks/${mockTaskId}`);
      const response = await getTask(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(mockTaskId);
    });

    it('should return 200 when user is assignee', async () => {
      const assigneeId = 'user-456';
      vi.mocked(authenticate).mockResolvedValue(mockAuthSuccess(assigneeId) as any);
      vi.mocked(tasksService.getTask).mockResolvedValue(mockTask as any);

      const request = createRequest('GET', `/api/tasks/${mockTaskId}`);
      const response = await getTask(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 403 when user is neither creator nor assignee and not admin', async () => {
      vi.mocked(authenticate).mockResolvedValue(mockAuthSuccess('other-user') as any);
      vi.mocked(tasksService.getTask).mockResolvedValue(mockTask as any);

      // Mock admin check: not admin
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { role: 'attorney' }, error: null }),
      });

      const request = createRequest('GET', `/api/tasks/${mockTaskId}`);
      const response = await getTask(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should allow admin access', async () => {
      vi.mocked(authenticate).mockResolvedValue(mockAuthSuccess('admin-user') as any);
      vi.mocked(tasksService.getTask).mockResolvedValue(mockTask as any);

      // Mock admin check: is admin
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
      });

      const request = createRequest('GET', `/api/tasks/${mockTaskId}`);
      const response = await getTask(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  // ==========================================================================
  // PATCH /api/tasks/[id]
  // ==========================================================================
  describe('PATCH /api/tasks/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(authenticate).mockResolvedValue(mockAuthFailure() as any);

      const request = createRequest('PATCH', `/api/tasks/${mockTaskId}`, { title: 'Updated' });
      const response = await updateTask(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when task not found', async () => {
      vi.mocked(authenticate).mockResolvedValue(mockAuthSuccess() as any);
      vi.mocked(tasksService.getTask).mockResolvedValue(null);

      const request = createRequest('PATCH', `/api/tasks/${mockTaskId}`, { title: 'Updated' });
      const response = await updateTask(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Task not found');
    });

    it('should return 400 for invalid Zod schema', async () => {
      vi.mocked(authenticate).mockResolvedValue(mockAuthSuccess() as any);
      vi.mocked(tasksService.getTask).mockResolvedValue(mockTask as any);

      const request = createRequest('PATCH', `/api/tasks/${mockTaskId}`, {
        status: 'invalid-status',
      });
      const response = await updateTask(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 200 with updated task', async () => {
      vi.mocked(authenticate).mockResolvedValue(mockAuthSuccess() as any);
      vi.mocked(tasksService.getTask).mockResolvedValue(mockTask as any);
      const updatedTask = { ...mockTask, title: 'Updated title' };
      vi.mocked(tasksService.updateTask).mockResolvedValue(updatedTask as any);

      const request = createRequest('PATCH', `/api/tasks/${mockTaskId}`, { title: 'Updated title' });
      const response = await updateTask(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.title).toBe('Updated title');
    });

    it('should set completed_at and completed_by when marking as completed', async () => {
      vi.mocked(authenticate).mockResolvedValue(mockAuthSuccess() as any);
      vi.mocked(tasksService.getTask).mockResolvedValue(mockTask as any);
      vi.mocked(tasksService.updateTask).mockResolvedValue({
        ...mockTask,
        status: 'completed',
        completed_at: '2024-06-01T00:00:00Z',
        completed_by: mockUserId,
      } as any);

      const request = createRequest('PATCH', `/api/tasks/${mockTaskId}`, { status: 'completed' });
      const response = await updateTask(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(tasksService.updateTask).toHaveBeenCalledWith(
        mockTaskId,
        expect.objectContaining({
          status: 'completed',
          completed_at: expect.any(String),
          completed_by: mockUserId,
        })
      );
    });

    it('should return 403 when user cannot update and is not admin', async () => {
      vi.mocked(authenticate).mockResolvedValue(mockAuthSuccess('other-user') as any);
      vi.mocked(tasksService.getTask).mockResolvedValue(mockTask as any);

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { role: 'client' }, error: null }),
      });

      const request = createRequest('PATCH', `/api/tasks/${mockTaskId}`, { title: 'Updated' });
      const response = await updateTask(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should return 500 on service error', async () => {
      vi.mocked(authenticate).mockResolvedValue(mockAuthSuccess() as any);
      vi.mocked(tasksService.getTask).mockResolvedValue(mockTask as any);
      vi.mocked(tasksService.updateTask).mockRejectedValue(new Error('DB error'));

      const request = createRequest('PATCH', `/api/tasks/${mockTaskId}`, { title: 'Updated' });
      const response = await updateTask(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update task');
    });
  });

  // ==========================================================================
  // DELETE /api/tasks/[id]
  // ==========================================================================
  describe('DELETE /api/tasks/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(authenticate).mockResolvedValue(mockAuthFailure() as any);

      const request = createRequest('DELETE', `/api/tasks/${mockTaskId}`);
      const response = await deleteTask(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when task not found', async () => {
      vi.mocked(authenticate).mockResolvedValue(mockAuthSuccess() as any);
      vi.mocked(tasksService.getTask).mockResolvedValue(null);

      const request = createRequest('DELETE', `/api/tasks/${mockTaskId}`);
      const response = await deleteTask(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Task not found');
    });

    it('should return 200 on successful delete by creator', async () => {
      vi.mocked(authenticate).mockResolvedValue(mockAuthSuccess() as any);
      vi.mocked(tasksService.getTask).mockResolvedValue(mockTask as any);
      vi.mocked(tasksService.deleteTask).mockResolvedValue(undefined);

      const request = createRequest('DELETE', `/api/tasks/${mockTaskId}`);
      const response = await deleteTask(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(tasksService.deleteTask).toHaveBeenCalledWith(mockTaskId);
    });

    it('should return 403 when non-creator/non-admin tries to delete', async () => {
      vi.mocked(authenticate).mockResolvedValue(mockAuthSuccess('other-user') as any);
      vi.mocked(tasksService.getTask).mockResolvedValue(mockTask as any);

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { role: 'attorney' }, error: null }),
      });

      const request = createRequest('DELETE', `/api/tasks/${mockTaskId}`);
      const response = await deleteTask(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should allow admin to delete', async () => {
      vi.mocked(authenticate).mockResolvedValue(mockAuthSuccess('admin-user') as any);
      vi.mocked(tasksService.getTask).mockResolvedValue(mockTask as any);
      vi.mocked(tasksService.deleteTask).mockResolvedValue(undefined);

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
      });

      const request = createRequest('DELETE', `/api/tasks/${mockTaskId}`);
      const response = await deleteTask(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 500 on service error', async () => {
      vi.mocked(authenticate).mockResolvedValue(mockAuthSuccess() as any);
      vi.mocked(tasksService.getTask).mockResolvedValue(mockTask as any);
      vi.mocked(tasksService.deleteTask).mockRejectedValue(new Error('DB error'));

      const request = createRequest('DELETE', `/api/tasks/${mockTaskId}`);
      const response = await deleteTask(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to delete task');
    });
  });
});
