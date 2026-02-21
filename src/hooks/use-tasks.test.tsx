import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Mock fetch-with-timeout
const mockFetchWithTimeout = vi.fn();
vi.mock('@/lib/api/fetch-with-timeout', () => {
  class MockTimeoutError extends Error {
    constructor(timeout: number) {
      super(`Request timed out after ${timeout / 1000} seconds`);
      this.name = 'TimeoutError';
    }
  }
  return {
    fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
    TimeoutError: MockTimeoutError,
  };
});

// Mock parse-response
const mockParseApiResponse = vi.fn();
const mockParseApiVoidResponse = vi.fn();
vi.mock('@/lib/api/parse-response', () => ({
  parseApiResponse: (...args: unknown[]) => mockParseApiResponse(...args),
  parseApiVoidResponse: (...args: unknown[]) => mockParseApiVoidResponse(...args),
}));

import {
  useTasks,
  useMyTasks,
  useCaseTasks,
  useTask,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useCompleteTask,
} from './use-tasks';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  Wrapper.displayName = 'TestQueryWrapper';
  return { Wrapper, queryClient };
}

const mockTask = {
  id: 'task-1',
  case_id: 'case-1',
  firm_id: 'firm-1',
  created_by: 'user-1',
  assigned_to: 'user-2',
  title: 'Review passport documents',
  description: 'Check passport validity',
  status: 'pending' as const,
  priority: 'high' as const,
  due_date: '2026-03-01',
  completed_at: null,
  completed_by: null,
  tags: ['documents', 'review'],
  created_at: '2026-01-15T00:00:00Z',
  updated_at: '2026-01-15T00:00:00Z',
  creator: {
    id: 'user-1',
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane@firm.com',
  },
  assignee: {
    id: 'user-2',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@firm.com',
  },
  case: {
    id: 'case-1',
    title: 'Test H-1B Case',
    visa_type: 'H-1B',
  },
};

describe('useTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches tasks on mount', async () => {
    const tasksResponse = { data: [mockTask] };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(tasksResponse);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTasks(), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // useTasks uses select: (data) => data.data, so result.current.data is the inner array
    expect(result.current.data).toEqual([mockTask]);
    expect(result.current.error).toBeNull();
  });

  test('passes filters to query params', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue({ data: [mockTask] });

    const { Wrapper } = createWrapper();
    renderHook(
      () => useTasks({ status: 'pending', priority: 'high', search: 'passport' }),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(mockFetchWithTimeout).toHaveBeenCalled();
    });

    const calledUrl = mockFetchWithTimeout.mock.calls[0][0] as string;
    expect(calledUrl).toContain('status=pending');
    expect(calledUrl).toContain('priority=high');
    expect(calledUrl).toContain('search=passport');
  });

  test('passes case_id filter', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue({ data: [mockTask] });

    const { Wrapper } = createWrapper();
    renderHook(() => useTasks({ case_id: 'case-1' }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(mockFetchWithTimeout).toHaveBeenCalled();
    });

    const calledUrl = mockFetchWithTimeout.mock.calls[0][0] as string;
    expect(calledUrl).toContain('case_id=case-1');
  });

  test('passes my filter', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue({ data: [mockTask] });

    const { Wrapper } = createWrapper();
    renderHook(() => useTasks({ my: true }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(mockFetchWithTimeout).toHaveBeenCalled();
    });

    const calledUrl = mockFetchWithTimeout.mock.calls[0][0] as string;
    expect(calledUrl).toContain('my=true');
  });

  test('handles empty tasks list', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue({ data: [] });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTasks(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
  });

  test('handles fetch error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 500 });
    mockParseApiResponse.mockRejectedValue(new Error('Internal Server Error'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTasks(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.data).toBeUndefined();
  });
});

describe('useMyTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches tasks with my=true filter', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue({ data: [mockTask] });

    const { Wrapper } = createWrapper();
    renderHook(() => useMyTasks(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(mockFetchWithTimeout).toHaveBeenCalled();
    });

    const calledUrl = mockFetchWithTimeout.mock.calls[0][0] as string;
    expect(calledUrl).toContain('my=true');
  });
});

describe('useCaseTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches tasks for a specific case', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue({ data: [mockTask] });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCaseTasks('case-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual([mockTask]);
  });

  test('does not fetch when caseId is undefined', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCaseTasks(undefined), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });
});

describe('useTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches a single task by id', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockTask);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTask('task-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockTask);
    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/tasks/task-1');
  });

  test('does not fetch when id is undefined', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTask(undefined), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });

  test('handles error for single task fetch', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 404 });
    mockParseApiResponse.mockRejectedValue(new Error('Task not found'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTask('nonexistent'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Task not found');
  });
});

describe('useCreateTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('creates a task and invalidates queries', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockTask);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateTask(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        title: 'Review passport documents',
        case_id: 'case-1',
        priority: 'high',
        due_date: '2026-03-01',
      });
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Review passport documents',
        case_id: 'case-1',
        priority: 'high',
        due_date: '2026-03-01',
      }),
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tasks'] });
  });

  test('handles creation error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 400 });
    mockParseApiResponse.mockRejectedValue(new Error('Title is required'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateTask(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({ title: '' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Title is required');
  });
});

describe('useUpdateTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('updates a task and invalidates queries', async () => {
    const updatedTask = { ...mockTask, status: 'in_progress' as const };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(updatedTask);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateTask(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'task-1',
        data: { status: 'in_progress' },
      });
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/tasks/task-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tasks'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['task', 'task-1'] });
  });

  test('updates task priority', async () => {
    const updatedTask = { ...mockTask, priority: 'urgent' as const };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(updatedTask);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateTask(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'task-1',
        data: { priority: 'urgent' },
      });
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/tasks/task-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: 'urgent' }),
    });
  });

  test('handles update error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 403 });
    mockParseApiResponse.mockRejectedValue(new Error('Forbidden'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateTask(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({
        id: 'task-1',
        data: { status: 'in_progress' },
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Forbidden');
  });
});

describe('useDeleteTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('deletes a task and invalidates queries', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiVoidResponse.mockResolvedValue(undefined);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteTask(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync('task-1');
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/tasks/task-1', {
      method: 'DELETE',
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tasks'] });
  });

  test('handles delete error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 404 });
    mockParseApiVoidResponse.mockRejectedValue(new Error('Task not found'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteTask(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate('nonexistent');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useCompleteTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('completes a task by setting status to completed', async () => {
    const completedTask = {
      ...mockTask,
      status: 'completed' as const,
      completed_at: '2026-02-20T10:00:00Z',
    };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(completedTask);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCompleteTask(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync('task-1');
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/tasks/task-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tasks'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['task', 'task-1'] });
  });

  test('handles complete error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 400 });
    mockParseApiResponse.mockRejectedValue(new Error('Cannot complete'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCompleteTask(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate('task-1');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Cannot complete');
  });
});
