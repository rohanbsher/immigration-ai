import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClientDashboard } from './client-dashboard';

// Mock fetchWithTimeout
vi.mock('@/lib/api/fetch-with-timeout', () => ({
  fetchWithTimeout: vi.fn(),
}));

// Mock CaseTimeline
vi.mock('./case-timeline', () => ({
  CaseTimeline: ({ currentStatus }: { currentStatus: string }) => (
    <div data-testid="case-timeline" data-status={currentStatus}>
      Case Timeline
    </div>
  ),
}));

// Mock react-query with controlled data
let mockQueryReturn: {
  data: unknown;
  isLoading: boolean;
  error: unknown;
} = { data: undefined, isLoading: true, error: null };

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: () => mockQueryReturn,
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

describe('ClientDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryReturn = { data: undefined, isLoading: true, error: null };
  });

  test('renders loading skeletons while loading', () => {
    mockQueryReturn = { data: undefined, isLoading: true, error: null };

    const { container } = render(<ClientDashboard />, { wrapper: createWrapper() });
    expect(screen.getByText('My Cases')).toBeInTheDocument();
    // Should have skeleton elements (animate-pulse)
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses.length).toBeGreaterThan(0);
  });

  test('renders empty state when no cases', () => {
    mockQueryReturn = { data: [], isLoading: false, error: null };

    render(<ClientDashboard />, { wrapper: createWrapper() });
    expect(screen.getByText('No active cases')).toBeInTheDocument();
    expect(
      screen.getByText("You don't have any immigration cases yet.")
    ).toBeInTheDocument();
  });

  test('renders cases with title and visa type', () => {
    mockQueryReturn = {
      data: [
        {
          id: '1',
          title: 'H-1B Application',
          visaType: 'H1B',
          status: 'document_collection',
          deadline: null,
          createdAt: '2025-01-01T00:00:00Z',
          documentsUploaded: 2,
          documentsRequired: 5,
          formsCompleted: 1,
          formsTotal: 3,
        },
      ],
      isLoading: false,
      error: null,
    };

    render(<ClientDashboard />, { wrapper: createWrapper() });
    expect(screen.getByText('H-1B Application')).toBeInTheDocument();
    expect(screen.getByText('H1B')).toBeInTheDocument();
  });

  test('renders status badge for each case', () => {
    mockQueryReturn = {
      data: [
        {
          id: '1',
          title: 'Test Case',
          visaType: 'H1B',
          status: 'document_collection',
          deadline: null,
          createdAt: '2025-01-01T00:00:00Z',
          documentsUploaded: 0,
          documentsRequired: 0,
          formsCompleted: 0,
          formsTotal: 0,
        },
      ],
      isLoading: false,
      error: null,
    };

    render(<ClientDashboard />, { wrapper: createWrapper() });
    expect(screen.getByText('Collecting Documents')).toBeInTheDocument();
  });

  test('renders deadline when present', () => {
    mockQueryReturn = {
      data: [
        {
          id: '1',
          title: 'Deadline Case',
          visaType: 'H1B',
          status: 'intake',
          deadline: '2025-06-15T00:00:00Z',
          createdAt: '2025-01-01T00:00:00Z',
          documentsUploaded: 0,
          documentsRequired: 0,
          formsCompleted: 0,
          formsTotal: 0,
        },
      ],
      isLoading: false,
      error: null,
    };

    render(<ClientDashboard />, { wrapper: createWrapper() });
    expect(screen.getByText('Deadline')).toBeInTheDocument();
    // date-fns format(new Date('2025-06-15T00:00:00Z'), 'MMM d, yyyy')
    // In some TZs this could be Jun 14 or Jun 15 -- use regex
    expect(screen.getByText(/Jun 1[45], 2025/)).toBeInTheDocument();
  });

  test('does not render deadline section when absent', () => {
    mockQueryReturn = {
      data: [
        {
          id: '1',
          title: 'No Deadline Case',
          visaType: 'H1B',
          status: 'intake',
          deadline: null,
          createdAt: '2025-01-01T00:00:00Z',
          documentsUploaded: 0,
          documentsRequired: 0,
          formsCompleted: 0,
          formsTotal: 0,
        },
      ],
      isLoading: false,
      error: null,
    };

    render(<ClientDashboard />, { wrapper: createWrapper() });
    expect(screen.queryByText('Deadline')).not.toBeInTheDocument();
  });

  test('renders progress bar with correct percentage', () => {
    mockQueryReturn = {
      data: [
        {
          id: '1',
          title: 'Progress Case',
          visaType: 'H1B',
          status: 'form_preparation',
          deadline: null,
          createdAt: '2025-01-01T00:00:00Z',
          documentsUploaded: 0,
          documentsRequired: 0,
          formsCompleted: 0,
          formsTotal: 0,
        },
      ],
      isLoading: false,
      error: null,
    };

    render(<ClientDashboard />, { wrapper: createWrapper() });
    expect(screen.getByText('Overall Progress')).toBeInTheDocument();
    // form_preparation is index 3 out of 9, so 44%
    expect(screen.getByText('44%')).toBeInTheDocument();
  });

  test('renders document and form counts', () => {
    mockQueryReturn = {
      data: [
        {
          id: '1',
          title: 'Count Case',
          visaType: 'H1B',
          status: 'intake',
          deadline: null,
          createdAt: '2025-01-01T00:00:00Z',
          documentsUploaded: 3,
          documentsRequired: 10,
          formsCompleted: 2,
          formsTotal: 5,
        },
      ],
      isLoading: false,
      error: null,
    };

    render(<ClientDashboard />, { wrapper: createWrapper() });
    expect(screen.getByText('3 / 10')).toBeInTheDocument();
    expect(screen.getByText('2 / 5')).toBeInTheDocument();
  });

  test('renders CaseTimeline for each case', () => {
    mockQueryReturn = {
      data: [
        {
          id: 'case-1',
          title: 'Timeline Case',
          visaType: 'H1B',
          status: 'client_review',
          deadline: null,
          createdAt: '2025-01-01T00:00:00Z',
          documentsUploaded: 0,
          documentsRequired: 0,
          formsCompleted: 0,
          formsTotal: 0,
        },
      ],
      isLoading: false,
      error: null,
    };

    render(<ClientDashboard />, { wrapper: createWrapper() });
    expect(screen.getByTestId('case-timeline')).toBeInTheDocument();
    expect(screen.getByTestId('case-timeline')).toHaveAttribute('data-status', 'client_review');
  });

  test('renders multiple cases', () => {
    mockQueryReturn = {
      data: [
        {
          id: '1',
          title: 'First Case',
          visaType: 'H1B',
          status: 'intake',
          deadline: null,
          createdAt: '2025-01-01T00:00:00Z',
          documentsUploaded: 0,
          documentsRequired: 0,
          formsCompleted: 0,
          formsTotal: 0,
        },
        {
          id: '2',
          title: 'Second Case',
          visaType: 'L1',
          status: 'filed',
          deadline: null,
          createdAt: '2025-02-01T00:00:00Z',
          documentsUploaded: 0,
          documentsRequired: 0,
          formsCompleted: 0,
          formsTotal: 0,
        },
      ],
      isLoading: false,
      error: null,
    };

    render(<ClientDashboard />, { wrapper: createWrapper() });
    expect(screen.getByText('First Case')).toBeInTheDocument();
    expect(screen.getByText('Second Case')).toBeInTheDocument();
  });

  test('renders subtitle text when cases are present', () => {
    mockQueryReturn = {
      data: [
        {
          id: '1',
          title: 'Test Case',
          visaType: 'H1B',
          status: 'intake',
          deadline: null,
          createdAt: '2025-01-01T00:00:00Z',
          documentsUploaded: 0,
          documentsRequired: 0,
          formsCompleted: 0,
          formsTotal: 0,
        },
      ],
      isLoading: false,
      error: null,
    };

    render(<ClientDashboard />, { wrapper: createWrapper() });
    expect(
      screen.getByText('Track the progress of your immigration cases')
    ).toBeInTheDocument();
  });
});
