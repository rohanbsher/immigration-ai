'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { parseApiResponse, parseApiVoidResponse } from '@/lib/api/parse-response';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  case_id: string | null;
  firm_id: string | null;
  created_by: string;
  assigned_to: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  creator?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  assignee?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  case?: {
    id: string;
    title: string;
    visa_type: string;
  } | null;
}

interface TaskFilters {
  case_id?: string;
  assigned_to?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  search?: string;
  my?: boolean;
}

interface CreateTaskData {
  case_id?: string;
  firm_id?: string;
  assigned_to?: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  due_date?: string;
  tags?: string[];
}

interface UpdateTaskData {
  assigned_to?: string | null;
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
  tags?: string[];
}

async function fetchTasks(filters: TaskFilters = {}): Promise<{ data: Task[] }> {
  const params = new URLSearchParams();
  if (filters.case_id) params.set('case_id', filters.case_id);
  if (filters.assigned_to) params.set('assigned_to', filters.assigned_to);
  if (filters.status) params.set('status', filters.status);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.search) params.set('search', filters.search);
  if (filters.my) params.set('my', 'true');

  const response = await fetchWithTimeout(`/api/tasks?${params.toString()}`);
  return parseApiResponse<{ data: Task[] }>(response);
}

async function fetchTask(id: string): Promise<Task> {
  const response = await fetchWithTimeout(`/api/tasks/${id}`);
  return parseApiResponse<Task>(response);
}

async function createTask(data: CreateTaskData): Promise<Task> {
  const response = await fetchWithTimeout('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return parseApiResponse<Task>(response);
}

async function updateTask(id: string, data: UpdateTaskData): Promise<Task> {
  const response = await fetchWithTimeout(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return parseApiResponse<Task>(response);
}

async function deleteTask(id: string): Promise<void> {
  const response = await fetchWithTimeout(`/api/tasks/${id}`, {
    method: 'DELETE',
  });
  await parseApiVoidResponse(response);
}

/**
 * Hook for fetching tasks
 */
export function useTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => fetchTasks(filters),
    staleTime: 30 * 1000, // 30 seconds — may update frequently
    select: (data) => data.data,
  });
}

/**
 * Hook for fetching my tasks
 */
export function useMyTasks() {
  return useTasks({ my: true });
}

/**
 * Hook for fetching tasks for a case
 */
export function useCaseTasks(caseId: string | undefined) {
  return useQuery({
    queryKey: ['tasks', { case_id: caseId }],
    queryFn: () => fetchTasks({ case_id: caseId }),
    enabled: !!caseId,
    staleTime: 30 * 1000, // 30 seconds
    select: (data) => data.data,
  });
}

/**
 * Hook for fetching a single task
 */
export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: ['task', id],
    queryFn: () => fetchTask(id!),
    enabled: !!id,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook for creating a task
 */
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

/**
 * Hook for updating a task
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaskData }) =>
      updateTask(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', id] });
    },
  });
}

/**
 * Hook for deleting a task
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

/**
 * Hook for completing a task
 */
export function useCompleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => updateTask(id, { status: 'completed' }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', id] });
    },
  });
}
