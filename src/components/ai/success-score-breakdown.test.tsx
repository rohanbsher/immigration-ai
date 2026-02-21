import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SuccessScoreBreakdown } from './success-score-breakdown';
import type { SuccessScore, ScoringFactor } from '@/lib/ai/success-probability';

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

// Mock the hook
const mockUseSuccessScore = vi.fn();
vi.mock('@/hooks/use-success-score', () => ({
  useSuccessScore: (...args: unknown[]) => mockUseSuccessScore(...args),
  getSuccessScoreColors: (score: number) => {
    if (score >= 80) return { bg: 'bg-success/10', text: 'text-success', border: 'border-success', gradient: 'from-success' };
    if (score >= 60) return { bg: 'bg-info/10', text: 'text-info', border: 'border-info', gradient: 'from-info' };
    if (score >= 40) return { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning', gradient: 'from-warning' };
    return { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive', gradient: 'from-destructive' };
  },
  getSuccessScoreLabel: (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Work';
  },
  getFactorStatusInfo: (status: string) => {
    switch (status) {
      case 'good':
        return { icon: 'check', color: 'text-success', bgColor: 'bg-success/10' };
      case 'warning':
        return { icon: 'alert', color: 'text-warning', bgColor: 'bg-warning/10' };
      case 'poor':
        return { icon: 'x', color: 'text-destructive', bgColor: 'bg-destructive/10' };
      default:
        return { icon: 'check', color: 'text-muted', bgColor: 'bg-muted' };
    }
  },
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

function makeFactor(overrides: Partial<ScoringFactor> = {}): ScoringFactor {
  return {
    name: 'Document Completeness',
    description: 'Percentage of required documents uploaded',
    score: 80,
    weight: 0.3,
    weightedScore: 24,
    status: 'good',
    ...overrides,
  };
}

function makeSuccessScore(overrides: Partial<SuccessScore> = {}): SuccessScore {
  return {
    overallScore: 72,
    confidence: 0.85,
    factors: [
      makeFactor({ name: 'Document Completeness', score: 80, status: 'good' }),
      makeFactor({ name: 'Form Quality', score: 65, status: 'warning' }),
    ],
    riskFactors: [],
    improvements: [],
    calculatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('SuccessScoreBreakdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    test('renders loading indicator when data is loading', () => {
      mockUseSuccessScore.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      render(<SuccessScoreBreakdown caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Calculating score')).toBeInTheDocument();
    });
  });

  describe('error / degraded state', () => {
    test('renders degraded fallback when there is an error', () => {
      mockUseSuccessScore.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Network error'),
      });

      render(<SuccessScoreBreakdown caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Success Score')).toBeInTheDocument();
      expect(screen.getByText('Upload documents and create forms to see your success probability.')).toBeInTheDocument();
    });

    test('renders degraded fallback when data is null', () => {
      mockUseSuccessScore.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      render(<SuccessScoreBreakdown caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Upload documents and create forms to see your success probability.')).toBeInTheDocument();
    });

    test('renders degraded fallback when data has degraded flag', () => {
      mockUseSuccessScore.mockReturnValue({
        data: { ...makeSuccessScore(), degraded: true },
        isLoading: false,
        error: null,
      });

      render(<SuccessScoreBreakdown caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Upload documents and create forms to see your success probability.')).toBeInTheDocument();
    });

    test('renders degraded fallback when overallScore is not a number', () => {
      mockUseSuccessScore.mockReturnValue({
        data: { ...makeSuccessScore(), overallScore: undefined },
        isLoading: false,
        error: null,
      });

      render(<SuccessScoreBreakdown caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Upload documents and create forms to see your success probability.')).toBeInTheDocument();
    });
  });

  describe('full variant', () => {
    test('renders overall score percentage', () => {
      mockUseSuccessScore.mockReturnValue({
        data: makeSuccessScore({ overallScore: 72 }),
        isLoading: false,
        error: null,
      });

      render(<SuccessScoreBreakdown caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('72%')).toBeInTheDocument();
    });

    test('renders score label for Good score (60-79)', () => {
      mockUseSuccessScore.mockReturnValue({
        data: makeSuccessScore({ overallScore: 72 }),
        isLoading: false,
        error: null,
      });

      render(<SuccessScoreBreakdown caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Good')).toBeInTheDocument();
    });

    test('renders Excellent label for high score (80+)', () => {
      mockUseSuccessScore.mockReturnValue({
        data: makeSuccessScore({ overallScore: 85 }),
        isLoading: false,
        error: null,
      });

      render(<SuccessScoreBreakdown caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Excellent')).toBeInTheDocument();
    });

    test('renders Needs Work label for low score (<40)', () => {
      mockUseSuccessScore.mockReturnValue({
        data: makeSuccessScore({ overallScore: 25 }),
        isLoading: false,
        error: null,
      });

      render(<SuccessScoreBreakdown caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Needs Work')).toBeInTheDocument();
    });

    test('renders Fair label for mid-range score (40-59)', () => {
      mockUseSuccessScore.mockReturnValue({
        data: makeSuccessScore({ overallScore: 45 }),
        isLoading: false,
        error: null,
      });

      render(<SuccessScoreBreakdown caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Fair')).toBeInTheDocument();
    });

    test('renders confidence percentage', () => {
      mockUseSuccessScore.mockReturnValue({
        data: makeSuccessScore({ confidence: 0.85 }),
        isLoading: false,
        error: null,
      });

      render(<SuccessScoreBreakdown caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Confidence: 85%')).toBeInTheDocument();
    });

    test('renders factors count', () => {
      mockUseSuccessScore.mockReturnValue({
        data: makeSuccessScore({
          factors: [
            makeFactor({ name: 'Factor 1' }),
            makeFactor({ name: 'Factor 2' }),
            makeFactor({ name: 'Factor 3' }),
          ],
        }),
        isLoading: false,
        error: null,
      });

      render(<SuccessScoreBreakdown caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Based on 3 scoring factors')).toBeInTheDocument();
    });

    test('renders Scoring Factors heading', () => {
      mockUseSuccessScore.mockReturnValue({
        data: makeSuccessScore(),
        isLoading: false,
        error: null,
      });

      render(<SuccessScoreBreakdown caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Scoring Factors')).toBeInTheDocument();
    });

    test('renders individual factor names and scores', () => {
      mockUseSuccessScore.mockReturnValue({
        data: makeSuccessScore({
          factors: [
            makeFactor({ name: 'Document Completeness', score: 80 }),
            makeFactor({ name: 'Form Quality', score: 65 }),
          ],
        }),
        isLoading: false,
        error: null,
      });

      render(<SuccessScoreBreakdown caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Document Completeness')).toBeInTheDocument();
      expect(screen.getByText('Form Quality')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
      expect(screen.getByText('65%')).toBeInTheDocument();
    });

    test('renders risk factors when present', () => {
      mockUseSuccessScore.mockReturnValue({
        data: makeSuccessScore({
          riskFactors: [
            'Missing passport copy',
            'Incomplete I-485 form',
          ],
        }),
        isLoading: false,
        error: null,
      });

      render(<SuccessScoreBreakdown caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText(/Risk Factors/)).toBeInTheDocument();
      expect(screen.getByText('Missing passport copy')).toBeInTheDocument();
      expect(screen.getByText('Incomplete I-485 form')).toBeInTheDocument();
    });

    test('does not render risk factors section when empty', () => {
      mockUseSuccessScore.mockReturnValue({
        data: makeSuccessScore({ riskFactors: [] }),
        isLoading: false,
        error: null,
      });

      render(<SuccessScoreBreakdown caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.queryByText(/Risk Factors/)).not.toBeInTheDocument();
    });

    test('renders improvement suggestions when showImprovements is true', () => {
      mockUseSuccessScore.mockReturnValue({
        data: makeSuccessScore({
          improvements: [
            'Upload tax returns for last 3 years',
            'Complete employment verification letter',
          ],
        }),
        isLoading: false,
        error: null,
      });

      render(<SuccessScoreBreakdown caseId="case-1" showImprovements />, {
        wrapper: createWrapper(),
      });
      expect(screen.getByText('How to Improve')).toBeInTheDocument();
      expect(screen.getByText('Upload tax returns for last 3 years')).toBeInTheDocument();
      expect(screen.getByText('Complete employment verification letter')).toBeInTheDocument();
    });

    test('does not render improvements when showImprovements is false', () => {
      mockUseSuccessScore.mockReturnValue({
        data: makeSuccessScore({
          improvements: ['Upload tax returns'],
        }),
        isLoading: false,
        error: null,
      });

      render(<SuccessScoreBreakdown caseId="case-1" showImprovements={false} />, {
        wrapper: createWrapper(),
      });
      expect(screen.queryByText('How to Improve')).not.toBeInTheDocument();
    });

    test('does not render improvements section when list is empty', () => {
      mockUseSuccessScore.mockReturnValue({
        data: makeSuccessScore({ improvements: [] }),
        isLoading: false,
        error: null,
      });

      render(<SuccessScoreBreakdown caseId="case-1" showImprovements />, {
        wrapper: createWrapper(),
      });
      expect(screen.queryByText('How to Improve')).not.toBeInTheDocument();
    });

    test('renders Success Probability title', () => {
      mockUseSuccessScore.mockReturnValue({
        data: makeSuccessScore(),
        isLoading: false,
        error: null,
      });

      render(<SuccessScoreBreakdown caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Success Probability')).toBeInTheDocument();
    });
  });

  describe('compact variant', () => {
    test('renders score percentage in compact mode', () => {
      mockUseSuccessScore.mockReturnValue({
        data: makeSuccessScore({ overallScore: 68 }),
        isLoading: false,
        error: null,
      });

      render(<SuccessScoreBreakdown caseId="case-1" variant="compact" />, {
        wrapper: createWrapper(),
      });
      expect(screen.getByText('68%')).toBeInTheDocument();
    });

    test('compact variant starts collapsed and can be expanded', () => {
      mockUseSuccessScore.mockReturnValue({
        data: makeSuccessScore({
          overallScore: 68,
          factors: [makeFactor({ name: 'Document Quality', score: 75 })],
        }),
        isLoading: false,
        error: null,
      });

      render(<SuccessScoreBreakdown caseId="case-1" variant="compact" />, {
        wrapper: createWrapper(),
      });

      // Compact starts collapsed (isExpanded defaults to false for compact)
      expect(screen.queryByText('Document Quality')).not.toBeInTheDocument();

      // Click to expand
      fireEvent.click(screen.getByText('68%'));
      expect(screen.getByText('Document Quality')).toBeInTheDocument();
    });
  });

  describe('score gauge', () => {
    test('renders score value in gauge', () => {
      mockUseSuccessScore.mockReturnValue({
        data: makeSuccessScore({ overallScore: 55 }),
        isLoading: false,
        error: null,
      });

      render(<SuccessScoreBreakdown caseId="case-1" />, { wrapper: createWrapper() });
      // The ScoreGauge renders the numeric score inside it
      expect(screen.getByText('55')).toBeInTheDocument();
    });
  });
});
