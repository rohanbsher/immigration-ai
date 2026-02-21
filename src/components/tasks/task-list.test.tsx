import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TaskList } from './task-list';
import type { Task, TaskPriority } from '@/hooks/use-tasks';

// Mock logger
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  }),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
    withContext: vi.fn().mockReturnThis(),
  },
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock useTasks hook
let mockUseTasksReturn: {
  data: Task[] | undefined;
  isLoading: boolean;
  error: Error | null;
} = { data: undefined, isLoading: false, error: null };

vi.mock('@/hooks/use-tasks', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/use-tasks')>('@/hooks/use-tasks');
  return {
    ...actual,
    useTasks: () => mockUseTasksReturn,
    useCompleteTask: () => ({ mutate: vi.fn(), isPending: false }),
    useDeleteTask: () => ({ mutate: vi.fn(), isPending: false }),
    useCreateTask: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

// Mock TaskCard
vi.mock('./task-card', () => ({
  TaskCard: ({ task }: { task: Task }) => (
    <div data-testid={`task-card-${task.id}`}>{task.title}</div>
  ),
}));

// Mock CreateTaskDialog
vi.mock('./create-task-dialog', () => ({
  CreateTaskDialog: ({ open }: { open: boolean }) => (
    open ? <div data-testid="create-task-dialog">Create Task Dialog</div> : null
  ),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/dashboard/tasks',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'TestQueryWrapper';
  return Wrapper;
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    case_id: 'case-1',
    firm_id: 'firm-1',
    created_by: 'user-1',
    assigned_to: null,
    title: 'Review documents',
    description: null,
    status: 'pending',
    priority: 'medium' as TaskPriority,
    due_date: null,
    completed_at: null,
    completed_by: null,
    tags: [],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('TaskList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTasksReturn = { data: undefined, isLoading: false, error: null };
  });

  test('renders search input', () => {
    mockUseTasksReturn = { data: [], isLoading: false, error: null };
    render(<TaskList />, { wrapper: createWrapper() });
    expect(screen.getByPlaceholderText('Search tasks...')).toBeInTheDocument();
  });

  test('renders New Task button', () => {
    mockUseTasksReturn = { data: [], isLoading: false, error: null };
    render(<TaskList />, { wrapper: createWrapper() });
    expect(screen.getByText('New Task')).toBeInTheDocument();
  });

  test('renders status tabs', () => {
    mockUseTasksReturn = { data: [], isLoading: false, error: null };
    render(<TaskList />, { wrapper: createWrapper() });
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  test('renders priority filter select', () => {
    mockUseTasksReturn = { data: [], isLoading: false, error: null };
    render(<TaskList />, { wrapper: createWrapper() });
    expect(screen.getByDisplayValue('All Priorities')).toBeInTheDocument();
  });

  test('shows loading spinner while loading', () => {
    mockUseTasksReturn = { data: undefined, isLoading: true, error: null };
    const { container } = render(<TaskList />, { wrapper: createWrapper() });
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  test('shows error state on error', () => {
    mockUseTasksReturn = {
      data: undefined,
      isLoading: false,
      error: new Error('Fetch failed'),
    };
    render(<TaskList />, { wrapper: createWrapper() });
    expect(screen.getByText('Failed to load tasks. Please try again.')).toBeInTheDocument();
  });

  test('shows empty state when no tasks', () => {
    mockUseTasksReturn = { data: [], isLoading: false, error: null };
    render(<TaskList />, { wrapper: createWrapper() });
    expect(screen.getByText('No tasks found')).toBeInTheDocument();
    expect(screen.getByText('Create your first task')).toBeInTheDocument();
  });

  test('renders task cards when tasks exist', () => {
    mockUseTasksReturn = {
      data: [
        makeTask({ id: 'task-1', title: 'First task' }),
        makeTask({ id: 'task-2', title: 'Second task' }),
      ],
      isLoading: false,
      error: null,
    };
    render(<TaskList />, { wrapper: createWrapper() });
    expect(screen.getByText('First task')).toBeInTheDocument();
    expect(screen.getByText('Second task')).toBeInTheDocument();
  });

  test('opens create task dialog on New Task click', () => {
    mockUseTasksReturn = { data: [], isLoading: false, error: null };
    render(<TaskList />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByText('New Task'));
    expect(screen.getByTestId('create-task-dialog')).toBeInTheDocument();
  });

  test('opens create task dialog on "Create your first task" click', () => {
    mockUseTasksReturn = { data: [], isLoading: false, error: null };
    render(<TaskList />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByText('Create your first task'));
    expect(screen.getByTestId('create-task-dialog')).toBeInTheDocument();
  });

  test('renders correct task counts per status tab', () => {
    mockUseTasksReturn = {
      data: [
        makeTask({ id: '1', status: 'pending' }),
        makeTask({ id: '2', status: 'pending' }),
        makeTask({ id: '3', status: 'in_progress' }),
        makeTask({ id: '4', status: 'completed' }),
      ],
      isLoading: false,
      error: null,
    };
    render(<TaskList />, { wrapper: createWrapper() });

    // "All" tab shows total count
    const allBadges = screen.getAllByText('4');
    expect(allBadges.length).toBeGreaterThan(0);
  });

  test('allows typing in search input', () => {
    mockUseTasksReturn = { data: [], isLoading: false, error: null };
    render(<TaskList />, { wrapper: createWrapper() });
    const input = screen.getByPlaceholderText('Search tasks...');
    fireEvent.change(input, { target: { value: 'review' } });
    expect(input).toHaveValue('review');
  });

  test('allows changing priority filter', () => {
    mockUseTasksReturn = { data: [], isLoading: false, error: null };
    render(<TaskList />, { wrapper: createWrapper() });
    const select = screen.getByDisplayValue('All Priorities');
    fireEvent.change(select, { target: { value: 'urgent' } });
    expect(select).toHaveValue('urgent');
  });
});
