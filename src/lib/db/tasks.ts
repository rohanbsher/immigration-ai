import { BaseService, sanitizeSearchInput } from './base-service';

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
  deleted_at: string | null;
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

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
}

export interface CreateTaskData {
  case_id?: string;
  firm_id?: string;
  created_by: string;
  assigned_to?: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  due_date?: string;
  tags?: string[];
}

export interface UpdateTaskData {
  assigned_to?: string | null;
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
  tags?: string[];
  completed_at?: string | null;
  completed_by?: string | null;
}

export interface TaskFilters {
  case_id?: string;
  assigned_to?: string;
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  due_before?: string;
  search?: string;
}

// Common select statement for tasks with relations
const TASK_SELECT = `
  *,
  creator:profiles!created_by (
    id,
    first_name,
    last_name,
    email
  ),
  assignee:profiles!assigned_to (
    id,
    first_name,
    last_name,
    email
  ),
  case:cases!case_id (
    id,
    title,
    visa_type
  )
`;

class TasksService extends BaseService {
  constructor() {
    super('tasks');
  }

  /**
   * Get tasks with optional filters
   */
  async getTasks(userId: string, filters: TaskFilters = {}): Promise<Task[]> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      let query = supabase
        .from('tasks')
        .select(TASK_SELECT)
        .is('deleted_at', null)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.case_id) {
        query = query.eq('case_id', filters.case_id);
      }

      if (filters.assigned_to) {
        query = query.eq('assigned_to', filters.assigned_to);
      }

      if (filters.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status);
        } else {
          query = query.eq('status', filters.status);
        }
      }

      if (filters.priority) {
        if (Array.isArray(filters.priority)) {
          query = query.in('priority', filters.priority);
        } else {
          query = query.eq('priority', filters.priority);
        }
      }

      if (filters.due_before) {
        query = query.lte('due_date', filters.due_before);
      }

      if (filters.search) {
        const search = sanitizeSearchInput(filters.search);
        if (search.length > 0) {
          query = query.ilike('title', `%${search}%`);
        }
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data as Task[];
    }, 'getTasks', { userId, filters });
  }

  /**
   * Get tasks for a specific case
   */
  async getTasksByCase(caseId: string): Promise<Task[]> {
    return this.getTasks('', { case_id: caseId });
  }

  /**
   * Get tasks assigned to a user
   */
  async getMyTasks(userId: string): Promise<Task[]> {
    return this.getTasks(userId, { assigned_to: userId });
  }

  /**
   * Get a single task
   */
  async getTask(id: string): Promise<Task | null> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data, error } = await supabase
        .from('tasks')
        .select(TASK_SELECT)
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return data as Task;
    }, 'getTask', { taskId: id });
  }

  /**
   * Create a new task
   */
  async createTask(data: CreateTaskData): Promise<Task> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data: task, error } = await supabase
        .from('tasks')
        .insert({
          ...data,
          priority: data.priority || 'medium',
          tags: data.tags || [],
        })
        .select(TASK_SELECT)
        .single();

      if (error) {
        throw error;
      }

      return task as Task;
    }, 'createTask', { title: data.title, caseId: data.case_id });
  }

  /**
   * Update a task
   */
  async updateTask(id: string, data: UpdateTaskData): Promise<Task> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data: task, error } = await supabase
        .from('tasks')
        .update(data)
        .eq('id', id)
        .select(TASK_SELECT)
        .single();

      if (error) {
        throw error;
      }

      return task as Task;
    }, 'updateTask', { taskId: id });
  }

  /**
   * Mark a task as complete
   */
  async completeTask(id: string, userId: string): Promise<Task> {
    return this.updateTask(id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by: userId,
    });
  }

  /**
   * Soft delete a task
   */
  async deleteTask(id: string): Promise<void> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { error } = await supabase
        .from('tasks')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        throw error;
      }
    }, 'deleteTask', { taskId: id });
  }

  /**
   * Get comments for a task
   */
  async getComments(taskId: string): Promise<TaskComment[]> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data, error } = await supabase
        .from('task_comments')
        .select(`
          *,
          user:profiles!user_id (
            id,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('task_id', taskId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      return data as TaskComment[];
    }, 'getComments', { taskId });
  }

  /**
   * Add a comment to a task
   */
  async addComment(taskId: string, userId: string, content: string): Promise<TaskComment> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data: comment, error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          user_id: userId,
          content,
        })
        .select(`
          *,
          user:profiles!user_id (
            id,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .single();

      if (error) {
        throw error;
      }

      return comment as TaskComment;
    }, 'addComment', { taskId, userId });
  }

  /**
   * Get count of pending tasks for a user
   */
  async getPendingCount(userId: string): Promise<number> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { count, error } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', userId)
        .in('status', ['pending', 'in_progress'])
        .is('deleted_at', null);

      if (error) {
        // Return 0 on error instead of throwing (graceful degradation)
        return 0;
      }

      return count || 0;
    }, 'getPendingCount', { userId });
  }

  /**
   * Get upcoming tasks (due within a week)
   */
  async getUpcomingTasks(userId: string, days = 7): Promise<Task[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return this.getTasks(userId, {
      assigned_to: userId,
      status: ['pending', 'in_progress'],
      due_before: futureDate.toISOString().split('T')[0],
    });
  }
}

// Export singleton instance
export const tasksService = new TasksService();
