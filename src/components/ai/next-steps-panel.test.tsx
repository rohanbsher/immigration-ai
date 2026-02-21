import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextStepsPanel } from './next-steps-panel';
import type { Recommendation } from '@/lib/db/recommendations';

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

// Mock the hooks
const mockUseRecommendations = vi.fn();
const mockCompleteRecommendation = vi.fn();
const mockDismissRecommendation = vi.fn();
const mockUseUpdateRecommendation = vi.fn();

vi.mock('@/hooks/use-recommendations', () => ({
  useRecommendations: (...args: unknown[]) => mockUseRecommendations(...args),
  useUpdateRecommendation: (...args: unknown[]) => mockUseUpdateRecommendation(...args),
  getPriorityColors: (priority: string) => {
    switch (priority) {
      case 'high':
        return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' };
      case 'medium':
        return { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500' };
      case 'low':
        return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' };
      default:
        return { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', dot: 'bg-gray-500' };
    }
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function makeRecommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    id: 'rec-1',
    priority: 'medium',
    action: 'Upload passport copy',
    reason: 'A valid passport is required for filing',
    category: 'document',
    ...overrides,
  };
}

describe('NextStepsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUpdateRecommendation.mockReturnValue({
      completeRecommendation: mockCompleteRecommendation,
      dismissRecommendation: mockDismissRecommendation,
      isUpdating: false,
    });
  });

  describe('loading state', () => {
    test('renders loading indicator when data is loading', () => {
      mockUseRecommendations.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
        forceRefresh: vi.fn(),
      });

      render(<NextStepsPanel caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Analyzing case')).toBeInTheDocument();
    });
  });

  describe('error / degraded state', () => {
    test('renders empty state when there is an error', () => {
      mockUseRecommendations.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Network error'),
        refetch: vi.fn(),
        forceRefresh: vi.fn(),
      });

      render(<NextStepsPanel caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('No recommendations yet')).toBeInTheDocument();
      expect(screen.getByText('Upload documents or add forms to get AI-powered suggestions.')).toBeInTheDocument();
    });

    test('renders empty state when data is null', () => {
      mockUseRecommendations.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        forceRefresh: vi.fn(),
      });

      render(<NextStepsPanel caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('No recommendations yet')).toBeInTheDocument();
    });

    test('renders empty state when data has degraded flag', () => {
      mockUseRecommendations.mockReturnValue({
        data: { recommendations: [], degraded: true },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        forceRefresh: vi.fn(),
      });

      render(<NextStepsPanel caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('No recommendations yet')).toBeInTheDocument();
    });

    test('renders empty state when recommendations array is empty', () => {
      mockUseRecommendations.mockReturnValue({
        data: { recommendations: [], source: 'ai', generatedAt: new Date().toISOString() },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        forceRefresh: vi.fn(),
      });

      render(<NextStepsPanel caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('No recommendations yet')).toBeInTheDocument();
    });

    test('empty state has Check again button that calls refetch', () => {
      const mockRefetch = vi.fn();
      mockUseRecommendations.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
        forceRefresh: vi.fn(),
      });

      render(<NextStepsPanel caseId="case-1" />, { wrapper: createWrapper() });
      fireEvent.click(screen.getByRole('button', { name: /Check again/i }));
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('mini variant', () => {
    test('shows count badge with total recommendations count', () => {
      mockUseRecommendations.mockReturnValue({
        data: {
          recommendations: [
            makeRecommendation({ id: 'r1', priority: 'high' }),
            makeRecommendation({ id: 'r2', priority: 'medium' }),
            makeRecommendation({ id: 'r3', priority: 'low' }),
          ],
          source: 'ai',
          generatedAt: new Date().toISOString(),
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        forceRefresh: vi.fn(),
      });

      render(<NextStepsPanel caseId="case-1" variant="mini" />, { wrapper: createWrapper() });
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  describe('compact variant', () => {
    test('renders Next Steps heading', () => {
      mockUseRecommendations.mockReturnValue({
        data: {
          recommendations: [makeRecommendation()],
          source: 'ai',
          generatedAt: new Date().toISOString(),
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        forceRefresh: vi.fn(),
      });

      render(<NextStepsPanel caseId="case-1" variant="compact" />, { wrapper: createWrapper() });
      expect(screen.getByText('Next Steps')).toBeInTheDocument();
    });

    test('renders recommendation actions in compact mode', () => {
      mockUseRecommendations.mockReturnValue({
        data: {
          recommendations: [
            makeRecommendation({ id: 'r1', action: 'Upload tax returns' }),
            makeRecommendation({ id: 'r2', action: 'Review I-485 form' }),
          ],
          source: 'ai',
          generatedAt: new Date().toISOString(),
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        forceRefresh: vi.fn(),
      });

      render(<NextStepsPanel caseId="case-1" variant="compact" />, { wrapper: createWrapper() });
      expect(screen.getByText('Upload tax returns')).toBeInTheDocument();
      expect(screen.getByText('Review I-485 form')).toBeInTheDocument();
    });

    test('shows View all link when recommendations exceed maxItems', () => {
      const recs = Array.from({ length: 8 }, (_, i) =>
        makeRecommendation({ id: `r-${i}`, action: `Action ${i}` })
      );

      mockUseRecommendations.mockReturnValue({
        data: {
          recommendations: recs,
          source: 'ai',
          generatedAt: new Date().toISOString(),
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        forceRefresh: vi.fn(),
      });

      render(<NextStepsPanel caseId="case-1" variant="compact" maxItems={5} />, {
        wrapper: createWrapper(),
      });
      expect(screen.getByText('View all 8 recommendations')).toBeInTheDocument();
    });
  });

  describe('full variant', () => {
    test('renders Recommended Next Steps title', () => {
      mockUseRecommendations.mockReturnValue({
        data: {
          recommendations: [makeRecommendation()],
          source: 'ai',
          generatedAt: new Date().toISOString(),
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        forceRefresh: vi.fn(),
      });

      render(<NextStepsPanel caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Recommended Next Steps')).toBeInTheDocument();
    });

    test('renders recommendation actions with reason', () => {
      mockUseRecommendations.mockReturnValue({
        data: {
          recommendations: [
            makeRecommendation({
              id: 'r1',
              action: 'Submit I-130 petition',
              reason: 'The petition form is complete and ready for filing',
            }),
          ],
          source: 'ai',
          generatedAt: new Date().toISOString(),
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        forceRefresh: vi.fn(),
      });

      render(<NextStepsPanel caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Submit I-130 petition')).toBeInTheDocument();
      expect(screen.getByText('The petition form is complete and ready for filing')).toBeInTheDocument();
    });

    test('renders Done and Skip buttons for each recommendation', () => {
      mockUseRecommendations.mockReturnValue({
        data: {
          recommendations: [makeRecommendation({ id: 'r1' })],
          source: 'ai',
          generatedAt: new Date().toISOString(),
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        forceRefresh: vi.fn(),
      });

      render(<NextStepsPanel caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByRole('button', { name: /Done/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Skip/i })).toBeInTheDocument();
    });

    test('Done button calls completeRecommendation', () => {
      mockUseRecommendations.mockReturnValue({
        data: {
          recommendations: [makeRecommendation({ id: 'r1' })],
          source: 'ai',
          generatedAt: new Date().toISOString(),
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        forceRefresh: vi.fn(),
      });

      render(<NextStepsPanel caseId="case-1" />, { wrapper: createWrapper() });
      fireEvent.click(screen.getByRole('button', { name: /Done/i }));
      expect(mockCompleteRecommendation).toHaveBeenCalledWith('r1');
    });

    test('Skip button calls dismissRecommendation', () => {
      mockUseRecommendations.mockReturnValue({
        data: {
          recommendations: [makeRecommendation({ id: 'r1' })],
          source: 'ai',
          generatedAt: new Date().toISOString(),
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        forceRefresh: vi.fn(),
      });

      render(<NextStepsPanel caseId="case-1" />, { wrapper: createWrapper() });
      fireEvent.click(screen.getByRole('button', { name: /Skip/i }));
      expect(mockDismissRecommendation).toHaveBeenCalledWith('r1');
    });

    test('renders Refresh button when showRefresh is true', () => {
      const mockForceRefresh = vi.fn();
      mockUseRecommendations.mockReturnValue({
        data: {
          recommendations: [makeRecommendation()],
          source: 'ai',
          generatedAt: new Date().toISOString(),
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        forceRefresh: mockForceRefresh,
      });

      render(<NextStepsPanel caseId="case-1" showRefresh />, { wrapper: createWrapper() });
      const refreshBtn = screen.getByRole('button', { name: /Refresh/i });
      expect(refreshBtn).toBeInTheDocument();
      fireEvent.click(refreshBtn);
      expect(mockForceRefresh).toHaveBeenCalledTimes(1);
    });

    test('shows View all link when recommendations exceed maxItems', () => {
      const recs = Array.from({ length: 10 }, (_, i) =>
        makeRecommendation({ id: `r-${i}`, action: `Action ${i}` })
      );

      mockUseRecommendations.mockReturnValue({
        data: {
          recommendations: recs,
          source: 'ai',
          generatedAt: new Date().toISOString(),
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        forceRefresh: vi.fn(),
      });

      render(<NextStepsPanel caseId="case-1" maxItems={5} />, { wrapper: createWrapper() });
      expect(screen.getByText('View all 10 recommendations')).toBeInTheDocument();
    });

    test('does not show View all link when recommendations are within maxItems', () => {
      mockUseRecommendations.mockReturnValue({
        data: {
          recommendations: [
            makeRecommendation({ id: 'r1' }),
            makeRecommendation({ id: 'r2' }),
          ],
          source: 'ai',
          generatedAt: new Date().toISOString(),
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        forceRefresh: vi.fn(),
      });

      render(<NextStepsPanel caseId="case-1" maxItems={5} />, { wrapper: createWrapper() });
      expect(screen.queryByText(/View all/)).not.toBeInTheDocument();
    });

    test('shows cached timestamp when source is cache', () => {
      const generatedAt = new Date().toISOString();
      mockUseRecommendations.mockReturnValue({
        data: {
          recommendations: [makeRecommendation()],
          source: 'cache',
          generatedAt,
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        forceRefresh: vi.fn(),
      });

      render(<NextStepsPanel caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText(/Updated/)).toBeInTheDocument();
    });
  });
});
