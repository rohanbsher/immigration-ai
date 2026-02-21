import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CreateTaskDialog } from './create-task-dialog';

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

// Mock useCreateTask
const mockCreateTask = vi.fn();
const mockUseCreateTask = vi.fn();

vi.mock('@/hooks/use-tasks', () => ({
  useCreateTask: (...args: unknown[]) => mockUseCreateTask(...args),
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

function submitForm() {
  const form = document.querySelector('form');
  if (form) {
    fireEvent.submit(form);
  }
}

describe('CreateTaskDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCreateTask.mockReturnValue({
      mutate: mockCreateTask,
      isPending: false,
    });
  });

  test('renders dialog with title and description when open', () => {
    render(<CreateTaskDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText('Create New Task')).toBeInTheDocument();
    expect(
      screen.getByText('Create a task to track work that needs to be done.')
    ).toBeInTheDocument();
  });

  test('renders form fields: title, description, priority, due date', () => {
    render(<CreateTaskDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByLabelText(/Task Title/)).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Priority')).toBeInTheDocument();
    expect(screen.getByLabelText('Due Date')).toBeInTheDocument();
  });

  test('renders Cancel and Create Task buttons', () => {
    render(<CreateTaskDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });
    expect(
      screen.getByRole('button', { name: /Cancel/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Create Task/i })
    ).toBeInTheDocument();
  });

  test('Cancel button calls onOpenChange(false)', () => {
    const onOpenChange = vi.fn();
    render(<CreateTaskDialog open={true} onOpenChange={onOpenChange} />, {
      wrapper: createWrapper(),
    });
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test('shows error toast when submitting without title', () => {
    render(<CreateTaskDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });
    submitForm();
    expect(toast.error).toHaveBeenCalledWith('Title is required');
    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  test('calls createTask with form data on valid submission', () => {
    render(<CreateTaskDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    // Fill in form fields
    fireEvent.change(screen.getByLabelText(/Task Title/), {
      target: { value: 'Review documents' },
    });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Review all uploaded docs' },
    });

    submitForm();

    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Review documents',
        description: 'Review all uploaded docs',
        priority: 'medium', // default
      }),
      expect.any(Object)
    );
  });

  test('passes caseId to createTask when provided', () => {
    render(<CreateTaskDialog {...defaultProps} caseId="case-42" />, {
      wrapper: createWrapper(),
    });

    fireEvent.change(screen.getByLabelText(/Task Title/), {
      target: { value: 'File petition' },
    });

    submitForm();

    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'File petition',
        case_id: 'case-42',
      }),
      expect.any(Object)
    );
  });

  test('shows Creating... button text when isPending', () => {
    mockUseCreateTask.mockReturnValue({
      mutate: mockCreateTask,
      isPending: true,
    });

    render(<CreateTaskDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText('Creating...')).toBeInTheDocument();
  });

  test('disables buttons when isPending', () => {
    mockUseCreateTask.mockReturnValue({
      mutate: mockCreateTask,
      isPending: true,
    });

    render(<CreateTaskDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });
    expect(
      screen.getByRole('button', { name: /Cancel/i })
    ).toBeDisabled();
    // The submit button contains "Creating..." when pending
    const submitBtn = screen.getByText('Creating...').closest('button');
    expect(submitBtn).toBeDisabled();
  });

  test('priority select has all options', () => {
    render(<CreateTaskDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    const select = screen.getByLabelText('Priority') as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.text);
    expect(options).toEqual(['Low', 'Medium', 'High', 'Urgent']);
  });

  test('default priority is medium', () => {
    render(<CreateTaskDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    const select = screen.getByLabelText('Priority') as HTMLSelectElement;
    expect(select.value).toBe('medium');
  });

  test('changing priority updates form state', () => {
    render(<CreateTaskDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    const select = screen.getByLabelText('Priority');
    fireEvent.change(select, { target: { value: 'urgent' } });

    fireEvent.change(screen.getByLabelText(/Task Title/), {
      target: { value: 'Urgent task' },
    });

    submitForm();

    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        priority: 'urgent',
      }),
      expect.any(Object)
    );
  });

  test('submitting with due date includes it in payload', () => {
    render(<CreateTaskDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    fireEvent.change(screen.getByLabelText(/Task Title/), {
      target: { value: 'Task with deadline' },
    });
    fireEvent.change(screen.getByLabelText('Due Date'), {
      target: { value: '2025-12-31' },
    });

    submitForm();

    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        due_date: '2025-12-31',
      }),
      expect.any(Object)
    );
  });

  test('submitting without due date sends undefined', () => {
    render(<CreateTaskDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    fireEvent.change(screen.getByLabelText(/Task Title/), {
      target: { value: 'No deadline task' },
    });

    submitForm();

    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        due_date: undefined,
      }),
      expect.any(Object)
    );
  });

  test('placeholder text is shown in title input', () => {
    render(<CreateTaskDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });
    expect(
      screen.getByPlaceholderText('e.g., Review client documents')
    ).toBeInTheDocument();
  });

  test('placeholder text is shown in description textarea', () => {
    render(<CreateTaskDialog {...defaultProps} />, {
      wrapper: createWrapper(),
    });
    expect(
      screen.getByPlaceholderText('Add details about this task...')
    ).toBeInTheDocument();
  });
});
