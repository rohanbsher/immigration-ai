import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TaskCard } from './task-card';
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
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock task hooks
const mockCompleteTask = vi.fn();
const mockDeleteTask = vi.fn();

vi.mock('@/hooks/use-tasks', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/use-tasks')>('@/hooks/use-tasks');
  return {
    ...actual,
    useCompleteTask: () => ({
      mutate: mockCompleteTask,
      isPending: false,
    }),
    useDeleteTask: () => ({
      mutate: mockDeleteTask,
      isPending: false,
    }),
  };
});

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
    title: 'Review client documents',
    description: 'Review and verify all submitted documents',
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

describe('TaskCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('full variant (default)', () => {
    test('renders task title', () => {
      render(<TaskCard task={makeTask()} />, { wrapper: createWrapper() });
      expect(screen.getByText('Review client documents')).toBeInTheDocument();
    });

    test('renders task description', () => {
      render(<TaskCard task={makeTask()} />, { wrapper: createWrapper() });
      expect(
        screen.getByText('Review and verify all submitted documents')
      ).toBeInTheDocument();
    });

    test('does not render description when null', () => {
      render(<TaskCard task={makeTask({ description: null })} />, {
        wrapper: createWrapper(),
      });
      expect(
        screen.queryByText('Review and verify all submitted documents')
      ).not.toBeInTheDocument();
    });

    test('renders priority badge', () => {
      render(<TaskCard task={makeTask({ priority: 'high' })} />, {
        wrapper: createWrapper(),
      });
      expect(screen.getByText('High')).toBeInTheDocument();
    });

    test('renders all priority levels', () => {
      const priorities: { priority: TaskPriority; label: string }[] = [
        { priority: 'low', label: 'Low' },
        { priority: 'medium', label: 'Medium' },
        { priority: 'high', label: 'High' },
        { priority: 'urgent', label: 'Urgent' },
      ];

      for (const { priority, label } of priorities) {
        const { unmount } = render(
          <TaskCard task={makeTask({ priority })} />,
          { wrapper: createWrapper() }
        );
        expect(screen.getByText(label)).toBeInTheDocument();
        unmount();
      }
    });

    test('renders due date when present', () => {
      // Use a midday UTC time to avoid timezone-offset date shift
      render(
        <TaskCard task={makeTask({ due_date: '2025-06-15T12:00:00Z' })} />,
        { wrapper: createWrapper() }
      );
      expect(screen.getByText(/Jun 15, 2025/)).toBeInTheDocument();
    });

    test('does not render due date when null', () => {
      render(<TaskCard task={makeTask({ due_date: null })} />, {
        wrapper: createWrapper(),
      });
      expect(screen.queryByText(/Due/)).not.toBeInTheDocument();
    });

    test('shows Overdue text for past due dates on non-completed tasks', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      render(
        <TaskCard
          task={makeTask({
            due_date: pastDate.toISOString(),
            status: 'pending',
          })}
        />,
        { wrapper: createWrapper() }
      );
      expect(screen.getByText(/Overdue:/)).toBeInTheDocument();
    });

    test('does not show Overdue for completed tasks with past due date', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      render(
        <TaskCard
          task={makeTask({
            due_date: pastDate.toISOString(),
            status: 'completed',
          })}
        />,
        { wrapper: createWrapper() }
      );
      expect(screen.queryByText(/Overdue:/)).not.toBeInTheDocument();
    });

    test('renders assignee name when present', () => {
      render(
        <TaskCard
          task={makeTask({
            assignee: {
              id: 'u-2',
              first_name: 'Alice',
              last_name: 'Smith',
              email: 'alice@example.com',
            },
          })}
        />,
        { wrapper: createWrapper() }
      );
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    test('renders case title when showCase is true and case exists', () => {
      render(
        <TaskCard
          task={makeTask({
            case: { id: 'c-1', title: 'Johnson H-1B', visa_type: 'H-1B' },
          })}
          showCase={true}
        />,
        { wrapper: createWrapper() }
      );
      expect(screen.getByText('Johnson H-1B')).toBeInTheDocument();
    });

    test('does not render case title when showCase is false', () => {
      render(
        <TaskCard
          task={makeTask({
            case: { id: 'c-1', title: 'Johnson H-1B', visa_type: 'H-1B' },
          })}
          showCase={false}
        />,
        { wrapper: createWrapper() }
      );
      expect(screen.queryByText('Johnson H-1B')).not.toBeInTheDocument();
    });

    test('renders tags when present', () => {
      render(
        <TaskCard task={makeTask({ tags: ['urgent', 'immigration'] })} />,
        { wrapper: createWrapper() }
      );
      expect(screen.getByText('urgent')).toBeInTheDocument();
      expect(screen.getByText('immigration')).toBeInTheDocument();
    });

    test('checkbox is checked for completed tasks', () => {
      render(
        <TaskCard task={makeTask({ status: 'completed' })} />,
        { wrapper: createWrapper() }
      );
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    test('checkbox is unchecked for pending tasks', () => {
      render(
        <TaskCard task={makeTask({ status: 'pending' })} />,
        { wrapper: createWrapper() }
      );
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();
    });

    test('clicking checkbox calls completeTask', () => {
      render(
        <TaskCard task={makeTask({ status: 'pending' })} />,
        { wrapper: createWrapper() }
      );
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(mockCompleteTask).toHaveBeenCalledWith('task-1', expect.any(Object));
    });

    test('does not call completeTask when task is already completed', () => {
      render(
        <TaskCard task={makeTask({ status: 'completed' })} />,
        { wrapper: createWrapper() }
      );
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeDisabled();
    });

    test('delete button is hidden for completed tasks', () => {
      render(
        <TaskCard task={makeTask({ status: 'completed' })} />,
        { wrapper: createWrapper() }
      );
      // Delete button should not be present for completed tasks
      // Only the checkbox button should exist
      const allButtons = screen.queryAllByRole('button');
      const deleteBtn = allButtons.find(
        (b) => b.className.includes('text-destructive')
      );
      expect(deleteBtn).toBeUndefined();
    });

    test('delete button opens confirmation dialog', () => {
      render(
        <TaskCard task={makeTask({ status: 'pending' })} />,
        { wrapper: createWrapper() }
      );
      const buttons = screen.getAllByRole('button');
      const deleteBtn = buttons.find(
        (b) => b.className.includes('text-destructive')
      );
      expect(deleteBtn).toBeDefined();

      if (deleteBtn) {
        fireEvent.click(deleteBtn);
        expect(screen.getByText('Delete Task')).toBeInTheDocument();
        expect(
          screen.getByText(
            /Are you sure you want to delete "Review client documents"/
          )
        ).toBeInTheDocument();
      }
    });
  });

  describe('compact variant', () => {
    test('renders task title in compact mode', () => {
      render(<TaskCard task={makeTask()} compact />, {
        wrapper: createWrapper(),
      });
      expect(screen.getByText('Review client documents')).toBeInTheDocument();
    });

    test('renders priority badge in compact mode', () => {
      render(<TaskCard task={makeTask({ priority: 'urgent' })} compact />, {
        wrapper: createWrapper(),
      });
      expect(screen.getByText('Urgent')).toBeInTheDocument();
    });

    test('renders due date in compact mode', () => {
      // Use midday UTC to avoid timezone-offset date shift
      render(
        <TaskCard
          task={makeTask({ due_date: '2025-06-15T12:00:00Z' })}
          compact
        />,
        { wrapper: createWrapper() }
      );
      expect(screen.getByText(/Jun 15/)).toBeInTheDocument();
    });

    test('does not render description in compact mode', () => {
      render(<TaskCard task={makeTask()} compact />, {
        wrapper: createWrapper(),
      });
      // Description should not appear in compact mode
      expect(
        screen.queryByText('Review and verify all submitted documents')
      ).not.toBeInTheDocument();
    });

    test('applies overdue styling in compact mode', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      render(
        <TaskCard
          task={makeTask({
            due_date: pastDate.toISOString(),
            status: 'pending',
          })}
          compact
        />,
        { wrapper: createWrapper() }
      );
      // The due date text should have destructive color
      const dueDateText = screen.getByText(/Due/);
      expect(dueDateText.className).toContain('text-destructive');
    });
  });
});
