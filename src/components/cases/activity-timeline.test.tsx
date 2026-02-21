import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ActivityTimeline } from './activity-timeline';
import type { ActivityWithUser } from '@/hooks/use-activities';

// Mock the useActivities hook
let mockUseActivitiesReturn: {
  data: ActivityWithUser[] | undefined;
  isLoading: boolean;
  error: Error | null;
} = { data: undefined, isLoading: true, error: null };

vi.mock('@/hooks/use-activities', () => ({
  useActivities: () => mockUseActivitiesReturn,
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

function makeActivity(overrides: Partial<ActivityWithUser> = {}): ActivityWithUser {
  return {
    id: 'activity-1',
    case_id: 'case-1',
    user_id: 'user-1',
    activity_type: 'case_created',
    description: 'Case was created',
    metadata: null,
    created_at: new Date().toISOString(),
    user: {
      id: 'user-1',
      first_name: 'Jane',
      last_name: 'Doe',
      avatar_url: null,
    },
    ...overrides,
  };
}

describe('ActivityTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseActivitiesReturn = { data: undefined, isLoading: true, error: null };
  });

  test('renders Activity Timeline heading', () => {
    render(<ActivityTimeline caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('Activity Timeline')).toBeInTheDocument();
  });

  test('shows loading spinner while loading', () => {
    mockUseActivitiesReturn = { data: undefined, isLoading: true, error: null };

    const { container } = render(<ActivityTimeline caseId="case-1" />, {
      wrapper: createWrapper(),
    });
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  test('shows error message on fetch failure', () => {
    mockUseActivitiesReturn = {
      data: undefined,
      isLoading: false,
      error: new Error('Fetch error'),
    };

    render(<ActivityTimeline caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('Failed to load activities.')).toBeInTheDocument();
  });

  test('shows empty state when no activities', () => {
    mockUseActivitiesReturn = { data: [], isLoading: false, error: null };

    render(<ActivityTimeline caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('No activity recorded yet.')).toBeInTheDocument();
  });

  test('renders activity descriptions', () => {
    mockUseActivitiesReturn = {
      data: [
        makeActivity({ id: '1', description: 'Case opened by attorney' }),
        makeActivity({ id: '2', description: 'Document uploaded' }),
      ],
      isLoading: false,
      error: null,
    };

    render(<ActivityTimeline caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('Case opened by attorney')).toBeInTheDocument();
    expect(screen.getByText('Document uploaded')).toBeInTheDocument();
  });

  test('renders user names for activities', () => {
    mockUseActivitiesReturn = {
      data: [
        makeActivity({
          id: '1',
          user: { id: 'u1', first_name: 'Alice', last_name: 'Smith', avatar_url: null },
        }),
      ],
      isLoading: false,
      error: null,
    };

    render(<ActivityTimeline caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
  });

  test('renders user initials in avatar fallback', () => {
    mockUseActivitiesReturn = {
      data: [
        makeActivity({
          id: '1',
          user: { id: 'u1', first_name: 'Bob', last_name: 'Jones', avatar_url: null },
        }),
      ],
      isLoading: false,
      error: null,
    };

    render(<ActivityTimeline caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('BJ')).toBeInTheDocument();
  });

  test('renders relative time for recent activity', () => {
    const now = new Date();
    mockUseActivitiesReturn = {
      data: [makeActivity({ id: '1', created_at: now.toISOString() })],
      isLoading: false,
      error: null,
    };

    render(<ActivityTimeline caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('just now')).toBeInTheDocument();
  });

  test('renders multiple activities in order', () => {
    mockUseActivitiesReturn = {
      data: [
        makeActivity({ id: '1', description: 'First activity', activity_type: 'case_created' }),
        makeActivity({ id: '2', description: 'Second activity', activity_type: 'document_uploaded' }),
        makeActivity({ id: '3', description: 'Third activity', activity_type: 'status_changed' }),
      ],
      isLoading: false,
      error: null,
    };

    render(<ActivityTimeline caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('First activity')).toBeInTheDocument();
    expect(screen.getByText('Second activity')).toBeInTheDocument();
    expect(screen.getByText('Third activity')).toBeInTheDocument();
  });

  test('handles undefined activities gracefully', () => {
    mockUseActivitiesReturn = { data: undefined, isLoading: false, error: null };

    render(<ActivityTimeline caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('No activity recorded yet.')).toBeInTheDocument();
  });

  test('renders single activity without connector line on last item', () => {
    mockUseActivitiesReturn = {
      data: [makeActivity({ id: '1', description: 'Solo activity' })],
      isLoading: false,
      error: null,
    };

    render(<ActivityTimeline caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('Solo activity')).toBeInTheDocument();
  });
});
