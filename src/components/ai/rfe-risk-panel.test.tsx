import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RFERiskPanel } from './rfe-risk-panel';
import type { RFEAssessmentResult } from '@/lib/ai/rfe/types';

// Mock logger (avoids circular dependency with crypto)
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
const mockUseRFEAssessment = vi.fn();
vi.mock('@/hooks/use-rfe-assessment', () => ({
  useRFEAssessment: (...args: unknown[]) => mockUseRFEAssessment(...args),
  getRFERiskInfo: (riskLevel: string) => {
    switch (riskLevel) {
      case 'low':
        return { label: 'Low RFE Risk', color: 'text-success', bgColor: 'bg-success/10' };
      case 'medium':
        return { label: 'Medium RFE Risk', color: 'text-warning', bgColor: 'bg-warning/10' };
      case 'high':
        return { label: 'High RFE Risk', color: 'text-orange-600', bgColor: 'bg-orange-600/10' };
      case 'critical':
        return { label: 'Critical RFE Risk', color: 'text-destructive', bgColor: 'bg-destructive/10' };
      default:
        return { label: 'Unknown', color: 'text-muted-foreground', bgColor: 'bg-muted' };
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

function makeAssessment(overrides: Partial<RFEAssessmentResult> = {}): RFEAssessmentResult {
  return {
    caseId: 'case-1',
    visaType: 'H-1B',
    rfeRiskScore: 25,
    riskLevel: 'low',
    estimatedRFEProbability: 0.15,
    triggeredRules: [],
    safeRuleIds: ['rule-1', 'rule-2'],
    priorityActions: [],
    dataConfidence: 0.8,
    assessedAt: new Date().toISOString(),
    assessmentVersion: '1.0.0',
    ...overrides,
  };
}

describe('RFERiskPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    test('renders loading indicator when data is loading', () => {
      mockUseRFEAssessment.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      render(<RFERiskPanel caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Assessing RFE risk')).toBeInTheDocument();
    });
  });

  describe('error / degraded state', () => {
    test('renders degraded fallback when there is an error', () => {
      mockUseRFEAssessment.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Network error'),
      });

      render(<RFERiskPanel caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('RFE Risk Assessment')).toBeInTheDocument();
      expect(screen.getByText('Upload documents to see RFE risk analysis.')).toBeInTheDocument();
    });

    test('renders degraded fallback when data is null', () => {
      mockUseRFEAssessment.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      render(<RFERiskPanel caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Upload documents to see RFE risk analysis.')).toBeInTheDocument();
    });

    test('renders degraded fallback when data has degraded flag', () => {
      mockUseRFEAssessment.mockReturnValue({
        data: { ...makeAssessment(), degraded: true },
        isLoading: false,
        error: null,
      });

      render(<RFERiskPanel caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Upload documents to see RFE risk analysis.')).toBeInTheDocument();
    });
  });

  describe('mini variant', () => {
    test('renders risk badge only for mini variant', () => {
      mockUseRFEAssessment.mockReturnValue({
        data: makeAssessment({ riskLevel: 'low' }),
        isLoading: false,
        error: null,
      });

      render(<RFERiskPanel caseId="case-1" variant="mini" />, { wrapper: createWrapper() });
      expect(screen.getByText('Low RFE Risk')).toBeInTheDocument();
    });

    test('renders correct badge for high risk in mini variant', () => {
      mockUseRFEAssessment.mockReturnValue({
        data: makeAssessment({ riskLevel: 'high' }),
        isLoading: false,
        error: null,
      });

      render(<RFERiskPanel caseId="case-1" variant="mini" />, { wrapper: createWrapper() });
      expect(screen.getByText('High RFE Risk')).toBeInTheDocument();
    });
  });

  describe('compact variant', () => {
    test('renders risk score gauge and risk factor count', () => {
      mockUseRFEAssessment.mockReturnValue({
        data: makeAssessment({
          rfeRiskScore: 45,
          riskLevel: 'medium',
          triggeredRules: [
            {
              ruleId: 'r-1',
              severity: 'medium',
              category: 'document_presence',
              title: 'Missing I-20',
              description: 'I-20 is required',
              recommendation: 'Upload I-20',
              evidence: ['No I-20 found'],
              confidence: 0.9,
            },
          ],
        }),
        isLoading: false,
        error: null,
      });

      render(<RFERiskPanel caseId="case-1" variant="compact" />, { wrapper: createWrapper() });
      expect(screen.getByText('Medium RFE Risk')).toBeInTheDocument();
      expect(screen.getByText('1 risk factor(s) found')).toBeInTheDocument();
      expect(screen.getByText('45')).toBeInTheDocument();
    });

    test('shows 0 risk factors when none triggered', () => {
      mockUseRFEAssessment.mockReturnValue({
        data: makeAssessment({ triggeredRules: [] }),
        isLoading: false,
        error: null,
      });

      render(<RFERiskPanel caseId="case-1" variant="compact" />, { wrapper: createWrapper() });
      expect(screen.getByText('0 risk factor(s) found')).toBeInTheDocument();
    });
  });

  describe('full variant', () => {
    test('renders risk score, badge, and no risk factors message', () => {
      mockUseRFEAssessment.mockReturnValue({
        data: makeAssessment({ rfeRiskScore: 10, riskLevel: 'low', triggeredRules: [] }),
        isLoading: false,
        error: null,
      });

      render(<RFERiskPanel caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Low RFE Risk')).toBeInTheDocument();
      expect(screen.getByText('No RFE risk factors detected')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });

    test('renders triggered rules list', () => {
      mockUseRFEAssessment.mockReturnValue({
        data: makeAssessment({
          rfeRiskScore: 65,
          riskLevel: 'high',
          triggeredRules: [
            {
              ruleId: 'r-1',
              severity: 'critical',
              category: 'document_presence',
              title: 'Missing Passport',
              description: 'Passport is required',
              recommendation: 'Upload a valid passport copy',
              evidence: ['No passport found in uploads'],
              confidence: 0.95,
            },
            {
              ruleId: 'r-2',
              severity: 'medium',
              category: 'form_consistency',
              title: 'Form Mismatch',
              description: 'Names do not match',
              recommendation: 'Verify names across forms',
              evidence: ['Petitioner name differs between I-130 and I-485'],
              confidence: 0.8,
            },
          ],
        }),
        isLoading: false,
        error: null,
      });

      render(<RFERiskPanel caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Risk Factors')).toBeInTheDocument();
      expect(screen.getByText('Missing Passport')).toBeInTheDocument();
      expect(screen.getByText('Form Mismatch')).toBeInTheDocument();
      expect(screen.getByText('critical')).toBeInTheDocument();
      expect(screen.getByText('medium')).toBeInTheDocument();
      expect(screen.getByText('2 risk factor(s) identified')).toBeInTheDocument();
    });

    test('expands triggered rule to show evidence and recommendation on click', () => {
      mockUseRFEAssessment.mockReturnValue({
        data: makeAssessment({
          rfeRiskScore: 50,
          riskLevel: 'medium',
          triggeredRules: [
            {
              ruleId: 'r-1',
              severity: 'high',
              category: 'document_presence',
              title: 'Missing Tax Returns',
              description: 'Tax returns needed',
              recommendation: 'Upload last 3 years of tax returns',
              evidence: ['No tax return documents found', 'Financial evidence incomplete'],
              confidence: 0.85,
            },
          ],
        }),
        isLoading: false,
        error: null,
      });

      render(<RFERiskPanel caseId="case-1" />, { wrapper: createWrapper() });

      // Evidence should not be visible initially
      expect(screen.queryByText('No tax return documents found')).not.toBeInTheDocument();

      // Click to expand
      fireEvent.click(screen.getByText('Missing Tax Returns'));

      // Now evidence and recommendation should be visible
      expect(screen.getByText('No tax return documents found')).toBeInTheDocument();
      expect(screen.getByText('Financial evidence incomplete')).toBeInTheDocument();
      expect(screen.getByText(/Upload last 3 years of tax returns/)).toBeInTheDocument();
    });

    test('renders priority actions when present', () => {
      mockUseRFEAssessment.mockReturnValue({
        data: makeAssessment({
          rfeRiskScore: 70,
          riskLevel: 'high',
          priorityActions: [
            'Upload missing passport copy',
            'Review form I-130 for consistency',
          ],
        }),
        isLoading: false,
        error: null,
      });

      render(<RFERiskPanel caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Priority Actions')).toBeInTheDocument();
      expect(screen.getByText('Upload missing passport copy')).toBeInTheDocument();
      expect(screen.getByText('Review form I-130 for consistency')).toBeInTheDocument();
    });

    test('does not render priority actions section when empty', () => {
      mockUseRFEAssessment.mockReturnValue({
        data: makeAssessment({ priorityActions: [] }),
        isLoading: false,
        error: null,
      });

      render(<RFERiskPanel caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.queryByText('Priority Actions')).not.toBeInTheDocument();
    });
  });

  describe('risk level rendering', () => {
    const riskLevels = [
      { level: 'low', label: 'Low RFE Risk' },
      { level: 'medium', label: 'Medium RFE Risk' },
      { level: 'high', label: 'High RFE Risk' },
      { level: 'critical', label: 'Critical RFE Risk' },
    ] as const;

    riskLevels.forEach(({ level, label }) => {
      test(`renders ${level} risk level correctly in full variant`, () => {
        mockUseRFEAssessment.mockReturnValue({
          data: makeAssessment({ riskLevel: level }),
          isLoading: false,
          error: null,
        });

        render(<RFERiskPanel caseId="case-1" />, { wrapper: createWrapper() });
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });
  });
});
